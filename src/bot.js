import 'dotenv/config';
import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import OpenAI from 'openai';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import {
  aiSystemPrompt,
  brand,
  fitAdvice,
  gameCopy,
  liveMessages,
  quotes,
  routines,
  styleProfiles
} from './content.js';
import {
  addBalance,
  adminGiveAura,
  adminGiveAuraForDrop,
  adminRevertGiveAura,
  adminGrantBadge,
  adminGrantItem,
  adminAuditUser,
  adminSetBalance,
  adminSetChestAccess,
  adminSetCasinoRestriction,
  adminSetSafeMode,
  adminSetLevel,
  adminTakeAura,
  applyBankInterest,
  applyFine,
  applyTaxes,
  awardActionXp,
  buyShopItem,
  canSpend,
  claimDaily,
  claimBeginnerBonus,
  claimTimedReward,
  craftCollectible,
  depositAura,
  getBalance,
  getCreditProfile,
  getGameRequestSettings,
  getProfile,
  getTransactions,
  getProgressDashboard,
  levelUnlocks,
  leaderboard,
  markWelcomeSeen,
  markCasinoPlayed,
  openBestChest,
  prestige,
  prepareCasinoEntry,
  recordGame,
  recycleCollectible,
  revertExceededDailyChestPurchases,
  refundReservedCasinoBet,
  salvageCollectible,
  sellInventoryItem,
  settleCasinoGame,
  setGameRequests,
  shopItems,
  spendBalance,
  transferAura,
  upgradeWorldBusiness,
  withdrawAura,
  buyLoanInsurance,
  buyPrime,
  performActivity,
  performRob,
  isEconomyFrozen,
  payLoan,
  getPrimeProfile,
  refundPrimeLoss,
  takeLoan,
  getCasinoCooldown,
  getWorldEvent,
  getWorldProfile,
  buyWorldBusiness,
  buyWorldProperty,
  buyWorldVehicle,
  chooseWorldJob,
  collectWorldIncome,
  exploreWorld,
  runDailyAdventure,
  runWorldMission,
  worldBusinesses,
  worldJobs,
  worldMaps,
  worldProperties,
  worldVehicles,
  xpNeeded
  ,addRestriction, removeRestriction, listRestrictions, checkRestriction
} from './economy.js';
import * as moderation from './moderation.js';
import { requiredEnv } from './env.js';
import { hashScore, pick, progressBar } from './utils.js';
import { renderCasinoCard, renderLeaderboardImage, renderProfileCard, renderRobberyCard, renderTransactionCard, renderTransferCard } from './canvas-renderer.js';
import { initPartyStore, getParty, getPartyByUser, createParty, joinParty, leaveParty, formatPartyEmbed } from './party.js';
import { ensureSupabaseHealth } from './db/supabase.js';
import {
  deleteAuraDrop as deleteAuraDropStore,
  loadAuraDrop as loadAuraDropStore,
  loadAuraDrops as loadAuraDropsStore,
  loadLiveLeaderboardState as loadLiveLeaderboardStateStore,
  loadUiEmotes as loadUiEmotesStore,
  saveAuraDrop as saveAuraDropStore,
  saveLiveLeaderboardState as saveLiveLeaderboardStateStore,
  saveUiEmotes as saveUiEmotesStore
} from './db/app-state-store.js';
import {
  applyMoggerAction,
  applyMoggerStack,
  buildMoggerPanelPayload,
  buildMoggerPublicPayload,
  buildMoggerStackModal,
  initializeMoggerSession,
  isMoggerImageAttachment,
  loadMoggerSession,
  loadMoggerVoteCount,
  parseMoggerStackInput,
  publishMoggerSession,
  saveMoggerSession,
  updateMoggerVote
} from './mogger.js';

const {
  DISCORD_TOKEN,
  OPENAI_API_KEY,
  OPENAI_MODEL = 'gpt-5.6-luna',
  AI_CHANNEL_ID,
  AI_REPLY_TO_MENTIONS = 'true',
  ENABLE_MESSAGE_CONTENT = 'false'
} = process.env;

const discordToken = requiredEnv('DISCORD_TOKEN');

const aiFeaturesEnabled = true;
const openai = aiFeaturesEnabled && OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const aiReplyHistory = new Map();
const aiConversationHistory = new Map();
const auraGiftHistory = new Map();
const auraGiftCooldownMs = 6 * 60 * 60 * 1000; // 6 hours
const pendingAdminGiftReverts = new Map();
const adminGrantCancelWindowMs = 60 * 1000;
const aiReplyLimit = 1000;
const pendingDuels = new Map();
const pendingDiceBattles = new Map();
const pendingQuickDraws = new Map();
const activeHeists = new Map();
const activeDrops = new Map();
const activeDropTimers = new Map();
const pendingDropClaims = new Set();
const activeCasinoSessions = new Map();
const activeCasinoUserSessions = new Map();
const pendingUiEmojiCaptures = new Map();
const expiringGameTimers = new Map();
const activeParties = new Map();
const pendingEconomyActions = new Map();
const pendingMentionGifts = new Map();
let liveLeaderboardContext = null;
let liveLeaderboardRefreshTimer = null;
let liveLeaderboardRefreshInFlight = false;
const liveLeaderboardTitle = 'Canlı Aura Lider Tablosu';
const adminUserIds = new Set(['1220194387867205743', '386421496463097857']);
const liveLeaderboardChannelId = '1517641666486472956';
const botLockPath = join(process.cwd(), 'data', 'bot.lock');
const liveLeaderboardRefreshMs = 10 * 1000;
const dayMs = 24 * 60 * 60 * 1000;
const dropCancelGraceMs = 2 * 60 * 1000;
const uiEmojiCaptureTtlMs = 2 * 60 * 1000;
const gameRequestTtlMs = 30 * 1000;
const gameRequestTickMs = 5 * 1000;
let uiEmotes = {};

function assertNoOtherOctosonProcess() {
  // The old bot version did not create bot.lock, so a legacy process can still be
  // running after an update. Two Octoson processes each keep their own economy
  // cache and can overwrite each other's balances. Detect that before login.
  try {
    const rows = execSync('ps -axo pid=,command=', { encoding: 'utf8' })
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const projectRoot = process.cwd();
    const otherBots = rows.filter(line => {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (!match) return false;
      const pid = Number(match[1]);
      const command = match[2];
      if (pid === process.pid || !Number.isInteger(pid)) return false;
      if (!/\bnode\b/.test(command)) return false;
      if (!/(^|\s)(?:\.\/)?src\/bot\.js(?:\s|$)/.test(command) && !command.includes(`${projectRoot}/src/bot.js`)) return false;
      return true;
    });

    if (otherBots.length) {
      console.error('\nFATAL: Another Octoson bot process is already running.');
      console.error('Running two copies causes wallet/bank values to jump back to stale balances.');
      console.error('Stop the old process first, then start Octoson again.');
      console.error('Detected:');
      for (const row of otherBots) console.error(`  ${row}`);
      console.error('\nQuick fix on macOS:');
      console.error("  pkill -f 'node src/bot.js'");
      console.error('  npm start\n');
      process.exit(1);
    }
  } catch (error) {
    // If `ps` is unavailable, the lock-file protection below still works for
    // all versions containing this patch.
    if (error?.status === 1) throw error;
  }
}

function acquireBotLock() {
  mkdir(dirname(botLockPath), { recursive: true }).catch(() => {});

  try {
    const fd = openSync(botLockPath, 'wx');
    writeFileSync(fd, `${process.pid}\n`);
    closeSync(fd);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;

    const existingPid = Number(readFileSync(botLockPath, 'utf8').trim());
    if (Number.isInteger(existingPid) && existingPid > 0 && processIsAlive(existingPid)) {
      console.error(`Another Octoson bot process is already running with PID ${existingPid}. Stop it before starting a new one.`);
      process.exit(1);
    }

    unlinkSync(botLockPath);
    const fd = openSync(botLockPath, 'wx');
    writeFileSync(fd, `${process.pid}\n`);
    closeSync(fd);
  }

  const release = () => {
    try {
      const existingPid = Number(readFileSync(botLockPath, 'utf8').trim());
      if (existingPid === process.pid) unlinkSync(botLockPath);
    } catch {}
  };

  process.once('exit', release);
  process.once('SIGINT', () => {
    release();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    release();
    process.exit(143);
  });
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

assertNoOtherOctosonProcess();
acquireBotLock();

const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];

if (ENABLE_MESSAGE_CONTENT === 'true') {
  intents.push(GatewayIntentBits.MessageContent);
}

const client = new Client({ intents });

client.once(Events.ClientReady, async readyClient => {
  console.log('');
  console.log('==========================================');
  console.log('[STARTUP] Discord ClientReady fired');
  console.log(`[STARTUP] Logged in as ${readyClient.user.tag}`);
  console.log(`[STARTUP] Bot ID: ${readyClient.user.id}`);
  console.log(`[STARTUP] Guilds: ${readyClient.guilds.cache.size}`);
  console.log('==========================================');
  console.log('');

  try {
    console.log('[STARTUP] Checking Supabase...');

    await ensureSupabaseHealth();

    console.log('[STARTUP] Supabase OK');
    console.log('[STARTUP] Continuing ClientReady initialization...');

    async function handleModal(interaction) {

      if (
  interaction.customId.startsWith(
    'mention_gift_amount:'
  )
) {
  await handleMentionGiftAmountModal(interaction);
  return;
}

      if (interaction.customId.startsWith('casino_cashout:')) {
        await handleCrashCashoutModal(interaction);
        return;
      }

      if (interaction.customId.startsWith('mogger_stack:')) {
        await handleMoggerModal(interaction);
        return;
      }

      if (interaction.customId === 'prime_refund_modal') {
        await handlePrimeRefundModal(interaction);
        return;
      }

      if (interaction.customId !== 'style_modal') {
        if (interaction.customId.startsWith('mod_modal:')) {
          await handleModModal(interaction);
        }
        return;
      }

      const outfit = interaction.fields.getTextInputValue('outfit');
      const goal = interaction.fields.getTextInputValue('goal');
      const concern = interaction.fields.getTextInputValue('concern') || 'ümumi balans';
      const profile = inferStyleProfile(goal, outfit);
      const focus = fitAdvice[hashScore(`${outfit}:${goal}`, fitAdvice.length)];
      await awardActionXp(interaction.user.id, 10);

      const embed = baseEmbed()
        .setTitle('Tərz yoxlanışı')
        .setDescription(outfit)
        .addFields(
          { name: 'Məqsəd', value: goal, inline: true },
          { name: 'Fokus', value: concern, inline: true },
          { name: profile.label, value: `${profile.note}\nRənglər: ${profile.colors}` },
          { name: focus.title, value: focus.text },
          { name: 'Düzəliş', value: buildStyleSuggestion(outfit, concern, profile) }
        );

      await interaction.reply({
        embeds: [embed],
        components: [singleButtonRow('panel_style', 'Yenidən yoxla', ButtonStyle.Primary)]
      });
    }

    async function handleMoggerButton(interaction) {
      if (interaction.customId.startsWith('mogger_vote:')) {
        await handleMoggerVoteButton(interaction);
        return;
      }

      const [, action, sessionId, ownerId] = interaction.customId.split(':');
      const session = await loadMoggerSession(sessionId);

      if (!session) {
        await interaction.reply({
          content: 'Mogger sessiyası tapılmadı. `/mogger` ilə yenidən aç.',
          ephemeral: true
        });
        return;
      }

      if (ownerId !== interaction.user.id) {
        await interaction.reply({
          content: 'Bu Looks Lab paneli başqa üzvə aiddir.',
          ephemeral: true
        });
        return;
      }

      if (action === 'stack') {
        if (session.status === 'closed') {
          await interaction.reply({
            content: 'Bu sessiya artıq bağlanıb. Yeni panel açmaq üçün yenidən `/mogger` yaz.',
            ephemeral: true
          });
          return;
        }

        await interaction.showModal(buildMoggerStackModal(session));
        return;
      }

      if (action === 'share' && (!interaction.channel || typeof interaction.channel.send !== 'function')) {
        await interaction.reply({
          content: 'Bu kanalda public paylaşım göndərmək olmur.',
          ephemeral: true
        });
        return;
      }

      await interaction.deferUpdate();

      try {
        if (action === 'compare') {
          const voteCount = await loadMoggerVoteCount(session.sessionId);
          const payload = await buildMoggerPanelPayload({
            session,
            analysis: session.analysis ?? {},
            voteCount,
            mode: 'compare'
          });
          await interaction.editReply(payload);
          return;
        }

        if (action === 'share') {
          const voteCount = await loadMoggerVoteCount(session.sessionId);
          if (session.isPublic && session.shareChannelId && session.shareMessageId) {
            await saveMoggerSession({
              ...session,
              isPublic: true,
              updatedAt: Date.now()
            });
          } else {
            await publishMoggerSession({
              session,
              channel: interaction.channel,
              voteCount,
              analysis: session.analysis ?? {}
            });
          }

          const updatedSession = await loadMoggerSession(session.sessionId);
          const privatePayload = await buildMoggerPanelPayload({
            session: updatedSession,
            analysis: updatedSession.analysis ?? session.analysis ?? {},
            voteCount,
            mode: updatedSession.lastMode ?? session.lastMode ?? 'analysis'
          });
          await interaction.editReply(privatePayload);
          await refreshMoggerPublicMessage(interaction.client, updatedSession, updatedSession.analysis ?? session.analysis ?? {}, voteCount);
          return;
        }

        if (action === 'reset') {
          const updatedSession = await saveMoggerSession({
            ...session,
            stack: [],
            lastMode: 'analysis',
            history: [
              ...(session.history ?? []),
              {
                kind: 'reset',
                createdAt: Date.now(),
                mode: 'reset',
                summary: 'Stack reset.'
              }
            ],
            updatedAt: Date.now()
          });

          const voteCount = await loadMoggerVoteCount(session.sessionId);
          const payload = await buildMoggerPanelPayload({
            session: updatedSession,
            analysis: updatedSession.analysis ?? {},
            voteCount,
            mode: 'analysis'
          });
          await interaction.editReply(payload);
          await refreshMoggerPublicMessage(interaction.client, updatedSession, updatedSession.analysis ?? session.analysis ?? {}, voteCount);
          return;
        }

        if (action === 'close') {
          const updatedSession = await saveMoggerSession({
            ...session,
            status: 'closed',
            history: [
              ...(session.history ?? []),
              {
                kind: 'closed',
                createdAt: Date.now(),
                mode: 'close',
                summary: 'Private panel closed.'
              }
            ],
            updatedAt: Date.now()
          });

          const voteCount = await loadMoggerVoteCount(session.sessionId);
          const payload = await buildMoggerPanelPayload({
            session: updatedSession,
            analysis: updatedSession.analysis ?? {},
            voteCount,
            mode: 'close'
          });
          await interaction.editReply(payload);
          await refreshMoggerPublicMessage(interaction.client, updatedSession, updatedSession.analysis ?? session.analysis ?? {}, voteCount);
          return;
        }

        if (['hair', 'grooming', 'camera', 'style'].includes(action)) {
          const result = await applyMoggerAction({
            openai,
            model: OPENAI_MODEL,
            session,
            action
          });

          const voteCount = await loadMoggerVoteCount(result.session.sessionId);
          const payload = await buildMoggerPanelPayload({
            session: result.session,
            analysis: result.analysis,
            voteCount,
            mode: action
          });
          await interaction.editReply(payload);
          await refreshMoggerPublicMessage(interaction.client, result.session, result.analysis, voteCount);
          return;
        }

        await interaction.editReply({
          content: 'Naməlum Mogger əməliyyatı.',
          components: []
        });
      } catch (error) {
        console.error('Mogger button handling failed:', error);
        await interaction.editReply({
          content: 'Mogger panelində dəyişiklik alınmadı. Yenidən cəhd et.',
          components: []
        });
      }
    }

    async function handleMoggerVoteButton(interaction) {
      const sessionId = interaction.customId.replace('mogger_vote:', '');
      const session = await loadMoggerSession(sessionId);

      if (!session || !session.isPublic) {
        await interaction.reply({
          content: 'Bu Looks Lab paylaşımı artıq public deyil.',
          ephemeral: true
        });
        return;
      }

      await interaction.deferUpdate();

      try {
        await updateMoggerVote(session.sessionId, interaction.user.id, 1);
        const voteCount = await loadMoggerVoteCount(session.sessionId);
        const payload = await buildMoggerPublicPayload({
          session,
          analysis: session.analysis ?? {},
          voteCount,
          mode: session.lastMode ?? 'analysis'
        });

        await interaction.editReply(payload);
        await interaction.followUp({
          content: 'Səsiniz qeydə alındı.',
          ephemeral: true
        }).catch(() => {});
      } catch (error) {
        console.error('Mogger vote failed:', error);
        await interaction.followUp({
          content: 'Səs qeyd edilə bilmədi.',
          ephemeral: true
        }).catch(() => {});
      }
    }

    async function handleMoggerModal(interaction) {
      const [, sessionId, ownerId] = interaction.customId.split(':');
      const session = await loadMoggerSession(sessionId);

      if (!session) {
        await interaction.reply({
          content: 'Mogger sessiyası tapılmadı.',
          ephemeral: true
        });
        return;
      }

      if (ownerId !== interaction.user.id) {
        await interaction.reply({
          content: 'Bu modal başqa üzv üçün açılıb.',
          ephemeral: true
        });
        return;
      }

      const stepsText = interaction.fields.getTextInputValue('steps');
      const note = interaction.fields.getTextInputValue('note') ?? '';
      const steps = parseMoggerStackInput(stepsText);

      if (!steps.length) {
        await interaction.reply({
          content: 'Stack üçün azı bir etibarlı addım yaz: hair, grooming, camera, style.',
          ephemeral: true
        });
        return;
      }

      await deferInteractionResponse(interaction, { ephemeral: true });

      try {
        const result = await applyMoggerStack({
          openai,
          model: OPENAI_MODEL,
          session,
          steps,
          note
        });

        const voteCount = await loadMoggerVoteCount(result.session.sessionId);
        const payload = await buildMoggerPanelPayload({
          session: result.session,
          analysis: result.analysis,
          voteCount,
          mode: 'stack'
        });

        await interaction.editReply(payload);
        await refreshMoggerPublicMessage(interaction.client, result.session, result.analysis, voteCount);
      } catch (error) {
        console.error('Mogger modal handling failed:', error);
        await interaction.editReply({
          content: 'Stack tətbiq edilə bilmədi. Yenidən cəhd et.',
          ephemeral: true
        });
      }
    }

  async function refreshMoggerPublicMessage(client, session, analysis, voteCount) {
    if (!session?.isPublic || !session.shareChannelId || !session.shareMessageId) {
      return;
    }

    const channel = await client.channels.fetch(session.shareChannelId).catch(() => null);

  if (!channel?.messages?.fetch) {
    return;
  }

  const message = await channel.messages.fetch(session.shareMessageId).catch(() => null);
  if (!message) {
    return;
  }

  const payload = await buildMoggerPublicPayload({
    session,
    analysis: analysis ?? session.analysis ?? {},
    voteCount,
    mode: session.lastMode ?? 'analysis'
  });

  await message.edit(payload).catch(() => {});
}

async function sendProfileHelp(interaction) {
  const user = interaction.options.getUser('user') ?? interaction.user;
  await deferInteractionResponse(interaction, { ephemeral: user.id === interaction.user.id });
  const profile = await getProfile(user.id);

  await interaction.reply(await profilePayload(user, profile, {
    components: user.id === interaction.user.id ? [quickActionRow()] : [],
    ephemeral: user.id === interaction.user.id
  }));
}

async function handleUserCommand(interaction) {
  const targetUser = interaction.options.getUser('user');
  if (!targetUser) {
    await interaction.reply({ content: 'Üzv seçin.', ephemeral: true });
    return;
  }

  // permission: require ManageGuild or admin list
  const member = interaction.member;
  const hasManage = interaction.memberPermissions?.has?.('ModerateMembers') || interaction.memberPermissions?.has?.('BanMembers');
  if (!hasManage && !isAdmin(interaction.user.id)) {
    await interaction.reply({ content: 'Bu paneli açmaq üçün icazəniz yoxdur.', ephemeral: true });
    return;
  }

  const profile = await getProfile(targetUser.id).catch(() => null);
  const guildMember = interaction.guild ? await interaction.guild.members.fetch(targetUser.id).catch(() => null) : null;

  const embed = baseEmbed()
    .setTitle(`👤 ${displayUserName(guildMember ?? targetUser)}`)
    .setDescription(`${targetUser}`)
    .addFields(
      { name: 'Balans', value: `${profile ? formatNumber(profile.balance) + ' Aura' : '—'}`, inline: true },
      { name: 'Bank', value: `${profile ? formatNumber(profile.bank) + ' Aura' : '—'}`, inline: true },
      { name: 'Rank', value: `${profile ? profile.rank : '—'}`, inline: true }
    )
    .setFooter({ text: `Opened by ${interaction.user.tag}` });

  const ownerId = interaction.user.id;
  const ts = Date.now().toString(36).slice(-6);

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`modpanel:warn:${ownerId}:${targetUser.id}:${ts}`).setLabel('Warn').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`modpanel:timeout:${ownerId}:${targetUser.id}:${ts}`).setLabel('Timeout').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`modpanel:ban:${ownerId}:${targetUser.id}:${ts}`).setLabel('Ban').setStyle(ButtonStyle.Danger)
  );

  const secondRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`modpanel:notes:${ownerId}:${targetUser.id}:${ts}`).setLabel('Notes').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`modpanel:dm:${ownerId}:${targetUser.id}:${ts}`).setLabel('DM').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`modpanel:economy:${ownerId}:${targetUser.id}:${ts}`).setLabel('Economy').setStyle(ButtonStyle.Primary)
  );

  await interaction.reply({ embeds: [embed], components: [actionRow, secondRow], ephemeral: true });
}

async function sendAiAnswer(interaction) {
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({ content: 'Bu AI komanda yalnız admin üçün açıqdır.', ephemeral: true });
    return;
  }

  const question = interaction.options.getString('question');

  if (!openai) {
    await interaction.reply({
      content: 'AI cavabları hazırda söndürülüb.',
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply();
  const { answer } = await askOpenAI(question, interaction.user.username);

  await interaction.editReply({
    embeds: [
      baseEmbed()
        .setTitle('Qısa cavab')
        .setDescription(answer)
    ]
  });
}

async function sendLivePanel(interaction) {
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({ content: 'TikTok live/reminder panelini yalnız admin yarada bilər.', ephemeral: true });
    return;
  }

  const link = interaction.options.getString('link');
  const topic = interaction.options.getString('topic') ?? 'Söhbət və community sualları';

  const embed = baseEmbed()
    .setColor(brand.accent)
    .setTitle('Canlı Yayın')
    .setDescription(pick(liveMessages))
    .addFields(
      { name: 'Mövzu', value: topic },
      { name: 'Link', value: link ?? 'Link hazır olanda bu mesaja əlavə edilə bilər.' },
      { name: 'Xatırlatma', value: 'Sualı qısa yazın, mövzunu qarışdırmayın, şəxsi hücum etməyin.' }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('live_question')
      .setLabel('Sual formatı')
      .setStyle(ButtonStyle.Secondary)
  );

  if (link) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Yayına keç')
        .setStyle(ButtonStyle.Link)
        .setURL(link)
    );
  }

  await interaction.reply({
    content: '@here',
    embeds: [embed],
    components: [row],
    allowedMentions: { parse: ['everyone'] }
  });
}


async function handleMoggerCommand(interaction) {
  const attachment = interaction.options.getAttachment('image');
  const targetUser = interaction.options.getUser('user') ?? null;

  if (!attachment) {
    await interaction.reply({
      content: 'Şəkil əlavə etməlisən.',
      ephemeral: true
    });
    return;
  }

  if (!isMoggerImageAttachment(attachment)) {
    await interaction.reply({
      content: 'Bu fayl uyğun şəkil deyil. JPG, PNG və ya WEBP şəkil göndər.',
      ephemeral: true
    });
    return;
  }

  if (!openai) {
    await interaction.reply({
      content: 'Mogger AI hazırda aktiv deyil.',
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply({
    ephemeral: true
  });

  try {
    const result = await initializeMoggerSession({
      openai,
      model: OPENAI_MODEL,
      owner: interaction.user,
      attachment,
      targetUser
    });

    const voteCount = await loadMoggerVoteCount(
      result.session.sessionId
    ).catch(() => 0);

    const payload = await buildMoggerPanelPayload({
      session: result.session,
      analysis: result.analysis,
      voteCount,
      mode: 'analysis'
    });

    await interaction.editReply(payload);
  } catch (error) {
    console.error('[MOGGER] Failed to initialize session:', error);

    if (error?.code === 'invalid_mogger_image') {
      await interaction.editReply({
        content: 'Bu fayl uyğun şəkil deyil. JPG, PNG və ya WEBP istifadə et.',
        embeds: [],
        components: []
      });
      return;
    }

    await interaction.editReply({
      content: 'Mogger analizi zamanı xəta baş verdi. Bir az sonra yenidən yoxla.',
      embeds: [],
      components: []
    });
  }
}

 
async function handleGameCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'menu') {
    await sendGameMenu(interaction);
    return;
  }

  if (subcommand === 'balance') {
    await sendBalance(interaction);
    return;
  }

  if (subcommand === 'daily') {
    await sendDaily(interaction);
    return;
  }

  if (subcommand === 'slots') {
    await playSlots(interaction);
    return;
  }

  if (subcommand === 'risk') {
    await playRisk(interaction);
    return;
  }

  if (subcommand === 'duel') {
    await createDuel(interaction);
    return;
  }

  if (subcommand === 'party') {
    await handlePartyCommand(interaction);
    return;
  }

  if (subcommand === 'leaderboard') {
    await sendLeaderboard(interaction);
    return;
  }

  if (subcommand === 'prestige') {
    await sendPrestige(interaction);
  }
}

async function handlePartyCommand(interaction) {
  const action = interaction.commandName === 'party'
    ? interaction.options.getSubcommand()
    : interaction.options.getString('action');
  const partyId = interaction.options.getString('party_id');
  const userId = interaction.user.id;
  const username = interaction.user.username;

  if (action === 'create') {
    const existing = getPartyByUser(userId);
    if (existing) {
      await interaction.reply({ content: `Sən artıq party içindəsən: **${existing.id}**. Əvvəl çıx və sonra yenisini yarat.`, ephemeral: true });
      return;
    }

    const party = createParty(userId, username);
    await interaction.reply({ embeds: [partyStatusEmbed('🎉 Party yaradıldı', party)], components: [partyRow(party.id)], ephemeral: true });
    return;
  }

  if (action === 'join') {
    if (!partyId) {
      await interaction.reply({ content: 'Qoşulmaq üçün party ID qeyd et.', ephemeral: true });
      return;
    }
    const party = getParty(partyId);
    if (!party) {
      await interaction.reply({ content: 'Bu party tapılmadı.', ephemeral: true });
      return;
    }
    const existing = getPartyByUser(userId);
    if (existing && existing.id !== partyId) {
      await interaction.reply({ content: `Sən artıq başqa party içindəsən: **${existing.id}**. Əvvəl ora çıx.`, ephemeral: true });
      return;
    }
    const joined = joinParty(partyId, userId, username);
    if (!joined) {
      await interaction.reply({ content: 'Party doludur və ya əlçatmazdır.', ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [partyStatusEmbed('✅ Party-yə qoşuldun', party)], components: [partyRow(party.id)], ephemeral: true });
    return;
  }

  if (action === 'leave') {
    const party = leaveParty(userId);
    if (!party) {
      await interaction.reply({ content: 'Sən heç bir party içində deyilsən.', ephemeral: true });
      return;
    }
    await interaction.reply({ content: `Party **${party.id}**-dən çıxdın.`, ephemeral: true });
    return;
  }

  if (action === 'status') {
    const party = getPartyByUser(userId);
    if (!party) {
      await interaction.reply({ content: 'Sən heç bir party içində deyilsən.', ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [partyStatusEmbed('🎉 Party Status', party)], components: [partyRow(party.id)], ephemeral: true });
    return;
  }

  await interaction.reply({ content: 'Action: create/join/leave/status seç.', ephemeral: true });
}

async function handlePartyButtonJoin(interaction, partyId) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const existing = getPartyByUser(userId);
  const party = getParty(partyId);

  if (!party) {
    await interaction.reply({ content: 'Bu party tapılmadı.', ephemeral: true });
    return;
  }

  if (existing && existing.id !== partyId) {
    await interaction.reply({ content: `Sən artıq başqa party içindəsən: **${existing.id}**. Əvvəl ora çıx.`, ephemeral: true });
    return;
  }

  const joined = joinParty(partyId, userId, username);
  if (!joined) {
    await interaction.reply({ content: 'Party doludur və ya əlçatmazdır.', ephemeral: true });
    return;
  }

  await interaction.reply({ embeds: [partyStatusEmbed('✅ Party-yə qoşuldun', party)], components: [partyRow(party.id)], ephemeral: true });
}

async function handlePartyButtonStatus(interaction, partyId) {
  const party = getParty(partyId);
  if (!party) {
    await interaction.reply({ content: 'Bu party tapılmadı.', ephemeral: true });
    return;
  }

  await interaction.reply({ embeds: [partyStatusEmbed('🎉 Party Status', party)], components: [partyRow(party.id)], ephemeral: true });
}

async function handlePartyButtonLeave(interaction) {
  const party = leaveParty(interaction.user.id);
  if (!party) {
    await interaction.reply({ content: 'Sən heç bir party içində deyilsən.', ephemeral: true });
    return;
  }

  await interaction.reply({ content: `Party **${party.id}**-dən çıxdın.`, ephemeral: true });
}

async function handlePartyButtonCreate(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const existing = getPartyByUser(userId);

  if (existing) {
    await interaction.reply({ content: `Sən artıq party içindəsən: **${existing.id}**. Əvvəl çıx və sonra yenisini yarat.`, ephemeral: true });
    return;
  }

  const party = createParty(userId, username);
  await interaction.reply({ embeds: [partyStatusEmbed('🎉 Party yaradıldı', party)], components: [partyRow(party.id)], ephemeral: true });
}

async function handlePartyButtonStatusByUser(interaction) {
  const party = getPartyByUser(interaction.user.id);

  if (!party) {
    await interaction.reply({ content: 'Sən heç bir party içində deyilsən.', ephemeral: true });
    return;
  }

  await handlePartyButtonStatus(interaction, party.id);
}

function partyStatusEmbed(title, party) {
  const embed = gameEmbed()
    .setTitle(title)
    .setDescription(`Party ID: **${party.id}**`);

  return embed.addFields(...formatPartyEmbed(party).fields);
}

async function handleWalletCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'balance') {
    await sendBalance(interaction);
    return;
  }

  if (subcommand === 'bank') {
    const profile = await getProfile(interaction.user.id);
    await interaction.reply({ embeds: [walletEmbed(profile)] });
    return;
  }

  if (subcommand === 'deposit') {
    const amount = interaction.options.getInteger('amount');
    const result = await depositAura(interaction.user.id, amount);
    const moved = result.moved ?? 0;
    if (result.ok) scheduleLiveLeaderboardRefresh();
    await interaction.reply(await transactionPayload(
      result.ok ? 'Bank yatırımı tamamlandı' : result.reason === 'bank_restricted' ? 'Bank hesabı dondurulub' : 'Balans kifayət deyil',
      result.profile,
      result.ok
        ? `+${moved} Aura bank hesabına keçdi. Wallet: ${formatNumber(result.walletBefore)} → ${formatNumber(result.walletAfter)} • Bank: ${formatNumber(result.bankBefore)} → ${formatNumber(result.bankAfter)}`
        : result.reason === 'bank_restricted'
          ? 'Moderasiya tərəfindən bank əməliyyatları müvəqqəti dondurulub.'
          : `${amount} Aura yatırmaq üçün wallet balansın çatmır.`,
      { ephemeral: !result.ok, amount: result.ok ? moved : null, kind: result.ok ? 'bank' : 'error' }
    ));
    return;
  }

  if (subcommand === 'withdraw') {
    const amount = interaction.options.getInteger('amount');
    const result = await withdrawAura(interaction.user.id, amount);
    const moved = result.moved ?? 0;
    if (result.ok) scheduleLiveLeaderboardRefresh();
    await interaction.reply(await transactionPayload(
      result.ok ? 'Bankdan çıxarış tamamlandı' : (result.reason === 'loan_frozen' || result.reason === 'bank_restricted') ? 'Bank hesabı dondurulub' : 'Bank balansı kifayət deyil',
      result.profile,
      result.ok
        ? `${moved} Aura wallet balansına keçdi. Bank: ${formatNumber(result.bankBefore)} → ${formatNumber(result.bankAfter)} • Wallet: ${formatNumber(result.walletBefore)} → ${formatNumber(result.walletAfter)}`
        : result.reason === 'loan_frozen'
          ? 'Aktiv borc vaxtı keçib. Əvvəl `/wallet payloan` ilə borcu bağla.'
          : result.reason === 'bank_restricted'
            ? 'Moderasiya tərəfindən bank əməliyyatları müvəqqəti dondurulub.'
            : `${amount} Aura çıxarmaq üçün bank balansın çatmır.`,
      { ephemeral: !result.ok, amount: result.ok ? moved : null, kind: result.ok ? 'bank' : 'error' }
    ));
    return;
  }

  if (subcommand === 'transfer' || subcommand === 'gift') {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (target.bot || target.id === interaction.user.id) {
      await interaction.reply({ content: 'Real başqa üzv seç.', ephemeral: true });
      return;
    }

    const result = await transferAura(interaction.user.id, target.id, amount, subcommand);
    if (result.ok) scheduleLiveLeaderboardRefresh();
    await interaction.reply(await transferPayload(
      result.ok ? (subcommand === 'gift' ? 'Aura hədiyyəsi göndərildi' : 'Aura transferi tamamlandı') : transferFailureTitle(result.reason),
      result.from,
      result.to,
      interaction.user,
      target,
      result.ok ? `${primeMention(interaction.user, result.from)} -> ${primeMention(target, result.to)}: **${amount} Aura**` : transferFailureMessage(result, amount),
      { allowedMentions: { users: [target.id] }, ephemeral: !result.ok, amount: result.ok ? amount : null, kind: result.ok ? subcommand : 'error' }
    ));
    return;
  }

  if (subcommand === 'loan') {
    const credit = await getCreditProfile(interaction.user.id);
    await interaction.reply({
      embeds: [loanCenterEmbed(credit)],
      components: loanRows(credit),
      ephemeral: true
    });
    return;
  }

  if (subcommand === 'prime') {
    const prime = await getPrimeProfile(interaction.user.id);
    await interaction.reply({
      embeds: [primeEmbed(prime)],
      components: primeRows(prime),
      ephemeral: true
    });
    return;
  }

  if (subcommand === 'credit') {
    await interaction.reply({ embeds: [creditProfileEmbed(await getCreditProfile(interaction.user.id))], ephemeral: true });
    return;
  }

  if (subcommand === 'payloan') {
    const credit = await getCreditProfile(interaction.user.id);
    const amount = interaction.options.getInteger('amount') ?? credit.active?.remaining ?? 0;
    const result = await payLoan(interaction.user.id, amount);
    await interaction.reply({
      embeds: [loanPaymentEmbed(result, interaction.user)],
      ephemeral: !result.ok
    });
    return;
  }

  if (subcommand === 'helploan') {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (target.bot || target.id === interaction.user.id) {
      await interaction.reply({ content: 'Real başqa üzv seç.', ephemeral: true });
      return;
    }

    const result = await payLoan(target.id, amount, interaction.user.id);
    await interaction.reply({
      embeds: [loanHelpEmbed(result, interaction.user, target)],
      allowedMentions: { users: [target.id] },
      ephemeral: !result.ok
    });
    return;
  }

  if (subcommand === 'insurance') {
    const result = await buyLoanInsurance(interaction.user.id);
    await interaction.reply({
      embeds: [loanInsuranceEmbed(result)],
      ephemeral: !result.ok
    });
    return;
  }

  if (subcommand === 'history' || subcommand === 'transactions') {
    await sendTransactions(interaction);
    return;
  }

  if (subcommand === 'interest') {
    const result = await applyBankInterest(interaction.user.id);
    await interaction.reply(await transactionPayload(
      result.claimed ? 'Bank faizi götürüldü' : 'Faiz artıq götürülüb',
      result.profile,
      result.claimed ? `+${result.reward} Aura bank hesabına əlavə olundu.` : 'Gündəlik bank faizini sabah yenidən götür.',
      { ephemeral: !result.claimed, amount: result.claimed ? result.reward : null, kind: result.claimed ? 'bank' : 'error' }
    ));
    return;
  }

  if (subcommand === 'taxes') {
    const result = await applyTaxes(interaction.user.id);
    await interaction.reply(await transactionPayload(
      result.charged ? 'Vergi hesablandı' : 'Vergi artıq hesablanıb',
      result.profile,
      result.amount > 0 ? `-${result.amount} Aura varlılıq vergisi tutuldu.` : 'Bu gün vergi tutulmadı. 10000 Aura altı qorunur.',
      { ephemeral: true, amount: result.amount > 0 ? -result.amount : null, kind: 'bank' }
    ));
  }
}

async function handleEarnCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'daily') {
    await sendDaily(interaction);
    return;
  }

  if (subcommand === 'weekly' || subcommand === 'monthly') {
    const result = await claimTimedReward(interaction.user.id, subcommand);
    await interaction.reply({
      ...(await transactionPayload(
        result.claimed ? `${subcommand} mükafatı götürüldü` : 'Mükafat artıq götürülüb',
        result.profile,
        result.claimed ? `+${result.reward} Aura və açarlar hesabına yazıldı.` : 'Bu mükafatı növbəti dövrdə yenidən götürə bilərsən.',
        { ephemeral: !result.claimed, amount: result.claimed ? result.reward : null, kind: result.claimed ? 'reward' : 'error' }
      )),
      components: result.claimed ? gameRows(interaction.user.id) : [],
      ephemeral: !result.claimed
    });
    return;
  }

  if (subcommand === 'rewards') {
    await interaction.reply({ embeds: [rewardsEmbed(await getProfile(interaction.user.id))], ephemeral: true });
    return;
  }

  if (subcommand === 'bonus') {
    await sendBeginnerBonus(interaction);
    return;
  }

  if (subcommand === 'rob') {
    await handleRobCommand(interaction);
    return;
  }

  const result = await performActivity(interaction.user.id, subcommand);
  if (!result.ok) {
    await interaction.reply({
      embeds: [gameEmbed().setTitle(`${result.config.label} cooldown`).setDescription(`Bu işi yenidən etmək üçün **${formatDuration(result.remainingMs)}** gözlə.`)],
      ephemeral: true
    });
    return;
  }

  await interaction.reply({
    embeds: [
      gameEmbed()
        .setTitle(`${result.config.label} nəticəsi`)
        .setDescription(result.success ? 'Missiya uğurlu oldu.' : 'Missiya alınmadı və cərimə gəldi.')
        .addFields(
          { name: 'Nəticə', value: result.amount >= 0 ? `+${result.amount} ${gameCopy.currency}` : `${result.amount} ${gameCopy.currency}`, inline: true },
          { name: 'Balans', value: `${result.profile.balance} ${gameCopy.currency}`, inline: true },
          { name: 'XP', value: xpLine(result.profile), inline: false }
        )
    ]
  });
}

async function handleInventoryCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'profile') {
    await interaction.reply(await profilePayload(interaction.user, await getProfile(interaction.user.id), { components: [quickActionRow()] }));
    return;
  }

  if (subcommand === 'items') {
    await interaction.reply({ embeds: [inventoryEmbed(await getProfile(interaction.user.id))], ephemeral: true });
    return;
  }

  if (subcommand === 'shop') {
    await interaction.reply({ embeds: [shopEmbed()], ephemeral: true });
    return;
  }

  if (subcommand === 'buy') {
    const result = await buyShopItem(interaction.user.id, interaction.options.getString('item'));
    await interaction.reply(await transactionPayload(
      shopBuyTitle(result, 'Əşya alındı'),
      result.profile,
      shopBuyDescription(result, 'Mağaza əşyasını yenidən seç.'),
      { ephemeral: true, amount: result.ok && result.item ? -result.item.price : null, kind: result.ok ? 'market' : 'error' }
    ));
    return;
  }

  if (subcommand === 'sell') {
    const result = await sellInventoryItem(interaction.user.id, interaction.options.getString('item'));
    await interaction.reply(await transactionPayload(
      result.ok ? 'Əşya satıldı' : 'Əşya tapılmadı',
      result.profile,
      result.ok ? `${result.sold} satıldı: +${result.reward} Aura` : 'Collectible adını inventardan olduğu kimi yaz.',
      { ephemeral: true, amount: result.ok ? result.reward : null, kind: result.ok ? 'market' : 'error' }
    ));
    return;
  }

  if (subcommand === 'open') {
    const result = await openBestChest(interaction.user.id);
    await interaction.reply(await transactionPayload(
      chestOpenTitle(result),
      result.profile,
      chestOpenDescription(result, true),
      { ephemeral: !result.ok, amount: result.ok ? result.reward : null, kind: result.ok ? 'reward' : 'error' }
    ));
    return;
  }

  if (subcommand === 'craft') {
    const result = await craftCollectible(interaction.user.id);
    await interaction.reply(await transactionPayload(result.ok ? 'Craft tamamlandı' : 'Material çatmır', result.profile, result.ok ? `Yeni titul: **${result.title}**` : 'Craft üçün 3 collectible lazımdır.', { ephemeral: true, kind: result.ok ? 'market' : 'error' }));
    return;
  }

  if (subcommand === 'recycle') {
    const result = await recycleCollectible(interaction.user.id);
    await interaction.reply(await transactionPayload(result.ok ? 'Recycle tamamlandı' : 'Collectible yoxdur', result.profile, result.ok ? `${result.item}: +${result.reward} Aura` : 'Recycle üçün collectible lazımdır.', { ephemeral: true, amount: result.ok ? result.reward : null, kind: result.ok ? 'market' : 'error' }));
    return;
  }

  if (subcommand === 'salvage') {
    const result = await salvageCollectible(interaction.user.id);
    await interaction.reply(await transactionPayload(result.ok ? 'Salvage tamamlandı' : 'Collectible yoxdur', result.profile, result.ok ? `${result.item} parçalandı: +1 açar` : 'Salvage üçün collectible lazımdır.', { ephemeral: true, kind: result.ok ? 'market' : 'error' }));
    return;
  }

  const profile = await getProfile(interaction.user.id);
  const embeds = {
    achievements: listEmbed('Nailiyyətlər', profile.achievements),
    badges: listEmbed('Nişanlar', [...profile.badges, ...profile.inventory.badges]),
    titles: listEmbed('Titullar', profile.inventory.titles),
    statistics: statisticsEmbed(profile),
    settings: settingsEmbed(profile)
  };
  await interaction.reply({ embeds: [embeds[subcommand]], ephemeral: true });
}

async function handleCasinoCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  await playCasinoRound(interaction, subcommand);
}

async function handleQuestCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'board') {
    await interaction.reply({ embeds: [missionsEmbed()], components: mainMenuRows(interaction.user.id, 'missions'), ephemeral: true });
    return;
  }

  if (subcommand === 'daily') {
    await sendDaily(interaction);
    return;
  }

  if (subcommand === 'weekly' || subcommand === 'monthly') {
    const result = await claimTimedReward(interaction.user.id, subcommand);
    await interaction.reply(await transactionPayload(
      result.claimed ? `${subcommand} quest tamamlandı` : 'Quest artıq tamamlanıb',
      result.profile,
      result.claimed ? `+${result.reward} Aura, XP və açar mükafatı verildi.` : 'Bu dövr üçün quest mükafatını artıq götürmüsən.',
      { ephemeral: !result.claimed, amount: result.claimed ? result.reward : null, kind: result.claimed ? 'reward' : 'error' }
    ));
    return;
  }

  if (subcommand === 'progress') {
    await interaction.reply({ embeds: [rewardsEmbed(await getProfile(interaction.user.id))], ephemeral: true });
    return;
  }

  if (subcommand === 'milestones') {
    await interaction.reply({ embeds: [milestonesEmbed(await getProfile(interaction.user.id))], ephemeral: true });
    return;
  }

  await runActivityCommand(interaction, subcommand);
}

async function handleMarketCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'shop' || subcommand === 'prices') {
    await interaction.reply({ embeds: [shopEmbed()], ephemeral: true });
    return;
  }

  if (subcommand === 'inventory') {
    await interaction.reply({ embeds: [inventoryEmbed(await getProfile(interaction.user.id))], ephemeral: true });
    return;
  }

  if (subcommand === 'auction' || subcommand === 'trade' || subcommand === 'listings') {
    await interaction.reply({ embeds: [marketBoardEmbed(subcommand)], ephemeral: true });
    return;
  }

  if (subcommand === 'buy') {
    const result = await buyShopItem(interaction.user.id, interaction.options.getString('item'));
    await interaction.reply(await transactionPayload(
      shopBuyTitle(result, 'Market alış-verişi tamamlandı'),
      result.profile,
      shopBuyDescription(result, 'Əşyanı kataloqdan seç.'),
      { ephemeral: true, amount: result.ok && result.item ? -result.item.price : null, kind: result.ok ? 'market' : 'error' }
    ));
    return;
  }

  if (subcommand === 'sell') {
    const result = await sellInventoryItem(interaction.user.id, interaction.options.getString('item'));
    await interaction.reply(await transactionPayload(
      result.ok ? 'Market satışı tamamlandı' : 'Əşya tapılmadı',
      result.profile,
      result.ok ? `${result.sold}: +${result.reward} Aura` : 'Satmaq üçün collectible adını inventardan yaz.',
      { ephemeral: true, amount: result.ok ? result.reward : null, kind: result.ok ? 'market' : 'error' }
    ));
    return;
  }

  const actions = {
    open: openBestChest,
    craft: craftCollectible,
    recycle: recycleCollectible,
    salvage: salvageCollectible
  };

  if (!actions[subcommand]) {
    await interaction.reply({
      content: 'Bu market əməliyyatı hələ aktiv deyil. `/market shop`, `/market open`, `/market craft`, `/market recycle` və ya `/market salvage` istifadə et.',
      ephemeral: true
    });
    return;
  }

  const result = await actions[subcommand](interaction.user.id);
  const notes = {
    open: chestOpenDescription(result, false),
    craft: result.ok ? `Yeni titul: ${result.title}` : 'Craft üçün 3 collectible lazımdır.',
    recycle: result.ok ? `${result.item}: +${result.reward} Aura` : 'Recycle üçün collectible lazımdır.',
    salvage: result.ok ? `${result.item}: +1 açar` : 'Salvage üçün collectible lazımdır.'
  };
  await interaction.reply(await transactionPayload(
    subcommand === 'open' ? chestOpenTitle(result) : result.ok ? 'Market əməliyyatı tamamlandı' : 'Market əməliyyatı alınmadı',
    result.profile,
    notes[subcommand],
    { ephemeral: !result.ok, kind: result.ok ? 'market' : 'error' }
  ));
}

async function handleProgressCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const profile = await getProfile(interaction.user.id);

  if (subcommand === 'profile') {
    await interaction.reply(await profilePayload(interaction.user, profile, { components: [quickActionRow()] }));
    return;
  }

  if (subcommand === 'season') {
    const dashboard = await getProgressDashboard(interaction.user.id);
    await interaction.reply({ embeds: [seasonEmbed(dashboard.season, dashboard.profile)], ephemeral: true });
    return;
  }

  if (subcommand === 'goals') {
    const dashboard = await getProgressDashboard(interaction.user.id);
    await interaction.reply({ embeds: [goalsEmbed(dashboard.goals, dashboard.profile, dashboard.objectiveRewards)], ephemeral: true });
    return;
  }

  if (subcommand === 'collection') {
    const dashboard = await getProgressDashboard(interaction.user.id);
    await interaction.reply({ embeds: [collectionBookEmbed(dashboard.collections)], ephemeral: true });
    return;
  }

  if (subcommand === 'level' || subcommand === 'rank') {
    await interaction.reply({ embeds: [progressEmbed(profile)], ephemeral: true });
    return;
  }

  if (subcommand === 'richest' || subcommand === 'leaderboard') {
    await sendLeaderboard(interaction);
    return;
  }

  if (subcommand === 'statistics') {
    await interaction.reply({ embeds: [statisticsEmbed(profile)], ephemeral: true });
    return;
  }

  if (subcommand === 'achievements') {
    await interaction.reply({ embeds: [listEmbed('Nailiyyətlər', profile.achievements)], ephemeral: true });
    return;
  }

  if (subcommand === 'badges') {
    await interaction.reply({ embeds: [listEmbed('Nişanlar', [...profile.badges, ...profile.inventory.badges])], ephemeral: true });
    return;
  }

  if (subcommand === 'titles') {
    await interaction.reply({ embeds: [listEmbed('Titullar', profile.inventory.titles)], ephemeral: true });
    return;
  }

  if (subcommand === 'prestige') {
    await sendPrestige(interaction);
    return;
  }

  if (subcommand === 'history') {
    await sendTransactions(interaction);
    return;
  }

  await interaction.reply({ embeds: [settingsEmbed(profile)], ephemeral: true });
}

async function handleSocialCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'profile') {
    const user = interaction.options.getUser('user') ?? interaction.user;
    await interaction.reply(await profilePayload(user, await getProfile(user.id), { ephemeral: user.id === interaction.user.id }));
    return;
  }

  if (subcommand === 'gift' || subcommand === 'transfer') {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (target.bot || target.id === interaction.user.id) {
      await interaction.reply({ content: 'Real başqa üzv seç.', ephemeral: true });
      return;
    }

    const result = await transferAura(interaction.user.id, target.id, amount, `social_${subcommand}`);
    await interaction.reply(await transferPayload(
      result.ok ? (subcommand === 'gift' ? 'Aura hədiyyəsi göndərildi' : 'Aura transferi tamamlandı') : transferFailureTitle(result.reason),
      result.from,
      result.to,
      interaction.user,
      target,
      result.ok ? `${primeMention(interaction.user, result.from)} -> ${primeMention(target, result.to)}: **${amount} Aura**` : transferFailureMessage(result, amount),
      { allowedMentions: { users: [target.id] }, ephemeral: !result.ok, amount: result.ok ? amount : null, kind: result.ok ? subcommand : 'error' }
    ));
    return;
  }

  if (subcommand === 'rob') {
    await handleRobCommand(interaction);
    return;
  }

  if (subcommand === 'duel') {
    await createDuel(interaction);
    return;
  }

  if (subcommand === 'dicebattle') {
    await createDiceBattle(interaction);
    return;
  }

  if (subcommand === 'quickdraw') {
    await createQuickDraw(interaction);
    return;
  }

  if (subcommand === 'heist') {
    await createHeist(interaction);
    return;
  }

  if (subcommand === 'gamerequests') {
    await handleGameRequestsSetting(interaction);
    return;
  }

  if (subcommand === 'compare') {
    const target = interaction.options.getUser('user');
    await interaction.reply({ embeds: [compareEmbed(interaction.user, await getProfile(interaction.user.id), target, await getProfile(target.id))] });
    return;
  }

  if (subcommand === 'leaderboard' || subcommand === 'richest') {
    await sendLeaderboard(interaction);
    return;
  }

  const profile = await getProfile(interaction.user.id);
  const embeds = {
    reputation: socialStatsEmbed(profile),
    badges: listEmbed('Community nişanları', [...profile.badges, ...profile.inventory.badges]),
    stats: statisticsEmbed(profile)
  };
  await interaction.reply({ embeds: [embeds[subcommand]], ephemeral: true });
}

async function handleWorldCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'profile') {
    const result = await getWorldProfile(interaction.user.id);
    await interaction.reply({ embeds: [worldProfileEmbed(interaction.user, result.profile, result.world)] });
    return;
  }

  if (subcommand === 'jobs') {
    await interaction.reply({ embeds: [worldCatalogEmbed('💼 Aura İşləri', worldJobs, item => `${formatNumber(item.salary)} Aura baza maaşı • XP ${item.xp}`, 'job')], ephemeral: true });
    return;
  }

  if (subcommand === 'job') {
    const result = await chooseWorldJob(interaction.user.id, interaction.options.getString('type'));
    await interaction.reply({
      embeds: [worldActionEmbed(result.ok ? 'İş seçildi' : 'İş tapılmadı', result.profile, result.world)
        .setDescription(result.ok ? `${result.job.emoji} **${result.job.name}** işi aktiv edildi. İndi \`/world mission\` ilə qazanc başlada bilərsən.` : 'Bu job botda tapılmadı.')]
    });
    return;
  }

  if (subcommand === 'mission') {
    const result = await runWorldMission(interaction.user.id, interaction.options.getString('choice'));
    if (!result.ok) {
      await interaction.reply({ embeds: [worldFailureEmbed(result, 'Missiya hazır deyil')], ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [worldMissionEmbed(interaction.user, result)] });
    return;
  }

  if (subcommand === 'businesses') {
    await interaction.reply({ embeds: [worldCatalogEmbed('🏪 Bizneslər', worldBusinesses, item => `${formatNumber(item.price)} Aura • saatlıq gəlir ${formatNumber(item.income)} Aura`, 'business')], ephemeral: true });
    return;
  }

  if (subcommand === 'buybusiness') {
    const result = await buyWorldBusiness(interaction.user.id, interaction.options.getString('type'));
    await interaction.reply({ embeds: [worldPurchaseEmbed(result, 'Biznes alındı')] });
    return;
  }

  if (subcommand === 'upgradebusiness') {
    const result = await upgradeWorldBusiness(interaction.user.id, interaction.options.getString('type'));
    await interaction.reply({ embeds: [worldBusinessUpgradeEmbed(result)] });
    return;
  }

  if (subcommand === 'property') {
    const result = await buyWorldProperty(interaction.user.id, interaction.options.getString('type'));
    await interaction.reply({ embeds: [worldPurchaseEmbed(result, 'Əmlak alındı')] });
    return;
  }

  if (subcommand === 'vehicle') {
    const result = await buyWorldVehicle(interaction.user.id, interaction.options.getString('type'));
    await interaction.reply({ embeds: [worldPurchaseEmbed(result, 'Nəqliyyat alındı')] });
    return;
  }

  if (subcommand === 'collect') {
    const result = await collectWorldIncome(interaction.user.id);
    if (!result.ok) {
      await interaction.reply({ embeds: [worldFailureEmbed(result, 'Gəlir hazır deyil')], ephemeral: true });
      return;
    }
    await interaction.reply({
      embeds: [worldActionEmbed('🏦 Gəlir toplandı', result.profile, result.world, 'income')
        .setColor(brand.success)
        .addFields(
          { name: 'Gəlir', value: `+${formatNumber(result.amount)} ${gameCopy.currency}`, inline: true },
          { name: 'Bazar dalğası', value: `${Math.round(result.marketPulse * 100)}%`, inline: true },
          { name: 'Balans', value: `${formatNumber(result.profile.balance)} ${gameCopy.currency}`, inline: true }
        )]
    });
    return;
  }

  if (subcommand === 'adventure') {
    const result = await runDailyAdventure(interaction.user.id, interaction.options.getString('choice'));
    if (!result.ok) {
      await interaction.reply({ embeds: [worldFailureEmbed(result, 'Macəra artıq edildi')], ephemeral: true });
      return;
    }
    await interaction.reply({
      embeds: [worldActionEmbed(result.success ? '🌟 Macəra uğurlu oldu' : '⚠️ Macəra pis bitdi', result.profile, result.world, 'adventure')
        .setColor(result.success ? brand.success : 0xc53030)
        .setDescription(result.config.label)
        .addFields(
          { name: 'Nəticə', value: `${result.amount >= 0 ? '+' : ''}${formatNumber(result.amount)} ${gameCopy.currency}`, inline: true },
          { name: 'Balans', value: `${formatNumber(result.profile.balance)} ${gameCopy.currency}`, inline: true },
          { name: 'Nüfuz', value: `${formatNumber(result.world.influence)}`, inline: true }
        )]
    });
    return;
  }

  if (subcommand === 'explore') {
    const result = await exploreWorld(interaction.user.id, interaction.options.getString('map'));
    if (!result.ok) {
      await interaction.reply({ embeds: [worldFailureEmbed(result, 'Explore hazır deyil')], ephemeral: true });
      return;
    }
    await interaction.reply({
      embeds: [worldActionEmbed(result.success ? `${result.map.emoji} Kəşf uğurlu oldu` : `${result.map.emoji} Kəşf təhlükəli bitdi`, result.profile, result.world, 'explore')
        .setColor(result.success ? brand.success : 0xc53030)
        .addFields(
          { name: 'Xəritə', value: result.map.name, inline: true },
          { name: 'Nəticə', value: `${result.amount >= 0 ? '+' : ''}${formatNumber(result.amount)} ${gameCopy.currency}`, inline: true },
          { name: 'Qənimət', value: result.success ? result.loot : 'Qənimət itdi', inline: true },
          { name: 'Ziyarət', value: `${formatNumber(result.visits)} dəfə`, inline: true },
          { name: 'Balans', value: `${formatNumber(result.profile.balance)} ${gameCopy.currency}`, inline: true }
        )]
    });
    return;
  }

  if (subcommand === 'event') {
    const result = await getWorldEvent(interaction.user.id);
    await interaction.reply({
      embeds: [worldActionEmbed(`${result.event.emoji} ${result.event.name}`, result.profile, result.world, 'event')
        .setDescription(result.event.description)
        .addFields({ name: 'Üstünlük', value: result.event.bonus, inline: true })]
    });
    return;
  }

  if (subcommand === 'influence') {
    const result = await getWorldProfile(interaction.user.id);
    await interaction.reply({
      embeds: [worldActionEmbed('🌐 Aura nüfuzu', result.profile, result.world, 'influence')
        .setDescription(worldInfluenceLabel(result.world.influence))
        .addFields(
          { name: 'Nüfuz', value: formatNumber(result.world.influence), inline: true },
          { name: 'Mövsüm xalı', value: formatNumber(result.world.seasonPoints), inline: true },
          { name: 'Ümumi dəyər', value: `${formatNumber(result.world.netWorth)} Aura`, inline: true }
        )]
    });
  }
}

function worldProfileEmbed(user, profile, world) {
  const job = world.job ? worldJobs[world.job] : null;
  const businesses = ownedWorldList(world.businesses, worldBusinesses);
  const properties = ownedWorldList(world.properties, worldProperties);
  const vehicles = world.vehicles.map(key => worldVehicles[key]).filter(Boolean).map(item => `${item.emoji} ${item.name}`).join(', ');
  const nextJobXp = 120 + (world.jobLevel - 1) * 55;

  return markPrimeEmbed(gameEmbed(), user, profile)
    .setTitle(`🌍 ${primeDisplayName(user, profile)} dünya profili`)
    .setThumbnail(worldImageUrl('world'))
    .setDescription(worldInfluenceLabel(world.influence))
    .addFields(
      { name: '💼 İş', value: job ? `${job.emoji} ${job.name}\nSəviyyə ${world.jobLevel} • ${formatNumber(world.jobXp)}/${formatNumber(nextJobXp)} XP` : '`/world jobs` ilə iş seç.', inline: true },
      { name: '🌐 Nüfuz', value: `${formatNumber(world.influence)}\nMövsüm: ${formatNumber(world.seasonPoints)} xal`, inline: true },
      { name: '💎 Ümumi dəyər', value: `${formatNumber(world.netWorth)} Aura`, inline: true },
      { name: '🏪 Bizneslər', value: businesses || 'Hələ biznes yoxdur.', inline: false },
      { name: '🏠 Əmlak', value: properties || 'Hələ əmlak yoxdur.', inline: false },
      { name: '🚗 Nəqliyyat', value: vehicles || 'Hələ nəqliyyat yoxdur.', inline: false },
      
    );
}

function worldActionEmbed(title, profile, world, visual = 'world') {
  return markPrimeEmbed(gameEmbed(), null, profile)
    .setTitle(title)
    .setThumbnail(worldImageUrl(visual))
    .addFields(
      { name: 'Balans', value: `${formatNumber(profile.balance)} ${gameCopy.currency}`, inline: true },
      { name: 'Nüfuz', value: formatNumber(world.influence), inline: true },
      { name: 'Mövsüm', value: `${formatNumber(world.seasonPoints)} xal`, inline: true }
    );
}

function worldMissionEmbed(user, result) {
  return markPrimeEmbed(gameEmbed(), user, result.profile)
    .setColor(result.success ? brand.success : 0xc53030)
    .setTitle(result.success ? '✅ İş missiyası uğurlu oldu' : '❌ İş missiyası alınmadı')
    .setThumbnail(worldImageUrl('mission'))
    .setDescription(`${result.job.emoji} **${result.job.name}** • ${result.style.label}${result.leveledJob ? '\nYeni job səviyyəsi açıldı.' : ''}`)
    .addFields(
      { name: 'Nəticə', value: `${result.amount >= 0 ? '+' : ''}${formatNumber(result.amount)} ${gameCopy.currency}`, inline: true },
      { name: 'Job səviyyəsi', value: `Lv.${result.world.jobLevel}`, inline: true },
      { name: 'Balans', value: `${formatNumber(result.profile.balance)} ${gameCopy.currency}`, inline: true },
      { name: 'XP', value: xpLine(result.profile), inline: false }
    );
}

function worldPurchaseEmbed(result, title) {
  const visual = title.includes('Əmlak') ? 'property' : title.includes('Nəqliyyat') ? 'vehicle' : 'business';
  const embed = worldActionEmbed(result.ok ? title : 'Alış alınmadı', result.profile, result.world, visual);
  if (!result.ok) {
    return embed
      .setColor(0xc53030)
      .setDescription(worldFailureText(result));
  }

  return embed
    .setColor(brand.success)
    .setDescription(`${result.item.emoji} **${result.item.name}** alındı.`)
    .addFields(
      { name: 'Qiymət', value: `${formatNumber(result.item.price)} ${gameCopy.currency}`, inline: true },
      { name: 'Üstünlük', value: result.item.income ? `Gəlir: ${formatNumber(result.item.income)} Aura` : `Gücləndirmə: ${Math.round((result.item.bonus ?? 0) * 100)}%`, inline: true }
    );
}

function worldFailureEmbed(result, title) {
  return gameEmbed()
    .setColor(0xc53030)
    .setTitle(title)
    .setThumbnail(worldImageUrl('warning'))
    .setDescription(worldFailureText(result))
    .addFields(
      { name: 'Balans', value: result.profile ? `${formatNumber(result.profile.balance)} ${gameCopy.currency}` : 'Bilinmir', inline: true },
      { name: 'Nüfuz', value: result.world ? formatNumber(result.world.influence) : '0', inline: true }
    );
}

function worldFailureText(result) {
  if (result.reason === 'cooldown') return `Yenidən istifadə üçün **${formatDuration(result.remainingMs)}** gözlə.`;
  if (result.reason === 'no_job') return 'Əvvəl `/world job` ilə iş seçməlisən.';
  if (result.reason === 'claimed') return 'Bugünkü macəranı artıq etmisən. Sabah yenidən açılacaq.';
  if (result.reason === 'no_assets') return 'Gəlir toplamaq üçün əvvəl biznes və ya əmlak almalısan.';
  if (result.reason === 'not_owned') return 'Bu biznes hələ səndə yoxdur. Əvvəl `/world buybusiness` ilə al.';
  if (result.reason === 'max_level') return 'Bu biznes artıq maksimum Lv.10 səviyyəsindədir.';
  if (result.reason === 'insufficient') return `Bu alış üçün kifayət qədər Aura yoxdur. Lazım olan: **${formatNumber(result.item?.price ?? 0)} Aura**.`;
  if (result.reason === 'owned') return 'Bu vehicle artıq səndə var.';
  return 'Bu əməliyyat alınmadı. Seçimi yenidən yoxla.';
}

function worldBusinessUpgradeEmbed(result) {
  const embed = worldActionEmbed(result.ok ? '🏪 Biznes upgrade edildi' : 'Upgrade alınmadı', result.profile, result.world, 'business');
  if (!result.ok) {
    return embed
      .setColor(0xc53030)
      .setDescription(worldFailureText(result));
  }

  return embed
    .setColor(brand.success)
    .setDescription(`${result.item.emoji} **${result.item.name}** artıq **Lv.${result.level}** oldu.`)
    .addFields(
      { name: 'Qiymət', value: `${formatNumber(result.price)} Aura`, inline: true },
      { name: 'Yeni gəlir', value: `${formatNumber(Math.floor(result.item.income * (1 + (result.level - 1) * 0.18)))} Aura / saat`, inline: true },
      { name: 'Məqsəd', value: 'Biznesi Lv.10-a qədər böyüdüb passiv gəliri artır.', inline: false }
    );
}

function worldCatalogEmbed(title, catalog, lineFactory, visual = 'world') {
  return gameEmbed()
    .setTitle(title)
    .setThumbnail(worldImageUrl(visual))
    .setDescription(Object.entries(catalog)
      .map(([key, item]) => `${item.emoji} **${item.name}**\n\`${key}\` • ${lineFactory(item)}`)
      .join('\n\n'));
}

function ownedWorldList(owned, catalog) {
  return Object.entries(owned)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => {
      const item = catalog[key];
      return item ? `${item.emoji} **${item.name}** x${count}` : `${key} x${count}`;
    })
    .join('\n');
}

function worldInfluenceLabel(influence) {
  if (influence >= 250) return '👑 Şəhərdə adın brend kimi tanınır.';
  if (influence >= 120) return '🌟 Güclü nüfuz: bizneslər və insanlar səni tanıyır.';
  if (influence >= 45) return '📈 Artan nüfuz: şəhərdə yerin formalaşır.';
  return '🌱 Başlanğıc nüfuz: iş, macəra və kəşf ilə böyüt.';
}

function seasonEmbed(season, profile) {
  const percent = season.level >= season.maxLevel ? 100 : Math.floor((season.xp / season.nextXp) * 100);
  return markPrimeEmbed(gameEmbed(), null, profile)
    .setTitle(`🌑 ${season.name}`)
    .setThumbnail(worldImageUrl('event'))
    .setDescription(`Mövsüm yalnız season progressini sıfırlayır, əsas Aura balansına toxunmur.\nBitməsinə **${season.daysLeft} gün** qalıb.`)
    .addFields(
      { name: 'Səviyyə', value: `Sv.${season.level}/${season.maxLevel}`, inline: true },
      { name: 'Mövsüm XP', value: `${progressBar(percent, 12)} ${formatNumber(season.xp)}/${formatNumber(season.nextXp)} (${percent}%)`, inline: false },
      { name: 'Final mükafat', value: season.finalReward, inline: false },
      { name: 'Mükafat xətti', value: season.rewards.map(row => `${row.unlocked ? '✅' : '🔒'} Sv.${row.level}: ${row.free} • Prime: ${row.prime}`).join('\n'), inline: false },
      { name: 'XP haradan gəlir?', value: 'Gündəlik, həftəlik, casino, PvP, dünya missiyası, macəra, kəşf və biznes upgrade.', inline: false }
    );
}

function goalsEmbed(goals, profile, rewards = []) {
  const dailyDone = goals.daily.filter(item => item.done).length;
  const weeklyDone = goals.weekly.filter(item => item.done).length;
  const embed = markPrimeEmbed(gameEmbed(), null, profile)
    .setTitle('🎯 Növbəti hədəflər')
    .setThumbnail(worldImageUrl('mission'))
    .setDescription(`Bu panel “indi nə edim?” sualının cavabıdır. Gündəlik: **${dailyDone}/${goals.daily.length}**, həftəlik: **${weeklyDone}/${goals.weekly.length}**.`)
    .addFields(
      { name: 'Gündəlik zəncir', value: goals.daily.map(goalLine).join('\n'), inline: false },
      { name: 'Həftəlik istiqamət', value: goals.weekly.map(goalLine).join('\n'), inline: false },
      { name: 'Mükafat necə alınır?', value: 'Bütün gündəlik hədəflər bitəndə həmin gün üçün bir dəfə **450 Aura + Gündəlik məqsəd sandığı** verilir. Həftəlik bonus tamamlananda **1,200 Aura + sandıq + açar** düşür.', inline: false },
      { name: 'Milestone izləyici', value: goals.milestones.join('\n'), inline: false }
    );

  if (rewards.length) {
    embed.addFields({
      name: '🎁 Yeni mükafat verildi',
      value: rewards.map(reward => `${reward.scope === 'daily' ? 'Gündəlik' : 'Həftəlik'} tamamlandı: **+${formatNumber(reward.aura)} Aura**, **${reward.chest}**${reward.keys ? `, **${reward.keys} açar**` : ''}.`).join('\n'),
      inline: false
    });
  }

  return embed;
}

function collectionBookEmbed(collections) {
  return gameEmbed()
    .setTitle('📚 Kolleksiya kitabı')
    .setThumbnail(worldImageUrl('explore'))
    .setDescription('Collectible-lar artıq sadəcə inventarda yatmır. Set tamamladıqca profil bonusu və cosmetic hədəfləri açılır.')
    .addFields(collections.map(set => ({
      name: `${set.emoji} ${set.name} • ${set.found.length}/${set.total}`,
      value: [
        `${progressBar(Math.floor((set.found.length / set.total) * 100), 10)} ${set.complete ? 'Tamamlandı' : 'Davam edir'}`,
        `Bonus: **${set.bonus}**`,
        `Tapılan: ${set.found.join(', ') || 'hələ yoxdur'}`,
        `Qalan: ${set.missing.slice(0, 5).join(', ') || 'yoxdur'}`
      ].join('\n'),
      inline: false
    })));
}

function auditEmbed(user, result) {
  const profile = result.profile;
  return gameEmbed()
    .setTitle(`🧾 Audit: ${user.globalName ?? user.username}`)
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: 'Balans', value: `${formatNumber(profile.balance)} Aura`, inline: true },
      { name: 'Bank', value: `${formatNumber(profile.bank)} Aura`, inline: true },
      { name: 'Level', value: `Sv.${profile.level} • ${formatNumber(profile.xp)} XP`, inline: true },
      { name: 'Prime', value: profile.prime?.activeUntil > Date.now() ? `aktiv • refund ${profile.prime.refundsRemaining}/6` : 'aktiv deyil', inline: true },
      { name: 'Kredit', value: profile.loan?.active ? `aktiv • qalan ${formatNumber(profile.loan.active.remaining)} Aura` : profile.loan?.frozen ? 'freeze aktivdir' : 'aktiv borc yoxdur', inline: true },
      { name: 'World', value: `Nüfuz ${formatNumber(profile.world?.influence ?? 0)} • ümumi dəyər ${formatNumber(profile.world?.netWorth ?? 0)} Aura`, inline: false },
      { name: 'Son transaction-lar', value: result.transactions.map(formatAuditTransaction).join('\n') || 'Transaction yoxdur.', inline: false },
      { name: 'Flag', value: result.flags.join('\n') || 'Açıq problem görünmür.', inline: false }
    );
}

async function handleAdminProfileButton(interaction) {
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({ content: 'Bu panel yalnız admin üçündür.', ephemeral: true });
    return;
  }

  const [, userId, category] = interaction.customId.split(':');
  const target = await interaction.client.users.fetch(userId).catch(() => ({ id: userId, username: userId, globalName: null, displayAvatarURL: () => null }));
  const result = await adminAuditUser(userId, category, 20);
  await interaction.update({
    embeds: [adminProfileEmbed(target, result)],
    components: adminProfileRows(userId, category)
  });
}

function adminProfileEmbed(user, result) {
  const profile = result.profile;
  const category = adminProfileCategories().find(item => item.id === result.category) ?? adminProfileCategories()[0];
  const transactions = result.transactions.map(formatAuditTransaction).join('\n') || 'Bu kateqoriyada transaction yoxdur.';
  return gameEmbed()
    .setTitle(`Admin profil: ${user.globalName ?? user.username}`)
    .setThumbnail(user.displayAvatarURL?.({ size: 128 }) ?? null)
    .setDescription(`Kateqoriya: **${category.label}**\nUser ID: \`${user.id}\``)
    .addFields(
      { name: 'Wallet', value: `Balans: **${formatNumber(profile.balance)} Aura**\nBank: **${formatNumber(profile.bank)} Aura**\nRank: **${profile.rank}**`, inline: true },
      { name: 'Progress', value: `Sv.${profile.level} • ${formatNumber(profile.xp)} XP\nPrestij: **${profile.prestige}**\nLuck: **${profile.luck}**`, inline: true },
      { name: 'Risk', value: `Kredit: ${profile.loan?.active ? `qalan ${formatNumber(profile.loan.active.remaining)}` : profile.loan?.frozen ? 'freeze' : 'yoxdur'}\nCasino cap: ${profile.moderation?.casinoMaxBet ?? 'yoxdur'}\nRobbed today: ${profile.limits?.robbedCount ?? 0}`, inline: true },
      { name: `${category.label} history`, value: fitDiscordField(transactions), inline: false },
      { name: 'Flags', value: result.flags.join('\n') || 'Açıq problem görünmür.', inline: false }
    );
}

function adminProfileRows(userId, activeCategory) {
  const buttons = adminProfileCategories().map(category => (
    new ButtonBuilder()
      .setCustomId(`admin_profile:${userId}:${category.id}`)
      .setLabel(category.label)
      .setStyle(category.id === activeCategory ? ButtonStyle.Primary : ButtonStyle.Secondary)
  ));
  return [
    new ActionRowBuilder().addComponents(buttons.slice(0, 5)),
    new ActionRowBuilder().addComponents(buttons.slice(5))
  ];
}

function adminProfileCategories() {
  return [
    { id: 'all', label: 'All' },
    { id: 'money', label: 'Money' },
    { id: 'casino', label: 'Casino' },
    { id: 'market', label: 'Market' },
    { id: 'social', label: 'Social' },
    { id: 'world', label: 'World' },
    { id: 'admin', label: 'Admin' }
  ];
}

function fitDiscordField(value) {
  return value.length > 1024 ? `${value.slice(0, 1000)}\n...` : value;
}

function goalLine(item) {
  return `${item.done ? '✅' : '⬜'} ${item.label} — **${formatNumber(item.current)}/${formatNumber(item.target)}**`;
}

function formatAuditTransaction(row) {
  const sign = row.amount > 0 ? '+' : '';
  return `\`${row.at.slice(11, 19)}\` ${sign}${formatNumber(row.amount)} • ${row.type} • ${row.note ?? '-'}`;
}

async function handleAdminCommand(interaction) {
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({ content: 'Bu komanda yalnız bot admini üçün açıqdır.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'drop') {
    await createAuraDrop(interaction);
    return;
  }

  if (subcommand === 'uiemoji') {
    await startUiEmojiCapture(interaction);
    return;
  }

  if (subcommand === 'chests') {
    const enabled = interaction.options.getBoolean('enabled');
    const settings = await adminSetChestAccess(enabled, interaction.user.id);
    await interaction.reply({
      embeds: [
        gameEmbed()
          .setTitle(enabled ? 'Sandıq sistemi açıldı' : 'Sandıq sistemi bağlandı')
          .setDescription(enabled
            ? 'Üzvlər yenə sandıq/açar ala və `/market open` ilə aça bilər.'
            : 'Üzvlər artıq sandıq/açar ala və `/market open` ilə aça bilməz.')
          .addFields(
            { name: 'Status', value: settings.chestsEnabled ? 'Aktiv' : 'Bağlı', inline: true },
            { name: 'Admin', value: `<@${interaction.user.id}>`, inline: true }
          )
      ],
      ephemeral: true
    });
    return;
  }

  if (subcommand === 'safemode') {
    const enabled = interaction.options.getBoolean('enabled');
    const settings = await adminSetSafeMode(enabled, interaction.user.id);
    await interaction.reply({
      embeds: [
        gameEmbed()
          .setTitle(enabled ? 'Safe mode açıldı' : 'Safe mode bağlandı')
          .setDescription(enabled
            ? 'Generated Aura gəlirləri azaldıldı: casino profit, daily/quest, işlər, world, sandıq reward və robbing artıq daha zəifdir.'
            : 'Economy reward-ları normal vəziyyətə qaytarıldı.')
          .addFields(
            { name: 'Status', value: settings.safeModeEnabled ? 'Aktiv' : 'Bağlı', inline: true },
            { name: 'Admin', value: `<@${interaction.user.id}>`, inline: true }
          )
      ],
      ephemeral: true
    });
    return;
  }

  if (subcommand === 'cleanup') {
    const scope = interaction.options.getString('scope') ?? 'all';
    const channel = interaction.channel;

    if (!channel?.isTextBased()) {
      await interaction.reply({ content: 'Bu cleanup əmri yalnız mətn kanalında işləyir.', ephemeral: true });
      return;
    }

    const result = scope === 'leaderboard'
      ? await cleanupLeaderboardMessages(channel, interaction.client.user.id)
      : await cleanupBotMessages(channel, interaction.client.user.id);

    await interaction.reply({
      content: result.deleted > 0
        ? `${result.label} üçün **${result.deleted}** bot mesajı silindi.${result.failed > 0 ? ` **${result.failed}** mesaj silinə bilmədi.` : ''}`
        : `${result.label} üçün silinəcək bot mesajı tapılmadı.`,
      ephemeral: true
    });
    return;
  }

  const target = interaction.options.getUser('user');
  if (!target || target.bot) {
    await interaction.reply({ content: 'Real üzv seç.', ephemeral: true });
    return;
  }

  if (subcommand === 'audit') {
    const result = await adminAuditUser(target.id);
    await interaction.reply({ embeds: [auditEmbed(target, result)], ephemeral: true });
    return;
  }

  if (subcommand === 'profile') {
    const result = await adminAuditUser(target.id, 'all', 20);
    await interaction.reply({
      embeds: [adminProfileEmbed(target, result)],
      components: adminProfileRows(target.id, 'all'),
      ephemeral: true
    });
    return;
  }

  if (subcommand === 'give') {
    const amount = interaction.options.getInteger('amount');
    const profile = await adminGiveAura(target.id, amount, interaction.user.id);
    scheduleLiveLeaderboardRefresh();
    await interaction.reply(await transactionPayload('Admin Aura verildi', profile, `${target} +${amount} ${gameCopy.currency}`, {
      allowedMentions: { users: [target.id] },
      amount,
      kind: 'admin'
    }));
    return;
  }

  if (subcommand === 'take') {
    const amount = interaction.options.getInteger('amount');
    const result = await adminTakeAura(target.id, amount, interaction.user.id);
    scheduleLiveLeaderboardRefresh();
    const note = result.capped
      ? `${target} üçün ${formatNumber(result.requested)} Aura tələb olundu, amma -50,000 Aura minimum balans limitinə görə faktiki ${formatNumber(result.removed)} Aura silindi. Balans: ${formatNumber(result.balanceBefore)} → ${formatNumber(result.balanceAfter)}.`
      : `${target} -${formatNumber(result.removed)} ${gameCopy.currency}. Balans: ${formatNumber(result.balanceBefore)} → ${formatNumber(result.balanceAfter)}.`;
    await interaction.reply(await transactionPayload('Admin Aura silindi', result.profile, note, {
      allowedMentions: { users: [target.id] },
      amount: -result.removed,
      kind: 'admin'
    }));
    return;
  }

  if (subcommand === 'setbalance') {
    const amount = interaction.options.getInteger('amount');
    const profile = await adminSetBalance(target.id, amount, interaction.user.id);
    scheduleLiveLeaderboardRefresh();
    await interaction.reply(await transactionPayload('Admin balans təyin etdi', profile, `${target} balansı **${amount} ${gameCopy.currency}** oldu.`, {
      allowedMentions: { users: [target.id] },
      amount,
      kind: 'admin'
    }));
    return;
  }

  if (subcommand === 'setlevel') {
    const level = interaction.options.getInteger('level');
    const profile = await adminSetLevel(target.id, level, interaction.user.id);
    await interaction.reply(await transactionPayload('Admin level təyin etdi', profile, `${target} artıq **Sv.${profile.level}** oldu. XP sıfırlandı.`, {
      allowedMentions: { users: [target.id] },
      kind: 'admin'
    }));
    return;
  }

  if (subcommand === 'casinorestrict') {
    const maxBet = interaction.options.getInteger('maxbet');
    const reason = interaction.options.getString('reason') ?? 'admin review';
    const profile = await adminSetCasinoRestriction(target.id, maxBet, reason, interaction.user.id);
    await interaction.reply(await transactionPayload('Casino limiti təyin edildi', profile, `${target} üçün maksimum casino mərci **${formatNumber(maxBet)} ${gameCopy.currency}** oldu.\nSəbəb: **${reason}**`, {
      allowedMentions: { users: [target.id] },
      kind: 'admin'
    }));
    return;
  }

  if (subcommand === 'badge') {
    const badge = interaction.options.getString('badge');
    const profile = await adminGrantBadge(target.id, badge, interaction.user.id);
    await interaction.reply(await transactionPayload('Admin nişan verdi', profile, `${target} üçün yeni nişan: **${badge}**`, {
      allowedMentions: { users: [target.id] },
      kind: 'admin'
    }));
    return;
  }

  if (subcommand === 'item') {
    const itemKey = interaction.options.getString('item');
    const count = interaction.options.getInteger('count');
    const result = await adminGrantItem(target.id, itemKey, count, interaction.user.id);
    await interaction.reply(await transactionPayload(
      result.ok ? 'Admin item verdi' : 'Item tapılmadı',
      result.profile,
      result.ok ? `${target}: **${count}x ${result.item.name}**` : 'Item seçimini yenidən yoxla.',
      {
      allowedMentions: { users: [target.id] },
      ephemeral: !result.ok,
      kind: result.ok ? 'admin' : 'error'
      }
    ));
  }
}

async function handleRobCommand(interaction) {
  const target = interaction.options.getUser('user');

  if (target.bot || target.id === interaction.user.id) {
    await interaction.reply({ content: 'Rob üçün real başqa üzv seç.', ephemeral: true });
    return;
  }

  const result = await performRob(interaction.user.id, target.id);

  if (!result.ok) {
    const descriptions = {
      cooldown: `Yenidən rob üçün **${formatDuration(result.remainingMs)}** gözlə.`,
      shielded: `${primeMention(target, result.target)} indi qorunur. **${formatDuration(result.remainingMs)}** sonra yoxla.`,
      poor_target: `${primeMention(target, result.target)} balansı çox aşağıdır. 100 Aura altı üzvlər qorunur.`,
      debt_locked: 'Balansın mənfidir. Borcdan çıxana qədər rob edə bilməzsən.',
      pair_daily_limit: `Bu üzvü bu gün maksimum **${result.limit}** dəfə rob etməyə cəhd edə bilərsən.`,
      target_daily_limit: `Bu üzv bu gün artıq **${result.limit}** dəfə rob hədəfi olub. Başqa hədəf seç.`
    };
    await interaction.reply({
      embeds: [gameEmbed().setTitle('Soyğun alınmadı').setDescription(descriptions[result.reason] ?? 'Bu rob cəhdi hazırda mümkün deyil.')],
      ephemeral: true
    });
    return;
  }

  await interaction.reply(await robberyPayload(interaction.user, target, result));
}

async function runActivityCommand(interaction, subcommand) {
  const result = await performActivity(interaction.user.id, subcommand);
  if (!result.ok) {
    await interaction.reply({
      embeds: [gameEmbed().setTitle(`${result.config.label} cooldown`).setDescription(`Bu işi yenidən etmək üçün **${formatDuration(result.remainingMs)}** gözlə.`)],
      ephemeral: true
    });
    return;
  }

  await interaction.reply({
    embeds: [
      gameEmbed()
        .setTitle(`${result.config.label} tamamlandı`)
        .setDescription(result.success ? 'Missiya uğurlu oldu.' : 'Missiya alınmadı və cərimə gəldi.')
        .addFields(
          { name: 'Nəticə', value: result.amount >= 0 ? `+${result.amount} ${gameCopy.currency}` : `${result.amount} ${gameCopy.currency}`, inline: true },
          { name: 'Balans', value: `${result.profile.balance} ${gameCopy.currency}`, inline: true },
          { name: 'XP', value: xpLine(result.profile), inline: false }
        )
    ]
  });
}

async function sendGameMenu(interaction) {
  await deferInteractionResponse(interaction, { ephemeral: false });
  const profile = await getProfile(interaction.user.id);
  const embed = gameEmbed()
    .setTitle('🌌 Octoson Aura')
    .setDescription(`${gameCopy.menu}\n\n${xpLine(profile)}\n${streakLine(profile)}`)
    .addFields(
      { name: '💠 Aura', value: `${formatNumber(profile.balance)} ${gameCopy.currency}`, inline: true },
      { name: '🏅 Rank', value: profile.rank, inline: true },
      { name: '⭐ Prestij', value: `${profile.prestige}`, inline: true },
      { name: '🎮 Oyunlar', value: '`/game daily`, `/game slots`, `/game risk`, `/game duel`', inline: false },
      { name: '🔓 Növbəti açılış', value: nextUnlockLine(profile), inline: false },
      { name: '🛡️ Qeyd', value: 'Real pul, crypto, skin və real dəyərli əşya yoxdur. Aura yalnız server daxilində əyləncə balıdır.' }
    );

  await interaction.reply({
    embeds: [embed],
    components: gameRows(interaction.user.id)
  });
}

async function sendBalance(interaction) {
  await deferInteractionResponse(interaction, { ephemeral: false });
  const user = interaction.options.getUser('user') ?? interaction.user;
  const profile = await getProfile(user.id);

  await interaction.reply(await profilePayload(user, profile, {
    components: user.id === interaction.user.id ? [quickActionRow()] : []
  }));
}

async function sendDaily(interaction) {
  await deferInteractionResponse(interaction, { ephemeral: true });
  const result = await claimDaily(interaction.user.id);

  if (!result.claimed) {
    await interaction.reply({
      embeds: [
        gameEmbed()
          .setTitle('⏳ Gündəlik mükafat artıq götürülüb')
          .setDescription('Sabah yenidən qayıt. Streak qorunur, oyunlar isə açıqdır.')
          .addFields(
            { name: '💠 Aura', value: `${formatNumber(result.balance)} ${gameCopy.currency}`, inline: true },
            { name: '🔥 Streak', value: `${result.profile.dailyStreak} gün`, inline: true },
            { name: '📊 XP', value: xpLine(result.profile), inline: false }
          )
      ],
      ephemeral: true
    });
    return;
  }

  await interaction.reply({
    embeds: [
      gameEmbed()
        .setColor(brand.success)
        .setTitle('🎁 Gündəlik giriş mükafatı')
        .setDescription(pick(gameCopy.dailyTasks))
        .addFields(
          { name: '💠 Qazanc', value: `+${formatNumber(result.reward)} ${gameCopy.currency}`, inline: true },
          { name: '📦 Sandıq', value: result.chest, inline: true },
          { name: '🔥 Streak', value: `${result.profile.dailyStreak} gün`, inline: true },
          { name: '📊 Səviyyə', value: xpLine(result.profile), inline: false },
          { name: '💰 Yeni balans', value: `${formatNumber(result.balance)} ${gameCopy.currency}`, inline: true }
        )
    ],
    components: gameRows(interaction.user.id)
  });
}

async function sendBeginnerBonus(interaction) {
  await deferInteractionResponse(interaction, { ephemeral: true });
  const result = await claimBeginnerBonus(interaction.user.id);

  if (!result.claimed) {
    await interaction.reply({
      embeds: [
        gameEmbed()
          .setTitle('🟡 İlk bonus artıq götürülüb')
          .setDescription('Bu bonus yalnız bir dəfə verilir. İndi ən yaxşı addım gündəlik bonusu götürmək və profilini yoxlamaqdır.')
          .addFields(
            { name: '💠 Aura', value: `${formatNumber(result.profile.balance)} ${gameCopy.currency}`, inline: true },
            { name: '📊 Səviyyə', value: xpLine(result.profile), inline: false },
            { name: '🎯 Növbəti addım', value: '`/game daily` yaz və günlük streak başlat.', inline: false }
          )
      ],
      ephemeral: true
    });
    return;
  }

  await interaction.reply({
    embeds: [
      gameEmbed()
        .setColor(brand.success)
        .setTitle('🎁 İlk bonus verildi')
        .setDescription('Başlanğıc üçün Aura, XP və 1 bilet aldın. İndi oyun panelindən az mərc ilə başlaya bilərsən.')
        .addFields(
          { name: '💠 Qazanc', value: `+${result.reward} ${gameCopy.currency}`, inline: true },
          { name: '🎟️ Bilet', value: '+1', inline: true },
          { name: '📊 Səviyyə', value: xpLine(result.profile), inline: false },
          { name: '🎯 Tövsiyə edilən addım', value: '`🎮 Oyunlar` düyməsinə bas və qaydaları oxu.', inline: false }
        )
    ],
    components: [quickActionRow()],
    ephemeral: true
  });
}

async function playSlots(interaction) {
  const bet = interaction.options.getInteger('bet');

  if (activeCasinoUserSessions.has(interaction.user.id)) {
    await interaction.reply({
      content: 'Sənin artıq aktiv casino raundun var. Əvvəl o raundu bitir və ya nəticəni gözlə.',
      ephemeral: true
    });
    return;
  }

  activeCasinoUserSessions.set(interaction.user.id, `instant:${interaction.id}`);

  if (!(await ensureCasinoReady(interaction))) {
    activeCasinoUserSessions.delete(interaction.user.id);
    return;
  }

  const symbols = Array.from({ length: 3 }, () => pick(gameCopy.slotSymbols));
  const unique = new Set(symbols).size;
  const multiplier = unique === 1 ? 5 : unique === 2 ? 1.7 : 0;
  const winnings = Math.floor(bet * multiplier);
  const entry = await prepareCasinoEntry(interaction.user.id, bet, 'slots');
  if (!entry.ok) {
    activeCasinoUserSessions.delete(interaction.user.id);
    await blockedCasinoEntry(interaction, bet, entry);
    return;
  }

  const settlement = await settleCasinoGame(interaction.user.id, {
    game: 'slots',
    bet,
    cost: entry.cost,
    payout: winnings,
    won: winnings > 0,
    multiplier
  });
  if (!settlement.ok) {
    activeCasinoUserSessions.delete(interaction.user.id);
    await blockedCasinoEntry(interaction, bet, entry);
    return;
  }
  scheduleLiveLeaderboardRefresh();
  await markCasinoPlayed(interaction.user.id);
  activeCasinoUserSessions.delete(interaction.user.id);
  const { profile } = settlement;
  const title = multiplier === 5 ? 'Mükəmməl uyğunluq' : multiplier === 1.7 ? 'Təmiz cütlük' : 'Uyğunluq yoxdur';
  const embed = markPrimeEmbed(gameEmbed(), interaction.user, profile)
    .setTitle('🎰 Tərz slotları')
    .setDescription(symbols.map(symbol => `**${symbol}**`).join('  |  '))
    .addFields(
      { name: 'Oyunçu', value: primeMention(interaction.user, profile), inline: false },
      { name: `🎲 ${title}`, value: settlement.net >= 0 ? `+${formatNumber(settlement.net)} ${gameCopy.currency}` : `${formatNumber(settlement.net)} ${gameCopy.currency}`, inline: true },
      { name: '📈 Çarpan', value: `${multiplier.toFixed(2)}x`, inline: true },
      { name: '🏦 House edge', value: 'təxminən 15%', inline: true },
      { name: 'Balans dəyişikliyi', value: balanceDeltaLine(settlement.balanceBefore, profile.balance), inline: true },
      { name: '💠 Aura', value: `${formatNumber(profile.balance)} ${gameCopy.currency}`, inline: true },
      { name: '📊 XP', value: xpLine(profile), inline: false },
      { name: '🎯 Statistika', value: statsLine(profile), inline: false }
    );
  addTicketField(embed, entry);
  addBoosterField(embed, settlement.boosterEffect);

  await interaction.reply({
    embeds: [embed],
    components: [casinoHelpRow('slots')]
  });
}

async function playRisk(interaction) {
  const bet = interaction.options.getInteger('bet');
  const level = interaction.options.getString('level');
  const config = gameCopy.riskLevels[level];

  if (activeCasinoUserSessions.has(interaction.user.id)) {
    await interaction.reply({
      content: 'Sənin artıq aktiv casino raundun var. Əvvəl o raundu bitir və ya nəticəni gözlə.',
      ephemeral: true
    });
    return;
  }

  activeCasinoUserSessions.set(interaction.user.id, `instant:${interaction.id}`);

  if (!(await ensureCasinoReady(interaction))) {
    activeCasinoUserSessions.delete(interaction.user.id);
    return;
  }

  const won = Math.random() < config.chance;
  const payout = won ? Math.floor(bet * config.payout) : 0;
  const entry = await prepareCasinoEntry(interaction.user.id, bet, 'risk');
  if (!entry.ok) {
    activeCasinoUserSessions.delete(interaction.user.id);
    await blockedCasinoEntry(interaction, bet, entry);
    return;
  }

  const settlement = await settleCasinoGame(interaction.user.id, {
    game: 'risk',
    bet,
    cost: entry.cost,
    payout,
    won,
    multiplier: won ? config.payout : 0
  });
  if (!settlement.ok) {
    activeCasinoUserSessions.delete(interaction.user.id);
    await blockedCasinoEntry(interaction, bet, entry);
    return;
  }
  scheduleLiveLeaderboardRefresh();
  await markCasinoPlayed(interaction.user.id);
  activeCasinoUserSessions.delete(interaction.user.id);
  const { profile } = settlement;
  const embed = markPrimeEmbed(gameEmbed(), interaction.user, profile)
    .setTitle(`🎲 ${config.label}`)
    .setDescription(config.note)
    .addFields(
      { name: 'Oyunçu', value: primeMention(interaction.user, profile), inline: false },
      { name: won ? '✅ Nəticə: qazandın' : '❌ Nəticə: uduzdun', value: settlement.net >= 0 ? `+${formatNumber(settlement.net)} ${gameCopy.currency}` : `${formatNumber(settlement.net)} ${gameCopy.currency}`, inline: true },
      { name: '🎯 Qazanma şansı', value: `${Math.round(config.chance * 100)}%`, inline: true },
      { name: '📈 Çarpan', value: `${config.payout.toFixed(2)}x`, inline: true },
      { name: 'Balans dəyişikliyi', value: balanceDeltaLine(settlement.balanceBefore, profile.balance), inline: true },
      { name: '💠 Aura', value: `${formatNumber(profile.balance)} ${gameCopy.currency}`, inline: true },
      { name: '📊 XP', value: xpLine(profile), inline: false },
      { name: '🎯 Statistika', value: statsLine(profile), inline: false }
    );
  addTicketField(embed, entry);
  addBoosterField(embed, settlement.boosterEffect);

  await interaction.reply({
    embeds: [embed],
    components: [casinoHelpRow('risk')]
  });
}

async function playCasinoRound(interaction, game) {
  const bet = interaction.options.getInteger('bet');

  if (isInteractiveCasinoGame(game)) {
    await startInteractiveCasino(interaction, game, bet);
    return;
  }

  if ((game === 'lottery' || game === 'jackpot') && await isEconomyFrozen(interaction.user.id)) {
    await interaction.reply({
      content: 'Bank hesabın kredit borcuna görə dondurulub. Lottery və jackpot üçün əvvəl `/wallet payloan` ilə borcu ödə.',
      ephemeral: true
    });
    return;
  }

  if (!(await ensureCasinoReady(interaction))) {
    return;
  }

  const result = casinoResult(interaction, game, bet);
  const entry = await prepareCasinoEntry(interaction.user.id, bet, game);
  if (!entry.ok) {
    await blockedCasinoEntry(interaction, bet, entry);
    return;
  }
  if (entry.usedTicket) {
    result.description = `${result.description}\nReward Ticket **${formatNumber(entry.ticketCover)} Aura** hissəni ödədi.`;
  }
  const payout = Math.floor(bet * result.multiplier);

  const settlement = await settleCasinoGame(interaction.user.id, {
    game,
    bet,
    cost: entry.cost,
    payout,
    won: payout - entry.cost > 0,
    multiplier: result.multiplier
  });
  if (!settlement.ok) {
    await blockedCasinoEntry(interaction, bet, entry);
    return;
  }
  await markCasinoPlayed(interaction.user.id);
  const { profile } = settlement;
  const embed = markPrimeEmbed(gameEmbed(), interaction.user, profile)
    .setTitle(result.title)
    .setDescription(result.description)
    .addFields(
      { name: 'Oyunçu', value: primeMention(interaction.user, profile), inline: false },
      { name: settlement.net > 0 ? 'Nəticə: qazandın' : settlement.net === 0 ? 'Nəticə: balans qorundu' : 'Nəticə: uduzdun', value: formatSignedAura(settlement.net), inline: true },
      { name: 'Çarpan', value: `${result.multiplier.toFixed(2)}x`, inline: true },
      { name: 'House edge', value: result.edge ?? 'server üstünlüyü aktivdir', inline: true },
      { name: 'Balans dəyişikliyi', value: balanceDeltaLine(settlement.balanceBefore, profile.balance), inline: true },
      { name: 'Balans', value: `${formatNumber(profile.balance)} ${gameCopy.currency}`, inline: true },
      { name: 'XP', value: xpLine(profile), inline: false }
    );
  addTicketField(embed, entry);
  addBoosterField(embed, settlement.boosterEffect);

  await interaction.reply({
    embeds: [embed],
    components: [casinoHelpRow(game)]
  });
}

async function startInteractiveCasino(interaction, game, bet) {
  const activeSessionId = activeCasinoUserSessions.get(interaction.user.id);
  if (activeSessionId) {
    await interaction.reply({
      content: 'Sənin artıq aktiv casino raundun var. Əvvəl o raundu bitir və ya nəticəni gözlə.',
      ephemeral: true
    });
    return;
  }

  activeCasinoUserSessions.set(interaction.user.id, `starting:${interaction.id}`);

  try {
    if ((game === 'lottery' || game === 'jackpot') && await isEconomyFrozen(interaction.user.id)) {
      activeCasinoUserSessions.delete(interaction.user.id);
      await interaction.reply({
        content: 'Bank hesabın kredit borcuna görə dondurulub. Lotereya və jackpot üçün əvvəl `/wallet payloan` ilə borcu ödə.',
        ephemeral: true
      });
      return;
    }

    if (!(await ensureCasinoReady(interaction))) {
      activeCasinoUserSessions.delete(interaction.user.id);
      return;
    }

    const entry = await prepareCasinoEntry(interaction.user.id, bet, game, { reserve: true });
    if (!entry.ok) {
      activeCasinoUserSessions.delete(interaction.user.id);
      await blockedCasinoEntry(interaction, bet, entry);
      return;
    }

    await markCasinoPlayed(interaction.user.id);

    const sessionId = `${interaction.id}`;
    const session = createCasinoSession(sessionId, interaction.user.id, game, bet, {
      cost: entry.cost,
      usedTicket: entry.usedTicket,
      ticketCover: entry.ticketCover,
      reserved: entry.cost > 0,
      walletBefore: entry.profile.balance + entry.cost,
      cashout: game === 'crash' ? interaction.options.getNumber('cashout') : null
    });
    activeCasinoSessions.set(sessionId, session);
    activeCasinoUserSessions.set(interaction.user.id, sessionId);

    await interaction.reply(await interactiveCasinoPayload(session));
    const reply = await interaction.fetchReply();
    session.message = reply;
    startCasinoExpiry(session);
  } catch (error) {
    activeCasinoUserSessions.delete(interaction.user.id);
    throw error;
  }
}

async function handleCasinoButton(interaction) {
  const [, sessionId, action, value] = interaction.customId.split(':');
  const session = activeCasinoSessions.get(sessionId);

  if (!session) {
    await interaction.reply({ content: 'Bu oyun raundu artıq bitib və ya bot restart olunub.', ephemeral: true });
    return;
  }

  if (isCasinoSessionExpired(session)) {
    await expireCasinoSession(session);
    await interaction.reply({ content: 'Bu casino raundunun vaxtı bitib. Mərc geri qaytarılıb.', ephemeral: true });
    return;
  }

  if (interaction.user.id !== session.userId) {
    await interaction.reply({ content: 'Bu casino raundu başqa üzvə aiddir.', ephemeral: true });
    return;
  }

  if (session.finished) {
    await interaction.reply({ content: 'Bu raund artıq bağlanıb.', ephemeral: true });
    return;
  }

  if (session.game === 'crash' && action === 'cashout_modal') {
    await showCrashCashoutModal(interaction, session);
    return;
  }

  if (session.game === 'mines') {
    await handleMinesButton(interaction, session, action, value);
    return;
  }

  if (session.game === 'blackjack') {
    await handleBlackjackButton(interaction, session, action);
    return;
  }

  if (session.game === 'tower') {
    await handleTowerButton(interaction, session, action);
    return;
  }

  if (session.game === 'higherlower') {
    await handleHigherLowerButton(interaction, session, action, value);
    return;
  }

  await finishChoiceCasino(interaction, session, action);
}

function isInteractiveCasinoGame(game) {
  return [
    'slots',
    'risk',
    'coinflip',
    'dice',
    'roulette',
    'blackjack',
    'crash',
    'mines',
    'tower',
    'higherlower',
    'wheel',
    'lottery',
    'jackpot',
    'rps',
    'baccarat',
    'poker',
    'horse',
    'penalty'
  ].includes(game);
}

function createCasinoSession(id, userId, game, bet, options = {}) {
  const base = {
    id,
    userId,
    game,
    bet,
    cost: options.cost ?? bet,
    usedTicket: Boolean(options.usedTicket),
    ticketCover: options.ticketCover ?? 0,
    reserved: Boolean(options.reserved),
    walletBefore: options.walletBefore ?? null,
    finished: false,
    createdAt: Date.now(),
    expiresAt: Date.now() + gameRequestTtlMs,
    message: null
  };

  if (game === 'mines') {
    const mines = new Set();
    while (mines.size < 2) mines.add(Math.floor(Math.random() * 9));
    return { ...base, mines, revealed: new Set(), multiplier: 1 };
  }

  if (game === 'blackjack') {
    return { ...base, player: [drawCard(), drawCard()], dealer: [drawCard(), drawCard()] };
  }

  if (game === 'tower') {
    return { ...base, floor: 0, multiplier: 1, maxFloors: 6 };
  }

  if (game === 'crash') {
    return { ...base, cashout: options.cashout ?? null };
  }

  if (game === 'higherlower') {
    return { ...base, firstCard: drawRank() };
  }

  return base;
}

function casinoCountdownText(session) {
  const remainingMs = Math.max(0, session.expiresAt - Date.now());
  return `Cavab üçün **${Math.ceil(remainingMs / 1000)} saniyə** qalır. Vaxt bitsə mərc geri qaytarılır.`;
}

function isCasinoSessionExpired(session) {
  return Date.now() >= session.expiresAt;
}

function startCasinoExpiry(session) {
  clearExpiringGame(session.id);

  const tick = setInterval(() => {
    const active = activeCasinoSessions.get(session.id);
    if (!active || active.finished) {
      clearExpiringGame(session.id);
      return;
    }

    if (isCasinoSessionExpired(active)) {
      expireCasinoSession(active).catch(error => console.error('Casino expiry failed:', error));
      return;
    }

    interactiveCasinoPayload(active)
      .then(payload => active.message?.edit({ ...payload, attachments: [] }))
      .catch(error => console.error('Casino countdown edit failed:', error));
  }, gameRequestTickMs);

  expiringGameTimers.set(session.id, tick);
}

async function expireCasinoSession(session) {
  if (session.finished) {
    return;
  }

  session.finished = true;
  activeCasinoSessions.delete(session.id);
  activeCasinoUserSessions.delete(session.userId);
  clearExpiringGame(session.id);

  let profile = await getProfile(session.userId);
  if ((session.reserved && session.cost > 0) || session.usedTicket) {
    profile = await refundReservedCasinoBet(session.userId, session.cost, session.game, session.usedTicket);
  }

  await session.message?.edit({
    embeds: [
      gameEmbed()
        .setColor(brand.neutral)
        .setTitle(`${interactiveCasinoTitle(session)} ləğv edildi`)
        .setThumbnail(casinoImageUrl(session.game))
        .setDescription('30 saniyə ərzində seçim edilmədi.')
        .addFields(
          { name: 'Refund', value: session.usedTicket ? `+${formatNumber(session.cost)} ${gameCopy.currency} və 1 Reward Ticket geri qaytarıldı.` : `+${formatNumber(session.cost)} ${gameCopy.currency}`, inline: true },
          { name: 'Balans', value: `${formatNumber(profile.balance)} ${gameCopy.currency}`, inline: true }
        )
    ],
    components: [casinoHelpRow(session.game)]
  }).catch(error => console.error('Casino expiry message edit failed:', error));
}

async function handleMinesButton(interaction, session, action, value) {
  if (action === 'cashout') {
    const multiplier = session.revealed.size === 0 ? 0.75 : session.multiplier;
    await finishCasinoSession(interaction, session, {
      title: 'Mina oyunu: götürüldü',
      description: `Təhlükəsiz xanalar: **${session.revealed.size}**`,
      multiplier,
      won: multiplier > 1,
      revealAll: true
    });
    return;
  }

  const tile = Number(value);

  if (!Number.isInteger(tile) || tile < 0 || tile > 8 || session.revealed.has(tile)) {
    await interaction.reply({ content: 'Bu xana artıq açılıb və ya yanlışdır.', ephemeral: true });
    return;
  }

  if (session.mines.has(tile)) {
    await finishCasinoSession(interaction, session, {
      title: 'Mina partladı',
      description: `Seçilən xana **${tile + 1}** mina idi.`,
      multiplier: 0,
      won: false,
      revealAll: true
    });
    return;
  }

  session.revealed.add(tile);
  session.multiplier = Number((1 + session.revealed.size * 0.34).toFixed(2));

  if (session.revealed.size >= 7) {
    await finishCasinoSession(interaction, session, {
      title: 'Mina oyunu: tam təmizləndi',
      description: 'Bütün təhlükəsiz xanaları açdın.',
      multiplier: 3.6,
      won: true,
      revealAll: true
    });
    return;
  }

  await interaction.update(await interactiveCasinoPayload(session));
}

async function handleBlackjackButton(interaction, session, action) {
  if (action === 'hit') {
    session.player.push(drawCard());
    if (handTotal(session.player) > 21) {
      await finishCasinoSession(interaction, session, {
        title: '21 oyunu: yandın',
        description: `Sənin əl: **${handLabel(session.player)}** (${handTotal(session.player)})`,
        multiplier: 0,
        won: false
      });
      return;
    }

    await interaction.update(await interactiveCasinoPayload(session));
    return;
  }

  while (handTotal(session.dealer) < 17) {
    session.dealer.push(drawCard());
  }

  const playerTotal = handTotal(session.player);
  const dealerTotal = handTotal(session.dealer);
  const won = dealerTotal > 21 || playerTotal > dealerTotal;
  const push = playerTotal === dealerTotal;

  await finishCasinoSession(interaction, session, {
    title: '21 oyunu nəticəsi',
    description: `Sən: **${handLabel(session.player)}** (${playerTotal})\nDiler: **${handLabel(session.dealer)}** (${dealerTotal})`,
    multiplier: won ? 1.9 : push ? 1 : 0,
    won
  });
}

async function handleTowerButton(interaction, session, action) {
  if (action === 'cashout') {
    await finishCasinoSession(interaction, session, {
      title: 'Qüllə: qazancı götürdün',
      description: `Çıxılan mərtəbə: **${session.floor}**`,
      multiplier: session.floor === 0 ? 0.75 : session.multiplier,
      won: session.floor > 0
    });
    return;
  }

  const successChance = Math.max(0.38, 0.74 - session.floor * 0.06);
  const climbed = Math.random() < successChance;

  if (!climbed) {
    await finishCasinoSession(interaction, session, {
      title: 'Qüllə yıxıldı',
      description: `Mərtəbə **${session.floor + 1}** alınmadı.`,
      multiplier: 0,
      won: false
    });
    return;
  }

  session.floor += 1;
  session.multiplier = Number((1 + session.floor * 0.42).toFixed(2));

  if (session.floor >= session.maxFloors) {
    await finishCasinoSession(interaction, session, {
      title: 'Qüllə tamamlandı',
      description: 'Bütün mərtəbələri keçdin.',
      multiplier: 4,
      won: true
    });
    return;
  }

  await interaction.update(await interactiveCasinoPayload(session));
}

async function handleHigherLowerButton(interaction, session, action, shownCardText) {
  const firstCard = session.firstCard ?? session.current;
  const shownCard = Number(shownCardText);

  if (!['higher', 'lower'].includes(action) || !Number.isInteger(firstCard)) {
    await interaction.reply({ content: 'Bu yuxarı/aşağı raundunun dataları yanlışdır. Yenidən `/casino higherlower` başlat.', ephemeral: true });
    return;
  }

  if (Number.isInteger(shownCard) && shownCard !== firstCard) {
    await interaction.reply({ content: 'Bu düymə köhnə karta aiddir. Yeni raund aç və ordakı düymələri istifadə et.', ephemeral: true });
    return;
  }

  const next = drawRank();
  const firstValue = higherLowerValue(firstCard);
  const nextValue = higherLowerValue(next);
  const correct = action === 'higher' ? nextValue > firstValue : nextValue < firstValue;
  await finishCasinoSession(interaction, session, {
    title: 'Yuxarı / aşağı',
    description: `İlk kart: **${cardRankLabel(firstCard)}** (${firstValue}) | İkinci kart: **${cardRankLabel(next)}** (${nextValue}) | Təxmin: **${action === 'higher' ? 'yuxarı' : 'aşağı'}**\nQayda: **A ən böyük kartdır (14)**. Eyni kart düşsə mərc geri qayıdır.`,
    multiplier: correct ? 1.85 : nextValue === firstValue ? 1 : 0,
    won: correct
  });
}

async function finishChoiceCasino(interaction, session, choice) {
  const outcome = choiceCasinoOutcome(session, choice);
  await finishCasinoSession(interaction, session, outcome);
}

async function showCrashCashoutModal(interaction, session) {
  const modal = new ModalBuilder()
    .setCustomId(`casino_cashout:${session.id}`)
    .setTitle('Crash çıxış çarpanı');

  const cashout = new TextInputBuilder()
    .setCustomId('cashout')
    .setLabel('Neçə x-də çıxmaq istəyirsən?')
    .setPlaceholder('məs: 2.5')
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(5)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(cashout));
  await interaction.showModal(modal);
}

async function handleCrashCashoutModal(interaction) {
  const sessionId = interaction.customId.replace('casino_cashout:', '');
  const session = activeCasinoSessions.get(sessionId);

  if (!session || session.finished) {
    await interaction.reply({ content: 'Bu crash raundu artıq bağlanıb və ya vaxtı keçib.', ephemeral: true });
    return;
  }

  if (isCasinoSessionExpired(session)) {
    await expireCasinoSession(session);
    await interaction.reply({ content: 'Bu crash raundunun vaxtı bitib. Mərc geri qaytarılıb.', ephemeral: true });
    return;
  }

  if (interaction.user.id !== session.userId) {
    await interaction.reply({ content: 'Bu crash raundu başqa üzvə aiddir.', ephemeral: true });
    return;
  }

  const rawCashout = interaction.fields.getTextInputValue('cashout').replace(',', '.');
  const cashout = Number(rawCashout);

  if (!Number.isFinite(cashout) || cashout < 1.1 || cashout > 10) {
    await interaction.reply({ content: 'Çıxış çarpanı 1.10x və 10.00x arasında olmalıdır.', ephemeral: true });
    return;
  }

  await finishChoiceCasino(interaction, session, `${cashout}`);
}

async function finishCasinoSession(interaction, session, outcome) {
  session.finished = true;
  activeCasinoSessions.delete(session.id);
  clearExpiringGame(session.id);

  const payout = Math.floor(session.bet * outcome.multiplier);
  const net = payout - session.cost;

  const settlement = await settleCasinoGame(session.userId, {
    game: session.game,
    bet: session.bet,
    cost: session.cost,
    payout,
    won: outcome.won ?? net > 0,
    multiplier: outcome.multiplier,
    reserved: session.reserved
  });
  activeCasinoUserSessions.delete(session.userId);
  const { profile } = settlement;
  if (settlement.ok) scheduleLiveLeaderboardRefresh();

  const payload = await finishedCasinoPayload(session, outcome, settlement.net, profile, settlement.boosterEffect);

  if (interaction.isModalSubmit()) {
    await interaction.reply(payload);
    return;
  }

  await interaction.update(payload);
}

function choiceCasinoOutcome(session, choice) {
  if (session.game === 'slots') {
    const symbols = Array.from({ length: 3 }, () => pick(gameCopy.slotSymbols));
    const unique = new Set(symbols).size;
    const multiplier = unique === 1 ? 5 : unique === 2 ? 1.7 : 0;
    const title = multiplier === 5 ? 'Slot: mükəmməl uyğunluq' : multiplier === 1.7 ? 'Slot: təmiz cütlük' : 'Slot: uyğunluq yoxdur';
    return {
      title,
      description: symbols.map(symbol => `**${symbol}**`).join('  |  '),
      multiplier,
      won: multiplier > 1
    };
  }

  if (session.game === 'risk') {
    const config = gameCopy.riskLevels[choice] ?? gameCopy.riskLevels.balanced;
    const won = Math.random() < config.chance;
    return {
      title: config.label,
      description: config.note,
      multiplier: won ? config.payout : 0,
      won
    };
  }

  if (session.game === 'coinflip') {
    const landed = Math.random() < 0.48 ? choice : choice === 'heads' ? 'tails' : 'heads';
    return {
      title: 'Sikkə atışı',
      description: `Seçim: **${coinSideLabel(choice)}** | Düşdü: **${coinSideLabel(landed)}**`,
      multiplier: landed === choice ? 1.95 : 0,
      won: landed === choice
    };
  }

  if (session.game === 'dice') {
    const player = 1 + Math.floor(Math.random() * 6);
    const house = 1 + Math.floor(Math.random() * 6);
    return {
      title: 'Zər oyunu',
      description: `Sənin zərin: **${player}** | Sistem: **${house}**`,
      multiplier: player > house ? 1.8 : player === house ? 0.75 : 0,
      won: player > house
    };
  }

  if (session.game === 'roulette') {
    const roll = Math.floor(Math.random() * 37);
    const landed = roll === 0 ? 'green' : roll % 2 === 0 ? 'black' : 'red';
    return {
      title: 'Rulet',
      description: `Seçim: **${colorLabel(choice)}** | Düşdü: **${colorLabel(landed)} ${roll}**`,
      multiplier: landed === choice ? 1.95 : 0,
      won: landed === choice
    };
  }

  if (session.game === 'crash') {
    const cashout = Number(choice);
    const crashAt = Math.max(1, Number((1 / Math.random()).toFixed(2)));
    return {
      title: 'Crash oyunu',
      description: `Çıxış: **${cashout.toFixed(2)}x** | Crash: **${crashAt.toFixed(2)}x**`,
      multiplier: cashout <= crashAt ? cashout * 0.92 : 0,
      won: cashout <= crashAt
    };
  }

  if (session.game === 'wheel') {
    const slices = [0, 0, 0.4, 0.8, 1.2, 2, 2.4];
    const multiplier = pick(slices);
    return {
      title: 'Uğur çarxı',
      description: `Çarx dayandı: **${multiplier.toFixed(2)}x**`,
      multiplier,
      won: multiplier > 1
    };
  }

  if (session.game === 'lottery') {
    const hit = Math.random() < 0.12;
    const ticketNote = session.usedTicket ? `\nReward Ticket ${formatNumber(session.ticketCover)} Aura hissəni ödədi.` : '';
    return {
      title: 'Lotereya bileti',
      description: hit
        ? `Biletin mükafatlı çıxdı.${ticketNote}`
        : `Bu bilet boş çıxdı.${ticketNote}`,
      multiplier: hit ? 8 : 0,
      won: hit
    };
  }

  if (session.game === 'jackpot') {
    const jackpot = Math.random() < 0.025;
    const smallWin = !jackpot && Math.random() < 0.15;
    return {
      title: 'Jackpot',
      description: jackpot ? 'Jackpot vuruldu.' : smallWin ? 'Kiçik jackpot payı düşdü.' : 'Pot böyüdü, bu raund boş keçdi.',
      multiplier: jackpot ? 25 : smallWin ? 2 : 0,
      won: jackpot || smallWin
    };
  }

  if (session.game === 'rps') {
    const house = pick(['rock', 'paper', 'scissors']);
    const won = (choice === 'rock' && house === 'scissors') || (choice === 'paper' && house === 'rock') || (choice === 'scissors' && house === 'paper');
    return {
      title: 'Daş kağız qayçı',
      description: `Sən: **${moveLabel(choice)}** | Sistem: **${moveLabel(house)}**`,
      multiplier: won ? 1.8 : choice === house ? 1 : 0,
      won
    };
  }

  if (session.game === 'baccarat') {
    const player = Math.floor(Math.random() * 10);
    const banker = Math.floor(Math.random() * 10);
    const winner = player === banker ? 'tie' : player > banker ? 'player' : 'banker';
    const multipliers = { player: 1.9, banker: 1.85, tie: 8 };
    return {
      title: 'Baccarat',
      description: `Seçim: **${baccaratLabel(choice)}**\nOyunçu: **${player}** | Bankir: **${banker}**`,
      multiplier: winner === choice ? multipliers[choice] : 0,
      won: winner === choice
    };
  }

  if (session.game === 'poker') {
    const hands = [
      { name: 'Yüksək kart', multiplier: 0 },
      { name: 'Cüt', multiplier: 1.2 },
      { name: 'İki cüt', multiplier: 1.8 },
      { name: 'Üç eyni', multiplier: 2.6 },
      { name: 'Straight', multiplier: 4 },
      { name: 'Flush', multiplier: 5 }
    ];
    const hand = hands[Math.min(hands.length - 1, Math.floor(Math.random() ** 2.4 * hands.length))];
    return {
      title: 'Poker',
      description: `Əl açıldı: **${hand.name}**`,
      multiplier: hand.multiplier,
      won: hand.multiplier > 1
    };
  }

  if (session.game === 'horse') {
    const winner = 1 + Math.floor(Math.random() * 6);
    return {
      title: 'At yarışı',
      description: `Sənin seçimin: **#${choice}** | Qalib: **#${winner}**`,
      multiplier: Number(choice) === winner ? 5 : 0,
      won: Number(choice) === winner
    };
  }

  if (session.game === 'penalty') {
    const keeper = pick(['left', 'center', 'right']);
    return {
      title: 'Penalti',
      description: `Zərbə: **${directionLabel(choice)}** | Qapıçı: **${directionLabel(keeper)}**`,
      multiplier: choice !== keeper ? 1.35 : 0,
      won: choice !== keeper
    };
  }

  return {
    title: session.game,
    description: 'Bu oyun üçün seçim tanınmadı.',
    multiplier: 0,
    won: false
  };
}

async function ensureCasinoReady(interaction) {
  const remainingMs = await getCasinoCooldown(interaction.user.id);

  if (remainingMs <= 0) {
    return true;
  }

  await interaction.reply({
    embeds: [
      gameEmbed()
        .setTitle('Casino cooldown')
        .setDescription(`Növbəti oyun üçün **${formatDuration(remainingMs)}** gözlə. Bu spamı saxlayır və iqtisadiyyatı balansda tutur.`)
    ],
    ephemeral: true
  });
  return false;
}

function casinoResult(interaction, game, bet) {
  const roll = Math.random();

  if (game === 'risk') {
    const won = roll < 0.44;
    return {
      title: 'Risk oyunu',
      description: won ? 'Kəskin oyun tutdu.' : 'Risk bu dəfə dönmədi.',
      multiplier: won ? 2 : 0,
      edge: 'təxminən 12%'
    };
  }

  if (game === 'coinflip') {
    const side = interaction.options.getString('side');
    const landed = Math.random() < 0.48 ? side : side === 'heads' ? 'tails' : 'heads';
    return {
      title: 'Sikkə atışı',
      description: `Seçim: **${side}** | Düşdü: **${landed}**`,
      multiplier: side === landed ? 1.95 : 0,
      edge: 'təxminən 6%'
    };
  }

  if (game === 'dice') {
    const player = 1 + Math.floor(Math.random() * 6);
    const house = 1 + Math.floor(Math.random() * 6);
    return {
      title: 'Zər oyunu',
      description: `Sən: **${player}** | Sistem: **${house}**`,
      multiplier: player > house ? 1.8 : player === house ? 0.75 : 0,
      edge: 'təxminən 12%'
    };
  }

  if (game === 'roulette') {
    const color = interaction.options.getString('color');
    const landed = Math.random() < 0.475 ? color : color === 'red' ? 'black' : 'red';
    return {
      title: 'Rulet',
      description: `Seçim: **${color}** | Düşdü: **${landed}**`,
      multiplier: color === landed ? 1.95 : 0,
      edge: 'təxminən 7%'
    };
  }

  if (game === 'blackjack') {
    const player = 16 + Math.floor(Math.random() * 7);
    const dealer = 16 + Math.floor(Math.random() * 7);
    const won = player <= 21 && (dealer > 21 || player > dealer);
    return {
      title: 'Blackjack',
      description: `Sən: **${player}** | Dealer: **${dealer}**`,
      multiplier: won ? 1.9 : player === dealer ? 0.8 : 0,
      edge: 'dealer üstünlüyü'
    };
  }

  if (game === 'crash') {
    const cashout = interaction.options.getNumber('cashout');
    const crashAt = Math.max(1, Number((1 / Math.random()).toFixed(2)));
    return {
      title: 'Crash',
      description: `Cashout: **${cashout.toFixed(2)}x** | Crash: **${crashAt.toFixed(2)}x**`,
      multiplier: cashout <= crashAt ? cashout * 0.92 : 0,
      edge: 'təxminən 8%'
    };
  }

  if (game === 'mines') {
    const safeTiles = Math.floor(Math.random() * 6);
    return {
      title: 'Mines',
      description: `Təmiz açılan xanalar: **${safeTiles}**`,
      multiplier: safeTiles >= 4 ? 2 : safeTiles >= 3 ? 1.3 : 0,
      edge: 'təxminən 10%'
    };
  }

  if (game === 'tower') {
    const floors = 1 + Math.floor(Math.random() * 6);
    return {
      title: 'Tower',
      description: `Çıxılan mərtəbə: **${floors}**`,
      multiplier: floors >= 5 ? 2 : floors >= 4 ? 1.2 : 0,
      edge: 'təxminən 13%'
    };
  }

  if (game === 'higherlower') {
    const guess = interaction.options.getString('guess');
    const first = 1 + Math.floor(Math.random() * 13);
    const second = 1 + Math.floor(Math.random() * 13);
    const correct = guess === 'higher' ? second > first : second < first;
    return {
      title: 'Higher Lower',
      description: `İlk kart: **${first}** | İkinci kart: **${second}** | Təxmin: **${guess}**`,
      multiplier: correct ? 1.85 : first === second ? 0.75 : 0,
      edge: 'təxminən 15%'
    };
  }

  if (game === 'wheel') {
    const slices = [0, 0, 0.4, 0.8, 1.2, 2, 2.4];
    const multiplier = pick(slices);
    return {
      title: 'Lucky Wheel',
      description: `Çarx **${multiplier.toFixed(2)}x** üzərində dayandı.`,
      multiplier,
      edge: 'təxminən 3%'
    };
  }

  if (game === 'lottery') {
    const hit = Math.random() < 0.12;
    return {
      title: 'Lottery',
      description: hit ? 'Biletin mükafatlı çıxdı.' : 'Bu bilet boş çıxdı.',
      multiplier: hit ? 8 : 0,
      edge: 'təxminən 4%'
    };
  }

  if (game === 'jackpot') {
    const jackpot = Math.random() < 0.025;
    const smallWin = !jackpot && Math.random() < 0.15;
    return {
      title: 'Jackpot',
      description: jackpot ? 'Jackpot vuruldu.' : smallWin ? 'Kiçik jackpot payı düşdü.' : 'Pot böyüdü, bu raund boş keçdi.',
      multiplier: jackpot ? 25 : smallWin ? 2 : 0,
      edge: 'təxminən 8%'
    };
  }

  if (game === 'rps') {
    const move = interaction.options.getString('move');
    const house = pick(['rock', 'paper', 'scissors']);
    const won = (move === 'rock' && house === 'scissors') || (move === 'paper' && house === 'rock') || (move === 'scissors' && house === 'paper');
    return {
      title: 'Rock Paper Scissors',
      description: `Sən: **${move}** | Sistem: **${house}**`,
      multiplier: won ? 1.8 : move === house ? 0.75 : 0,
      edge: 'təxminən 15%'
    };
  }

  if (game === 'baccarat') {
    const player = Math.floor(Math.random() * 10);
    const banker = Math.floor(Math.random() * 10);
    return {
      title: 'Baccarat',
      description: `Player: **${player}** | Banker: **${banker}**`,
      multiplier: player > banker ? 1.9 : player === banker ? 0.7 : 0,
      edge: 'təxminən 8%'
    };
  }

  if (game === 'poker') {
    const hands = [
      { name: 'High Card', multiplier: 0 },
      { name: 'Pair', multiplier: 1.2 },
      { name: 'Two Pair', multiplier: 1.8 },
      { name: 'Three of a Kind', multiplier: 2.6 },
      { name: 'Straight', multiplier: 4 },
      { name: 'Flush', multiplier: 5 }
    ];
    const hand = hands[Math.min(hands.length - 1, Math.floor(Math.random() ** 2.4 * hands.length))];
    return {
      title: 'Poker',
      description: `Əl: **${hand.name}**`,
      multiplier: hand.multiplier,
      edge: 'draw odds house-tuned'
    };
  }

  if (game === 'horse') {
    const horse = 1 + Math.floor(Math.random() * 6);
    const winner = 1 + Math.floor(Math.random() * 6);
    return {
      title: 'Horse Racing',
      description: `Sənin atın: **#${horse}** | Qalib: **#${winner}**`,
      multiplier: horse === winner ? 5 : 0,
      edge: 'təxminən 17%'
    };
  }

  if (game === 'penalty') {
    const shot = pick(['left', 'center', 'right']);
    const keeper = pick(['left', 'center', 'right']);
    return {
      title: 'Penalty Shootout',
      description: `Zərbə: **${shot}** | Qapıçı: **${keeper}**`,
      multiplier: shot !== keeper ? 1.35 : 0,
      edge: 'təxminən 10%'
    };
  }

  return {
    title: game,
    description: `Mərc: ${bet} Aura`,
    multiplier: roll > 0.5 ? 2 : 0
  };
}

function interactiveCasinoEmbed(session, profile = null, user = null) {
  const embed = markPrimeEmbed(gameEmbed(), user, profile)
    .setTitle(interactiveCasinoTitle(session))
    .setThumbnail(casinoImageUrl(session.game))
    .setImage('attachment://casino-card.png')
    .addFields(
      { name: 'Oyunçu', value: `<@${session.userId}>${maybePrimeBadge(profile)}`, inline: false },
      { name: 'Mərc', value: `${formatNumber(session.bet)} ${gameCopy.currency}`, inline: true },
      { name: 'Ödənən', value: ticketPaymentLine(session), inline: true },
      { name: 'Vaxt', value: casinoCountdownText(session), inline: false },
      { name: 'Status', value: interactiveCasinoStatus(session), inline: false }
    );

  if (session.game === 'mines') {
    embed.setDescription(minesBoard(session, false));
  } else if (session.game === 'blackjack') {
    embed.setDescription(`Sən: **${handLabel(session.player)}** (${handTotal(session.player)})\nDiler: **${cardLabel(session.dealer[0])}**, ?`);
  } else if (session.game === 'tower') {
    embed.setDescription(towerBoard(session));
  } else if (session.game === 'higherlower') {
    embed.setDescription(`İlk kart: **${cardRankLabel(session.firstCard ?? session.current)}** (${higherLowerValue(session.firstCard ?? session.current)})\nNövbəti kart yuxarıdır, yoxsa aşağı?\nQayda: **A ən böyük kartdır (14)**. Eyni kart düşsə mərc geri qayıdır.`);
  } else if (session.game === 'crash') {
    embed.setDescription('Çıxmaq istədiyin çarpanı seç. Çarpan crash nöqtəsindən aşağı qalarsa qazanırsan.');
  } else {
    embed.setDescription('Seçimini düymə ilə et. Nəticə seçdikdən sonra açılacaq.');
  }

  return embed;
}

function finishedCasinoEmbed(session, outcome, net, profile, boosterEffect = null) {
  const won = net > 0;
  const pushed = net === 0;
  const walletBefore = Number.isFinite(session.walletBefore) ? session.walletBefore : null;
  const embed = markPrimeEmbed(gameEmbed(), null, profile)
    .setColor(won ? brand.success : pushed ? brand.neutral : 0xc53030)
    .setTitle(`${won ? '✅ SƏN QAZANDIN' : pushed ? '➖ BALANS QORUNDU' : '❌ SƏN UDUZDUN'} - ${outcome.title}`)
    .setThumbnail(casinoImageUrl(session.game))
    .setImage('attachment://casino-card.png')
    .setDescription(outcome.revealAll && session.game === 'mines' ? `${outcome.description}\n\n${minesBoard(session, true)}` : outcome.description)
    .addFields(
      { name: 'Oyunçu', value: `<@${session.userId}>${maybePrimeBadge(profile)}`, inline: false },
      { name: won ? 'Qazanc' : pushed ? 'Nəticə' : 'İtki', value: formatSignedAura(net), inline: true },
      { name: 'Çarpan', value: `${outcome.multiplier.toFixed(2)}x`, inline: true },
      { name: 'Balans dəyişikliyi', value: balanceDeltaLine(walletBefore, profile.balance), inline: true },
      { name: 'Balans', value: `${formatNumber(profile.balance)} ${gameCopy.currency}`, inline: true },
      { name: 'XP', value: xpLine(profile), inline: false }
    );
  addTicketField(embed, session);
  addBoosterField(embed, boosterEffect);
  return embed;
}

async function interactiveCasinoPayload(session) {
  const profile = await getProfile(session.userId);
  const user = await fetchUserQuietly(client, session.userId);

  const blackjackState = session.game === 'blackjack'
    ? {
        player: session.player.map(card => cardLabel(card)),
        dealer: [
          cardLabel(session.dealer[0]),
          '?'
        ],
        playerTotal: handTotal(session.player),
        dealerTotal: null,
        revealDealer: false
      }
    : null;

  const attachment = new AttachmentBuilder(await renderCasinoCard({
    title: interactiveCasinoTitle(session),
    subtitle: casinoCountdownText(session).replaceAll('**', ''),
    game: session.game,
    bet: session.bet,
    balance: null,
    multiplier: casinoCardMultiplier(session),
    status: interactiveCasinoStatus(session),
    board: casinoCardBoard(session),
    tone: 'active',
    primeBadge: canvasPrimeBadge(profile),
    blackjackState
  }), { name: 'casino-card.png' });

  return {
    embeds: [interactiveCasinoEmbed(session, profile, user)],
    components: interactiveCasinoRows(session),
    files: [attachment]
  };
}

async function finishedCasinoPayload(session, outcome, net, profile, boosterEffect = null) {
  const won = net > 0;
  const pushed = net === 0;

  const blackjackState = session.game === 'blackjack'
    ? {
        player: session.player.map(card => cardLabel(card)),
        dealer: session.dealer.map(card => cardLabel(card)),
        playerTotal: handTotal(session.player),
        dealerTotal: handTotal(session.dealer),
        revealDealer: true
      }
    : null;

  const attachment = new AttachmentBuilder(await renderCasinoCard({
    title: `${won ? 'Sən qazandın' : pushed ? 'Balans qorundu' : 'Sən uduzdun'} - ${outcome.title}`,
    subtitle: formatAuraText(outcome.description.replaceAll('*', '').split('\n')[0]),
    game: session.game,
    bet: session.bet,
    balance: profile.balance,
    multiplier: `${outcome.multiplier.toFixed(2)}x`,
    status: boosterEffect
      ? `${boosterStatus(boosterEffect)} • Nəticə: ${formatSignedAura(net)}`
      : net >= 0
        ? `Nəticə: +${formatNumber(net)} Aura`
        : `Nəticə: -${formatNumber(Math.abs(net))} Aura`,
    board: finishedCasinoBoard(session, outcome),
    tone: won ? 'win' : pushed ? 'push' : 'lose',
    primeBadge: canvasPrimeBadge(profile),
    blackjackState
  }), { name: 'casino-card.png' });

  return {
    embeds: [finishedCasinoEmbed(session, outcome, net, profile, boosterEffect)],
    components: [casinoHelpRow(session.game)],
    files: [attachment]
  };
}

function addBoosterField(embed, boosterEffect) {
  if (!boosterEffect) return embed;
  const value = boosterEffect.type === 'surge'
    ? `Casino charge istifadə olundu. **${boosterEffect.multiplier.toFixed(2)}x** bonus effekti: **+${formatNumber(boosterEffect.amount)} ${gameCopy.currency}**.`
    : `Casino charge istifadə olundu. Loss shield **+${formatNumber(boosterEffect.amount)} ${gameCopy.currency}** geri qaytardı.`;
  embed.addFields({ name: '🍀 Lucky Booster', value, inline: false });
  return embed;
}

function addTicketField(embed, entry) {
  if (!entry?.usedTicket) return embed;
  embed.addFields({
    name: '🎟️ Reward Ticket',
    value: `1 ticket istifadə olundu və mərcin **${formatNumber(entry.ticketCover)} ${gameCopy.currency}** hissəsini ödədi.`,
    inline: false
  });
  return embed;
}

function ticketPaymentLine(session) {
  if (!session.usedTicket) return `${formatNumber(session.cost)} ${gameCopy.currency}`;
  if (session.cost <= 0) return `Reward Ticket (${formatNumber(session.ticketCover)} ${gameCopy.currency})`;
  return `${formatNumber(session.cost)} ${gameCopy.currency} + Reward Ticket (${formatNumber(session.ticketCover)} ${gameCopy.currency})`;
}

function balanceDeltaLine(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) {
    return `${formatNumber(after)} ${gameCopy.currency}`;
  }

  if (before === after) {
    return `${formatNumber(after)} ${gameCopy.currency}`;
  }

  return `${formatNumber(before)} → ${formatNumber(after)} ${gameCopy.currency}`;
}

function boosterStatus(boosterEffect) {
  if (!boosterEffect) return '';
  return boosterEffect.type === 'surge'
    ? `Lucky Booster +${formatNumber(boosterEffect.amount)} Aura bonus verdi`
    : `Lucky Booster +${formatNumber(boosterEffect.amount)} Aura shield qaytardı`;
}

function casinoCardMultiplier(session) {
  if (session.multiplier) return `${session.multiplier.toFixed(2)}x`;
  if (session.cashout) return `${session.cashout.toFixed(2)}x`;
  return 'Seçim';
}

function casinoCardBoard(session) {
  if (session.game === 'mines') return minesBoard(session, false).replaceAll('\n', '   ');
  if (session.game === 'blackjack') return `Sən: ${handLabel(session.player)} (${handTotal(session.player)}) • Diler: ${cardLabel(session.dealer[0])}, ?`;
  if (session.game === 'tower') return `Mərtəbə ${session.floor}/${session.maxFloors} • Götürmə ${session.multiplier.toFixed(2)}x`;
  if (session.game === 'higherlower') return `İlk kart ${cardRankLabel(session.firstCard ?? session.current)} (${higherLowerValue(session.firstCard ?? session.current)}) • A=14 • yuxarı/aşağı seç`;
  if (session.game === 'crash') return 'Çıxış çarpanını seç • aşağı risk daha təhlükəsizdir';
  return 'Düymə ilə seçim et • nəticə canlı yenilənəcək';
}

function finishedCasinoBoard(session, outcome) {
  if (outcome.revealAll && session.game === 'mines') {
    return minesBoard(session, true).replaceAll('\n', '   ');
  }

  if (session.game === 'penalty') {
    return outcome.description.replaceAll('*', '');
  }

  return casinoCardBoard(session);
}

function interactiveCasinoRows(session) {
  if (session.game === 'slots') return withCasinoHelp(session, choiceRows(session, [
    ['spin', '🎰 Fırlat', ButtonStyle.Primary]
  ]));
  if (session.game === 'risk') return withCasinoHelp(session, choiceRows(session, [
    ['safe', '🟢 Sakit', ButtonStyle.Success],
    ['balanced', '🟡 Orta', ButtonStyle.Primary],
    ['bold', '🔴 Cəsarətli', ButtonStyle.Danger]
  ]));
  if (session.game === 'mines') return withCasinoHelp(session, minesRows(session));
  if (session.game === 'blackjack') return withCasinoHelp(session, blackjackRows(session));
  if (session.game === 'tower') return withCasinoHelp(session, towerRows(session));
  if (session.game === 'crash') return withCasinoHelp(session, crashRows(session));
  if (session.game === 'dice') return withCasinoHelp(session, choiceRows(session, [
    ['roll', '🎲 Zəri at', ButtonStyle.Primary]
  ]));
  if (session.game === 'higherlower') return withCasinoHelp(session, higherLowerRows(session));
  if (session.game === 'coinflip') return withCasinoHelp(session, choiceRows(session, [
    ['heads', '🟡 Üz', ButtonStyle.Primary],
    ['tails', '⚫ Arxa', ButtonStyle.Secondary]
  ]));
  if (session.game === 'roulette') return withCasinoHelp(session, choiceRows(session, [
    ['red', '🔴 Qırmızı', ButtonStyle.Danger],
    ['black', '⚫ Qara', ButtonStyle.Secondary]
  ]));
  if (session.game === 'wheel') return withCasinoHelp(session, choiceRows(session, [
    ['spin', '🎡 Çarxı fırlat', ButtonStyle.Primary]
  ]));
  if (session.game === 'lottery') return withCasinoHelp(session, choiceRows(session, [
    ['open', '🎟️ Bileti aç', ButtonStyle.Primary]
  ]));
  if (session.game === 'jackpot') return withCasinoHelp(session, choiceRows(session, [
    ['open', '💰 Jackpotu yoxla', ButtonStyle.Danger]
  ]));
  if (session.game === 'baccarat') return withCasinoHelp(session, choiceRows(session, [
    ['player', '🧑 Oyunçu', ButtonStyle.Primary],
    ['banker', '🏦 Bankir', ButtonStyle.Secondary],
    ['tie', '⚖️ Bərabər', ButtonStyle.Success]
  ]));
  if (session.game === 'poker') return withCasinoHelp(session, choiceRows(session, [
    ['draw', '🃏 Əli aç', ButtonStyle.Primary]
  ]));
  if (session.game === 'horse') return withCasinoHelp(session, horseRows(session));
  if (session.game === 'penalty') return withCasinoHelp(session, choiceRows(session, [
    ['left', '⬅️ Sol', ButtonStyle.Secondary],
    ['center', '🎯 Orta', ButtonStyle.Primary],
    ['right', '➡️ Sağ', ButtonStyle.Secondary]
  ]));
  return withCasinoHelp(session, choiceRows(session, [
    ['rock', '🪨 Daş', ButtonStyle.Secondary],
    ['paper', '📄 Kağız', ButtonStyle.Primary],
    ['scissors', '✂️ Qayçı', ButtonStyle.Secondary]
  ]));
}

function minesRows(session) {
  const rows = [];
  for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
    const row = new ActionRowBuilder();
    for (let column = 0; column < 3; column += 1) {
      const tile = rowIndex * 3 + column;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`casino:${session.id}:tile:${tile}`)
          .setLabel(session.revealed.has(tile) ? 'Təmiz' : `${tile + 1}`)
          .setStyle(session.revealed.has(tile) ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(session.revealed.has(tile))
      );
    }
    rows.push(row);
  }

  rows.push(new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`casino:${session.id}:cashout`)
      .setLabel(`Götür ${session.multiplier.toFixed(2)}x`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(session.revealed.size === 0), 'cashout', '💰')
  ));
  return rows;
}

function blackjackRows(session) {
  return [
    new ActionRowBuilder().addComponents(
      withUiEmoji(new ButtonBuilder()
        .setCustomId(`casino:${session.id}:hit`)
        .setLabel('Kart çək')
        .setStyle(ButtonStyle.Primary), 'games', '🃏'),
      withUiEmoji(new ButtonBuilder()
        .setCustomId(`casino:${session.id}:stand`)
        .setLabel('Dayan')
        .setStyle(ButtonStyle.Success), 'accept', '✅')
    )
  ];
}

function towerRows(session) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`casino:${session.id}:climb`)
        .setLabel('Qalx')
        .setStyle(ButtonStyle.Primary),
      withUiEmoji(new ButtonBuilder()
        .setCustomId(`casino:${session.id}:cashout`)
        .setLabel(`Götür ${session.multiplier.toFixed(2)}x`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(session.floor === 0), 'cashout', '💰')
    )
  ];
}

function crashRows(session) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`casino:${session.id}:1.5`)
        .setLabel('1.50x')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`casino:${session.id}:2`)
        .setLabel('2.00x')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`casino:${session.id}:3`)
        .setLabel('3.00x')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`casino:${session.id}:5`)
        .setLabel('5.00x')
        .setStyle(ButtonStyle.Danger),
      withUiEmoji(new ButtonBuilder()
        .setCustomId(`casino:${session.id}:cashout_modal`)
        .setLabel('Xüsusi')
        .setStyle(ButtonStyle.Success), 'custom', '✏️')
    )
  ];
}

function higherLowerRows(session) {
  const firstCard = session.firstCard ?? session.current;
  return [
    new ActionRowBuilder().addComponents(
      withUiEmoji(new ButtonBuilder()
        .setCustomId(`casino:${session.id}:higher:${firstCard}`)
        .setLabel('Yuxarı')
        .setStyle(ButtonStyle.Primary), 'up', '⬆️'),
      withUiEmoji(new ButtonBuilder()
        .setCustomId(`casino:${session.id}:lower:${firstCard}`)
        .setLabel('Aşağı')
        .setStyle(ButtonStyle.Secondary), 'down', '⬇️')
    )
  ];
}

function horseRows(session) {
  return [
    new ActionRowBuilder().addComponents(
      [1, 2, 3].map(number =>
        withUiEmoji(new ButtonBuilder()
          .setCustomId(`casino:${session.id}:${number}`)
          .setLabel(`#${number}`)
          .setStyle(ButtonStyle.Secondary), 'games', '🏁')
      )
    ),
    new ActionRowBuilder().addComponents(
      [4, 5, 6].map(number =>
        withUiEmoji(new ButtonBuilder()
          .setCustomId(`casino:${session.id}:${number}`)
          .setLabel(`#${number}`)
          .setStyle(ButtonStyle.Secondary), 'games', '🏁')
      )
    )
  ];
}

function choiceRows(session, choices) {
  return [
    new ActionRowBuilder().addComponents(
      choices.map(([value, label, style]) =>
        new ButtonBuilder()
          .setCustomId(`casino:${session.id}:${value}`)
          .setLabel(label)
          .setStyle(style)
      )
    )
  ];
}

function withCasinoHelp(session, rows) {
  return [...rows, casinoHelpRow(session.game)];
}

function casinoHelpRow(game) {
  return new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`casino_help:${game}`)
      .setLabel('Necə işləyir?')
      .setStyle(ButtonStyle.Secondary), 'help', '❔')
  );
}

function interactiveCasinoTitle(session) {
  const titles = {
    coinflip: 'Sikkə atışı',
    slots: 'Tərz slotları',
    risk: 'Risk oyunu',
    dice: 'Zər oyunu',
    roulette: 'Rulet',
    rps: 'Daş kağız qayçı',
    higherlower: 'Yuxarı / aşağı',
    mines: 'Mina oyunu',
    tower: 'Qüllə oyunu',
    blackjack: '21 oyunu',
    crash: 'Crash oyunu',
    wheel: 'Uğur çarxı',
    lottery: 'Lotereya',
    jackpot: 'Jackpot',
    baccarat: 'Baccarat',
    poker: 'Poker',
    horse: 'At yarışı',
    penalty: 'Penalti'
  };
  return titles[session.game] ?? session.game;
}

function interactiveCasinoStatus(session) {
  if (session.game === 'mines') return `Təmiz: ${session.revealed.size}/7 | Götürmə: ${session.multiplier.toFixed(2)}x | 2 mina gizlidir.`;
  if (session.game === 'blackjack') return 'Kart çək 21-ə yaxınlaşır, Dayan dileri açır.';
  if (session.game === 'tower') return `Mərtəbə: ${session.floor}/${session.maxFloors} | Götürmə: ${session.multiplier.toFixed(2)}x`;
  if (session.game === 'crash') return 'Aşağı çarpan daha təhlükəsizdir, yüksək çarpan daha risklidir.';
  if (session.game === 'lottery') return session.usedTicket ? `1 Reward Ticket ${formatNumber(session.ticketCover)} Aura hissəni ödəyib.` : 'Bileti aç və nəticəni gör.';
  if (session.game === 'risk') return 'Risk səviyyəsini özün seç: sakit daha az payout, cəsarətli daha böyük riskdir.';
  return 'Seçimi düymə ilə et.';
}

async function validatePvpChallenge(interaction, opponent, stake) {
  if (!opponent || opponent.bot || opponent.id === interaction.user.id) {
    await interaction.reply({
      content: 'PvP oyun üçün real başqa üzv seç.',
      ephemeral: true
    });
    return false;
  }

  if (!Number.isInteger(stake) || stake <= 0) {
    await interaction.reply({
      content: 'Mərc məbləği düzgün deyil.',
      ephemeral: true
    });
    return false;
  }

  const [challengerBalance, opponentBalance] = await Promise.all([
    getBalance(interaction.user.id),
    getBalance(opponent.id)
  ]);

  if (challengerBalance < stake) {
    await interaction.reply({
      embeds: [
        gameEmbed()
          .setTitle('Balans kifayət etmir')
          .setDescription(
            `Bu oyun üçün **${formatNumber(stake)} Aura** lazımdır.`
          )
          .addFields({
            name: 'Sənin balansın',
            value: `**${formatNumber(challengerBalance)} Aura**`
          })
      ],
      ephemeral: true
    });

    return false;
  }

  if (opponentBalance < stake) {
    await interaction.reply({
      embeds: [
        gameEmbed()
          .setTitle('Rəqibin balansı kifayət etmir')
          .setDescription(
            `${opponent} bu oyunun **${formatNumber(stake)} Aura** mərcini qarşılaya bilmir.`
          )
          .addFields({
            name: 'Rəqibin balansı',
            value: `**${formatNumber(opponentBalance)} Aura**`
          })
      ],
      allowedMentions: { users: [] },
      ephemeral: true
    });

    return false;
  }

  // KEEP EVERYTHING ALREADY BELOW THIS
  if (isUserInAnyGame(interaction.user.id)) {
    await interaction.reply({ content: `${opponent} artıq aktiv oyundadır. Bir az sonra yenidən çağır.`, ephemeral: true });
    return false;
  }

  const targetSettings = await getGameRequestSettings(opponent.id);
  if (!targetSettings.enabled) {
    await interaction.reply({ content: `${opponent} PvP oyun çağırışlarını bağlayıb.`, ephemeral: true });
    return false;
  }

  if (!(await canSpend(interaction.user.id, stake))) {
    await notEnoughAura(interaction, stake);
    return false;
  }

  return true;
}

async function handleGameRequestsSetting(interaction) {
  const mode = interaction.options.getString('mode');

  if (mode === 'status') {
    const settings = await getGameRequestSettings(interaction.user.id);
    await interaction.reply({
      embeds: [gameEmbed().setTitle('Oyun çağırışları').setDescription(settings.enabled ? 'PvP çağırışların **açıqdır**.' : 'PvP çağırışların **bağlıdır**.')],
      ephemeral: true
    });
    return;
  }

  const profile = await setGameRequests(interaction.user.id, mode === 'on');
  await interaction.reply({
    embeds: [
      gameEmbed()
        .setTitle('Oyun çağırışları yeniləndi')
        .setDescription(profile.settings.gameRequests ? 'Artıq sənə PvP oyun çağırışı göndərə bilərlər.' : 'Artıq sənə PvP oyun çağırışı göndərilə bilməz.')
    ],
    ephemeral: true
  });
}

function isUserInAnyGame(userId) {
  return activeCasinoUserSessions.has(userId)
    || isUserInPendingMap(pendingDuels, userId)
    || isUserInPendingMap(pendingDiceBattles, userId)
    || isUserInPendingMap(pendingQuickDraws, userId)
    || [...activeHeists.values()].some(heist => heist.players?.has(userId));
}

function isUserInPendingMap(map, userId) {
  return [...map.values()].some(session => session.challengerId === userId || session.opponentId === userId);
}

async function takePvpStakes(firstId, secondId, stake) {
  const firstReady = await spendBalance(firstId, stake);
  const secondReady = await spendBalance(secondId, stake);

  if (!firstReady || !secondReady) {
    if (firstReady) await addBalance(firstId, stake, { safeMode: false });
    if (secondReady) await addBalance(secondId, stake, { safeMode: false });
    return { ok: false };
  }

  return { ok: true };
}

function rollDiceSet() {
  return Array.from({ length: 3 }, () => 1 + Math.floor(Math.random() * 6));
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

async function recordPvpGame(userId, game, stake, won, net) {
  await recordGame(userId, {
    game,
    bet: stake,
    won,
    net,
    multiplier: won ? 2 : 0,
    ledger: net > 0
  });
}

function pvpResultEmbed({ title, winnerId, description, reward }) {
  return gameEmbed()
    .setColor(winnerId ? brand.success : brand.neutral)
    .setTitle(winnerId ? `🏆 ${title}` : title)
    .setThumbnail(casinoImageUrl('dice'))
    .setDescription(description)
    .addFields(
      { name: 'Qalib', value: winnerId ? `<@${winnerId}>` : 'Bərabərlik', inline: true },
      { name: 'Mükafat', value: reward, inline: true }
    );
}

function heistEmbed(heist) {
  const players = [...heist.players];
  const successChance = Math.min(0.78, 0.35 + players.length * 0.08);
  return gameEmbed()
    .setTitle('💰 Aura Heist lobby')
    .setThumbnail(casinoImageUrl('heist'))
    .setDescription('Komanda yığ, sonra lobby sahibi heist-i başladır.')
    .addFields(
      { name: 'Risk', value: `${heist.stake} ${gameCopy.currency} hər oyunçu`, inline: true },
      { name: 'Oyunçu', value: `${players.length}/6`, inline: true },
      { name: 'Uğur şansı', value: `${Math.round(successChance * 100)}%`, inline: true },
      { name: 'Komanda', value: players.map(playerId => `<@${playerId}>`).join('\n'), inline: false },
      { name: 'Qayda', value: 'Uğurlu olsa hər kəs pay alır. Alınmasa hər kəs stake və kiçik cərimə itirir.', inline: false }
    );
}

async function handleCasinoHelpButton(interaction) {
  const game = interaction.customId.replace('casino_help:', '');
  await interaction.reply({
    embeds: [casinoHelpEmbed(game)],
    ephemeral: true
  });
}

function casinoHelpEmbed(game) {
  const help = casinoHelpText(game);
  return gameEmbed()
    .setTitle(`${interactiveCasinoTitle({ game })} necə işləyir?`)
    .setThumbnail(casinoImageUrl(game))
    .setDescription(help.description)
    .addFields(
      { name: 'Məqsəd', value: help.goal, inline: false },
      { name: 'Düymələr', value: help.buttons, inline: false },
      { name: 'Ödəniş', value: help.payout, inline: false },
      { name: 'Qeyd', value: 'Aura yalnız server içi əyləncə balansıdır. Hər oyunda cooldown və server üstünlüyü var.', inline: false }
    );
}

function casinoHelpText(game) {
  const common = {
    slots: {
      description: 'Slotda məqsəd 3 simvolu uyğun gətirməkdir.',
      goal: '3 eyni simvol böyük qazanc verir, 2 eyni simvol kiçik qazanc verir.',
      buttons: '`🎰 Fırlat` basırsan, simvollar açılır və nəticə dərhal hesablanır.',
      payout: '3 eyni: 5.00x. 2 eyni: 1.70x. Uyğunluq yoxdursa mərc itir.'
    },
    risk: {
      description: 'Risk oyununda qazanc səviyyəsini özün seçirsən.',
      goal: 'Sakit oyun daha təhlükəsizdir, cəsarətli oyun daha böyük çarpan verir.',
      buttons: '`Sakit`, `Orta`, `Cəsarətli` düymələrindən birini seç.',
      payout: 'Risk artdıqca qazanma ehtimalı azalır, amma çarpan böyüyür.'
    },
    coinflip: {
      description: 'Sikkənin hansı tərəfə düşəcəyini təxmin edirsən.',
      goal: 'Üz və ya arxa seç. Düz tapsan payout gəlir.',
      buttons: '`Üz` və ya `Arxa` seç.',
      payout: 'Düz seçim 1.95x verir, səhv seçim mərcin itməsidir.'
    },
    dice: {
      description: 'Sən və sistem zər atırsınız.',
      goal: 'Sənin zərin sistemin zərindən böyük olmalıdır.',
      buttons: '`Zəri at` nəticəni açır.',
      payout: 'Sən böyük olsan 1.80x. Bərabərlikdə mərcin bir hissəsi qayıdır.'
    },
    roulette: {
      description: 'Rulet rəng təxminidir.',
      goal: 'Top qırmızı və ya qara rəngə düşəcək. 0 yaşıl rəngdir və rəng mərclərini uduzdurur.',
      buttons: '`Qırmızı` və ya `Qara` seç.',
      payout: 'Düz rəng 1.95x verir.'
    },
    blackjack: {
      description: '21 oyununda məqsəd 21-i keçmədən dilerin əlindən yüksək xal toplamaqdır.',
      goal: 'A 11 sayılır, amma əl 21-i keçirsə 1-ə düşür. Üz kartları 10 sayılır.',
      buttons: '`Kart çək` yeni kart verir. `Dayan` seçəndə diler kartlarını açır və nəticə hesablanır.',
      payout: 'Dileri keçsən 1.90x. Bərabərlikdə mərc geri qayıdır. 21-i keçsən raund dərhal uduzulur.'
    },
    crash: {
      description: 'Crash oyununda çıxış çarpanını əvvəlcədən seçirsən.',
      goal: 'Crash nöqtəsi sənin seçdiyin çarpandan yüksək olsa qazanırsan.',
      buttons: 'Hazır çarpanlardan birini seç və ya `Xüsusi` ilə modal açıb öz rəqəmini yaz.',
      payout: 'Aşağı çarpan daha təhlükəsizdir. Ödəniş seçdiyin çarpanın təxminən 92%-i ilə hesablanır.'
    },
    mines: {
      description: 'Mina sahəsində 9 xana var, 2-si minadır.',
      goal: 'Təmiz xanaları açdıqca çarpan artır. Mina açsan mərc itir.',
      buttons: 'Xana düymələrinə bas. İstədiyin vaxt `Götür` ilə çarpanı bağla.',
      payout: 'Hər təmiz xana çarpanı artırır. Bütün təhlükəsiz xanaları açsan böyük payout alırsan.'
    },
    tower: {
      description: 'Qüllədə mərtəbə-mərtəbə qalxırsan.',
      goal: 'Hər uğurlu mərtəbə çarpanı artırır. Yıxılsan mərc itir.',
      buttons: '`Qalx` növbəti mərtəbəni yoxlayır. `Götür` mövcud çarpanı bağlayır.',
      payout: 'Mərtəbə yüksəldikcə payout artır, amma uğur şansı azalır.'
    },
    higherlower: {
      description: 'Kartın növbəti dəyərinin yuxarı, yoxsa aşağı olacağını təxmin edirsən. Bu oyunda A ən böyük kartdır.',
      goal: 'İlk kart göstərilir. İkinci kartın böyük və ya kiçik olacağını seç.',
      buttons: '`Yuxarı` və ya `Aşağı` seç.',
      payout: 'Kart sırası: 2 < 3 < ... < Q < K < A. Düz təxmin 1.85x verir. Eyni kart çıxsa mərc geri qayıdır.'
    },
    wheel: {
      description: 'Uğur çarxında çarx müxtəlif çarpanlardan birində dayanır.',
      goal: 'Çarxı fırlat və düşən çarpanı gör.',
      buttons: '`Çarxı fırlat` nəticəni açır.',
      payout: 'Çarxda 0x-dan 2.40x-a qədər nəticələr var.'
    },
    lottery: {
      description: 'Lotereya nadir böyük qazanc oyunudur.',
      goal: 'Bileti aç və mükafatlı olub-olmadığını yoxla.',
      buttons: '`Bileti aç` nəticəni göstərir.',
      payout: 'Uğurlu bilet 8.00x verir. Reward Ticket varsa mərcin ilk 500 Aura hissəsini ödəyir.'
    },
    jackpot: {
      description: 'Jackpot çox riskli, böyük payout oyunudur.',
      goal: 'Nadir jackpot və ya kiçik pay düşə bilər.',
      buttons: '`Jackpotu yoxla` nəticəni açır.',
      payout: 'Jackpot 25.00x, kiçik pay 2.00x verir.'
    },
    rps: {
      description: 'Daş kağız qayçı klassik seçim oyunudur.',
      goal: 'Daş qayçını, qayçı kağızı, kağız daşı udur.',
      buttons: '`Daş`, `Kağız`, `Qayçı` seç.',
      payout: 'Qələbə 1.80x verir. Bərabərlikdə mərc geri qayıdır.'
    },
    baccarat: {
      description: 'Baccaratda oyunçu, bankir və ya bərabərlik seçirsən.',
      goal: 'Hansı tərəfin 0-9 arası daha yüksək xal alacağını təxmin et.',
      buttons: '`Oyunçu`, `Bankir`, `Bərabər` düymələrindən birini seç.',
      payout: 'Oyunçu 1.90x, bankir 1.85x, bərabərlik 8.00x verir.'
    },
    poker: {
      description: 'Poker raundunda bir əl açılır və əl gücünə görə payout verilir.',
      goal: 'Daha güclü əl daha böyük çarpan deməkdir.',
      buttons: '`Əli aç` nəticəni göstərir.',
      payout: 'Cüt kiçik payout verir, straight/flush daha böyük payout verir.'
    },
    horse: {
      description: 'At yarışında 6 nömrədən birini seçirsən.',
      goal: 'Seçdiyin nömrə yarışı qazanmalıdır.',
      buttons: '#1-dən #6-ya qədər bir düymə seç.',
      payout: 'Düz at 5.00x verir.'
    },
    penalty: {
      description: 'Penaltidə zərbənin istiqamətini seçirsən.',
      goal: 'Qapıçı sənin seçdiyin tərəfə tullansa uduzursan, başqa tərəfə getsə qol olur.',
      buttons: '`Sol`, `Orta`, `Sağ` seç.',
      payout: 'Qol olsa 1.35x verir.'
    },
    dicebattle: {
      description: 'Dice Royale iki nəfərlik zər döyüşüdür.',
      goal: 'Hər oyunçu 3 zər atır. Toplamı böyük olan potu götürür.',
      buttons: 'Rəqib `Qəbul et` basandan sonra zərlər avtomatik atılır.',
      payout: 'Qalib iki stake-i götürür. Triple 6 bonus verir, triple 1 pis nəticədir.'
    },
    quickdraw: {
      description: 'Quick Draw reaksiya sürəti oyunudur.',
      goal: 'Bot “DRAW” deyəndə ilk basan qalibdir.',
      buttons: 'Əvvəl `Qəbul et`, sonra hazır ol. `BAS!` düyməsini yalnız DRAW çıxanda bas.',
      payout: 'Qalib bütün potu götürür. Tez basmaq false start sayılır və rəqib qalib olur.'
    },
    heist: {
      description: 'Aura Heist çox nəfərlik risk oyunudur.',
      goal: '2-6 nəfər lobby-yə qoşulur, sonra komanda bank soyğununa girir.',
      buttons: '`Qoşul` komandaya girir. `Başlat` yalnız lobby sahibində işləyir.',
      payout: 'Uğurlu olsa hamı pay alır. Alınmasa stake və əlavə cərimə çıxılır.'
    }
  };

  return common[game] ?? {
    description: 'Bu casino raundunda seçim düyməsi ilə nəticə açılır.',
    goal: 'Məqsəd düzgün seçim edib Aura çarpanı qazanmaqdır.',
    buttons: 'Ekrandakı oyun düymələrindən birini seç.',
    payout: 'Qalib nəticədə çarpan Aura balansına əlavə olunur.'
  };
}

function casinoImageUrl(game) {
  const emojiCodepoints = {
    slots: '1f3b0',
    risk: '1f3b2',
    coinflip: '1fa99',
    dice: '1f3b2',
    roulette: '1f534',
    blackjack: '1f0cf',
    crash: '1f4c8',
    mines: '1f4a3',
    tower: '1f3d7-fe0f',
    higherlower: '1f0cf',
    wheel: '1f3a1',
    lottery: '1f39f-fe0f',
    jackpot: '1f4b0',
    rps: '2702-fe0f',
    baccarat: '1f3e6',
    poker: '1f0cf',
    horse: '1f3c1',
    penalty: '1f945',
    duel: '2694-fe0f',
    dicebattle: '1f3b2',
    quickdraw: '26a1',
    heist: '1f4b0'
  };
  const codepoint = emojiCodepoints[game] ?? '1f3ae';
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoint}.png`;
}

function worldImageUrl(kind) {
  const emojiCodepoints = {
    world: '1f30d',
    job: '1f4bc',
    mission: '1f4cb',
    business: '1f3ea',
    property: '1f3e0',
    vehicle: '1f697',
    income: '1f4b8',
    adventure: '1f5fa-fe0f',
    explore: '1f9ed',
    event: '1f3aa',
    influence: '1f310',
    warning: '26a0-fe0f'
  };
  const codepoint = emojiCodepoints[kind] ?? emojiCodepoints.world;
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoint}.png`;
}

function minesBoard(session, revealAll) {
  const cells = Array.from({ length: 9 }, (_, index) => {
    if (session.revealed.has(index)) return '✅';
    if (revealAll && session.mines.has(index)) return '💣';
    return '⬜';
  });
  return `${cells.slice(0, 3).join(' ')}\n${cells.slice(3, 6).join(' ')}\n${cells.slice(6, 9).join(' ')}`;
}

function towerBoard(session) {
  const rows = [];
  for (let floor = session.maxFloors; floor >= 1; floor -= 1) {
    rows.push(floor <= session.floor ? `Lv.${floor} ✅` : `Lv.${floor} ⬜`);
  }
  return rows.join('\n');
}

function drawRank() {
  return 1 + Math.floor(Math.random() * 13);
}

function cardRankLabel(rank) {
  const labels = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  return labels[rank] ?? `${rank}`;
}

function higherLowerValue(rank) {
  return rank === 1 ? 14 : rank;
}

function drawCard() {
  const rank = drawRank();
  return { rank, value: rank === 1 ? 11 : Math.min(rank, 10) };
}

function cardLabel(card) {
  return cardRankLabel(card.rank);
}

function challengeCountdownField(createdAt) {
  const remainingMs = Math.max(0, gameRequestTtlMs - (Date.now() - createdAt));
  return {
    name: 'Vaxt',
    value: `Qəbul üçün **${Math.ceil(remainingMs / 1000)} saniyə** qalır.`,
    inline: true
  };
}

function isChallengeExpired(session) {
  return Date.now() - session.createdAt >= gameRequestTtlMs;
}

function duelInviteEmbed(duel, challengerId) {
  return gameEmbed()
    .setTitle('⚔️ Tərz dueli')
    .setDescription(`<@${challengerId}> səni tərz duelinə çağırır.`)
    .addFields(
      { name: 'Qoyulan Aura', value: `${duel.stake} ${gameCopy.currency}`, inline: true },
      { name: 'Ümumi pot', value: `${duel.stake * 2} ${gameCopy.currency}`, inline: true },
      challengeCountdownField(duel.createdAt),
      { name: 'Qayda', value: 'Hər iki tərəfdən Aura çıxılır. Qalib bütün potu götürür. Bərabərlik olarsa Aura geri qayıdır.', inline: false }
    );
}

function duelEnergy(profile, userId, duelId) {
  return Math.round(Math.max(45, Math.min(99,
    48
    + profile.level * 1.2
    + profile.prestige * 4
    + profile.luck * 0.18
    + profile.reputation * 0.08
    + hashScore(`${duelId}:${userId}`, 18)
  )));
}

function duelAbility(userId, duelId) {
  return pick([
    { key: 'burst', name: '🔥 Aura Burst', description: '+30 damage şansı' },
    { key: 'guard', name: '🛡️ Iron Guard', description: 'İlk böyük zərbəni yarıya salır' },
    { key: 'speed', name: '⚡ Sürət gücü', description: 'Bəzən iki dəfə vurur' },
    { key: 'luck', name: '🍀 Lucky Charm', description: 'Crit şansı artır' },
    { key: 'dodge', name: '🌀 Dodge', description: 'Bir zərbədən yayınma şansı' }
  ].sort(() => hashScore(`${duelId}:${userId}:${Math.random()}`, 3) - 1));
}

function simulateStyleDuel(duel, challengerProfile, opponentProfile) {
  const fighters = {
    [duel.challengerId]: {
      id: duel.challengerId,
      profile: challengerProfile,
      hp: 100,
      energy: duelEnergy(challengerProfile, duel.challengerId, duel.id ?? duel.createdAt),
      ability: duelAbility(duel.challengerId, duel.id ?? duel.createdAt),
      damage: 0,
      crits: 0,
      dodges: 0,
      longestCombo: 0,
      guardUsed: false
    },
    [duel.opponentId]: {
      id: duel.opponentId,
      profile: opponentProfile,
      hp: 100,
      energy: duelEnergy(opponentProfile, duel.opponentId, duel.id ?? duel.createdAt),
      ability: duelAbility(duel.opponentId, duel.id ?? duel.createdAt),
      damage: 0,
      crits: 0,
      dodges: 0,
      longestCombo: 0,
      guardUsed: false
    }
  };
  const ids = [duel.challengerId, duel.opponentId];
  const rounds = [];
  let legendary = null;

  if (Math.random() < 0.03) {
    const winnerId = Math.random() < duelWinChance(fighters[ids[0]], fighters[ids[1]]) ? ids[0] : ids[1];
    fighters[winnerId].damage = 100;
    fighters[winnerId === ids[0] ? ids[1] : ids[0]].hp = 0;
    legendary = {
      winnerId,
      text: `🌌 LEGENDARY FINISH!\n<@${winnerId}> **AURA OBLITERATION** açdı. Arena susdu.`
    };
    return { fighters, rounds: [legendary.text], winnerId, legendary };
  }

  const event = Math.random() < 0.25 ? pick(['crystal', 'wind', 'coin', 'exhaustion']) : null;
  if (event === 'coin') {
    fighters[ids[0]].energy += 10;
    fighters[ids[1]].energy += 10;
    rounds.push('🍀 Lucky Coin: hər iki oyunçu +10 Energy aldı.');
  } else if (event === 'exhaustion') {
    fighters[ids[0]].energy -= 8;
    fighters[ids[1]].energy -= 8;
    rounds.push('⚠️ Exhaustion: hər iki oyunçunun enerjisi azaldı.');
  } else if (event === 'crystal') {
    rounds.push('💎 Aura Crystal: bu döyüşdə crit şansı yüksəldi.');
  } else if (event === 'wind') {
    rounds.push('🌪️ Güclü külək: zərbələr daha qeyri-sabitdir.');
  }

  for (let round = 1; round <= 5; round += 1) {
    const attackerId = Math.random() < duelWinChance(fighters[ids[0]], fighters[ids[1]]) ? ids[0] : ids[1];
    const defenderId = attackerId === ids[0] ? ids[1] : ids[0];
    const attacker = fighters[attackerId];
    const defender = fighters[defenderId];
    const critChance = 0.12 + (attacker.ability.key === 'luck' ? 0.12 : 0) + (event === 'crystal' ? 0.15 : 0);
    const dodged = defender.ability.key === 'dodge' && Math.random() < 0.18;

    if (dodged) {
      defender.dodges += 1;
      rounds.push(`Round ${round}\n🌀 <@${defenderId}> mükəmməl dodge etdi. Zərbə boşa getdi.`);
      continue;
    }

    let damage = 12 + Math.floor(Math.random() * 17) + Math.floor((attacker.energy - defender.energy) / 8);
    let note = pick([
      'sürətli combo vurdu',
      'stylish counterattack etdi',
      'təmiz zərbə tapdı',
      'arenanı silkələyən hərəkət etdi',
      'ritmi ələ aldı'
    ]);

    if (attacker.ability.key === 'burst' && Math.random() < 0.25) {
      damage += 30;
      note = '🔥 Aura Burst açdı';
    }

    if (attacker.ability.key === 'speed' && Math.random() < 0.22) {
      damage += 10;
      attacker.longestCombo = Math.max(attacker.longestCombo, 2);
      note = '⚡ Sürət gücü ilə iki zərbə bağladı';
    }

    const crit = Math.random() < critChance;
    if (crit) {
      damage = Math.floor(damage * 1.7);
      attacker.crits += 1;
      note = `💥 CRITICAL HIT! ${note}`;
    }

    if (defender.ability.key === 'guard' && !defender.guardUsed && damage >= 25) {
      defender.guardUsed = true;
      damage = Math.ceil(damage / 2);
      note += '\n🛡️ Iron Guard zərbəni yarıya saldı';
    }

    damage = Math.max(6, damage + (event === 'wind' ? Math.floor(Math.random() * 13) - 6 : 0));
    const before = defender.hp;
    defender.hp = Math.max(0, defender.hp - damage);
    attacker.damage += before - defender.hp;
    attacker.longestCombo = Math.max(attacker.longestCombo, crit ? 3 : 1);
    rounds.push(`Round ${round}\n${note}\n<@${defenderId}> HP: **${before} → ${defender.hp}** (-${before - defender.hp})`);

    if (defender.hp <= 0) {
      break;
    }
  }

  let winnerId;
  if (fighters[ids[0]].hp === fighters[ids[1]].hp) {
    winnerId = Math.random() < duelWinChance(fighters[ids[0]], fighters[ids[1]]) ? ids[0] : ids[1];
  } else {
    winnerId = fighters[ids[0]].hp > fighters[ids[1]].hp ? ids[0] : ids[1];
  }

  return { fighters, rounds, winnerId, legendary };
}

function duelWinChance(first, second) {
  const diff = first.energy - second.energy;
  return Math.max(0.28, Math.min(0.72, 0.5 + diff / 100));
}

function duelBattleEmbed(duel, battle, visibleRounds = 0, final = false) {
  const first = battle.fighters[duel.challengerId];
  const second = battle.fighters[duel.opponentId];
  const shownRounds = battle.rounds.slice(0, visibleRounds).join('\n\n') || 'Döyüş başlayır...';
  const winner = battle.fighters[battle.winnerId];
  const loserId = battle.winnerId === duel.challengerId ? duel.opponentId : duel.challengerId;
  const chance = Math.round(duelWinChance(first, second) * 100);

  const embed = gameEmbed()
    .setColor(final ? brand.success : brand.color)
    .setTitle(final ? '🏆 STYLE DUEL QALİBİ' : '⚔️ STYLE DUEL CANLI')
    .setThumbnail(casinoImageUrl('duel'))
    .setDescription([
      `👑 <@${duel.challengerId}> | ${first.profile.rank}`,
      `Energy: **${first.energy}** ${progressBar(first.energy)}`,
      `Ability: **${first.ability.name}** - ${first.ability.description}`,
      '',
      `🆚`,
      '',
      `⚡ <@${duel.opponentId}> | ${second.profile.rank}`,
      `Energy: **${second.energy}** ${progressBar(second.energy)}`,
      `Ability: **${second.ability.name}** - ${second.ability.description}`,
      '',
      `Win chance: <@${duel.challengerId}> **${chance}%** | <@${duel.opponentId}> **${100 - chance}%**`,
      `Prize Pool: **${duel.stake * 2} Aura**`
    ].join('\n'))
    .addFields(
      { name: 'Canlı raundlar', value: shownRounds.slice(0, 1000), inline: false },
      { name: 'HP', value: `<@${duel.challengerId}>: **${first.hp}/100**\n<@${duel.opponentId}>: **${second.hp}/100**`, inline: true }
    );

  if (final) {
    embed.addFields(
      { name: 'Qalib', value: `<@${battle.winnerId}> +${duel.stake} Aura net`, inline: true },
      { name: 'Duel Stats', value: [
        `Damage: ${winner.damage}`,
        `Critical Hits: ${winner.crits}`,
        `Dodges: ${winner.dodges}`,
        `Longest Combo: ${winner.longestCombo}`,
        `Məğlub: <@${loserId}>`
      ].join('\n'), inline: false }
    );
  }

  return embed;
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function diceBattleInviteEmbed(battle, challengerId) {
  return gameEmbed()
    .setTitle('🎲 Dice Royale çağırışı')
    .setThumbnail(casinoImageUrl('dice'))
    .setDescription(`<@${challengerId}> səni 3 zərli Aura döyüşünə çağırır.`)
    .addFields(
      { name: 'Qoyuluş', value: `${battle.stake} ${gameCopy.currency} hər oyunçu`, inline: true },
      { name: 'Pot', value: `${battle.stake * 2} ${gameCopy.currency}`, inline: true },
      challengeCountdownField(battle.createdAt),
      { name: 'Qayda', value: 'Hər tərəf 3 zər atır. Daha yüksək toplam qalibdir. Triple 6 bonus, triple 1 ağır uduzdurur.', inline: false }
    );
}

function quickDrawInviteEmbed(quick, challengerId) {
  return gameEmbed()
    .setTitle('⚡ Quick Draw çağırışı')
    .setThumbnail(casinoImageUrl('quickdraw'))
    .setDescription(`<@${challengerId}> səni reaksiya oyununa çağırır.`)
    .addFields(
      { name: 'Qoyuluş', value: `${quick.stake} ${gameCopy.currency} hər oyunçu`, inline: true },
      challengeCountdownField(quick.createdAt),
      { name: 'Qayda', value: 'Qəbul ediləndən sonra bot gözləyir. “DRAW” çıxanda ilk basan qalibdir. Tez basmaq false start sayılır.', inline: false }
    );
}

function expiredChallengeEmbed(title, createdAt) {
  return gameEmbed()
    .setColor(brand.neutral)
    .setTitle(`${title} vaxtı bitdi`)
    .setDescription(`30 saniyə ərzində cavab gəlmədi. Çağırış avtomatik ləğv edildi.`)
    .addFields({ name: 'Açılıb', value: `<t:${Math.floor(createdAt / 1000)}:R>`, inline: true });
}

function startExpiringChallenge({ id, map, title, row, embed }) {
  clearExpiringGame(id);

  const tick = setInterval(() => {
    const session = map.get(id);
    if (!session?.message) {
      return;
    }

    if (Date.now() - session.createdAt >= gameRequestTtlMs) {
      clearExpiringGame(id);
      map.delete(id);
      session.message.edit({
        embeds: [expiredChallengeEmbed(title, session.createdAt)],
        components: []
      }).catch(error => console.error('Challenge expiry edit failed:', error));
      return;
    }

    session.message.edit({
      embeds: [embed(session)],
      components: [row(id)]
    }).catch(error => console.error('Challenge countdown edit failed:', error));
  }, gameRequestTickMs);

  expiringGameTimers.set(id, tick);
}

function clearExpiringGame(id) {
  const timer = expiringGameTimers.get(id);
  if (timer) {
    clearInterval(timer);
    expiringGameTimers.delete(id);
  }
}

function handTotal(cards) {
  let total = cards.reduce((sum, card) => sum + card.value, 0);
  let aces = cards.filter(card => card.rank === 1).length;

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function handLabel(cards) {
  return cards.map(cardLabel).join(', ');
}

function coinSideLabel(side) {
  return side === 'heads' ? 'üz' : 'arxa';
}

function colorLabel(color) {
  const labels = { red: 'qırmızı', black: 'qara', green: 'yaşıl' };
  return labels[color] ?? color;
}

function moveLabel(move) {
  const labels = { rock: 'daş', paper: 'kağız', scissors: 'qayçı' };
  return labels[move] ?? move;
}

function baccaratLabel(choice) {
  const labels = { player: 'oyunçu', banker: 'bankir', tie: 'bərabər' };
  return labels[choice] ?? choice;
}

function directionLabel(direction) {
  const labels = { left: 'sol', center: 'orta', right: 'sağ' };
  return labels[direction] ?? direction;
}

async function createDuel(interaction) {
  const opponent = interaction.options.getUser('opponent');
  const stake = interaction.options.getInteger('stake');

  if (!(await validatePvpChallenge(interaction, opponent, stake))) {
    return;
  }

  const duelId = `${interaction.id}:${interaction.user.id}:${opponent.id}`;
  pendingDuels.set(duelId, {
    id: duelId,
    challengerId: interaction.user.id,
    opponentId: opponent.id,
    stake,
    message: null,
    createdAt: Date.now()
  });

  const duel = pendingDuels.get(duelId);
  await interaction.reply({
    content: `${opponent}`,
    embeds: [duelInviteEmbed(duel, interaction.user.id)],
    components: [duelRows(duelId)],
    allowedMentions: { users: [opponent.id] }
  });
  const reply = await interaction.fetchReply();
  duel.message = reply;
  startExpiringChallenge({
    id: duelId,
    map: pendingDuels,
    title: 'Duel',
    row: duelRows,
    embed: session => duelInviteEmbed(session, session.challengerId)
  });
}

async function resolveDuel(interaction, duelId, accepted) {
  const duel = pendingDuels.get(duelId);

  if (!duel) {
    await interaction.reply({
      content: 'Bu duel artıq bağlanıb və ya vaxtı keçib.',
      ephemeral: true
    });
    return;
  }

  if (isChallengeExpired(duel)) {
    pendingDuels.delete(duelId);
    clearExpiringGame(duelId);
    await interaction.update({ embeds: [expiredChallengeEmbed('Duel', duel.createdAt)], components: [] });
    return;
  }

  if (interaction.user.id !== duel.opponentId) {
    await interaction.reply({
      content: 'Bu duel qərarını yalnız çağırılan üzv verə bilər.',
      ephemeral: true
    });
    return;
  }

  pendingDuels.delete(duelId);
  clearExpiringGame(duelId);

  if (!accepted) {
    await interaction.update({
      embeds: [
        gameEmbed()
          .setTitle('Duel rədd edildi')
          .setDescription(`<@${duel.opponentId}> bu raundu qəbul etmədi.`)
      ],
      components: []
    });
    return;
  }

  const challengerReady = await spendBalance(duel.challengerId, duel.stake);
  const opponentReady = await spendBalance(duel.opponentId, duel.stake);

  if (!challengerReady || !opponentReady) {
    if (challengerReady) await addBalance(duel.challengerId, duel.stake, { safeMode: false });
    if (opponentReady) await addBalance(duel.opponentId, duel.stake, { safeMode: false });

    await interaction.update({
      embeds: [
        gameEmbed()
          .setTitle('Duel ləğv edildi')
          .setDescription('Tərəflərdən birinin balansı qoyuluş üçün kifayət etmədi.')
      ],
      components: []
    });
    return;
  }

  const pot = duel.stake * 2;
  const challengerProfile = await getProfile(duel.challengerId);
  const opponentProfile = await getProfile(duel.opponentId);
  const battle = simulateStyleDuel(duel, challengerProfile, opponentProfile);
  const challengerWon = battle.winnerId === duel.challengerId;
  const opponentWon = battle.winnerId === duel.opponentId;

  if (challengerWon) {
    await addBalance(duel.challengerId, pot);
  } else {
    await addBalance(duel.opponentId, pot);
  }

  await interaction.update({
    embeds: [duelBattleEmbed(duel, battle, 0, false)],
    components: []
  });

  for (let index = 1; index <= battle.rounds.length; index += 1) {
    await sleep(1200);
    await interaction.editReply({
      embeds: [duelBattleEmbed(duel, battle, index, false)],
      components: []
    });
  }

  await recordGame(duel.challengerId, {
    game: 'duel',
    bet: duel.stake,
    won: challengerWon,
    net: challengerWon ? duel.stake : opponentWon ? -duel.stake : 0,
    multiplier: challengerWon ? 2 : 0
  });
  await recordGame(duel.opponentId, {
    game: 'duel',
    bet: duel.stake,
    won: opponentWon,
    net: opponentWon ? duel.stake : challengerWon ? -duel.stake : 0,
    multiplier: opponentWon ? 2 : 0
  });

  await sleep(900);
  await interaction.editReply({
    embeds: [duelBattleEmbed(duel, battle, battle.rounds.length, true)],
    components: []
  });
}

async function createDiceBattle(interaction) {
  const opponent = interaction.options.getUser('opponent');
  const stake = interaction.options.getInteger('stake');

  if (!(await validatePvpChallenge(interaction, opponent, stake))) {
    return;
  }

  const battleId = `${interaction.id}:${interaction.user.id}:${opponent.id}`;
  pendingDiceBattles.set(battleId, {
    challengerId: interaction.user.id,
    opponentId: opponent.id,
    stake,
    message: null,
    createdAt: Date.now()
  });

  const battle = pendingDiceBattles.get(battleId);
  await interaction.reply({
    content: `${opponent}`,
    embeds: [diceBattleInviteEmbed(battle, interaction.user.id)],
    components: [pvpChallengeRow('dice', battleId)],
    allowedMentions: { users: [opponent.id] }
  });
  const reply = await interaction.fetchReply();
  battle.message = reply;
  startExpiringChallenge({
    id: battleId,
    map: pendingDiceBattles,
    title: 'Dice Royale',
    row: id => pvpChallengeRow('dice', id),
    embed: session => diceBattleInviteEmbed(session, session.challengerId)
  });
}

async function resolveDiceBattle(interaction, battleId, accepted) {
  const battle = pendingDiceBattles.get(battleId);

  if (!battle) {
    await interaction.reply({ content: 'Bu dice battle artıq bağlanıb və ya vaxtı keçib.', ephemeral: true });
    return;
  }

  if (isChallengeExpired(battle)) {
    pendingDiceBattles.delete(battleId);
    clearExpiringGame(battleId);
    await interaction.update({ embeds: [expiredChallengeEmbed('Dice Royale', battle.createdAt)], components: [] });
    return;
  }

  if (interaction.user.id !== battle.opponentId) {
    await interaction.reply({ content: 'Bu çağırışı yalnız seçilən rəqib qəbul edə bilər.', ephemeral: true });
    return;
  }

  pendingDiceBattles.delete(battleId);
  clearExpiringGame(battleId);

  if (!accepted) {
    await interaction.update({
      embeds: [gameEmbed().setTitle('🎲 Dice Royale rədd edildi').setDescription(`<@${battle.opponentId}> bu raundu qəbul etmədi.`)],
      components: []
    });
    return;
  }

  const payment = await takePvpStakes(battle.challengerId, battle.opponentId, battle.stake);
  if (!payment.ok) {
    await interaction.update({
      embeds: [gameEmbed().setTitle('🎲 Dice Royale ləğv edildi').setDescription('Tərəflərdən birinin balansı qoyuluş üçün kifayət etmədi.')],
      components: []
    });
    return;
  }

  const first = rollDiceSet();
  const second = rollDiceSet();
  const firstTripleSix = first.every(value => value === 6);
  const secondTripleSix = second.every(value => value === 6);
  const firstTripleOne = first.every(value => value === 1);
  const secondTripleOne = second.every(value => value === 1);
  let winnerId = null;

  if (firstTripleSix !== secondTripleSix) {
    winnerId = firstTripleSix ? battle.challengerId : battle.opponentId;
  } else if (firstTripleOne !== secondTripleOne) {
    winnerId = firstTripleOne ? battle.opponentId : battle.challengerId;
  } else if (sum(first) !== sum(second)) {
    winnerId = sum(first) > sum(second) ? battle.challengerId : battle.opponentId;
  }

  const pot = battle.stake * 2;
  if (winnerId) {
    const bonus = (firstTripleSix || secondTripleSix) ? battle.stake : 0;
    await addBalance(winnerId, pot + bonus);
  } else {
    await addBalance(battle.challengerId, battle.stake, { safeMode: false });
    await addBalance(battle.opponentId, battle.stake, { safeMode: false });
  }

  await recordPvpGame(battle.challengerId, 'dicebattle', battle.stake, winnerId === battle.challengerId, winnerId ? winnerId === battle.challengerId ? battle.stake : -battle.stake : 0);
  await recordPvpGame(battle.opponentId, 'dicebattle', battle.stake, winnerId === battle.opponentId, winnerId ? winnerId === battle.opponentId ? battle.stake : -battle.stake : 0);

  await interaction.update({
    embeds: [
      pvpResultEmbed({
        title: winnerId ? '🎲 Dice Royale: qalib var' : '🎲 Dice Royale: bərabərlik',
        winnerId,
        description: [
          `<@${battle.challengerId}>: **${first.join(' + ')} = ${sum(first)}**`,
          `<@${battle.opponentId}>: **${second.join(' + ')} = ${sum(second)}**`,
          firstTripleSix || secondTripleSix ? '🎯 Triple 6 bonusu aktiv oldu.' : null,
          firstTripleOne || secondTripleOne ? '💀 Triple 1 ağır uduzma sayıldı.' : null
        ].filter(Boolean).join('\n'),
        reward: winnerId ? `${pot}${firstTripleSix || secondTripleSix ? ` + ${battle.stake} bonus` : ''} Aura` : 'Aura geri qaytarıldı.'
      })
    ],
    components: []
  });
}

async function createQuickDraw(interaction) {
  const opponent = interaction.options.getUser('opponent');
  const stake = interaction.options.getInteger('stake');

  if (!(await validatePvpChallenge(interaction, opponent, stake))) {
    return;
  }

  const quickId = `${interaction.id}:${interaction.user.id}:${opponent.id}`;
  pendingQuickDraws.set(quickId, {
    challengerId: interaction.user.id,
    opponentId: opponent.id,
    stake,
    ready: false,
    drawAt: null,
    message: null,
    createdAt: Date.now()
  });

  const quick = pendingQuickDraws.get(quickId);
  await interaction.reply({
    content: `${opponent}`,
    embeds: [quickDrawInviteEmbed(quick, interaction.user.id)],
    components: [pvpChallengeRow('quick', quickId)],
    allowedMentions: { users: [opponent.id] }
  });
  const reply = await interaction.fetchReply();
  quick.message = reply;
  startExpiringChallenge({
    id: quickId,
    map: pendingQuickDraws,
    title: 'Quick Draw',
    row: id => pvpChallengeRow('quick', id),
    embed: session => quickDrawInviteEmbed(session, session.challengerId)
  });
}

async function resolveQuickDraw(interaction, quickId, accepted) {
  const quick = pendingQuickDraws.get(quickId);

  if (!quick) {
    await interaction.reply({ content: 'Bu Quick Draw artıq bağlanıb və ya vaxtı keçib.', ephemeral: true });
    return;
  }

  if (isChallengeExpired(quick)) {
    pendingQuickDraws.delete(quickId);
    clearExpiringGame(quickId);
    await interaction.update({ embeds: [expiredChallengeEmbed('Quick Draw', quick.createdAt)], components: [] });
    return;
  }

  if (interaction.user.id !== quick.opponentId) {
    await interaction.reply({ content: 'Bu çağırışı yalnız seçilən rəqib qəbul edə bilər.', ephemeral: true });
    return;
  }

  if (!accepted) {
    pendingQuickDraws.delete(quickId);
    clearExpiringGame(quickId);
    await interaction.update({
      embeds: [gameEmbed().setTitle('⚡ Quick Draw rədd edildi').setDescription(`<@${quick.opponentId}> bu raundu qəbul etmədi.`)],
      components: []
    });
    return;
  }

  const payment = await takePvpStakes(quick.challengerId, quick.opponentId, quick.stake);
  if (!payment.ok) {
    pendingQuickDraws.delete(quickId);
    clearExpiringGame(quickId);
    await interaction.update({
      embeds: [gameEmbed().setTitle('⚡ Quick Draw ləğv edildi').setDescription('Tərəflərdən birinin balansı qoyuluş üçün kifayət etmədi.')],
      components: []
    });
    return;
  }

  const waitMs = 2500 + Math.floor(Math.random() * 3500);
  quick.message = interaction.message;
  quick.ready = false;
  quick.drawAt = Date.now() + waitMs;
  clearExpiringGame(quickId);

  await interaction.update({
    embeds: [
      gameEmbed()
        .setTitle('⚡ Quick Draw hazırlanır')
        .setThumbnail(casinoImageUrl('quickdraw'))
        .setDescription('Hazır ol. Düyməni yalnız **DRAW** yazısı çıxanda bas.')
        .addFields({ name: 'Oyunçular', value: `<@${quick.challengerId}> vs <@${quick.opponentId}>`, inline: false })
    ],
    components: [quickDrawRow(quickId, true)]
  });

  setTimeout(() => {
    const active = pendingQuickDraws.get(quickId);
    if (!active) return;
    active.ready = true;
    active.drawAt = Date.now();
    active.message?.edit({
      embeds: [
        gameEmbed()
          .setColor(brand.success)
          .setTitle('🔥 DRAW!')
          .setThumbnail(casinoImageUrl('quickdraw'))
          .setDescription('İndi bas. İlk düzgün klik qalibdir.')
      ],
      components: [quickDrawRow(quickId, false)]
    }).catch(error => console.error('Quick draw update failed:', error));
  }, waitMs);
}

async function pressQuickDraw(interaction, quickId) {
  const quick = pendingQuickDraws.get(quickId);

  if (!quick) {
    await interaction.reply({ content: 'Bu Quick Draw artıq bitib.', ephemeral: true });
    return;
  }

  if (![quick.challengerId, quick.opponentId].includes(interaction.user.id)) {
    await interaction.reply({ content: 'Bu Quick Draw raundunda sən yoxsan.', ephemeral: true });
    return;
  }

  let winnerId = interaction.user.id;
  let description;

  if (!quick.ready) {
    winnerId = interaction.user.id === quick.challengerId ? quick.opponentId : quick.challengerId;
    description = `${interaction.user} çox tez basdı. False start.`;
  } else {
    description = `${interaction.user} **${Date.now() - quick.drawAt}ms** reaksiya ilə basdı.`;
  }

  pendingQuickDraws.delete(quickId);
  clearExpiringGame(quickId);
  await addBalance(winnerId, quick.stake * 2);
  await recordPvpGame(quick.challengerId, 'quickdraw', quick.stake, winnerId === quick.challengerId, winnerId === quick.challengerId ? quick.stake : -quick.stake);
  await recordPvpGame(quick.opponentId, 'quickdraw', quick.stake, winnerId === quick.opponentId, winnerId === quick.opponentId ? quick.stake : -quick.stake);

  await interaction.update({
    embeds: [
      pvpResultEmbed({
        title: '⚡ Quick Draw nəticəsi',
        winnerId,
        description,
        reward: `${quick.stake * 2} Aura`
      })
    ],
    components: []
  });
}

async function createHeist(interaction) {
  const stake = interaction.options.getInteger('stake');
  if (!(await canSpend(interaction.user.id, stake))) {
    await notEnoughAura(interaction, stake);
    return;
  }

  const heistId = `${interaction.id}:${interaction.user.id}`;
  const heist = {
    id: heistId,
    creatorId: interaction.user.id,
    stake,
    players: new Set([interaction.user.id]),
    createdAt: Date.now()
  };
  activeHeists.set(heistId, heist);

  await interaction.reply({
    embeds: [heistEmbed(heist)],
    components: [heistRow(heistId, false)]
  });
}

async function joinHeist(interaction, heistId) {
  const heist = activeHeists.get(heistId);

  if (!heist) {
    await interaction.reply({ content: 'Bu heist artıq bitib və ya vaxtı keçib.', ephemeral: true });
    return;
  }

  if (heist.players.has(interaction.user.id)) {
    await interaction.reply({ content: 'Sən artıq bu heist lobby-sindəsən.', ephemeral: true });
    return;
  }

  if (heist.players.size >= 6) {
    await interaction.reply({ content: 'Bu heist lobby-si doludur. Maksimum 6 nəfər.', ephemeral: true });
    return;
  }

  if (!(await canSpend(interaction.user.id, heist.stake))) {
    await notEnoughAura(interaction, heist.stake);
    return;
  }

  heist.players.add(interaction.user.id);
  await interaction.update({
    embeds: [heistEmbed(heist)],
    components: [heistRow(heistId, false)]
  });
}

async function startHeist(interaction, heistId) {
  const heist = activeHeists.get(heistId);

  if (!heist) {
    await interaction.reply({ content: 'Bu heist artıq bitib və ya vaxtı keçib.', ephemeral: true });
    return;
  }

  if (interaction.user.id !== heist.creatorId) {
    await interaction.reply({ content: 'Heist-i yalnız lobby-ni açan üzv başlada bilər.', ephemeral: true });
    return;
  }

  if (heist.players.size < 2) {
    await interaction.reply({ content: 'Heist üçün ən az 2 nəfər lazımdır.', ephemeral: true });
    return;
  }

  activeHeists.delete(heistId);
  const players = [...heist.players];
  const paidPlayers = [];
  for (const playerId of players) {
    if (await spendBalance(playerId, heist.stake)) {
      paidPlayers.push(playerId);
    }
  }

  if (paidPlayers.length < 2) {
    for (const playerId of paidPlayers) {
      await addBalance(playerId, heist.stake, { safeMode: false });
    }
    await interaction.update({
      embeds: [gameEmbed().setTitle('💰 Heist ləğv edildi').setDescription('Ən az 2 nəfərin balansı qoyuluş üçün çatmalıdır.')],
      components: []
    });
    return;
  }

  const successChance = Math.min(0.78, 0.35 + paidPlayers.length * 0.08);
  const success = Math.random() < successChance;
  const pot = heist.stake * paidPlayers.length;
  const rewardEach = success ? Math.floor((pot * 1.8) / paidPlayers.length) : 0;
  const fine = success ? 0 : Math.floor(heist.stake * 0.35);

  for (const playerId of paidPlayers) {
    if (success) {
      await addBalance(playerId, rewardEach);
    } else if (fine > 0) {
      await applyFine(playerId, fine, 'heist_fine', `stake:${heist.stake}`);
    }
    await recordPvpGame(playerId, 'heist', heist.stake, success, success ? rewardEach - heist.stake : -heist.stake - fine);
  }

  await interaction.update({
    embeds: [
      gameEmbed()
        .setColor(success ? brand.success : 0xc53030)
        .setTitle(success ? '💰 HEIST UĞURLU OLDU' : '🚔 HEIST ALINMADI')
        .setThumbnail(casinoImageUrl('heist'))
        .setDescription(success ? 'Komanda bankdan Aura çıxara bildi.' : 'Polis gəldi, komanda cərimə yedi.')
        .addFields(
          { name: 'Oyunçular', value: paidPlayers.map(playerId => `<@${playerId}>`).join('\n'), inline: true },
          { name: 'Şans', value: `${Math.round(successChance * 100)}%`, inline: true },
          { name: 'Nəticə', value: success ? `Hər oyunçu **+${rewardEach - heist.stake} Aura net** aldı.` : `Hər oyunçu **-${heist.stake + fine} Aura** itirdi.`, inline: false }
        )
    ],
    components: []
  });
}

async function createAuraDrop(interaction) {
  const amount = interaction.options.getInteger('amount');
  const claims = interaction.options.getInteger('claims');
  const mode = interaction.options.getString('mode') ?? 'same';
  const durationSeconds = interaction.options.getInteger('duration');

  if (!Number.isInteger(amount) || !Number.isInteger(claims) || !Number.isInteger(durationSeconds) || amount < 1 || claims < 1 || durationSeconds < 5) {
    await interaction.reply({
      content: 'İstifadə: `/admin drop amount:1000 claims:5 mode:same duration:60`. Duration saniyə ilə yazılmalıdır.',
      ephemeral: true
    });
    return;
  }

  if (mode === 'random' && amount < claims) {
    await interaction.reply({
      content: 'Random bölüşdürmə üçün amount claim sayından az ola bilməz. Məsələn: amount:1000 claims:5.',
      ephemeral: true
    });
    return;
  }

  const dropId = createSafeDropId();
  const drop = {
    id: dropId,
    amount,
    claims,
    mode,
    remainingAmount: mode === 'random' ? amount : null,
    creatorId: interaction.user.id,
    claimedBy: [],
    claimRecords: [],
    createdAt: Date.now(),
    expiresAt: Date.now() + durationSeconds * 1000,
    cancelAvailableUntil: Date.now() + dropCancelGraceMs,
    paidAt: null,
    channelId: interaction.channelId,
    messageId: null
  };
  activeDrops.set(dropId, drop);
  await saveAuraDrop(drop);

  await interaction.reply({
    embeds: [dropEmbed(drop)],
    components: [dropRow(dropId, false, drop)]
  });

  const message = await interaction.fetchReply();
  drop.messageId = message.id;
  activeDrops.set(dropId, drop);
  await saveAuraDrop(drop);
  scheduleDropExpiry(drop, interaction.client);
}

async function claimAuraDrop(interaction, dropId) {
  const claimKey = `${dropId}:${interaction.user.id}`;

  if (pendingDropClaims.has(claimKey)) {
    await interaction.reply({ content: 'Bu claim artıq işlənir. Bir neçə saniyə gözlə.', ephemeral: true });
    return;
  }

  pendingDropClaims.add(claimKey);

  try {
    const drop = await loadAuraDrop(dropId);

    if (!drop) {
      await interaction.reply({ content: 'Bu Aura portalı artıq bağlanıb.', ephemeral: true });
      return;
    }

    if (drop.claimedBy.includes(interaction.user.id)) {
      await interaction.reply({ content: 'Bu portaldan artıq claim etmisən.', ephemeral: true });
      return;
    }

    if (drop.expiresAt && Date.now() >= drop.expiresAt) {
      await expireAuraDrop(dropId, interaction.client);
      await interaction.reply({ content: 'Bu Aura portalının vaxtı bitib.', ephemeral: true });
      return;
    }

    if (drop.claimedBy.length >= drop.claims) {
      await interaction.reply({ content: 'Bu Aura portalında claim limiti dolub.', ephemeral: true });
      return;
    }

    const payout = nextDropPayout(drop);
    drop.claimedBy.push(interaction.user.id);
    drop.claimRecords.push({
      userId: interaction.user.id,
      amount: payout,
      claimedAt: Date.now()
    });
    const closed = drop.claimedBy.length >= drop.claims;

    activeDrops.set(dropId, drop);
    await saveAuraDrop(drop);

    await interaction.update({
      content: null,
      embeds: [dropEmbed(drop, closed)],
      components: [dropRow(dropId, closed, drop)]
    });

    await interaction.followUp({
      content: `Claim qeydə alındı. Timer bitəndə **${formatNumber(payout)} ${gameCopy.currency}** hesabına yazılacaq.`,
      ephemeral: true
    });
  } finally {
    pendingDropClaims.delete(claimKey);
  }
}

async function cancelAuraDrop(interaction, dropId) {
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({ content: 'Bu düymə yalnız admin üçündür.', ephemeral: true });
    return;
  }

  const drop = await loadAuraDrop(dropId);
  if (!drop) {
    await interaction.reply({ content: 'Bu Aura portalı artıq bağlanıb.', ephemeral: true });
    return;
  }

  if (drop.cancelledAt) {
    await interaction.reply({ content: 'Bu Aura portalı artıq ləğv edilib.', ephemeral: true });
    return;
  }

  if (!isDropCancelable(drop)) {
    await interaction.reply({ content: 'Bu portalı artıq ləğv etmək üçün vaxtı bitib. Yeni portal açmaq lazımdır.', ephemeral: true });
    return;
  }

  drop.cancelledAt = Date.now();
  drop.cancelledBy = interaction.user.id;
  activeDrops.delete(dropId);
  await deleteAuraDrop(dropId);
  clearDropTimer(dropId);

  await interaction.update({
    content: null,
    embeds: [dropEmbed(drop, true).setTitle('Aura portalı ləğv edildi')],
    components: [dropRow(dropId, true, drop)]
  });
}

async function handleLoanButton(interaction) {
  const [, lender, amountText] = interaction.customId.split(':');
  const amount = Number(amountText);

  if (!Number.isInteger(amount) || amount <= 0) {
    await interaction.reply({ content: 'Loan amount yanlışdır.', ephemeral: true });
    return;
  }

  const result = await takeLoan(interaction.user.id, lender, amount);
  await interaction.reply({
    embeds: [loanTakenEmbed(result, interaction.user, lender, amount)],
    ephemeral: !result.ok
  });
}

async function handlePrimeBuyButton(interaction) {
  const result = await buyPrime(interaction.user.id);
  const embed = primeEmbed(result.profile)
    .setColor(result.ok ? brand.success : brand.accent)
    .setDescription(result.ok
      ? `Prime aktiv edildi. **${formatNumber(result.price)} Aura** tutuldu. Növbəti 30 gün ərzində 6 lost casino oyununu refund edə bilərsən.`
      : result.reason === 'active'
        ? 'Prime artıq aktivdir.'
        : `Prime üçün **${formatNumber(result.price)} Aura** lazımdır.`);

  await interaction.update({
    embeds: [embed],
    components: primeRows(result.profile)
  });
}

async function handlePrimeLossSelect(interaction) {
  const lossId = interaction.values[0];
  const prime = await getPrimeProfile(interaction.user.id);
  const selectedLoss = prime.losses.find(loss => loss.id === lossId);

  await interaction.update({
    embeds: [primeEmbed(prime, selectedLoss)],
    components: primeRows(prime, selectedLoss?.id)
  });
}

async function handlePrimeRefundButton(interaction, lossId) {
  if (!lossId || lossId === 'none') {
    await interaction.reply({ content: 'Əvvəl dropdown-dan refund ediləcək lost game seç.', ephemeral: true });
    return;
  }

  const result = await refundPrimeLoss(interaction.user.id, lossId);
  const embed = primeRefundResultEmbed(result);
  await interaction.update({
    embeds: [embed],
    components: primeRows(result.profile)
  });
}

async function showPrimeRefundModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('prime_refund_modal')
    .setTitle('Prime refund ID');

  const lossId = new TextInputBuilder()
    .setCustomId('loss_id')
    .setLabel('Lost game ID')
    .setPlaceholder('məs: pr_mines_lz123_abc')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(lossId));
  await interaction.showModal(modal);
}

async function handlePrimeRefundModal(interaction) {
  const lossId = interaction.fields.getTextInputValue('loss_id').trim();
  const result = await refundPrimeLoss(interaction.user.id, lossId);
  await interaction.reply({
    embeds: [primeRefundResultEmbed(result)],
    components: primeRows(result.profile),
    ephemeral: true
  });
}

function primeRefundResultEmbed(result) {
  if (!result.ok) {
    const reasons = {
      inactive: 'Prime aktiv deyil. Əvvəl `/wallet prime` panelindən Prime al.',
      limit: 'Bu ay/Prime periodu üçün refund haqqın bitib.',
      missing: 'Bu ID ilə refund edilə bilən lost game tapılmadı.',
      refunded: 'Bu oyun artıq refund edilib.',
      expired: 'Bu lost game 30 günlük refund müddətindən çıxıb.'
    };
    return primeEmbed(result.profile)
      .setColor(0xc53030)
      .setTitle('Prime refund alınmadı')
      .setDescription(reasons[result.reason] ?? 'Refund alınmadı.');
  }

  return primeEmbed(result.profile)
    .setColor(brand.success)
    .setTitle('Prime refund tamamlandı')
    .setDescription(`\`${result.loss.id}\` üçün **${formatNumber(result.refunded)} Aura** wallet balansına qaytarıldı.`)
    .addFields(
      { name: 'Oyun', value: casinoGameLabel(result.loss.game), inline: true },
      { name: 'Mərc', value: `${formatNumber(result.loss.bet)} Aura`, inline: true },
      { name: 'Qalan haqq', value: `${result.profile.refundsRemaining}/${result.profile.refundLimit}`, inline: true }
    );
}

async function sendLeaderboard(interaction) {
  await deferInteractionResponse(interaction, { ephemeral: false });
  const payload = await leaderboardPayload(interaction.client, { title: 'Aura Lider Tablosu', live: false });

  await interaction.reply({
    ...payload
  });
}

async function startLiveLeaderboard(readyClient) {
  const channel = await readyClient.channels.fetch(liveLeaderboardChannelId);

  if (!channel?.isTextBased()) {
    console.error(`Live leaderboard channel ${liveLeaderboardChannelId} is not a text channel.`);
    return;
  }

  liveLeaderboardContext = { client: readyClient, channel };

  const tick = async () => {
    await updateLiveLeaderboardMessage(readyClient, channel);
  };

  await tick();
  setInterval(() => {
    tick().catch(error => console.error('Live leaderboard update failed:', error));
  }, liveLeaderboardRefreshMs);
}

function scheduleLiveLeaderboardRefresh() {
  if (!liveLeaderboardContext) {
    return;
  }

  if (liveLeaderboardRefreshTimer) {
    clearTimeout(liveLeaderboardRefreshTimer);
  }

  liveLeaderboardRefreshTimer = setTimeout(() => {
    liveLeaderboardRefreshTimer = null;
    refreshLiveLeaderboard().catch(error => console.error('Live leaderboard refresh failed:', error));
  }, 250);
}

async function refreshLiveLeaderboard() {
  if (!liveLeaderboardContext) {
    return;
  }

  const { client, channel } = liveLeaderboardContext;
  await updateLiveLeaderboardMessage(client, channel);
}

async function updateLiveLeaderboardMessage(discordClient, channel) {
  if (liveLeaderboardRefreshInFlight) {
    return null;
  }

  liveLeaderboardRefreshInFlight = true;

  try {
    const payload = await leaderboardPayload(discordClient, { title: liveLeaderboardTitle, live: true });
    const state = await readLiveLeaderboardState();
    let message = await resolveLiveLeaderboardMessage(channel, discordClient.user?.id ?? null, state.messageId);

    if (message) {
      await message.edit({ ...payload, attachments: [] });

      if (message.id !== state.messageId) {
        await writeLiveLeaderboardState({ channelId: channel.id, messageId: message.id });
      }

      return message;
    }

    message = await channel.send(payload);
    await writeLiveLeaderboardState({ channelId: channel.id, messageId: message.id });
    return message;
  } finally {
    liveLeaderboardRefreshInFlight = false;
  }
}

async function resolveLiveLeaderboardMessage(channel, botUserId, keepMessageId = null) {
  try {
    const messages = await collectLiveLeaderboardMessages(channel, botUserId);

    if (!messages.length) {
      return null;
    }

    const keepMessage = (keepMessageId && messages.find(message => message.id === keepMessageId)) ?? messages[0];
    const deleteTargets = messages.filter(message => message.id !== keepMessage.id);

    await Promise.all(deleteTargets.map(message => message.delete().catch(error => {
      console.warn(`Could not delete duplicate live leaderboard message ${message.id}:`, error);
      return null;
    })));

    return keepMessage;
  } catch (error) {
    console.warn('Live leaderboard message cleanup failed:', error);
    return null;
  }
}

async function collectLiveLeaderboardMessages(channel, botUserId) {
  return collectChannelMessages(channel, botUserId, message => message.embeds?.some(embed => embed.title === liveLeaderboardTitle));
}

async function collectChannelMessages(channel, botUserId, predicate = () => true) {
  const messages = [];
  let before = null;

  while (true) {
    const batch = await channel.messages.fetch(before ? { limit: 100, before } : { limit: 100 });

    if (!batch.size) {
      break;
    }

    for (const message of batch.values()) {
      if (botUserId && message.author?.id !== botUserId) {
        continue;
      }

      if (!predicate(message)) {
        continue;
      }

      messages.push(message);
    }

    if (batch.size < 100) {
      break;
    }

    before = batch.last()?.id ?? null;

    if (!before) {
      break;
    }
  }

  messages.sort((left, right) => (right.createdTimestamp ?? 0) - (left.createdTimestamp ?? 0) || (right.id > left.id ? 1 : -1));
  return messages;
}

async function cleanupBotMessages(channel, botUserId) {
  const messages = await collectChannelMessages(channel, botUserId);
  const result = await deleteChannelMessages(messages);
  return { ...result, label: 'bütün kanal' };
}

async function cleanupLeaderboardMessages(channel, botUserId) {
  const messages = await collectChannelMessages(channel, botUserId, message => message.embeds?.some(embed => embed.title === liveLeaderboardTitle || embed.title === 'Aura Lider Tablosu'));
  const result = await deleteChannelMessages(messages);
  return { ...result, label: 'leaderboard' };
}

async function deleteChannelMessages(messages) {
  let deleted = 0;
  let failed = 0;
  const batches = chunk(messages, 10);

  for (const batch of batches) {
    const results = await Promise.all(batch.map(async message => {
      try {
        await message.delete();
        return true;
      } catch (error) {
        console.warn(`Could not delete message ${message.id}:`, error);
        return false;
      }
    }));

    for (const ok of results) {
      if (ok) {
        deleted += 1;
      } else {
        failed += 1;
      }
    }
  }

  return { deleted, failed };
}

function chunk(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function notifyDailyChestLimitReverts(readyClient) {
  const affected = await revertExceededDailyChestPurchases();

  if (!affected.length) {
    return;
  }

  for (const entry of affected) {
    try {
      const user = await readyClient.users.fetch(entry.userId);
      await user.send({
        embeds: [
          gameEmbed()
            .setTitle('Gündəlik sandıq limiti tətbiq olundu')
            .setDescription([
              `Sandıq alış limiti gündə **${entry.limit}** ədəddir.`,
              `Limitdən artıq **${entry.reverted}** sandıq geri çevrildi.`,
              entry.unopenedReverted ? `Açılmamış sandıq geri alındı: **${entry.unopenedReverted}**.` : null,
              entry.openedReverted ? `Açılmış sandıq reward-u geri alındı: **${formatNumber(entry.openedAuraReverted)} Aura**.` : null,
              `Alış məbləği refund edildi: **${formatNumber(entry.refunded)} Aura**.`,
              `Net düzəliş: **${formatNumber(entry.refunded - entry.openedAuraReverted)} Aura**.`
            ].filter(Boolean).join('\n'))
            .addFields({ name: 'Geri çevrilənlər', value: formatRevertedChestItems(entry.items), inline: false })
        ]
      });
    } catch (error) {
      console.error(`Could not notify ${entry.userId} about chest limit revert:`, error);
    }
  }
}

function formatRevertedChestItems(items) {
  const lines = Object.entries(items ?? {}).map(([name, count]) => `${name}: ${count}`);
  return lines.length ? lines.join('\n') : 'Sandıq qeydi yoxdur.';
}

async function leaderboardPayload(discordClient, { title, live }) {
  const rows = await leaderboard(10);
  const enriched = await enrichLeaderboardRows(discordClient, rows);
  const totalAura = rows.reduce((sum, row) => sum + row.balance, 0);
  const attachment = new AttachmentBuilder(
    await renderLeaderboardImage(enriched, totalAura, Math.round(liveLeaderboardRefreshMs / 1000)),
    { name: 'aura-leaderboard.png' }
  );
  const top = enriched[0];
  const description = top
    ? `Birinci yer: ${top.mention} **${top.displayName}** - **${formatNumber(top.balance)} ${gameCopy.currency}**.`
    : 'Hələ heç kim Aura toplamayıb.';

  return {
    embeds: [
      gameEmbed()
        .setTitle(title)
        .setDescription(description)
        .addFields(
          { name: 'Top 10', value: leaderboardText(enriched), inline: false },
          { name: 'İzlənən Aura', value: `${formatNumber(totalAura)} ${gameCopy.currency}`, inline: true },
          { name: 'Yenilənmə', value: live ? `Hər ${Math.round(liveLeaderboardRefreshMs / 1000)} saniyə` : 'Yeniləmək üçün `/leaderboard` istifadə et.', inline: true },
          { name: 'Qeyd', value: '`/game leaderboard`, `/progress leaderboard` və `/social leaderboard` alias kimi saxlanılıb. Əsas qısa komanda `/leaderboard`-dur.', inline: false }
        )
        .setImage('attachment://aura-leaderboard.png')
    ],
    files: [attachment]
  };
}

async function enrichLeaderboardRows(discordClient, rows) {
  return Promise.all(rows.map(async (row, index) => {
    const user = await fetchUserQuietly(discordClient, row.userId);
    const displayName = user?.globalName ?? user?.username ?? `User ${row.userId.slice(-4)}`;
    return {
      ...row,
      place: index + 1,
      displayName,
      mention: `<@${row.userId}>`,
      primeBadge: row.primeActive ? canvasPrimeBadge(row) : null,
      avatarUrl: user?.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true }) ?? null
    };
  }));
}

async function fetchUserQuietly(discordClient, userId) {
  try {
    return await discordClient.users.fetch(userId);
  } catch {
    return null;
  }
}

async function sendPrestige(interaction) {
  const result = await prestige(interaction.user.id);

  if (!result.ok) {
    await interaction.reply({
      embeds: [
        gameEmbed()
          .setTitle('🔒 Prestij bağlıdır')
          .setDescription('Prestij üçün Lv.50 lazımdır. Səviyyə, XP və ardıcıllıq sıfırlanır, amma daimi Aura bonusu və xüsusi kosmetiklər qalır.')
          .addFields(
            { name: '📊 Hazırkı level', value: xpLine(result.profile), inline: false },
            { name: '🎁 Üstünlük', value: 'Hər prestij üçün daimi +10% Aura qazancı.', inline: false }
          )
      ],
      ephemeral: true
    });
    return;
  }

  await interaction.reply({
    embeds: [
      gameEmbed()
        .setColor(brand.success)
        .setTitle('⭐ Prestij tamamlandı')
        .setDescription(`${interaction.user}, sən indi **${result.profile.title}** statusundasan.`)
        .addFields(
          { name: '🎁 Daimi bonus', value: `+${result.profile.prestige * 10}% Aura qazancı`, inline: true },
          { name: '🪪 Kosmetika', value: '⭐ Prestij nişanı\nUlduz sərhədi\nXüsusi titul', inline: true },
          { name: '📊 Yeni start', value: xpLine(result.profile), inline: false }
        )
    ],
    components: gameRows(interaction.user.id)
  });
}

async function handleButton(interaction) {
  if (interaction.customId.startsWith('help_prev:') || interaction.customId.startsWith('help_next:')) {
    await handleHelpPageButton(interaction);
    return;
  }

  if (isScopedUxButton(interaction.customId)) {
    await handleUxButton(interaction);
    return;
  }

  if (
    interaction.customId.startsWith('mogger_vote:')
    || interaction.customId.startsWith('mogger_action:')
    || interaction.customId.startsWith('mogger_stack:')
    || interaction.customId.startsWith('mogger_compare:')
    || interaction.customId.startsWith('mogger_share:')
    || interaction.customId.startsWith('mogger_reset:')
    || interaction.customId.startsWith('mogger_close:')
  ) {
    await handleMoggerButton(interaction);
    return;
  }

  if (interaction.customId === 'panel_style') {
    await showStyleModal(interaction);
    return;
  }

  if (interaction.customId === 'panel_skin') {
    await replyWithRoutine(interaction, 'skin');
    return;
  }

  if (interaction.customId === 'panel_photo') {
    await replyWithRoutine(interaction, 'photo');
    return;
  }

  if (interaction.customId === 'panel_quote') {
    await interaction.reply({
      embeds: [
        baseEmbed()
          .setTitle('Qısa qeyd')
          .setDescription(pick(quotes))
      ],
      ephemeral: true
    });
    return;
  }

  if (interaction.customId === 'panel_games') {
    await sendGameMenu(interaction);
    return;
  }

  if (interaction.customId === 'routine_skin') {
    await replyWithRoutine(interaction, 'skin');
    return;
  }

  if (interaction.customId === 'routine_hair') {
    await replyWithRoutine(interaction, 'hair');
    return;
  }

  if (interaction.customId === 'routine_posture') {
    await replyWithRoutine(interaction, 'posture');
    return;
  }

  if (interaction.customId === 'routine_photo') {
    await replyWithRoutine(interaction, 'photo');
    return;
  }

  if (interaction.customId === 'live_question') {
    if (!isAdmin(interaction.user.id)) {
      await interaction.reply({ content: 'Live reminder düymələri yalnız admin üçündür.', ephemeral: true });
      return;
    }

    await interaction.reply({
      content: 'Yaxşı sual formatı: qısa kontekst + konkret sual. Məsələn: “Saçım dalğalıdır, kamera üçün hansı forma daha yaxşı görünər?”',
      ephemeral: true
    });
    return;
  }

  if (interaction.customId === 'game_daily') {
    await sendDaily(interaction);
    return;
  }

  if (interaction.customId === 'game_balance') {
    await deferInteractionResponse(interaction, { ephemeral: true });
    const profile = await getProfile(interaction.user.id);
    await interaction.reply(await profilePayload(interaction.user, profile, {
      components: [quickActionRow()],
      ephemeral: true
    }));
    return;
  }

  if (interaction.customId === 'game_leaderboard') {
    await sendLeaderboard(interaction);
    return;
  }

  if (parseAction(interaction.customId) === 'game_party') {
    const currentParty = getPartyByUser(interaction.user.id);
    await interaction.reply({
      embeds: [gameEmbed()
        .setTitle('🎉 Casino Party')
        .setDescription(currentParty
          ? `Sənin party ID: **${currentParty.id}**
Host: <@${currentParty.hostId}>
Üzvlər: ${currentParty.members.map(member => member.username).join(', ')}`
          : 'Party yaratmaq, qoşulmaq və ya statusu yoxlamaq üçün aşağıdakı düymələrdən istifadə et.')],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('party_create')
            .setLabel('Party yarat')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!!currentParty),
          new ButtonBuilder()
            .setCustomId('party_status')
            .setLabel('Mənim party')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!currentParty),
          new ButtonBuilder()
            .setCustomId('party_leave')
            .setLabel('Çıx')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!currentParty)
        )
      ],
      ephemeral: true
    });
    return;
  }

  if (interaction.customId === 'party_create') {
    await handlePartyButtonCreate(interaction);
    return;
  }

  if (interaction.customId === 'party_status') {
    await handlePartyButtonStatusByUser(interaction);
    return;
  }

  if (interaction.customId === 'party_leave') {
    await handlePartyButtonLeave(interaction);
    return;
  }

  if (interaction.customId.startsWith('party_join:')) {
    await handlePartyButtonJoin(interaction, interaction.customId.replace('party_join:', ''));
    return;
  }

  if (interaction.customId.startsWith('party_status:')) {
    await handlePartyButtonStatus(interaction, interaction.customId.replace('party_status:', ''));
    return;
  }

  if (interaction.customId.startsWith('party_leave:')) {
    await handlePartyButtonLeave(interaction);
    return;
  }

  if (interaction.customId.startsWith('drop_claim:')) {
    await claimAuraDrop(interaction, interaction.customId.replace('drop_claim:', ''));
    return;
  }

  if (interaction.customId.startsWith('drop_cancel:')) {
    await cancelAuraDrop(interaction, interaction.customId.replace('drop_cancel:', ''));
    return;
  }

  if (interaction.customId.startsWith('admin_profile:')) {
    await handleAdminProfileButton(interaction);
    return;
  }

  if (interaction.customId.startsWith('modpanel:')) {
    await handleModPanelButton(interaction);
    return;
  }

  if (interaction.customId.startsWith('loan_take:')) {
    await handleLoanButton(interaction);
    return;
  }

  if (interaction.customId === 'prime_buy') {
    await handlePrimeBuyButton(interaction);
    return;
  }

  if (interaction.customId.startsWith('prime_refund:')) {
    await handlePrimeRefundButton(interaction, interaction.customId.replace('prime_refund:', ''));
    return;
  }

  if (interaction.customId === 'prime_manual') {
    await showPrimeRefundModal(interaction);
    return;
  }

  if (interaction.customId.startsWith('casino_help:')) {
    await handleCasinoHelpButton(interaction);
    return;
  }

  if (interaction.customId.startsWith('casino:')) {
    await handleCasinoButton(interaction);
    return;
  }

  if (interaction.customId.startsWith('dice_accept:')) {
    await resolveDiceBattle(interaction, interaction.customId.replace('dice_accept:', ''), true);
    return;
  }

  if (interaction.customId.startsWith('dice_decline:')) {
    await resolveDiceBattle(interaction, interaction.customId.replace('dice_decline:', ''), false);
    return;
  }

  if (interaction.customId.startsWith('quick_accept:')) {
    await resolveQuickDraw(interaction, interaction.customId.replace('quick_accept:', ''), true);
    return;
  }

  if (interaction.customId.startsWith('quick_decline:')) {
    await resolveQuickDraw(interaction, interaction.customId.replace('quick_decline:', ''), false);
    return;
  }

  if (interaction.customId.startsWith('quick_press:')) {
    await pressQuickDraw(interaction, interaction.customId.replace('quick_press:', ''));
    return;
  }

  if (interaction.customId.startsWith('heist_join:')) {
    await joinHeist(interaction, interaction.customId.replace('heist_join:', ''));
    return;
  }

  if (interaction.customId.startsWith('heist_start:')) {
    await startHeist(interaction, interaction.customId.replace('heist_start:', ''));
    return;
  }

  if (interaction.customId.startsWith('duel_accept:')) {
    await resolveDuel(interaction, interaction.customId.replace('duel_accept:', ''), true);
    return;
  }

  if (interaction.customId.startsWith('duel_decline:')) {
    await resolveDuel(interaction, interaction.customId.replace('duel_decline:', ''), false);
  }

  // moderation undo
  if (interaction.customId.startsWith('mod_economy_confirm:') || interaction.customId.startsWith('mod_economy_edit:') || interaction.customId.startsWith('mod_economy_cancel:')) {
    const [prefix, id, ownerId] = interaction.customId.split(':');
    if (ownerId !== interaction.user.id) {
      await interaction.reply({ content: 'Only the moderator who opened this can confirm.', ephemeral: true });
      return;
    }

    const pending = pendingEconomyActions.get(id);
    if (!pending) {
      await interaction.reply({ content: 'Pending action expired or not found.', ephemeral: true });
      return;
    }

    if (prefix === 'mod_economy_cancel') {
      pendingEconomyActions.delete(id);
      await interaction.update({ content: 'Action canceled.', embeds: [], components: [] });
      return;
    }

    if (prefix === 'mod_economy_edit') {
      pendingEconomyActions.delete(id);
      await interaction.update({ content: 'Edit requested. Re-open the economy panel to modify inputs.', embeds: [], components: [], ephemeral: true });
      return;
    }

    // confirm
    // re-check permissions and role hierarchy
    const hasManage = interaction.memberPermissions?.has?.('ModerateMembers') || interaction.memberPermissions?.has?.('BanMembers') || isAdmin(interaction.user.id);
    if (!hasManage) {
      await interaction.reply({ content: 'You no longer have moderator permissions.', ephemeral: true });
      return;
    }

    const pendingEntry = pending;
    const { action, targetId, inputs, previous } = pendingEntry;
    // role position check
    if (interaction.guild) {
      const moderatorMember = interaction.member;
      const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
      if (targetMember && moderatorMember.roles?.highest?.position <= targetMember.roles?.highest?.position && !isAdmin(interaction.user.id)) {
        await interaction.reply({ content: 'Cannot moderate this user due to role hierarchy.', ephemeral: true });
        return;
      }
    }

    try {
      if (action === 'fine') {
        const amount = Number(inputs.amount || 0);
        if (!amount || amount <= 0) {
          await interaction.reply({ content: 'Invalid fine amount.', ephemeral: true });
          return;
        }
        const before = await getProfile(targetId);
        const after = await applyFine(targetId, amount, 'mod_fine', `by:${interaction.user.id}`);
        const deducted = Math.max(0, (before.balance ?? 0) - (after.balance ?? 0));
        const c = await moderation.createCase({ type: 'fine', moderatorId: interaction.user.id, targetId, reason: inputs.reason || 'fine', meta: { requestedAmount: amount, amountDeducted: deducted, previousState: before, newState: after } });
        const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`mod_undo:${c.id}:${interaction.user.id}`).setLabel('Undo (30s)').setStyle(ButtonStyle.Secondary));
        await interaction.update({ embeds: [baseEmbed().setTitle('Fined').setDescription(`<@${targetId}> fined ${formatNumber(deducted)} Aura`).addFields({ name: 'Reason', value: inputs.reason || '—' })], components: [undoRow] });
        // auto-resolve after 30s
        setTimeout(async () => { try { await moderation.resolveCase(c.id, { resolvedBy: interaction.user.id, resolution: 'completed' }); } catch (e) {} }, 30000);
        pendingEconomyActions.delete(id);
        return;
      }

      // restriction additions
      if (action === 'freeze_bank' || action === 'block_gambling' || action === 'block_robbing' || action === 'block_trade' || action === 'set_casino_max') {
        const typeMap = {
          freeze_bank: 'bank',
          block_gambling: 'casino',
          block_robbing: 'rob',
          block_trade: 'trade',
          set_casino_max: 'casino_max_bet'
        };
        const type = typeMap[action];
        const durationMs = inputs.durationMs ?? null;
        const meta = inputs.maxbet ? { maxBet: inputs.maxbet } : (inputs.meta || {});
        const r = await addRestriction(targetId, type, interaction.user.id, inputs.reason || '', { durationMs, meta });
        // if set_casino_max also set legacy fields for backward compatibility
        if (action === 'set_casino_max') {
          try { await adminSetCasinoRestriction(targetId, Number(inputs.maxbet || 0), inputs.reason || '', interaction.user.id); } catch (e) {}
        }

        const after = await listRestrictions(targetId);
        const c = await moderation.createCase({ type: 'restriction', moderatorId: interaction.user.id, targetId, reason: inputs.reason || '', meta: { action: 'add', restriction: r, previous: previous || [], new: after } });
        const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`mod_undo:${c.id}:${interaction.user.id}`).setLabel('Undo (30s)').setStyle(ButtonStyle.Secondary));
        await interaction.update({ embeds: [baseEmbed().setTitle('Restriction applied').setDescription(`${action} applied to <@${targetId}>`).addFields({ name: 'Reason', value: inputs.reason || '—' })], components: [undoRow] });
        setTimeout(async () => { try { await moderation.resolveCase(c.id, { resolvedBy: interaction.user.id, resolution: 'completed' }); } catch (e) {} }, 30000);
        pendingEconomyActions.delete(id);
        return;
      }

      // removals (unfreeze/unblock/remove casino cap)
      if (action === 'unfreeze_bank' || action === 'unblock_gambling' || action === 'unblock_robbing' || action === 'unblock_trade' || action === 'remove_casino_max') {
        const typeMap = {
          unfreeze_bank: 'bank',
          unblock_gambling: 'casino',
          unblock_robbing: 'rob',
          unblock_trade: 'trade',
          remove_casino_max: 'casino_max_bet'
        };
        const type = typeMap[action];
        const removed = await removeRestriction(targetId, type);
        // if remove_casino_max also clear legacy fields
        if (action === 'remove_casino_max') {
          try { await adminSetCasinoRestriction(targetId, null, 'removed by moderator', interaction.user.id); } catch (e) {}
        }
        const after = await listRestrictions(targetId);
        const c = await moderation.createCase({ type: 'restriction', moderatorId: interaction.user.id, targetId, reason: inputs?.reason || '', meta: { action: 'remove', removed, previous: previous || [], new: after } });
        const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`mod_undo:${c.id}:${interaction.user.id}`).setLabel('Undo (30s)').setStyle(ButtonStyle.Secondary));
        await interaction.update({ embeds: [baseEmbed().setTitle('Restriction removed').setDescription(`${action} removed for <@${targetId}>`).addFields({ name: 'Removed', value: `${removed.length} restriction(s)` })], components: [undoRow] });
        setTimeout(async () => { try { await moderation.resolveCase(c.id, { resolvedBy: interaction.user.id, resolution: 'completed' }); } catch (e) {} }, 30000);
        pendingEconomyActions.delete(id);
        return;
      }

      await interaction.reply({ content: 'Unhandled economy action.', ephemeral: true });
      return;
    } catch (err) {
      console.error('Economy confirm error', err);
      await interaction.reply({ content: 'Failed to execute action.', ephemeral: true });
      return;
    }
  }

  // moderation undo
  if (interaction.customId.startsWith('mod_undo:')) {
    const [, caseId, ownerId] = interaction.customId.split(':');
    if (ownerId !== interaction.user.id) {
      await interaction.reply({ content: 'Only the moderator who performed this action can undo it.', ephemeral: true });
      return;
    }

    const c = await moderation.getCase(caseId);
    if (!c) {
      await interaction.reply({ content: 'Case not found.', ephemeral: true });
      return;
    }

    // best-effort revert: for bans/timeouts/fines we attempt reversal
    try {
      if (c.type === 'ban' && interaction.guild) {
        await interaction.guild.members.unban(c.targetId).catch(() => {});
      }
      if (c.type === 'timeout' && interaction.guild) {
        const m = await interaction.guild.members.fetch(c.targetId).catch(() => null);
        if (m) await m.timeout(null).catch(() => {});
      }
      if (c.type === 'fine') {
        // refund fine (use exact deducted amount when available)
const refunded = Math.abs(
  Number(c.meta?.amountDeducted ?? (c.meta?.amount || 0))
);
        if (refunded > 0) {
          await adminGiveAura(c.targetId, refunded, interaction.client.user.id).catch(() => {});
        }
      }

      if (c.type === 'restriction') {
        // revert restriction action
        const action = c.meta?.action;
        if (action === 'add') {
          const rid = c.meta?.restriction?.id;
          if (rid) await removeRestriction(c.targetId, rid).catch(() => {});
        }
        if (action === 'remove') {
          const removed = Array.isArray(c.meta?.removed) ? c.meta.removed : [];
          for (const r of removed) {
            const dur = r.expiresAt ? Math.max(0, r.expiresAt - Date.now()) : null;
            try {
              await addRestriction(c.targetId, r.type, r.moderatorId ?? interaction.client.user.id, r.reason || '', { durationMs: dur, meta: r.meta || {} });
            } catch (e) {}
          }
        }
      }

      await moderation.resolveCase(caseId, { resolvedBy: interaction.user.id, resolution: 'undone' });
      await interaction.update({ content: 'Action undone.', embeds: [], components: [], ephemeral: true });
    } catch (err) {
      console.error('Undo failed', err);
      await interaction.reply({ content: 'Undo failed.', ephemeral: true });
    }
    return;
  }
}

async function handleUxButton(interaction) {
  const ownerId = parseOwner(interaction.customId);

  if (ownerId !== 'all' && ownerId !== interaction.user.id) {
    await interaction.reply({
      content: '⚠ Bu panel başqa üzvə aiddir. Öz panelini açmaq üçün `/panel` yaz.',
      ephemeral: true
    });
    return;
  }

  const action = parseAction(interaction.customId);

  if (action === 'ux_close') {
    await interaction.update({
      embeds: [
        gameEmbed()
          .setTitle('❌ Panel bağlandı')
          .setDescription('Yenisini açmaq üçün `/panel` və ya `/help` yaz.')
      ],
      components: []
    });
    return;
  }

  if (action === 'ux_home' || action === 'ux_back') {
    await interaction.update({
      embeds: [welcomeEmbed(interaction)],
      components: mainMenuRows(interaction.user.id, 'home')
    });
    return;
  }

  if (action === 'ux_aura') {
    await interaction.update({
      embeds: [moduleHelpEmbed('aura')],
      components: helpRows(interaction.user.id, 'aura')
    });
    return;
  }

  if (action === 'ux_help') {
    await interaction.update({
      embeds: [moduleHelpEmbed('home')],
      components: helpRows(interaction.user.id, 'home')
    });
    return;
  }

  if (action === 'ux_commands') {
    await interaction.update({
      embeds: [moduleHelpEmbed('commands')],
      components: helpRows(interaction.user.id, 'commands')
    });
    return;
  }

  if (action === 'ux_wallet') {
    await interaction.update({
      embeds: [moduleHelpEmbed('wallet')],
      components: helpRows(interaction.user.id, 'wallet')
    });
    return;
  }

  if (action === 'ux_games') {
    await interaction.update({
      embeds: [moduleHelpEmbed('games')],
      components: helpRows(interaction.user.id, 'games')
    });
    return;
  }

  if (action === 'ux_missions') {
    await interaction.update({
      embeds: [moduleHelpEmbed('missions')],
      components: helpRows(interaction.user.id, 'missions')
    });
    return;
  }

  if (action === 'ux_world') {
    await interaction.update({
      embeds: [moduleHelpEmbed('world')],
      components: helpRows(interaction.user.id, 'world')
    });
    return;
  }

  if (action === 'ux_inventory') {
    await interaction.update({
      embeds: [moduleHelpEmbed('inventory')],
      components: helpRows(interaction.user.id, 'inventory')
    });
    return;
  }

  if (action === 'ux_market') {
    await interaction.update({
      embeds: [moduleHelpEmbed('market')],
      components: helpRows(interaction.user.id, 'market')
    });
    return;
  }

  if (action === 'ux_progress') {
    await interaction.update({
      embeds: [moduleHelpEmbed('progress')],
      components: helpRows(interaction.user.id, 'progress')
    });
    return;
  }

  if (action === 'ux_social') {
    await interaction.update({
      embeds: [moduleHelpEmbed('social')],
      components: helpRows(interaction.user.id, 'social')
    });
    return;
  }

  if (action === 'ux_style') {
    await interaction.update({
      embeds: [moduleHelpEmbed('style')],
      components: helpRows(interaction.user.id, 'style')
    });
    return;
  }

  if (action === 'ux_profile' || action === 'game_balance') {
    await interaction.reply(await profilePayload(interaction.user, await getProfile(interaction.user.id), {
      components: [quickActionRow()],
      ephemeral: true
    }));
    return;
  }

  if (action === 'ux_bonus') {
    await sendBeginnerBonus(interaction);
    return;
  }

  if (action === 'game_daily') {
    await sendDaily(interaction);
    return;
  }

  if (action === 'game_leaderboard') {
    await sendLeaderboard(interaction);
  }
}

async function handleSelectMenu(interaction) {

  if (
  interaction.customId.startsWith(
    'mention_gift_user:'
  )
) {
  await handleMentionGiftUserSelect(interaction);
  return;
}

  if (interaction.customId.startsWith('mod_economy_select:')) {
    const [, ownerId, targetId] = interaction.customId.split(':');
    if (ownerId !== interaction.user.id) {
      await interaction.reply({ content: 'This economy panel is owned by someone else.', ephemeral: true });
      return;
    }
    const action = interaction.values[0];
    // actions that require modal input
    const modalRequired = new Set(['fine', 'freeze_bank', 'block_gambling', 'block_robbing', 'block_trade', 'set_casino_max']);
    if (modalRequired.has(action)) {
      const modal = new ModalBuilder().setCustomId(`mod_modal:${action}:${ownerId}:${targetId}`).setTitle(`Economy • ${action}`);
      // common fields: reason, duration
      const reason = new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(true);
     const duration = new TextInputBuilder()
  .setCustomId('duration')
  .setLabel('Duration')
  .setPlaceholder('30m, 1h, 6h, 1d, 3d, 7d, permanent')
  .setStyle(TextInputStyle.Short)
  .setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(reason), new ActionRowBuilder().addComponents(duration));

      if (action === 'fine') {
        const amount = new TextInputBuilder().setCustomId('amount').setLabel('Amount').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(amount));
      }

      if (action === 'set_casino_max') {
        const maxBet = new TextInputBuilder().setCustomId('maxbet').setLabel('Max Bet').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(maxBet));
      }

      await interaction.showModal(modal);
      return;
    }

    // actions that do not require modal: show confirmation preview
    const current = await listRestrictions(targetId).catch(() => []);
    const proposed = { action };
    const embed = baseEmbed().setTitle('Economy action preview').addFields(
      { name: 'Action', value: action, inline: true },
      { name: 'Target', value: `<@${targetId}>`, inline: true },
      { name: 'Reason', value: '—', inline: false },
      { name: 'Duration', value: '—', inline: true },
      { name: 'Current state', value: current.length ? `${current.length} active restriction(s)` : 'None', inline: true },
      { name: 'Proposed state', value: JSON.stringify(proposed), inline: false }
    );

    const id = `pe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
    pendingEconomyActions.set(id, { id, action, ownerId: interaction.user.id, targetId, inputs: {}, previous: current });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mod_economy_confirm:${id}:${interaction.user.id}`).setLabel('Confirm').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`mod_economy_edit:${id}:${interaction.user.id}`).setLabel('Edit').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mod_economy_cancel:${id}:${interaction.user.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    return;
  }
  if (interaction.customId.startsWith('prime_loss_select:')) {
    await handlePrimeLossSelect(interaction);
    return;
  }

  if (!interaction.customId.startsWith('help_select:')) {
    await interaction.reply({ content: 'Bu seçim artıq aktiv deyil. `/help` ilə yenidən aç.', ephemeral: true });
    return;
  }

  const [, currentPage, ownerId] = interaction.customId.split(':');
  if (ownerId !== 'all' && ownerId !== interaction.user.id) {
    await interaction.reply({
      content: '⚠ Bu help paneli başqa üzvə aiddir. Öz panelini açmaq üçün `/help` yaz.',
      ephemeral: true
    });
    return;
  }

  const page = normalizeHelpPage(interaction.values[0] ?? currentPage);
  await interaction.update({
    embeds: [moduleHelpEmbed(page)],
    components: helpRows(interaction.user.id, page)
  });
}

async function handleHelpPageButton(interaction) {
  const [action, currentPage, ownerId] = interaction.customId.split(':');
  if (ownerId !== 'all' && ownerId !== interaction.user.id) {
    await interaction.reply({
      content: '⚠ Bu help paneli başqa üzvə aiddir. Öz panelini açmaq üçün `/help` yaz.',
      ephemeral: true
    });
    return;
  }

  const index = helpPageIndex(normalizeHelpPage(currentPage));
  const direction = action === 'help_next' ? 1 : -1;
  const page = helpPages[(index + direction + helpPages.length) % helpPages.length].id;
  await interaction.update({
    embeds: [moduleHelpEmbed(page)],
    components: helpRows(interaction.user.id, page)
  });
}

/* async function handleModal(interaction) {
  if (interaction.customId.startsWith('casino_cashout:')) {
    await handleCrashCashoutModal(interaction);
    return;
  }

  if (interaction.customId.startsWith('mogger_stack:')) {
    await handleMoggerModal(interaction);
    return;
  }

  if (interaction.customId === 'prime_refund_modal') {
    await handlePrimeRefundModal(interaction);
    return;
  }

  if (interaction.customId !== 'style_modal') {
    // moderation modals
    if (interaction.customId.startsWith('mod_modal:')) {
      await handleModModal(interaction);
    }
    return;
  }

  const outfit = interaction.fields.getTextInputValue('outfit');
  const goal = interaction.fields.getTextInputValue('goal');
  const concern = interaction.fields.getTextInputValue('concern') || 'ümumi balans';
  const profile = inferStyleProfile(goal, outfit);
  const focus = fitAdvice[hashScore(`${outfit}:${goal}`, fitAdvice.length)];
  await awardActionXp(interaction.user.id, 10);

  const embed = baseEmbed()
    .setTitle('Tərz yoxlanışı')
    .setDescription(outfit)
    .addFields(
      { name: 'Məqsəd', value: goal, inline: true },
      { name: 'Fokus', value: concern, inline: true },
      { name: profile.label, value: `${profile.note}\nRənglər: ${profile.colors}` },
      { name: focus.title, value: focus.text },
      { name: 'Düzəliş', value: buildStyleSuggestion(outfit, concern, profile) }
    );

  await interaction.reply({

    async function handleMoggerButton(interaction) {
      if (interaction.customId.startsWith('mogger_vote:')) {
        await handleMoggerVoteButton(interaction);
        return;
      }

      const [, action, sessionId, ownerId] = interaction.customId.split(':');
      const session = await loadMoggerSession(sessionId);

      if (!session) {
        await interaction.reply({
          content: 'Mogger sessiyası tapılmadı. `/mogger` ilə yenidən aç.',
          ephemeral: true
        });
        return;
      }

      if (ownerId !== interaction.user.id) {
        await interaction.reply({
          content: 'Bu Looks Lab paneli başqa üzvə aiddir.',
          ephemeral: true
        });
        return;
      }

      if (action === 'stack') {
        if (session.status === 'closed') {
          await interaction.reply({
            content: 'Bu sessiya artıq bağlanıb. Yeni panel açmaq üçün yenidən `/mogger` yaz.',
            ephemeral: true
          });
          return;
        }

        await interaction.showModal(buildMoggerStackModal(session));
        return;
      }

      if (action === 'share' && (!interaction.channel || typeof interaction.channel.send !== 'function')) {
        await interaction.reply({
          content: 'Bu kanalda public paylaşım göndərmək olmur.',
          ephemeral: true
        });
        return;
      }

      await interaction.deferUpdate();

      try {
        if (action === 'compare') {
          const voteCount = await loadMoggerVoteCount(session.sessionId);
          const payload = await buildMoggerPanelPayload({
            session,
            analysis: session.analysis ?? {},
            voteCount,
            mode: 'compare'
          });
          await interaction.editReply(payload);
          return;
        }

        if (action === 'share') {
          const voteCount = await loadMoggerVoteCount(session.sessionId);
          if (session.isPublic && session.shareChannelId && session.shareMessageId) {
            await saveMoggerSession({
              ...session,
              isPublic: true,
              updatedAt: Date.now()
            });
          } else {
            await publishMoggerSession({
              session,
              channel: interaction.channel,
              voteCount,
              analysis: session.analysis ?? {}
            });
          }

          const updatedSession = await loadMoggerSession(session.sessionId);
          const privatePayload = await buildMoggerPanelPayload({
            session: updatedSession,
            analysis: updatedSession.analysis ?? session.analysis ?? {},
            voteCount,
            mode: updatedSession.lastMode ?? session.lastMode ?? 'analysis'
          });
          await interaction.editReply(privatePayload);
          await refreshMoggerPublicMessage(interaction.client, updatedSession, updatedSession.analysis ?? session.analysis ?? {}, voteCount);
          return;
        }

        if (action === 'reset') {
          const updatedSession = await saveMoggerSession({
            ...session,
            stack: [],
            lastMode: 'analysis',
            history: [
              ...(session.history ?? []),
              {
                kind: 'reset',
                createdAt: Date.now(),
                mode: 'reset',
                summary: 'Stack reset.'
              }
            ],
            updatedAt: Date.now()
          });

          const voteCount = await loadMoggerVoteCount(session.sessionId);
          const payload = await buildMoggerPanelPayload({
            session: updatedSession,
            analysis: updatedSession.analysis ?? {},
            voteCount,
            mode: 'analysis'
          });
          await interaction.editReply(payload);
          await refreshMoggerPublicMessage(interaction.client, updatedSession, updatedSession.analysis ?? session.analysis ?? {}, voteCount);
          return;
        }

        if (action === 'close') {
          const updatedSession = await saveMoggerSession({
            ...session,
            status: 'closed',
            history: [
              ...(session.history ?? []),
              {
                kind: 'closed',
                createdAt: Date.now(),
                mode: 'close',
                summary: 'Private panel closed.'
              }
            ],
            updatedAt: Date.now()
          });

          const voteCount = await loadMoggerVoteCount(session.sessionId);
          const payload = await buildMoggerPanelPayload({
            session: updatedSession,
            analysis: updatedSession.analysis ?? {},
            voteCount,
            mode: 'close'
          });
          await interaction.editReply(payload);
          await refreshMoggerPublicMessage(interaction.client, updatedSession, updatedSession.analysis ?? session.analysis ?? {}, voteCount);
          return;
        }

        if (['hair', 'grooming', 'camera', 'style'].includes(action)) {
          const result = await applyMoggerAction({
            openai,
            model: OPENAI_MODEL,
            session,
            action
          });

          const voteCount = await loadMoggerVoteCount(result.session.sessionId);
          const payload = await buildMoggerPanelPayload({
            session: result.session,
            analysis: result.analysis,
            voteCount,
            mode: action
          });
          await interaction.editReply(payload);
          await refreshMoggerPublicMessage(interaction.client, result.session, result.analysis, voteCount);
          return;
        }

        await interaction.editReply({
          content: 'Naməlum Mogger əməliyyatı.',
          components: []
        });
      } catch (error) {
        console.error('Mogger button handling failed:', error);
        await interaction.editReply({
          content: 'Mogger panelində dəyişiklik alınmadı. Yenidən cəhd et.',
          components: []
        });
      }
    }

    async function handleMoggerVoteButton(interaction) {
      const sessionId = interaction.customId.replace('mogger_vote:', '');
      const session = await loadMoggerSession(sessionId);

      if (!session || !session.isPublic) {
        await interaction.reply({
          content: 'Bu Looks Lab paylaşımı artıq public deyil.',
          ephemeral: true
        });
        return;
      }

      await interaction.deferUpdate();

      try {
        await updateMoggerVote(session.sessionId, interaction.user.id, 1);
        const voteCount = await loadMoggerVoteCount(session.sessionId);
        const payload = await buildMoggerPublicPayload({
          session,
          analysis: session.analysis ?? {},
          voteCount,
          mode: session.lastMode ?? 'analysis'
        });

        await interaction.editReply(payload);
        await interaction.followUp({
          content: 'Səsiniz qeydə alındı.',
          ephemeral: true
        }).catch(() => {});
      } catch (error) {
        console.error('Mogger vote failed:', error);
        await interaction.followUp({
          content: 'Səs qeyd edilə bilmədi.',
          ephemeral: true
        }).catch(() => {});
      }
    }

    async function handleMoggerModal(interaction) {
      const [, sessionId, ownerId] = interaction.customId.split(':');
      const session = await loadMoggerSession(sessionId);

      if (!session) {
        await interaction.reply({
          content: 'Mogger sessiyası tapılmadı.',
          ephemeral: true
        });
        return;
      }

      if (ownerId !== interaction.user.id) {
        await interaction.reply({
          content: 'Bu modal başqa üzv üçün açılıb.',
          ephemeral: true
        });
        return;
      }

      const stepsText = interaction.fields.getTextInputValue('steps');
      const note = interaction.fields.getTextInputValue('note') ?? '';
      const steps = parseMoggerStackInput(stepsText);

      if (!steps.length) {
        await interaction.reply({
          content: 'Stack üçün azı bir etibarlı addım yaz: hair, grooming, camera, style.',
          ephemeral: true
        });
        return;
      }

      await deferInteractionResponse(interaction, { ephemeral: true });

      try {
        const result = await applyMoggerStack({
          openai,
          model: OPENAI_MODEL,
          session,
          steps,
          note
        });

        const voteCount = await loadMoggerVoteCount(result.session.sessionId);
        const payload = await buildMoggerPanelPayload({
          session: result.session,
          analysis: result.analysis,
          voteCount,
          mode: 'stack'
        });

        await interaction.editReply(payload);
        await refreshMoggerPublicMessage(interaction.client, result.session, result.analysis, voteCount);
      } catch (error) {
        console.error('Mogger modal handling failed:', error);
        await interaction.editReply({
          content: 'Stack tətbiq edilə bilmədi. Yenidən cəhd et.',
          ephemeral: true
        });
      }
    }
    embeds: [embed],
    components: [singleButtonRow('panel_style', 'Yenidən yoxla', ButtonStyle.Primary)]
  });
} */

async function handleModPanelButton(interaction) {
  console.log('MOD PANEL CLICK:', interaction.customId);

  const parts = interaction.customId.split(':');
  // modpanel:action:ownerId:targetId:ts
  const action = parts[1];
  const ownerId = parts[2];
  const targetId = parts[3];

  if (ownerId !== interaction.user.id) {
    await interaction.reply({
      content: 'This panel is owned by someone else.',
      ephemeral: true
    });
    return;
  }

  if (action === 'warn' || action === 'ban' || action === 'timeout') {
    const modal = new ModalBuilder().setCustomId(`mod_modal:${action}:${ownerId}:${targetId}`).setTitle(`${action.toUpperCase()} • ${targetId}`);
    const reason = new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(true);
    const evidence = new TextInputBuilder().setCustomId('evidence').setLabel('Evidence (links)').setStyle(TextInputStyle.Short).setRequired(false);
    modal.addComponents(new ActionRowBuilder().addComponents(reason), new ActionRowBuilder().addComponents(evidence));
    await interaction.showModal(modal);
    return;
  }

  if (action === 'notes') {
    const modal = new ModalBuilder().setCustomId(`mod_modal:note:${ownerId}:${targetId}`).setTitle('Private note');
    const note = new TextInputBuilder().setCustomId('note').setLabel('Note (staff-only)').setStyle(TextInputStyle.Paragraph).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(note));
    await interaction.showModal(modal);
    return;
  }

  if (action === 'dm') {
    const modal = new ModalBuilder().setCustomId(`mod_modal:dm:${ownerId}:${targetId}`).setTitle('DM user');
    const dmText = new TextInputBuilder().setCustomId('dmtext').setLabel('Message to user').setStyle(TextInputStyle.Paragraph).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(dmText));
    await interaction.showModal(modal);
    return;
  }

  if (action === 'economy') {
    // show quick select menu ephemeral
    const ts = Date.now().toString(36).slice(-6);
    const select = new StringSelectMenuBuilder()
      .setCustomId(`mod_economy_select:${ownerId}:${targetId}:${ts}`)
      .setPlaceholder('Select economy action')
      .addOptions([
        { label: 'Fine user', value: 'fine' },
        { label: 'Freeze bank', value: 'freeze_bank' },
        { label: 'Unfreeze bank', value: 'unfreeze_bank' },
        { label: 'Block gambling', value: 'block_gambling' },
        { label: 'Unblock gambling', value: 'unblock_gambling' },
        { label: 'Block robbing', value: 'block_robbing' },
        { label: 'Unblock robbing', value: 'unblock_robbing' },
        { label: 'Block trading/gifting', value: 'block_trade' },
        { label: 'Unblock trading/gifting', value: 'unblock_trade' },
        { label: 'Set casino max bet', value: 'set_casino_max' },
        { label: 'Remove casino max bet', value: 'remove_casino_max' }
      ]);

    await interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    return;
  }

  await interaction.reply({ content: 'Unknown action.', ephemeral: true });
}

async function handleModModal(interaction) {
  // mod_modal:action:ownerId:targetId
  const [, action, ownerId, targetId] = interaction.customId.split(':');
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'This modal was not opened by you.', ephemeral: true });
    return;
  }

  try {
    // helper to parse duration strings
    function parseDurationString(text) {
      if (!text) return null;
      const t = `${text}`.trim().toLowerCase();
      if (t === 'permanent' || t === 'perm' || t === 'p') return null;
      if (/^\d+$/.test(t)) return Number(t);
      if (/^\d+m$/.test(t)) return Number(t.replace('m','')) * 60000;
      if (/^\d+h$/.test(t)) return Number(t.replace('h','')) * 3600000;
      if (/^\d+d$/.test(t)) return Number(t.replace('d','')) * 24 * 3600000;
      // allow formats like 1d,3d,7d and '30m','1h'
      return null;
    }

    if (action === 'note') {
      const note = interaction.fields.getTextInputValue('note');
      await moderation.createCase({ type: 'note', moderatorId: interaction.user.id, targetId, reason: note });
      await interaction.reply({ content: 'Note saved (staff-only).', ephemeral: true });
      return;
    }

    if (action === 'dm') {
      const text = interaction.fields.getTextInputValue('dmtext');
      // attempt DM
      const user = await client.users.fetch(targetId).catch(() => null);
      if (user) {
        await user.send({ content: `Staff message from ${interaction.user.tag}:\n\n${text}` }).catch(() => {});
      }
      await moderation.createCase({ type: 'dm', moderatorId: interaction.user.id, targetId, reason: text });
      await interaction.reply({ content: 'DM sent (best-effort).', ephemeral: true });
      return;
    }

   let reason = '';
let evidence = '';

try {
  reason = interaction.fields.getTextInputValue('reason');
} catch {}

try {
  evidence = interaction.fields.getTextInputValue('evidence');
} catch {}
    // economy modal flow: capture inputs and show preview (confirm before executing)
    const economyActions = new Set(['fine','freeze_bank','block_gambling','block_robbing','block_trade','set_casino_max']);
    if (economyActions.has(action)) {
      const id = `pe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
      const inputs = { reason, evidence };
      if (action === 'fine') {
        inputs.amount = Number(interaction.fields.getTextInputValue('amount') || 0);
      }
      if (action === 'set_casino_max') {
        inputs.maxbet = Number(interaction.fields.getTextInputValue('maxbet') || 0);
      }
      inputs.durationText = interaction.fields.getTextInputValue('duration') || '';
      inputs.durationMs = parseDurationString(inputs.durationText);

      const current = await listRestrictions(targetId).catch(() => []);
      // build proposed state for preview
      const proposed = { action, reason: inputs.reason, duration: inputs.durationText };
      if (action === 'set_casino_max') proposed.maxBet = inputs.maxbet;
      if (action === 'fine') proposed.amount = inputs.amount;

      pendingEconomyActions.set(id, { id, action, ownerId: interaction.user.id, targetId, inputs, initiatorId: interaction.user.id, previous: current });

      const embed = baseEmbed().setTitle('Economy action preview').addFields(
        { name: 'Action', value: action, inline: true },
        { name: 'Target', value: `<@${targetId}>`, inline: true },
        { name: 'Reason', value: inputs.reason || '—', inline: false },
        { name: 'Duration', value: inputs.durationText || 'permanent', inline: true },
        { name: 'Current state', value: current.length ? `${current.length} active restriction(s)` : 'None', inline: true },
        { name: 'Proposed state', value: JSON.stringify(proposed), inline: false }
      );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`mod_economy_confirm:${id}:${interaction.user.id}`).setLabel('Confirm').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`mod_economy_edit:${id}:${interaction.user.id}`).setLabel('Edit').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`mod_economy_cancel:${id}:${interaction.user.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      return;
    }

    if (action === 'warn') {
      const c = await moderation.createCase({ type: 'warn', moderatorId: interaction.user.id, targetId, reason, evidence: evidence ? [evidence] : [] });
      // mirror to staff channel if configured
      const settings = await moderation.getSettings();
      if (settings.staffChannelId) {
        const ch = await client.channels.fetch(settings.staffChannelId).catch(() => null);
        if (ch && ch.isTextBased && ch.send) {
          await ch.send({ embeds: [baseEmbed().setTitle('🚨 Warn').setDescription(`<@${targetId}> warned by <@${interaction.user.id}>`).addFields({ name: 'Reason', value: reason })] }).catch(() => {});
        }
      }

      const reply = baseEmbed().setTitle('Warn issued').setDescription(`<@${targetId}> warned`).addFields({ name: 'Reason', value: reason });
      const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`mod_undo:${c.id}:${interaction.user.id}`).setLabel('Undo (30s)').setStyle(ButtonStyle.Secondary));
      await interaction.reply({ embeds: [reply], components: [undoRow], ephemeral: true });

      // auto-resolve after 30s
      setTimeout(async () => {
        try { await moderation.resolveCase(c.id, { resolvedBy: interaction.user.id, resolution: 'completed' }); } catch (e) {}
      }, 30000);
      return;
    }

    if (action === 'fine') {
      const amount = Number(interaction.fields.getTextInputValue('amount') || 0);
      if (!amount || amount <= 0) {
        await interaction.reply({ content: 'Invalid amount.', ephemeral: true });
        return;
      }
      await applyFine(targetId, amount, 'mod_fine', `by:${interaction.user.id}`);
      const c = await moderation.createCase({ type: 'fine', moderatorId: interaction.user.id, targetId, reason, meta: { amount } });
      await interaction.reply({ content: `Fined ${formatNumber(amount)} Aura.`, ephemeral: true });
      const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`mod_undo:${c.id}:${interaction.user.id}`).setLabel('Undo (30s)').setStyle(ButtonStyle.Secondary));
      await interaction.followUp({ content: 'Action recorded.', components: [undoRow], ephemeral: true });
      setTimeout(async () => { try { await moderation.resolveCase(c.id, { resolvedBy: interaction.user.id, resolution: 'completed' }); } catch (e) {} }, 30000);
      return;
    }

    if (action === 'ban') {
      // perform ban
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply({ content: 'Guild context required.', ephemeral: true });
        return;
      }
      await guild.members.ban(targetId, { reason }).catch(err => { console.error('Ban failed', err); });
      const c = await moderation.createCase({ type: 'ban', moderatorId: interaction.user.id, targetId, reason });
      const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`mod_undo:${c.id}:${interaction.user.id}`).setLabel('Undo (30s)').setStyle(ButtonStyle.Secondary));
      await interaction.reply({ embeds: [baseEmbed().setTitle('Banned').setDescription(`<@${targetId}> banned by <@${interaction.user.id}>`).addFields({ name: 'Reason', value: reason })], components: [undoRow], ephemeral: true });
      setTimeout(async () => { try { await moderation.resolveCase(c.id, { resolvedBy: interaction.user.id, resolution: 'completed' }); } catch (e) {} }, 30000);
      return;
    }

    if (action === 'timeout') {
      const durText = interaction.fields.getTextInputValue('evidence') || '1m';
      // parse simple durations like 1m, 10m, 1h
      let ms = 60000;
      if (/^\d+h$/.test(durText)) ms = Number(durText.replace('h','')) * 3600000;
      else if (/^\d+m$/.test(durText)) ms = Number(durText.replace('m','')) * 60000;
      else if (/^\d+s$/.test(durText)) ms = Number(durText.replace('s','')) * 1000;
      const member = interaction.guild ? await interaction.guild.members.fetch(targetId).catch(() => null) : null;
      if (member) await member.timeout(ms, reason).catch(() => {});
      const c = await moderation.createCase({ type: 'timeout', moderatorId: interaction.user.id, targetId, reason, meta: { durationMs: ms } });
      const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`mod_undo:${c.id}:${interaction.user.id}`).setLabel('Undo (30s)').setStyle(ButtonStyle.Secondary));
      await interaction.reply({ embeds: [baseEmbed().setTitle('Timeout applied').setDescription(`<@${targetId}> timed out for ${formatDuration(ms)}`)], components: [undoRow], ephemeral: true });
      setTimeout(async () => { try { await moderation.resolveCase(c.id, { resolvedBy: interaction.user.id, resolution: 'completed' }); } catch (e) {} }, 30000);
      return;
    }

    await interaction.reply({ content: 'Unhandled moderation action.', ephemeral: true });
  } catch (err) {
    console.error('handleModModal error', err);
    await interaction.reply({ content: 'Failed to perform action.', ephemeral: true });
  }
}

async function replyWithRoutine(interaction, type) {
  const routine = routines[type] ?? routines.skin;
  const embed = baseEmbed()
    .setColor(brand.neutral)
    .setTitle(routine.title)
    .setDescription(routine.note)
    .addFields(
      routine.steps.map((step, index) => ({
        name: `${index + 1}. addım`,
        value: step
      }))
    );

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

async function askOpenAI(input, username, userId = null) {
  const cleaned = input.replace(/\s+/g, ' ').trim();
  const historyKey = userId || username;
  const history = aiConversationHistory.get(historyKey) || [];
  const previousContext = history.length ? `Keçmiş söhbət:
${history.join('\n')}

` : '';
  const replyKey = `${historyKey}:${cleaned}`;

  const profileContext = userId ? await buildUserContext(userId) : '';
  const leaderboardContext = await buildLeaderboardContext();
  const userReference = userId ? `${username} <@${userId}>` : username;
  const requestPayload = {
    model: OPENAI_MODEL,
    instructions: aiSystemPrompt,
    input: [
      {
        role: 'system',
        content: `${profileContext}${leaderboardContext}Cari istifadəçi: ${userReference}`
      },
      {
        role: 'user',
        content: `${previousContext}${userReference}: ${cleaned}`
      }
    ],
    max_output_tokens: 220,
    temperature: 0.75,
    top_p: 0.9
  };

  let answer;
  try {
    const response = await openai.responses.create(requestPayload);
    answer = response.output_text?.trim() || 'Cavab boş gəldi. Sualı bir az daha konkret yaz.';
  } catch (error) {
    console.error('OpenAI request failed:', error);
    answer = 'AI cavabını hazırlamaq mümkün olmadı. Bir az sonra yenidən cəhd et.';
  }

  const previous = aiReplyHistory.get(replyKey);
  if (previous && previous === answer) {
    const variationResponse = await openai.responses.create({
      ...requestPayload,
      instructions: `${aiSystemPrompt}\n\nƏvvəlki cavab təkrar oldu. Daha fərqli və daha faydalı bir cavab ver.`
    });
    answer = variationResponse.output_text?.trim() || answer;
  }

  const updatedHistory = [...history, `İstifadəçi: ${cleaned}`, `Köməkçi: ${answer}`].slice(-8);
  aiConversationHistory.set(historyKey, updatedHistory);
  aiReplyHistory.set(replyKey, answer);

  const gift = userId ? await maybeGrantAuraForKindness(userId, cleaned) : null;
  return { answer, gift };
}

function evalKindnessScore(text) {
  const normalized = text.toLowerCase();
  let score = 0;

  if (/\b(təşəkkür|sağ ol|xahiş|zəhmət olmasa|please|thanks|thank you|ty|pls|kindly)\b/.test(normalized)) {
    score += 2;
  }

  if (/[😊😍😇👍✨❤️♥❤️]/.test(text)) {
    score += 2;
  }

  if (/\b(gözəl|əla|super|mükəmməl|şən|xoş|səmimi|hörmət|nəzakət|dost)\b/.test(normalized)) {
    score += 1;
  }

  if (/\b(pulsuz aura|give me free|free aura|ver mənə pul|ver mənə aura|xahiş edirəm aura)\b/.test(normalized)) {
    score -= 2;
  }

  if (/\b(nifrət|pis|təhqir|qəzəb|öfke|yaxşı deyil)\b/.test(normalized)) {
    score -= 1;
  }

  return Math.max(0, score);
}

async function maybeGrantAuraForKindness(userId, messageContent) {
  const score = evalKindnessScore(messageContent);
  if (score < 3) {
    return null;
  }

  const lastGiftAt = auraGiftHistory.get(userId);
  if (lastGiftAt && Date.now() - lastGiftAt < auraGiftCooldownMs) {
    return null;
  }

  let giftAmount;
  if (score >= 6) {
    giftAmount = 2500;
  } else if (score === 5) {
    giftAmount = 1000;
  } else if (score === 4) {
    giftAmount = 500;
  } else {
    giftAmount = 25 + Math.floor(Math.random() * 75);
  }

  await addBalance(userId, giftAmount, { safeMode: false });
  auraGiftHistory.set(userId, Date.now());
  return giftAmount;
}

async function buildUserContext(userId) {
  try {
    const profile = await getProfile(userId);
    return [`İstifadəçi profili:`,
      `- Balans: ${profile.balance} Aura`,
      `- Bank: ${profile.bank} Aura`,
      `- Ümumi Aura: ${profile.balance + profile.bank} Aura`,
      `- Level: ${profile.level}`,
      `- Rank: ${profile.rank}`,
      `- Prestige: ${profile.prestige}`,
      `- Aktiv kredit: ${profile.loan?.amount ?? 0} Aura`,
      `- Son 5 əməliyyat: ${profile.transactions?.slice(0, 5).map(tx => `${tx.type}:${tx.amount}`).join(', ')}`
    ].join('\n') + '\n\n';
  } catch (error) {
    return '';
  }
}

async function buildLeaderboardContext() {
  try {
    const rows = await leaderboard(5);
    if (!rows.length) return '';
    const top = rows.map((row, index) => `${index + 1}. ${row.userId.slice(-4)} = ${row.balance} Aura`).join(', ');
    return `Liderlər tablosu (top 5): ${top}\n\n`;
  } catch (error) {
    return '';
  }
}

function shouldAnswerMessage(message) {
  if (!openai || message.author.bot || !message.guild) {
    return false;
  }

  // Direct @mention of Octoson
  const mentioned = message.mentions.users.has(client.user.id);

  // Optional dedicated AI channel
  const inAiChannel =
    Boolean(AI_CHANNEL_ID) &&
    message.channelId === AI_CHANNEL_ID;

  if (AI_REPLY_TO_MENTIONS === 'true' && mentioned) {
    return true;
  }

  if (inAiChannel) {
    return true;
  }

  return false;
}



async function startUiEmojiCapture(interaction) {
  const key = interaction.options.getString('key');
  const pastedEmoji = interaction.options.getString('emoji');

  if (pastedEmoji) {
    const parsed = parseEmojiInput(pastedEmoji);
    if (!parsed) {
      await interaction.reply({
        content: 'Emoji düzgün oxunmadı. Custom emoji üçün `<:ad:id>` formatında paste et, ya da `emoji` boş saxla və sonra sticker/image göndər.',
        ephemeral: true
      });
      return;
    }

    uiEmotes[key] = parsed;
    await writeUiEmotes(uiEmotes);
    await interaction.reply({
      content: `${emojiPreview(parsed)} **${uiEmojiLabel(key)}** UI emotesi kimi yadda saxlandı.`,
      ephemeral: true
    });
    return;
  }

  pendingUiEmojiCaptures.set(interaction.user.id, {
    key,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    createdAt: Date.now()
  });

  await interaction.reply({
    embeds: [
      gameEmbed()
        .setTitle('UI emote seçimi')
        .setDescription([
          `Slot: **${uiEmojiLabel(key)}**`,
          'Bu kanala 2 dəqiqə ərzində sticker, image attachment və ya custom emoji göndər.',
          'Bot onu server emojisi kimi əlavə edib UI düymələrində istifadə edəcək.'
        ].join('\n'))
        .addFields(
          { name: 'Vacib icazə', value: 'Botda **Manage Expressions** icazəsi olmalıdır.', inline: false },
          { name: 'Qeyd', value: 'Discord düymələrində sticker birbaşa işləmədiyi üçün sticker şəkli server emoji-yə çevrilir.', inline: false }
        )
    ],
    ephemeral: true
  });
}

async function handleUiEmojiCapture(message) {
  if (message.author?.bot || !message.guild) {
    return false;
  }

  const capture = pendingUiEmojiCaptures.get(message.author.id);
  if (!capture) {
    return false;
  }

  if (Date.now() - capture.createdAt > uiEmojiCaptureTtlMs) {
    pendingUiEmojiCaptures.delete(message.author.id);
    await message.reply({ content: 'UI emote seçimi vaxtı bitdi. Yenidən `/admin uiemoji` yaz.', allowedMentions: { repliedUser: false } });
    return true;
  }

  // allow the user to send the emoji from any server or DM; we will copy it into the target guild

  const source = getEmojiSourceFromMessage(message);
  if (!source) {
    await message.reply({
      content: 'Sticker, şəkil attachment və ya custom emoji göndər. Sadə mətn UI emote kimi əlavə edilə bilmir.',
      allowedMentions: { repliedUser: false }
    });
    return true;
  }

  try {
    const targetGuild = await client.guilds.fetch(capture.guildId);
    const emoji = await targetGuild.emojis.create({
      attachment: source.url,
      name: createEmojiName(capture.key, source.name)
    });

    uiEmotes[capture.key] = {
      id: emoji.id,
      name: emoji.name,
      animated: Boolean(emoji.animated)
    };
    await writeUiEmotes(uiEmotes);
    pendingUiEmojiCaptures.delete(message.author.id);

    await message.reply({
      content: `${emoji} **${uiEmojiLabel(capture.key)}** UI emotesi kimi yadda saxlandı.`,
      allowedMentions: { repliedUser: false }
    });
  } catch (error) {
    console.error('UI emoji capture failed:', error);
    const code = error?.code ?? error?.rawError?.code;
    const content = code === 50013
      ? 'Botun **Manage Expressions** icazəsi yoxdur. İcazəni ver, sonra `/admin uiemoji` ilə yenidən yoxla.'
      : 'Discord bu sticker/şəkli server emoji kimi əlavə etmədi. PNG, JPG, WEBP və ya GIF image göndər və ölçünü kiçilt.';
    await message.reply({ content, allowedMentions: { repliedUser: false } });
  }

  return true;
}

function isAdminAuraGrantMessage(message) {
  if (!adminUserIds.has(message.author.id)) {
    return false;
  }

  if (!message.mentions.users.has(client.user.id)) {
    return false;
  }

  const targetMentions = message.mentions.users.filter((user, id) => id !== client.user.id);
  if (!targetMentions.size) {
    return false;
  }

  const amount = parseAdminAuraGrantAmount(message.content);
  return Number.isInteger(amount) && amount > 0;
}

function parseAdminAuraGrantAmount(content) {
  if (!content) return null;

  // remove mention tokens (user, role, channel) and inline code, then normalize
  let cleaned = String(content)
    .replace(/<@!?(?:\d+)>/g, ' ')
    .replace(/<@&(?:\d+)>/g, ' ')
    .replace(/<#(?:\d+)>/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/[,]/g, ' ')
    .toLowerCase();

  // find all numeric tokens like 2, 2.5, 2k, 1m etc.
  const matches = [...cleaned.matchAll(/\b(\d+(?:\.\d+)?)([km]?)\b/g)];
  if (!matches.length) return null;

  // try to prefer the number that appears after a give-like verb (english/azerbaijani verbs)
  const givePos = cleaned.search(/\b(give|ver|verdi|verildi|give\s|hədiyyə|gift)\b/);
  let chosenMatch = matches[0];
  if (givePos >= 0) {
    const after = matches.find(m => (m.index ?? 0) >= givePos);
    if (after) chosenMatch = after;
  }

  let amount = Number(chosenMatch[1]);
  const suffix = chosenMatch[2];
  if (suffix === 'k') amount *= 1000;
  if (suffix === 'm') amount *= 1000000;

  return Number.isFinite(amount) && amount >= 1 ? Math.floor(amount) : null;
}

function isCancelGrantMessage(content) {
  return /\b(cancel|cancelled|iptal|ləğv|ləğv et|ləğv edin|dayandır|stop)\b/i.test(content);
}

async function handleAdminAuraGrantMessage(message) {
  if (message.author.bot) {
    return false;
  }

  if (message.reference?.messageId) {
    const pending = pendingAdminGiftReverts.get(message.reference.messageId);
    if (!pending) {
      return false;
    }

    if (!isCancelGrantMessage(message.content)) {
      return false;
    }

    if (message.author.id !== pending.adminId && message.author.id !== pending.targetId) {
      return false;
    }

    if (Date.now() - pending.grantedAt > adminGrantCancelWindowMs) {
      pendingAdminGiftReverts.delete(message.reference.messageId);
      await message.channel.send({
        content: `Bu əməliyyat artıq 1 dəqiqə sonra ləğv edilə bilməz.`,
        allowedMentions: { repliedUser: false }
      });
      return true;
    }

    pendingAdminGiftReverts.delete(message.reference.messageId);
    const result = await adminRevertGiveAura(pending.targetId, pending.amount, pending.adminId);
    scheduleLiveLeaderboardRefresh();
    await message.channel.send({
      content: `⚠️ <@${pending.targetId}> üçün **${formatNumber(result.deducted)} Aura** geri alındı.`,
      allowedMentions: { users: [pending.targetId, pending.adminId], repliedUser: false }
    });
    await message.channel.send({
      content: `<@${pending.adminId}> tərəfindən verilmiş **${formatNumber(pending.amount)} Aura** əməliyyatı ləğv edildi.`,
      allowedMentions: { users: [pending.targetId, pending.adminId], repliedUser: false }
    });
    return true;
  }

  if (!isAdminAuraGrantMessage(message)) {
    return false;
  }

  const amount = parseAdminAuraGrantAmount(message.content);
  if (!amount || amount <= 0) {
    return false;
  }

  const target = message.mentions.users.filter((user, id) => id !== client.user.id).first();
  if (!target) {
    return false;
  }

  await adminGiveAura(target.id, amount, message.author.id);
  scheduleLiveLeaderboardRefresh();

  const [fromProfile, toProfile] = await Promise.all([
    getProfile(message.author.id),
    getProfile(target.id)
  ]);

  const attachment = new AttachmentBuilder(await renderTransferCard({
    fromUser: message.author,
    toUser: target,
    fromProfile,
    toProfile,
    amount,
    title: 'Aura verildi',
    tone: 'gift'
  }), { name: 'aura-transfer.png' });

  const notification = await message.channel.send({
    content: `<@${target.id}> sənə **${formatNumber(amount)} Aura** verildi.`,
    files: [attachment],
    allowedMentions: { users: [target.id], repliedUser: false }
  });

  pendingAdminGiftReverts.set(notification.id, {
    adminId: message.author.id,
    targetId: target.id,
    amount,
    grantedAt: Date.now()
  });

  setTimeout(() => pendingAdminGiftReverts.delete(notification.id), adminGrantCancelWindowMs);
  return true;
}

function getEmojiSourceFromMessage(message) {
  const sticker = message.stickers?.first?.();
  if (sticker?.url) {
    return { url: sticker.url, name: sticker.name };
  }

  const attachment = message.attachments?.find(item => {
    if (item.contentType?.startsWith('image/')) return true;
    return /\.(png|jpe?g|webp|gif)$/i.test(item.name ?? item.url ?? '');
  });
  if (attachment?.url) {
    return { url: attachment.url, name: attachment.name };
  }

  const customEmoji = message.content?.match(/<(?<animated>a?):(?<name>[a-zA-Z0-9_]{2,32}):(?<id>\d{17,22})>/);
  if (customEmoji?.groups) {
    const extension = customEmoji.groups.animated ? 'gif' : 'png';
    return {
      url: `https://cdn.discordapp.com/emojis/${customEmoji.groups.id}.${extension}`,
      name: customEmoji.groups.name
    };
  }

  return null;
}

function parseEmojiInput(input) {
  const customEmoji = input.trim().match(/^<(?<animated>a?):(?<name>[a-zA-Z0-9_]{2,32}):(?<id>\d{17,22})>$/);
  if (customEmoji?.groups) {
    return {
      id: customEmoji.groups.id,
      name: customEmoji.groups.name,
      animated: Boolean(customEmoji.groups.animated)
    };
  }

  const trimmed = input.trim();
  if (trimmed && trimmed.length <= 8) {
    return { value: trimmed };
  }

  return null;
}

function createEmojiName(key, sourceName = '') {
  const suffix = `${Date.now().toString(36)}`.slice(-5);
  const cleanSource = `${sourceName}`.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 10);
  return `octo_${key}_${cleanSource || suffix}`.slice(0, 32);
}

async function loadUiEmotes() {
  uiEmotes = await loadUiEmotesStore();
  return uiEmotes;
}

async function readUiEmotes() {
  return loadUiEmotesStore();
}

async function writeUiEmotes(store) {
  await saveUiEmotesStore(store);
}

function uiEmoji(key, fallback) {
  const saved = uiEmotes[key];
  if (saved?.value) {
    return saved.value;
  }

  if (saved?.id && saved?.name) {
    return { id: saved.id, name: saved.name, animated: Boolean(saved.animated) };
  }

  return fallback;
}

function emojiPreview(saved) {
  if (saved?.value) return saved.value;
  if (saved?.id && saved?.name) return `<${saved.animated ? 'a' : ''}:${saved.name}:${saved.id}>`;
  return '';
}

function withUiEmoji(button, key, fallback) {
  return button.setEmoji(uiEmoji(key, fallback));
}

function isPrimeProfile(profile) {
  return Boolean(profile?.prime?.activeUntil && profile.prime.activeUntil > Date.now()) || Boolean(profile?.primeActive);
}

function primeBadge() {
  return emojiPreview(uiEmotes.prime_badge) || '💎 PRIME';
}

function maybePrimeBadge(profile) {
  return isPrimeProfile(profile) ? ` ${primeBadge()}` : '';
}

function primeDisplayName(user, profile) {
  return `${user.globalName ?? user.displayName ?? user.username}${maybePrimeBadge(profile)}`;
}

function displayUserName(user) {
  return user.globalName ?? user.displayName ?? user.username ?? 'Üzv';
}

function primeMention(user, profile) {
  return `${user}${maybePrimeBadge(profile)}`;
}

function canvasPrimeBadge(profile) {
  if (!isPrimeProfile(profile)) return null;
  return 'PRIME';
}

function markPrimeEmbed(embed, user, profile) {
  if (!isPrimeProfile(profile)) return embed;
  const name = user
    ? `${user.globalName ?? user.displayName ?? user.username ?? 'Üzv'}`
    : 'Üzv';
  const iconURL = user?.displayAvatarURL?.({ size: 128 });
  return embed.setAuthor({
    name: `PRIME ÜZV • ${name}`,
    iconURL
  });
}

function uiEmojiLabel(key) {
  const labels = {
    daily: 'Gündəlik',
    leaderboard: 'Liderlər',
    games: 'Oyunlar',
    profile: 'Profil',
    commands: 'Komandalar',
    wallet: 'Wallet',
    market: 'Market',
    inventory: 'Inventory',
    progress: 'Progress',
    social: 'Social',
    style: 'Style',
    prime_badge: 'Prime badge',
    help: 'Help',
    back: 'Geri',
    home: 'Ana panel',
    close: 'Bağla',
    claim: 'Götür',
    accept: 'Qəbul et',
    decline: 'Rədd et',
    up: 'Yuxarı',
    down: 'Aşağı',
    custom: 'Xüsusi',
    cashout: 'Götür',
    join: 'Qoşul',
    start: 'Başlat',
    bonus: 'Üstünlük'
  };
  return labels[key] ?? key;
}

function baseEmbed() {
  return new EmbedBuilder()
    .setColor(brand.color)
    .setFooter({ text: brand.footer })
    .setTimestamp();
}

function gameEmbed() {
  return baseEmbed()
    .setColor(brand.accent)
    .setFooter({ text: `${brand.footer} - yalnız server içi Aura` });
}

function helpEmbed() {
  return moduleHelpEmbed('home');
}

const helpPages = [
  { id: 'home', label: 'Başlanğıc', emoji: '🏠', title: '🏠 Octoson Kömək Paneli' },
  { id: 'commands', label: 'Komandalar', emoji: '📋', title: '📋 Komanda Xəritəsi' },
  { id: 'aura', label: 'Aura', emoji: '💠', title: '💠 Aura Sistemi' },
  { id: 'games', label: 'Casino', emoji: '🎮', title: '🎮 Casino' },
  { id: 'wallet', label: 'Wallet', emoji: '👛', title: '👛 Wallet və Bank' },
  { id: 'missions', label: 'Qazanc', emoji: '💼', title: '💼 Qazanc' },
  { id: 'world', label: 'Dünya', emoji: '🌍', title: '🌍 Octoson Dünyası' },
  { id: 'market', label: 'Market', emoji: '🛒', title: '🛒 Market' },
  { id: 'inventory', label: 'İnventar', emoji: '🎒', title: '🎒 İnventar' },
  { id: 'progress', label: 'Progress', emoji: '📈', title: '📈 Progress' },
  { id: 'social', label: 'Sosial', emoji: '🤝', title: '🤝 Sosial' },
  { id: 'style', label: 'Stil', emoji: '✨', title: '✨ Stil' }
];

function helpPageIndex(page) {
  return Math.max(0, helpPages.findIndex(item => item.id === page));
}

function normalizeHelpPage(page) {
  return helpPages.some(item => item.id === page) ? page : 'home';
}

function moduleHelpEmbed(page = 'home') {
  const normalized = normalizeHelpPage(page);
  const index = helpPageIndex(normalized);
  const pageMeta = helpPages[index];

  if (normalized === 'commands') return commandMapEmbed().setTitle(pageMeta.title).setDescription(helpHeader(pageMeta, index));
  if (normalized === 'aura') return auraInfoEmbed().setTitle(pageMeta.title).setDescription(helpHeader(pageMeta, index));
  if (normalized === 'games') return casinoGuideEmbed().setDescription(`${helpHeader(pageMeta, index)}\nBütün casino oyunlarında nəticə embed və canvas kartında aydın göstərilir.`);
  if (normalized === 'wallet') return walletGuideEmbed().setDescription(`${helpHeader(pageMeta, index)}\nWallet oyun üçün hazır Aura, bank isə saxlanılan Aura üçündür.`);
  if (normalized === 'missions') return earnGuideEmbed().setDescription(`${helpHeader(pageMeta, index)}\nRisksiz qazanc üçün əvvəl gündəlik və iş komandalarını istifadə et.`);
  if (normalized === 'world') return worldGuideEmbed().setDescription(`${helpHeader(pageMeta, index)}\nİş seç, missiya et, biznes/əmlak al, xəritə kəşf et və Aura nüfuzunu böyüt.`);
  if (normalized === 'market') return marketGuideEmbed().setDescription(`${helpHeader(pageMeta, index)}\nƏşyalar casino və economy loop üçün istifadə olunur: ticket mərcin bir hissəsini ödəyir, booster casino nəticəsini gücləndirir, açar/sandıq collectible və Aura verir.`);
  if (normalized === 'inventory') return inventoryHelpEmbed().setTitle(pageMeta.title).setDescription(`${helpHeader(pageMeta, index)}\nBütün item-lar aşağıda “necə alınır, necə istifadə olunur, nə edir” formatında izah olunub.`);
  if (normalized === 'progress') return progressGuideEmbed().setDescription(`${helpHeader(pageMeta, index)}\nLevel, rank, statistikalar və leaderboard inkişafını izləmək üçündür.`);
  if (normalized === 'social') return socialGuideEmbed().setDescription(`${helpHeader(pageMeta, index)}\nDostlara Aura göndər, PvP çağır və sosial statistikaya bax.`);
  if (normalized === 'style') return styleGuideEmbed().setDescription(`${helpHeader(pageMeta, index)}\nFit yoxlanışı və rutinlər üçün yüngül stil alətləri.`);

  return gameEmbed()
    .setTitle(pageMeta.title)
    .setDescription(`${helpHeader(pageMeta, index)}\nAşağıdakı uzun seçim qutusundan modul seç və ya səhifə düymələri ilə gəz.`)
    .addFields(
      { name: '🚀 Başla', value: '`/earn bonus` -> `/earn daily` -> `/profile`', inline: true },
      { name: '🎮 Oyna', value: '`/casino slots bet:10`\n`/casino mines bet:50`', inline: true },
      { name: '👛 Pul idarəsi', value: '`/wallet balance`\n`/wallet deposit amount:100`', inline: true },
      { name: '📦 Modul qutuları', value: 'Komandalar, Aura, Casino, Wallet, Qazanc, Dünya, Market, İnventar, Progress, Sosial və Stil səhifələri ayrı-ayrı açılır.', inline: false },
      { name: '🔒 Admin', value: '`/ask`, `/livepanel` və `/admin` komandaları normal üzvlər üçün bağlıdır.', inline: false }
    );
}

function helpHeader(pageMeta, index) {
  return `**${pageMeta.label}** modulu • Səhifə **${index + 1}/${helpPages.length}**`;
}

function auraInfoEmbed() {
  return gameEmbed()
    .setTitle('Aura nədir?')
    .setDescription('Aura Octoson V3-də sənin server içi oyun balansındır. Real pul deyil və serverdən kənar dəyəri yoxdur.')
    .addFields(
      { name: 'Necə qazanırsan?', value: '`/earn daily`, `/earn work`, `/earn fish`, `/earn mine`, `/earn weekly`, oyun qələbələri və duel qələbələri.', inline: false },
      { name: 'Harada istifadə olunur?', value: 'Casino mərcləri, duel qoyuluşları, mağaza əşyaları, sandıqlar, craft, rank və leaderboard rəqabəti.', inline: false },
      { name: 'Balansı necə qoruyursan?', value: '`/wallet deposit amount:100` ilə bank hesabına qoy. Bank gündəlik faiz verir: `/wallet interest`.', inline: false }
    );
}

function tutorialEmbed() {
  return gameEmbed()
    .setTitle('📖 30 saniyəlik başlanğıc')
    .setDescription('Yeni üzvsənsə bu sıranı izlə və botun məntiqini dərhal tutacaqsan.')
    .addFields(
      { name: '1. 🎁 İlk bonus', value: 'Bir dəfəlik başlanğıc Aura-sı və bilet götür.', inline: false },
      { name: '2. 👤 Profil', value: 'Aura, səviyyə, XP, rank və inventarını yoxla.', inline: false },
      { name: '3. 🎮 Oyunlar', value: 'Əvvəl az mərc ilə slot və ya risk raundu yoxla.', inline: false },
      { name: '4. 🏆 Liderlər', value: 'Hədəf seç: daha çox Aura, daha yüksək səviyyə və ya daha yaxşı qələbə faizi.', inline: false },
      { name: '💡 Günlük tövsiyə', value: pick(gameCopy.dailyTasks), inline: false }
    );
}

function gamesHelpEmbed() {
  return gameEmbed()
    .setTitle('Oyunlar necə işləyir?')
    .setDescription('Hər oyun `bet` istəyir. Bot əvvəl mərcini çıxır, sonra qazananda ödənişi və XP-ni profilinə yazır. Kiçik mərc ilə başla.')
    .addFields(
      { name: 'Ən asan başlanğıc', value: '`/casino slots bet:10` - 3 simvol eyni olarsa böyük qazanc.\n`/casino coinflip bet:10` - üz/arxa düyməsi seç.\n`/casino dice bet:10` - zəri düymə ilə at.', inline: false },
      { name: 'Orta oyunlar', value: '`/casino roulette bet:25` - qırmızı/qara düyməsi.\n`/casino blackjack bet:25` - kart çək və ya dayan.\n`/casino higherlower bet:25` - yuxarı/aşağı təxmin et.', inline: false },
      { name: 'Riskli oyunlar', value: '`/casino crash bet:50` - çıxış çarpanını düymə və ya modal ilə seç.\n`/casino mines bet:50` - xanaları aç, istəyəndə götür.\n`/casino jackpot bet:100` - nadir, böyük payout.\nBütün casino oyunlarında 4 saniyə cooldown və server house edge var.', inline: false },
      { name: 'Başqa üzvlə', value: '`/social duel opponent:@user stake:50` - hər iki oyunçu Aura qoyur, qalib potu götürür.', inline: false }
    );
}

function missionsEmbed() {
  return gameEmbed()
    .setTitle('Missiyalar və gündəlik rutin')
    .setDescription('Oyun oynamadan Aura qazanmaq üçün bu komandalar var. Bəzilərində cooldown var, ona görə hər şeyi eyni anda farm etmək olmur.')
    .addFields(
      { name: 'Gündəlik yol', value: '`/earn daily` mükafat al.\n`/earn work` təhlükəsiz Aura.\n`/earn fish` və `/earn mine` əlavə qazanc.\n`/progress profile` nəticəni yoxla.', inline: false },
      { name: 'Böyük mükafatlar', value: '`/earn weekly` həftədə bir dəfə.\n`/earn monthly` ayda bir dəfə.\n`/wallet interest` bank faizini götür.', inline: false },
      { name: 'Kiçik və riskli missiyalar', value: '`/earn beg` az Aura üçün qısa cooldown missiyasıdır.\n`/earn crime` və `/earn rob` daha çox Aura verə bilər, amma uduzanda cərimə gəlir.', inline: false }
    );
}

function earnGuideEmbed() {
  return gameEmbed()
    .setTitle('💼 Qazanc və Tapşırıqlar')
    .setDescription('Casino oynamadan Aura yığmaq üçün bu bölmədən istifadə et. Komandaların cooldown-u var ki, ekonomi balanslı qalsın.')
    .addFields(
      { name: '🎁 Pulsuz mükafatlar', value: '`/earn bonus` başlanğıc hədiyyəsi\n`/earn daily` gündəlik Aura, XP və sandıq şansı\n`/earn weekly`, `/earn monthly`, `/earn rewards`', inline: false },
      { name: '🧰 Stabil missiyalar', value: '`/earn work`, `/earn fish`, `/earn mine`, `/earn hunt`, `/earn collect`, `/earn beg`', inline: false },
      { name: '⚠ Riskli missiyalar', value: '`/earn crime` və `/earn rob` daha çox Aura verə bilər, amma cərimə riski var.', inline: false },
      { name: '📋 Quest paneli', value: '`/quest board`, `/quest progress`, `/quest milestones` və gündəlik/həftəlik tapşırıqlar.', inline: false }
    );
}

function worldGuideEmbed() {
  return gameEmbed()
    .setTitle('🌍 Octoson Dünyası')
    .setDescription('Octoson dünyası server içi mini rol oyunu kimidir. Məqsəd Aura qazanmaq, işini böyütmək, biznes və əmlak almaq, xəritələri kəşf etmək və şəhərdə nüfuz toplamaqdır.')
    .addFields(
      { name: '💼 İş sistemi', value: '`/world jobs` bütün işləri göstərir. `/world job type:hacker` kimi iş seçirsən. Hər işin maaşı, riski və XP dəyəri fərqlidir.', inline: false },
      { name: '📋 Missiyalar', value: '`/world mission choice:safe/smart/bold` ilə iş missiyası edirsən. Safe daha təhlükəsizdir, smart balanslıdır, bold isə daha çox Aura verə bilər, amma uduzma riski yüksəkdir.', inline: false },
      { name: '🏪 Biznes və passiv gəlir', value: '`/world businesses` biznesləri göstərir, `/world buybusiness` biznes alır. Sonra `/world collect` ilə biznes və əmlak gəlirini toplayırsan.', inline: false },
      { name: '🏠 Əmlak və 🚗 nəqliyyat', value: '`/world property` ev/ofis kimi mülk alır. `/world vehicle` isə missiya və gəlir bonusu verir. Bahalı nəqliyyat daha çox gücləndirmə deməkdir.', inline: false },
      { name: '🗺️ Macəra və kəşf', value: '`/world adventure` gündəlik seçimli hadisədir. `/world explore map:dungeon` kimi xəritə kəşf edəndə Aura, collectible və nüfuz qazana bilərsən.', inline: false },
      { name: '🌐 Nüfuz', value: '`/world influence` şəhərdə nüfuzunu göstərir. Nüfuz işlərdən, macəralardan, kəşfdən və mülklərdən artır. Bu sistem gələcək guild, boss və mövsüm mükafatları üçün əsas olacaq.', inline: false },
      { name: '✅ Ən rahat başlanğıc', value: '`/world jobs` → `/world job` → `/world mission` → Aura yığ → `/world buybusiness` → `/world collect` → `/world explore`', inline: false }
    );
}

function inventoryHelpEmbed() {
  return gameEmbed()
    .setTitle('İnventar, market və craft')
    .setDescription('Bütün əsas item-lar aşağıdadır. Bunlar title almaq üçün yox, casino, sandıq və economy loop üçün işləyən əşyalardır.')
    .addFields(
      { name: '🔑 Bürünc Açar', value: 'Necə alınır: `/market buy item:bronze_key` və ya admin verir.\nNecə istifadə olunur: `/market open`.\nNə edir: sandığın yoxdursa bonus cache açır, Aura + collectible verir. Cache reward **1x-5x** çıxa bilər.', inline: false },
      { name: '🎟️ Reward Ticket', value: 'Necə alınır: `/market buy item:ticket`, daily/weekly reward və ya admin.\nNecə istifadə olunur: hər casino oyununda avtomatik.\nNə edir: mərcin ilk **500 Aura** hissəsini ödəyir. Məsələn 700 mərcdə 500 ticket, 200 walletdən gedir.', inline: false },
      { name: '🍀 Lucky Booster', value: 'Necə alınır: `/market buy item:lucky_booster`.\nNecə istifadə olunur: növbəti pullu casino oyununda avtomatik.\nNə edir: win olsa bonus payout verir, loss olsa shield refund qaytarır. Nəticə embed-ində ayrıca görünür.', inline: false },
      { name: '🪵 Bürünc / 🥇 Qızıl sandıq', value: 'Necə alınır: market, daily/weekly reward və ya admin.\nNecə istifadə olunur: `/market open`.\nNə edir: Aura və collectible materialı verir. Qızıl sandıq daha premium reward hissi üçündür.', inline: false },
      { name: '🧩 Collectible materialları', value: 'Məsələn Oktyabr nişanı, Aura tokeni, Prestij sapı. Bunlar ayrıca güc deyil, materialdır: `/market craft` ilə 3 dənədən titul, `/market recycle` ilə Aura, `/market salvage` ilə açar alırsan.', inline: false }
    );
}

function commandMapEmbed() {
  return gameEmbed()
    .setTitle('📋 Komanda Xəritəsi')
    .setDescription('Bütün əsas modul komandaları buradadır. Daha rahat oxumaq üçün yuxarıdakı seçim menyusundan modul seç.')
    .addFields(
      { name: 'Start', value: '`/start`, `/panel`, `/help`, `/commands`, `/leaderboard`', inline: false },
      { name: 'Earn / Quest', value: '`/earn daily weekly monthly work crime hunt fish mine beg rob collect rewards bonus`\n`/quest board daily weekly monthly work crime hunt fish mine collect progress milestones`', inline: false },
      { name: 'Casino / Game', value: '`/casino slots risk coinflip dice roulette blackjack crash mines tower higherlower wheel lottery jackpot rps baccarat poker horse penalty`\n`/game menu balance daily slots risk duel leaderboard prestige`', inline: false },
      { name: 'Wallet / World', value: '`/wallet balance bank deposit withdraw transfer gift loan prime payloan credit helploan insurance history transactions interest taxes`\n`/world profile jobs job mission businesses buybusiness collect property vehicle adventure explore event influence`', inline: false },
      { name: 'Market / Inventory', value: '`/market shop prices buy sell open craft recycle salvage auction trade listings inventory`\n`/inventory profile items shop buy sell open craft recycle salvage achievements badges titles statistics settings`', inline: false },
      { name: 'Progress / Social / Style', value: '`/progress profile level rank richest leaderboard statistics achievements badges titles prestige history settings`\n`/social profile gift transfer rob duel dicebattle quickdraw heist compare leaderboard richest reputation badges stats`\n`/profile`, `/stylecheck`, `/routine`, `/mogger`', inline: false },
      { name: 'Lider tablosu qısa yolu', value: '`/leaderboard` əsas qısa komandadır. `/game leaderboard`, `/progress leaderboard` və `/social leaderboard` alias kimi saxlanılıb.', inline: false },
      { name: 'Admin', value: '`/admin give`, `/admin take`, `/admin setbalance`, `/admin setlevel`, `/admin badge`, `/admin item`, `/admin drop`, `/admin uiemoji` - yalnız icazəli bot adminləri istifadə edə bilər.', inline: false }
    );
}

function walletGuideEmbed() {
  return gameEmbed()
    .setTitle('Wallet və bank necə işləyir?')
    .setDescription('Wallet oyun üçün hazır Aura-dır. Bank Aura-nı saxlamaq və faiz almaq üçündür.')
    .addFields(
      { name: 'Əsas komandalar', value: '`/wallet balance` - wallet + bank.\n`/wallet deposit amount:100` - banka qoy.\n`/wallet withdraw amount:100` - walletə çıxar.\n`/wallet history` - son əməliyyatlar.', inline: false },
      { name: 'Üzvlərlə', value: '`/wallet transfer user:@name amount:50` - Aura göndər.\n`/social gift user:@name amount:50` - hədiyyə kimi göndər.', inline: false },
      { name: 'Kredit və Prime', value: '`/wallet loan` kredit təklifləri açır.\n`/wallet prime` 10,000 Aura Prime alır və 30 gün üçün 6 casino loss refund verir.\n`/wallet payloan` borcu ödəyir.\n`/wallet credit` reytinqi göstərir.\n`/wallet insurance` aylıq 50% penalty sığortası alır.', inline: false },
      { name: 'Faiz və vergi', value: '`/wallet interest` gündəlik bank faizi verir.\n`/wallet taxes` yüksək balans üçün gündəlik vergi hesablayır.', inline: false }
    );
}

function casinoGuideEmbed() {
  return gameEmbed()
    .setTitle('🎮 Casino Komandaları')
    .setDescription('Bütün casino oyunları yalnız Aura ilə işləyir. Maksimum mərc balans və bank əsasında təyin olunur, cooldown 4 saniyədir və server üstünlüyü aktivdir.')
    .addFields(
      { name: 'Başlanğıc oyunları', value: '`/casino slots bet:10`\n`/casino coinflip bet:10`\n`/casino dice bet:10`\n`/casino roulette bet:10`', inline: false },
      { name: 'Kart və təxmin', value: '`/casino blackjack bet:25`\n`/casino poker bet:25`\n`/casino baccarat bet:25`\n`/casino higherlower bet:25`\n`/casino rps bet:25`', inline: false },
      { name: 'Riskli oyunlar', value: '`/casino crash bet:50`\n`/casino mines bet:50`\n`/casino tower bet:50`\n`/casino wheel bet:50`\n`/casino lottery bet:100`\n`/casino jackpot bet:100`\n`/casino horse bet:50`\n`/casino penalty bet:50`', inline: false },
      { name: 'Game qrupu', value: '`/game menu`, `/game balance`, `/game daily`, `/game slots`, `/game risk`, `/game duel`, `/game leaderboard`, `/game prestige`', inline: false }
    );
}

function marketGuideEmbed() {
  return gameEmbed()
    .setTitle('🛒 Market və İnventar')
    .setDescription('Market Aura-nı real istifadə olunan item-lara çevirir. Burada title almaq əsas deyil; əsas loop casino ticket, booster, sandıq, açar və collectible-lardır.')
    .addFields(
      { name: '🛒 Əsas loop', value: '`/market shop` bax -> `/market buy` item al -> casino oyna və ya `/market open` aç -> collectible-ları craft/recycle/salvage et.', inline: false },
      { name: '🎰 Casino item-ları', value: '**Reward Ticket** bütün casino oyunlarında avtomatik işləyir və 500 Aura cover verir.\n**Lucky Booster** bütün pullu casino oyunlarında avtomatik işləyir: win bonusu və ya loss shield.', inline: false },
      { name: '🔑 Sandıq item-ları', value: '**Bürünc Açar** sandıq yoxdursa bonus cache açır.\n**Bürünc/Qızıl sandıq** `/market open` ilə açılır, Aura + collectible verir.', inline: false },
      { name: '📌 Hazır baxış panelləri', value: '`/market auction`, `/market trade`, `/market listings` hələ real al-sat sistemi deyil; hazırda istifadəçini aktiv market yollarına yönləndirən info panelidir.', inline: false }
    );
}

function progressGuideEmbed() {
  return gameEmbed()
    .setTitle('📈 Progress Komandaları')
    .setDescription('Rank, XP, nailiyyət, tarixçə və leaderboard inkişafını buradan yoxla.')
    .addFields(
      { name: 'Profil', value: '`/profile`, `/progress profile`, `/progress level`, `/progress rank`, `/progress prestige`', inline: false },
      { name: 'Statistika və açılanlar', value: '`/progress statistics`, `/progress achievements`, `/progress badges`, `/progress titles`, `/progress settings`, `/quest milestones`', inline: false },
      { name: 'Lider tablosu və tarixçə', value: '`/progress leaderboard`, `/progress richest`, `/progress history`, `/game leaderboard`', inline: false }
    );
}

function socialGuideEmbed() {
  return gameEmbed()
    .setTitle('🤝 Sosial Komandalar')
    .setDescription('Üzv profilləri, Aura göndərmə, müqayisə və PvP oyunları üçün bu bölmədən istifadə et.')
    .addFields(
      { name: 'Member actions', value: '`/social profile user:@name`, `/social compare user:@name`, `/social reputation`, `/social stats`', inline: false },
      { name: 'Üzvlərlə Aura', value: '`/social gift user:@name amount:50`, `/social transfer user:@name amount:50`, `/wallet gift`, `/wallet transfer`', inline: false },
      { name: 'Rob', value: '`/social rob user:@name` və `/earn rob user:@name` real üzvdən Aura steal cəhdidir: 1 dəqiqə cooldown və 1 dəqiqə target shield var.', inline: false },
      { name: 'Competition', value: '`/social duel opponent:@name stake:50`, `/social dicebattle opponent:@name stake:100`, `/social quickdraw opponent:@name stake:100`, `/social heist stake:250`, `/social leaderboard`, `/social richest`, `/social badges`', inline: false }
    );
}

function styleGuideEmbed() {
  return gameEmbed()
    .setTitle('✨ Stil Alətləri')
    .setDescription('Tərz yoxlanışı və rutin alətləri Aura ekonomisindən ayrı işləyir.')
    .addFields(
      { name: 'Stil alətləri', value: '`/stylecheck` fit və stil modalı açır.\n`/routine type:skin|hair|posture|photo` praktik rutin verir.\n`/mogger image:<file> user:@name` private Looks Lab açır.', inline: false },
      { name: 'Admin AI and live', value: '`/ask` və `/livepanel` yalnız admin üçün saxlanılıb. AI cavabları hazırda söndürülüb.', inline: false },
      { name: 'Profil', value: '`/profile user:@name` başqa üzvün profil kartını göstərir. Boş saxlasan öz profilin açılır.', inline: false }
    );
}

function profileEmbed(user, profile) {
  return markPrimeEmbed(gameEmbed(), user, profile)
    .setTitle(`🪪 ${primeDisplayName(user, profile)} - Aura Profili`)
    .setImage('attachment://aura-profile.png')
    .setDescription(`Profil kartı aşağıdakı şəkildədir. Qısa baxış: **${formatNumber(profile.balance)} Aura**, **Sv.${profile.level}**, **${profile.rank}**.`)
    .addFields(
      { name: '📊 XP', value: xpLine(profile), inline: true },
      { name: '🔥 Seriya', value: `${profile.dailyStreak} gün`, inline: true },
      { name: '🎯 Növbəti addım', value: nextActionLine(profile), inline: false }
    );
}

async function profilePayload(user, profile, options = {}) {
  try {
    const attachment = new AttachmentBuilder(await renderProfileCard(user, profile, { primeBadge: canvasPrimeBadge(profile) }), { name: 'aura-profile.png' });
    return {
      embeds: [profileEmbed(user, profile)],
      files: [attachment],
      components: options.components ?? [],
      ephemeral: options.ephemeral
    };
  } catch (error) {
    console.error('Profile canvas render failed:', error);
    return {
      embeds: [profileEmbed(user, profile).setImage(null)],
      components: options.components ?? [],
      ephemeral: options.ephemeral
    };
  }
}

function walletEmbed(profile) {
  return gameEmbed()
    .setTitle('🏦 Aura bankı')
    .setDescription(`${xpLine(profile)}\n${streakLine(profile)}`)
    .addFields(
      { name: 'Wallet', value: `${formatNumber(profile.balance)} ${gameCopy.currency}`, inline: true },
      { name: 'Bank', value: `${formatNumber(profile.bank)} ${gameCopy.currency}`, inline: true },
      { name: 'Ümumi', value: `${formatNumber(profile.balance + profile.bank)} ${gameCopy.currency}`, inline: true },
      { name: 'Faiz', value: 'Gündə 1.5%, maksimum 750 Aura.', inline: false },
      { name: 'Vergi', value: '10000 Aura üstü toplam sərvət üçün gündə 1%, maksimum 1000 Aura.', inline: false }
    );
}

function loanCenterEmbed(credit) {
  const bank = credit.offers.octobank;
  const shadow = credit.offers.blackmarket;
  return gameEmbed()
    .setTitle('OctoBank Kredit Mərkəzi')
    .setDescription(credit.active ? 'Aktiv kreditin var. Yeni kredit üçün əvvəl borcu bağla.' : 'Kredit almaq istəyirsən? Safe bank və riskli qara bazar arasında seçim et.')
    .addFields(
      { name: 'Kredit Reytinqin', value: `${credit.grade.grade} ${credit.grade.stars}\n${credit.grade.label}`, inline: true },
      { name: 'OctoBank', value: `Max **${formatNumber(bank.max)} Aura**\nFaiz **${Math.round(bank.interest * 100)}%**\n${bank.payments} ödəniş / ${Math.round(bank.durationMs / dayMs)} gün`, inline: true },
      { name: 'Kölgə Krediti', value: `Max **${formatNumber(shadow.max)} Aura**\nFaiz **${Math.round(shadow.interest * 100)}%**\nRiskli, qısa müddət`, inline: true },
      { name: 'Aktiv Borc', value: credit.active ? loanStatusLine(credit.active) : 'Yoxdur', inline: false },
      { name: 'Freeze qaydası', value: 'Vaxtı keçmiş borc transfer, withdraw, lottery və jackpot əməliyyatlarını bağlayır.', inline: false }
    );
}

function creditProfileEmbed(credit) {
  return gameEmbed()
    .setTitle('Kredit Hesabı')
    .addFields(
      { name: 'Reytinq', value: `${credit.grade.grade} ${credit.grade.stars}`, inline: true },
      { name: 'Score', value: `${credit.score}/950`, inline: true },
      { name: 'Status', value: credit.frozen ? 'Dondurulub' : 'Aktiv', inline: true },
      { name: 'Aktiv Borc', value: credit.active ? loanStatusLine(credit.active) : 'Yoxdur', inline: false },
      { name: 'Vaxtında Ödəniş', value: `${credit.stats.onTimePayments}`, inline: true },
      { name: 'Gecikmiş', value: `${credit.stats.latePayments}`, inline: true },
      { name: 'Ümumi Kredit', value: `${formatNumber(credit.stats.totalBorrowed)} Aura`, inline: true },
      { name: 'Sığorta', value: credit.insured ? 'Aktiv: növbəti penalty 50% azalır' : '`/wallet insurance` ilə aylıq sığorta al', inline: false }
    );
}

function loanRows(credit) {
  const disabled = Boolean(credit.active || credit.frozen);
  return [
    loanRow('octobank', credit.offers.octobank, [1000, 5000, 10000], disabled),
    loanRow('blackmarket', credit.offers.blackmarket, [500, 5000, 25000], disabled),
    loanRow('casino', credit.offers.casino, [100, 250, 500], disabled),
    loanRow('business', credit.offers.business, [5000, 15000, 25000], disabled),
    loanRow('vip', credit.offers.vip, [10000, 50000, 100000], disabled)
  ];
}

function loanRow(lender, offer, amounts, disabled) {
  return new ActionRowBuilder().addComponents(
    amounts.map(amount =>
      new ButtonBuilder()
        .setCustomId(`loan_take:${lender}:${amount}`)
        .setLabel(`${offer.label} ${formatShortNumber(amount)}`)
        .setStyle(lender === 'blackmarket' ? ButtonStyle.Danger : lender === 'casino' ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(disabled || amount > offer.max || amount < offer.min)
    )
  );
}

function primeEmbed(prime, selectedLoss = null) {
  const activeText = prime.active
    ? `Aktivdir, bitir: <t:${Math.floor(prime.activeUntil / 1000)}:R>`
    : 'Aktiv deyil. 10,000 Aura ödəyib 30 günlük Prime aç.';
  const selectedText = selectedLoss
    ? `Seçilən ID: \`${selectedLoss.id}\`\nOyun: **${casinoGameLabel(selectedLoss.game)}**\nMərc: **${formatNumber(selectedLoss.bet)} Aura**\nRefund: **${formatNumber(selectedLoss.lossAmount)} Aura**`
    : prime.losses.length
      ? 'Aşağıdakı seçim qutusundan refund etmək istədiyin lost game seç.'
      : 'Hələ refund edilə bilən future lost game yoxdur.';

  return gameEmbed()
    .setTitle('💎 Octoson Prime Refund')
    .setDescription('Prime casino riskini yumşaldır: 10,000 Aura ödə, 30 gün ərzində uduzduğun casino oyunlarından maksimum 6-nı geri qaytar.')
    .addFields(
      { name: 'Status', value: activeText, inline: false },
      { name: 'Qalan refund haqqı', value: `${prime.refundsRemaining}/${prime.refundLimit}`, inline: true },
      { name: 'Qiymət', value: `${formatNumber(prime.price)} Aura`, inline: true },
      { name: 'Qayda', value: 'Yalnız Prime aldıqdan sonra oynanılan və son 30 gündə uduzulmuş casino oyunları refund siyahısına düşür. Hər oyun yalnız 1 dəfə refund edilir.', inline: false },
      { name: 'Refund seçimi', value: selectedText, inline: false }
    );
}

function primeRows(prime, selectedLossId = null) {
  const rows = [];

  if (prime.active && prime.losses.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`prime_loss_select:${selectedLossId ?? 'none'}`)
        .setPlaceholder('Refund üçün lost game seç')
        .addOptions(prime.losses.slice(0, 25).map(loss => ({
          label: `${casinoGameLabel(loss.game)} - ${formatNumber(loss.lossAmount)} Aura`,
          value: loss.id,
          description: `ID: ${loss.id.slice(0, 38)} | Bet ${formatNumber(loss.bet)} | ${timeAgo(loss.createdAt)}`,
          default: loss.id === selectedLossId
        })))
    ));
  }

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('prime_buy')
      .setLabel(prime.active ? 'Prime aktivdir' : 'Prime al - 10,000 Aura')
      .setStyle(prime.active ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setEmoji('💎')
      .setDisabled(prime.active),
    new ButtonBuilder()
      .setCustomId(selectedLossId ? `prime_refund:${selectedLossId}` : 'prime_refund:none')
      .setLabel('Seçiləni refund et')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('↩️')
      .setDisabled(!prime.active || !selectedLossId || prime.refundsRemaining <= 0),
    new ButtonBuilder()
      .setCustomId('prime_manual')
      .setLabel('ID ilə refund')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️')
      .setDisabled(!prime.active || prime.refundsRemaining <= 0)
  ));

  return rows;
}

function casinoGameLabel(game) {
  const labels = {
    slots: 'Slot',
    risk: 'Risk',
    coinflip: 'Sikkə',
    dice: 'Zər',
    roulette: 'Rulet',
    blackjack: 'Blackjack',
    crash: 'Crash',
    mines: 'Mines',
    tower: 'Qüllə',
    higherlower: 'Yuxarı/Aşağı',
    wheel: 'Çarx',
    lottery: 'Lotereya',
    jackpot: 'Jackpot',
    rps: 'Daş/Kağız/Qayçı',
    baccarat: 'Baccarat',
    poker: 'Poker',
    horse: 'Yarış',
    penalty: 'Penalti'
  };
  return labels[game] ?? game;
}

function timeAgo(timestamp) {
  if (!timestamp) return 'vaxt yoxdur';
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s əvvəl`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}d əvvəl`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}saat əvvəl`;
  return `${Math.floor(hours / 24)}g əvvəl`;
}

function loanTakenEmbed(result, user, lender, amount) {
  if (!result.ok) {
    const reasons = {
      active_loan: 'Aktiv kreditin var. Əvvəl `/wallet payloan` ilə bağla.',
      frozen: 'Hesabın dondurulub. Əvvəl aktiv borcu bağla.',
      not_allowed: 'Bu məbləğ hazırkı kredit limitinə uyğun deyil.',
      requirements: 'Bu kredit üçün level, prestige və ya credit score çatmır.'
    };
    return gameEmbed()
      .setTitle('Kredit rədd edildi')
      .setDescription(reasons[result.reason] ?? 'Kredit təsdiqlənmədi.');
  }

  return gameEmbed()
    .setColor(lender === 'blackmarket' ? 0x111827 : brand.success)
    .setTitle(result.offer.label)
    .setDescription(`${user}, **${formatNumber(amount)} Aura** kredit götürdün.`)
    .addFields(
      { name: 'Qaytarılacaq', value: `${formatNumber(result.loan.remaining)} Aura`, inline: true },
      { name: 'Faiz', value: `${Math.round(result.loan.interestRate * 100)}%`, inline: true },
      { name: 'Gündəlik/periodik ödəniş', value: `${formatNumber(result.loan.installment)} Aura`, inline: true },
      { name: 'Növbəti ödəniş', value: `<t:${Math.floor(result.loan.nextPaymentAt / 1000)}:R>`, inline: true },
      { name: 'Son tarix', value: `<t:${Math.floor(result.loan.dueAt / 1000)}:R>`, inline: true }
    );
}

function loanPaymentEmbed(result, user) {
  if (!result.ok) {
    return gameEmbed()
      .setTitle('Kredit ödənişi alınmadı')
      .setDescription(result.reason === 'no_loan' ? 'Aktiv kreditin yoxdur.' : 'Ödəniş üçün balansın çatmır.');
  }

  return gameEmbed()
    .setColor(brand.success)
    .setTitle('Kredit ödənişi')
    .setDescription(`${user} **${formatNumber(result.payment)} Aura** ödədi.`)
    .addFields(
      { name: 'Qalan borc', value: result.profile.active ? `${formatNumber(result.profile.active.remaining)} Aura` : 'Tam bağlandı', inline: true },
      { name: 'Reytinq', value: `${result.profile.grade.grade} ${result.profile.grade.stars}`, inline: true }
    );
}

function loanHelpEmbed(result, helper, target) {
  if (!result.ok) {
    return gameEmbed()
      .setTitle('Borc köməyi alınmadı')
      .setDescription(result.reason === 'no_loan' ? `${target} üzvünün aktiv krediti yoxdur.` : 'Sənin balansın bu kömək üçün çatmır.');
  }

  return gameEmbed()
    .setColor(brand.success)
    .setTitle('Dost borca kömək etdi')
    .setDescription(`${helper} ${target} üçün **${formatNumber(result.payment)} Aura** ödədi.`)
    .addFields({ name: 'Qalan borc', value: result.profile.active ? `${formatNumber(result.profile.active.remaining)} Aura` : 'Tam bağlandı', inline: true });
}

function loanInsuranceEmbed(result) {
  if (!result.ok) {
    return gameEmbed()
      .setTitle('Sığorta alınmadı')
      .setDescription(result.reason === 'already_bought' ? 'Bu ay artıq kredit sığortası almısan.' : 'Sığorta üçün 1200 Aura lazımdır.');
  }

  return gameEmbed()
    .setColor(brand.success)
    .setTitle('Kredit sığortası aktivdir')
    .setDescription(`${formatNumber(result.price)} Aura ödənildi. Bu ay ilk missed-payment penalty 50% azalacaq.`);
}

function transactionEmbed(title, profile, description, withImage = false) {
  const embed = gameEmbed()
    .setTitle(title)
    .setDescription(formatAuraText(description))
    .addFields(
      { name: 'Balans', value: `${formatNumber(profile.balance)} ${gameCopy.currency}`, inline: true },
      { name: 'Bank', value: `${formatNumber(profile.bank)} ${gameCopy.currency}`, inline: true },
      { name: 'Rank', value: profile.rank, inline: true }
    );

  if (withImage) {
    embed.setImage('attachment://transaction-card.png');
  }

  return embed;
}

async function transactionPayload(title, profile, description, options = {}) {
  try {
    const attachment = new AttachmentBuilder(await renderTransactionCard({
      title,
      description: formatAuraText(description),
      profile,
      amount: options.amount ?? amountFromDescription(description),
      kind: options.kind ?? transactionKind(title, description)
    }), { name: 'transaction-card.png' });

    return {
      embeds: [transactionEmbed(title, profile, description, true)],
      files: [attachment],
      ephemeral: options.ephemeral,
      allowedMentions: options.allowedMentions
    };
  } catch (error) {
    console.error('Transaction canvas render failed:', error);
    return {
      embeds: [transactionEmbed(title, profile, description)],
      ephemeral: options.ephemeral,
      allowedMentions: options.allowedMentions
    };
  }
}

async function transferPayload(title, fromProfile, toProfile, fromUser, toUser, description, options = {}) {
  const amount = Math.abs(options.amount ?? amountFromDescription(description) ?? 0);
  const cleanDescription = `${displayUserName(fromUser)} -> ${displayUserName(toUser)}: **${formatNumber(amount)} Aura**`;

  if (!toProfile || options.kind === 'error') {
    return transactionPayload(title, fromProfile, cleanDescription, options);
  }

  try {
    const attachment = new AttachmentBuilder(await renderTransferCard({
      fromUser,
      toUser,
      fromProfile,
      toProfile,
      amount,
      title,
      tone: options.kind === 'gift' ? 'gift' : 'transfer'
    }), { name: 'aura-transfer.png' });

    const isGift = options.kind === 'gift';
    const embed = markPrimeEmbed(gameEmbed(), fromUser, fromProfile)
      .setColor(isGift ? 0xec4899 : brand.success)
      .setTitle(`${isGift ? '🎁' : '💸'} ${title}`)
      .setDescription(`${primeMention(fromUser, fromProfile)} → ${primeMention(toUser, toProfile)}\n**${formatNumber(amount)} ${gameCopy.currency}** ${isGift ? 'hədiyyə edildi.' : 'göndərildi.'}`)
      .addFields(
        { name: 'Göndərən', value: `${displayUserName(fromUser)}\n${formatNumber(fromProfile.balance)} ${gameCopy.currency}`, inline: true },
        { name: 'Alan', value: `${displayUserName(toUser)}\n${formatNumber(toProfile.balance)} ${gameCopy.currency}`, inline: true },
        { name: isGift ? 'Hədiyyə' : 'Məbləğ', value: `**${formatNumber(amount)} ${gameCopy.currency}**`, inline: true },
        { name: 'Status', value: 'Balanslar yeniləndi və əməliyyat tarixçəyə yazıldı.', inline: false }
      )
      .setImage('attachment://aura-transfer.png');

    return {
      embeds: [embed],
      files: [attachment],
      ephemeral: options.ephemeral,
      allowedMentions: options.allowedMentions
    };
  } catch (error) {
    console.error('Transfer canvas render failed:', error);
    return transactionPayload(title, fromProfile, cleanDescription, options);
  }
}

async function robberyPayload(robberUser, targetUser, result) {
  const title = result.success ? 'Soyğun uğurlu oldu' : 'Soyğun alınmadı';
  const description = result.success
    ? `${primeMention(robberUser, result.robber)} ${primeMention(targetUser, result.target)} üzvündən Aura götürdü.`
    : `${primeMention(robberUser, result.robber)} yaxalandı və cərimə ödədi.`;

  const embed = gameEmbed()
    .setTitle(title)
    .setDescription(description)
    .addFields(
      { name: 'Nəticə', value: result.amount >= 0 ? `+${formatNumber(result.amount)} ${gameCopy.currency}` : `${formatNumber(result.amount)} ${gameCopy.currency}`, inline: true },
      { name: 'Soyğunçunun balansı', value: `${formatNumber(result.robber.balance)} ${gameCopy.currency}`, inline: true },
      { name: 'Qoruma limiti', value: `1 dəqiqə cooldown, hədəf üçün 1 dəqiqə qorunma.`, inline: false }
    )
    .setImage('attachment://soygun-card.png');

  try {
    const attachment = new AttachmentBuilder(await renderRobberyCard({
      robberUser,
      targetUser,
      robberProfile: result.robber,
      targetProfile: result.target,
      amount: result.amount,
      success: result.success
    }), { name: 'soygun-card.png' });

    return {
      embeds: [embed],
      files: [attachment],
      allowedMentions: { users: [targetUser.id] }
    };
  } catch (error) {
    console.error('Robbery canvas render failed:', error);
    return {
      embeds: [embed.setImage(null)],
      allowedMentions: { users: [targetUser.id] }
    };
  }
}

function amountFromDescription(description) {
  const match = `${description}`.replaceAll(',', '').match(/([+-]?\d+)\s*Aura/i);
  return match ? Number(match[1]) : null;
}

function formatAuraText(value) {
  return `${value}`.replace(/([+-]?\d[\d,]*)\s+Aura/g, (_, number) => {
    const numeric = Number(`${number}`.replaceAll(',', ''));
    if (!Number.isFinite(numeric)) return `${number} Aura`;
    return `${numeric < 0 ? '-' : number.startsWith('+') ? '+' : ''}${formatNumber(Math.abs(numeric))} Aura`;
  });
}

function formatSignedAura(value) {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${formatNumber(Math.abs(value))} ${gameCopy.currency}`;
}

function transactionKind(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('admin')) return 'admin';
  if (text.includes('bank') || text.includes('faiz') || text.includes('vergi')) return 'bank';
  if (text.includes('göndər') || text.includes('transfer') || text.includes('gift')) return 'transfer';
  if (text.includes('mükafat') || text.includes('gündəlik') || text.includes('quest') || text.includes('sandıq')) return 'reward';
  if (text.includes('market') || text.includes('əşya') || text.includes('craft') || text.includes('recycle') || text.includes('salvage')) return 'market';
  if (text.includes('kifayət deyil') || text.includes('tapılmadı') || text.includes('alınmadı')) return 'error';
  return 'transfer';
}

function dropEmbed(drop, closed = false) {
  const remaining = Math.max(0, drop.claims - drop.claimedBy.length);
  const mode = drop.mode === 'random' ? 'Random bölüşdürmə' : 'Hamıya eyni';
  const rewardText = drop.mode === 'random'
    ? `Toplam pool: **${formatNumber(drop.amount)} ${gameCopy.currency}**`
    : `Hər claim: **${formatNumber(drop.amount)} ${gameCopy.currency}**`;
  const claimers = dropClaimersLine(drop);
  const timeLeft = dropTimeLeft(drop);
  const title = drop.cancelledAt ? 'Aura portalı ləğv edildi' : closed && drop.paidAt ? 'Aura portalı tamamlandı' : closed ? 'Claim limiti doldu' : 'Aura portalı açıldı';
  return gameEmbed()
    .setColor(drop.cancelledAt ? 0xc53030 : closed ? brand.success : brand.accent)
    .setTitle(title)
    .setDescription(`${rewardText}\nİlk **${drop.claims} nəfər** claim yerini tutur. Reward yalnız vaxt bitəndə yazılır.`)
    .addFields(
      { name: 'Qalan claim', value: `${remaining}/${drop.claims}`, inline: true },
      { name: 'Paylaşım', value: mode, inline: true },
      { name: 'Vaxt', value: drop.cancelledAt ? 'Ləğv edildi' : closed && !drop.paidAt ? timeLeft : closed ? 'Bağlandı' : timeLeft, inline: true },
      { name: 'Verən admin', value: `<@${drop.creatorId}>`, inline: true },
      ...(drop.mode === 'random' ? [{ name: 'Qalan pool', value: `${formatNumber(Math.max(0, drop.remainingAmount ?? 0))} ${gameCopy.currency}`, inline: true }] : []),
      { name: 'Claim edənlər', value: claimers, inline: false },
      { name: 'Qayda', value: drop.cancelledAt ? 'Portal admin tərəfindən ləğv edildi. Aura verilmədi.' : 'Hər üzv yalnız 1 dəfə claim edə bilər. Aura yalnız timer bitəndə verilir.', inline: false }
    );
}

function dropMessage(drop, closed = false) {
  const remaining = Math.max(0, drop.claims - drop.claimedBy.length);
  const rewardText = drop.mode === 'random'
    ? `Toplam **${formatNumber(drop.amount)} ${gameCopy.currency}** random bölünür.`
    : `Hər biri **${formatNumber(drop.amount)} ${gameCopy.currency}** alır.`;
  const status = closed ? 'Aura portalı tamamlandı' : 'Aura portalı açıldı';
  return [
    `**${status}**`,
    `İlk **${drop.claims} nəfər** claim yeri tutur. ${rewardText}`,
    `Qalan claim: **${remaining}/${drop.claims}**`,
    `Vaxt: **${closed ? 'bağlandı' : dropTimeLeft(drop)}**`,
    `Claim edənlər: ${dropClaimersLine(drop)}`,
    `Verən admin: <@${drop.creatorId}>`
  ].join('\n');
}

function dropClaimersLine(drop) {
  const records = normalizeDropClaimRecords(drop);
  if (!records.length) return 'Hələ heç kim claim etməyib.';
  return records
    .slice(0, 15)
    .map((record, index) => `**${index + 1}.** <@${record.userId}> - **${formatNumber(record.amount)} ${gameCopy.currency}**`)
    .join('\n');
}

function dropTimeLeft(drop) {
  if (!drop.expiresAt) return 'Timer yoxdur';
  const remainingMs = Math.max(0, drop.expiresAt - Date.now());
  if (remainingMs <= 0) return 'bitib';
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds} sec`;
  return `${minutes} min ${seconds} sec`;
}

function isDropCancelable(drop) {
  return !drop.cancelledAt && Number.isFinite(drop.cancelAvailableUntil) && Date.now() < drop.cancelAvailableUntil;
}

function nextDropPayout(drop) {
  if (drop.mode !== 'random') return drop.amount;
  const claimed = drop.claimRecords.length;
  const remainingSlotsAfterThis = Math.max(0, drop.claims - claimed - 1);
  const pool = Math.max(remainingSlotsAfterThis + 1, drop.remainingAmount ?? drop.amount);
  if (remainingSlotsAfterThis === 0) {
    drop.remainingAmount = 0;
    return pool;
  }

  const maxPayout = Math.max(1, pool - remainingSlotsAfterThis);
  const average = Math.max(1, Math.floor(pool / (remainingSlotsAfterThis + 1)));
  const softMax = Math.max(1, Math.min(maxPayout, average * 2));
  const payout = 1 + Math.floor(Math.random() * softMax);
  drop.remainingAmount = pool - payout;
  return payout;
}

function dropRow(dropId, closed, drop = null) {
  const cancelable = drop ? isDropCancelable(drop) : false;
  return new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`drop_claim:${dropId}`)
      .setLabel(closed ? 'Portal bağlandı' : 'Claim Aura')
      .setStyle(closed ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(closed), 'claim', '✨'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`drop_cancel:${dropId}`)
      .setLabel(cancelable ? `Cancel (${dropTimeLeft({ expiresAt: drop.cancelAvailableUntil })})` : 'Cancel')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!cancelable), 'close', '❌')
  );
}

function createSafeDropId() {
  return `drop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readAuraDrops() {
  return { drops: await loadAuraDropsStore() };
}

async function scheduleSavedDrops(discordClient) {
  const store = await readAuraDrops();
  for (const drop of Object.values(store.drops ?? {})) {
    const normalized = normalizeAuraDrop(drop);
    if (normalized.expiresAt && Date.now() >= normalized.expiresAt) {
      await expireAuraDrop(normalized.id, discordClient);
      continue;
    }
    activeDrops.set(normalized.id, normalized);
    scheduleDropExpiry(normalized, discordClient);
  }
}

async function writeAuraDrops(store) {
  const nextDrops = store?.drops ?? {};
  const currentDrops = await loadAuraDropsStore();

  for (const drop of Object.values(nextDrops)) {
    await saveAuraDropStore(drop);
  }

  for (const dropId of Object.keys(currentDrops)) {
    if (!nextDrops[dropId]) {
      await deleteAuraDropStore(dropId);
    }
  }
}

async function saveAuraDrop(drop) {
  const normalized = normalizeAuraDrop(drop);
  activeDrops.set(normalized.id, normalized);
  await saveAuraDropStore(normalized);
}

async function loadAuraDrop(dropId) {
  const memoryDrop = activeDrops.get(dropId);
  if (memoryDrop) {
    return normalizeAuraDrop(memoryDrop);
  }

  const drop = await loadAuraDropStore(dropId);
  if (!drop) {
    return null;
  }

  const normalized = normalizeAuraDrop(drop);
  activeDrops.set(dropId, normalized);
  return normalized;
}

async function deleteAuraDrop(dropId) {
  activeDrops.delete(dropId);
  await deleteAuraDropStore(dropId);
}

function normalizeAuraDrop(drop) {
  const claimedBy = Array.isArray(drop.claimedBy) ? drop.claimedBy : [...(drop.claimedBy ?? [])];
  const claimRecords = normalizeDropClaimRecords({ ...drop, claimedBy });
  return {
    ...drop,
    mode: drop.mode === 'random' ? 'random' : 'same',
    remainingAmount: drop.mode === 'random' ? Math.max(0, drop.remainingAmount ?? 0) : null,
    expiresAt: drop.expiresAt ?? null,
    paidAt: drop.paidAt ?? null,
    cancelledAt: drop.cancelledAt ?? null,
    cancelledBy: drop.cancelledBy ?? null,
    claimedBy,
    claimRecords
  };
}

function normalizeDropClaimRecords(drop) {
  if (Array.isArray(drop.claimRecords)) {
    return drop.claimRecords.map((record, index) => ({
      userId: record.userId,
      amount: Number.isInteger(record.amount) ? record.amount : drop.amount,
      claimedAt: record.claimedAt ?? drop.createdAt ?? Date.now(),
      index
    }));
  }

  return (Array.isArray(drop.claimedBy) ? drop.claimedBy : []).map((userId, index) => ({
    userId,
    amount: drop.amount,
    claimedAt: drop.createdAt ?? Date.now(),
    index
  }));
}

function scheduleDropExpiry(drop, discordClient) {
  clearDropTimer(drop.id);
  if (!drop.expiresAt) return;
  const delay = drop.expiresAt - Date.now();
  if (delay <= 0) {
    expireAuraDrop(drop.id, discordClient).catch(error => console.error('Drop expiry failed:', error));
    return;
  }
  activeDropTimers.set(drop.id, setTimeout(() => {
    expireAuraDrop(drop.id, discordClient).catch(error => console.error('Drop expiry failed:', error));
  }, Math.min(delay, 2_147_483_647)));
}

function clearDropTimer(dropId) {
  const timer = activeDropTimers.get(dropId);
  if (timer) clearTimeout(timer);
  activeDropTimers.delete(dropId);
}

async function expireAuraDrop(dropId, discordClient) {
  const drop = await loadAuraDrop(dropId);
  if (!drop || (drop.expiresAt && Date.now() < drop.expiresAt)) return;
  const paidRecords = [];

  if (!drop.paidAt) {
    for (const record of normalizeDropClaimRecords(drop)) {
      const result = await adminGiveAuraForDrop(record.userId, record.amount, drop.creatorId, dropId);
      if (result.ok || result.duplicate) {
        paidRecords.push(record);
      }
    }
    drop.paidAt = Date.now();
    if (paidRecords.length) {
      scheduleLiveLeaderboardRefresh();
    }
  }

  activeDrops.delete(dropId);
  await deleteAuraDrop(dropId);
  clearDropTimer(dropId);

  if (!drop.channelId || !drop.messageId) return;
  try {
    const channel = await discordClient.channels.fetch(drop.channelId);
    const message = await channel.messages.fetch(drop.messageId);
    await message.edit({
      content: null,
      embeds: [dropEmbed(drop, true).setTitle(paidRecords.length ? 'Aura portalı tamamlandı' : 'Aura portalının vaxtı bitdi')],
      components: [dropRow(dropId, true, drop)]
    });
  } catch (error) {
    console.error('Could not update expired drop message:', error);
  }
}

function leaderboardText(rows) {
  if (!rows.length) {
    return 'Hələ heç kim Aura toplamayıb.';
  }

  return rows.map(row => {
    const medal = row.place === 1 ? '1st' : row.place === 2 ? '2nd' : row.place === 3 ? '3rd' : `#${row.place}`;
    return `**${medal}** <@${row.userId}>${maybePrimeBadge(row)} - **${formatNumber(row.balance)} ${gameCopy.currency}** | Lv.${row.level} | ${row.rank}`;
  }).join('\n');
}

function leaderboardSvg(rows) {
  const width = 1000;
  const height = 720;
  const rowHeight = 54;
  const maxBalance = Math.max(1, ...rows.map(row => row.balance));
  const rowMarkup = rows.map((row, index) => {
    const y = 170 + index * rowHeight;
    const barWidth = Math.max(36, Math.round((row.balance / maxBalance) * 310));
    const placeColor = index === 0 ? '#f5c542' : index === 1 ? '#c8d2dc' : index === 2 ? '#c9824a' : '#d9e2ec';
    return `
      <g>
        <rect x="58" y="${y - 34}" width="884" height="44" rx="12" fill="${index % 2 === 0 ? '#171923' : '#202333'}"/>
        <text x="86" y="${y - 6}" fill="${placeColor}" font-size="24" font-weight="800">#${row.place}</text>
        <text x="160" y="${y - 7}" fill="#f7fafc" font-size="23" font-weight="700">${escapeSvg(row.displayName)}</text>
        <rect x="492" y="${y - 25}" width="330" height="14" rx="7" fill="#2d3748"/>
        <rect x="492" y="${y - 25}" width="${barWidth}" height="14" rx="7" fill="#f59e0b"/>
        <text x="842" y="${y - 7}" fill="#f7fafc" font-size="21" font-weight="700" text-anchor="end">${formatNumber(row.balance)}</text>
        <text x="912" y="${y - 7}" fill="#a0aec0" font-size="18" text-anchor="end">Lv.${row.level}</text>
      </g>
    `;
  }).join('');

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="32" fill="#0f1117"/>
  <rect x="28" y="28" width="944" height="664" rx="26" fill="#141722" stroke="#2d3748" stroke-width="2"/>
  <circle cx="88" cy="82" r="26" fill="#f59e0b"/>
  <text x="88" y="91" text-anchor="middle" fill="#111827" font-size="30" font-weight="900">A</text>
  <text x="132" y="82" fill="#f7fafc" font-size="40" font-weight="900">Aura Lider Tablosu</text>
  <text x="134" y="116" fill="#a0aec0" font-size="19">Canlı Octoson iqtisadiyyat sıralaması</text>
  <text x="894" y="86" fill="#f59e0b" font-size="22" font-weight="800" text-anchor="end">TOP 10</text>
  <text x="894" y="116" fill="#a0aec0" font-size="16" text-anchor="end">hər ${Math.round(liveLeaderboardRefreshMs / 1000)} saniyə yenilənir</text>
  ${rowMarkup || '<text x="500" y="370" fill="#a0aec0" font-size="30" text-anchor="middle">Hələ Aura datası yoxdur</text>'}
  <text x="500" y="662" fill="#718096" font-size="16" text-anchor="middle">Aura yalnız server daxili əyləncə valyutasıdır. Real pul dəyəri yoxdur.</text>
</svg>`.trim();
}

async function readLiveLeaderboardState() {
  return loadLiveLeaderboardStateStore();
}

async function writeLiveLeaderboardState(state) {
  await saveLiveLeaderboardStateStore(state);
}

function escapeSvg(value) {
  return `${value}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatShortNumber(value) {
  if (value >= 1000000) return `${Math.round(value / 100000) / 10}M`;
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`;
  return `${value}`;
}

function loanStatusLine(loan) {
  return [
    `Lender: **${loan.lender}**`,
    `Qalan: **${formatNumber(loan.remaining)} Aura**`,
    `Installment: **${formatNumber(loan.installment)} Aura**`,
    `Növbəti: <t:${Math.floor(loan.nextPaymentAt / 1000)}:R>`,
    `Son tarix: <t:${Math.floor(loan.dueAt / 1000)}:R>`
  ].join('\n');
}

async function sendTransactions(interaction) {
  await deferInteractionResponse(interaction, { ephemeral: true });
  const rows = await getTransactions(interaction.user.id, 10);
  await interaction.reply({
    embeds: [
      gameEmbed()
        .setTitle('📜 Aura əməliyyatları')
        .setDescription(rows.length ? rows.map(formatTransaction).join('\n') : 'Hələ əməliyyat yoxdur.')
    ],
    ephemeral: true
  });
}

function formatTransaction(row) {
  const sign = row.amount > 0 ? '+' : '';
  const date = row.at.slice(0, 10);
  return `**${sign}${row.amount}** - ${row.type} - ${row.note} (${date})`;
}

function rewardsEmbed(profile) {
  return gameEmbed()
    .setTitle('🎁 Mükafat statusu')
    .addFields(
      { name: 'Gündəlik streak', value: `${profile.dailyStreak} gün`, inline: true },
      { name: 'Son daily', value: profile.lastDaily ?? 'yoxdur', inline: true },
      { name: 'Son weekly', value: profile.lastWeekly ?? 'yoxdur', inline: true },
      { name: 'Son monthly', value: profile.lastMonthly ?? 'yoxdur', inline: true },
      { name: 'Açarlar', value: `${profile.inventory.keys}`, inline: true },
      { name: 'Biletlər', value: `${profile.inventory.tickets}`, inline: true },
      { name: 'Lucky Booster', value: `${profile.inventory.boosterCharges ?? 0} charge`, inline: true }
    );
}

function inventoryEmbed(profile) {
  const chests = Object.entries(profile.inventory.chests)
    .map(([name, count]) => `${name}: ${count}`)
    .join('\n') || 'Sandıq yoxdur.';
  const collectibles = profile.inventory.collectibles
    .slice(0, 12)
    .map(item => `**${item}** - ${collectiblePurpose(item)}`)
    .join('\n') || 'Collectible yoxdur.';
  const extraCollectibles = profile.inventory.collectibles.length > 12
    ? `\n...və daha ${profile.inventory.collectibles.length - 12} collectible.`
    : '';

  return gameEmbed()
    .setTitle('🎒 İnventar')
    .addFields(
      { name: 'Sandıqlar', value: chests, inline: false },
      { name: 'Collectible materialları', value: `${collectibles}${extraCollectibles}`, inline: false },
      { name: 'Açar / Bilet / Booster', value: `${profile.inventory.keys} açar | ${profile.inventory.tickets} bilet | ${profile.inventory.boosterCharges ?? 0} booster charge`, inline: true },
      { name: 'Nə edir?', value: 'Collectible-lar ayrı-ayrı güc vermir; materialdır. 3 dənə ilə `/market craft` titul yaradırsan, `/market recycle` ilə Aura alırsan, `/market salvage` ilə açara çevirirsən. Bürünc Açar sandığın yoxdursa bonus cache açır və nadir **5x** reward verə bilər.', inline: false },
      { name: 'Boosters', value: profile.inventory.boosters.length ? `${profile.inventory.boosters.join('\n')}\nCharge: ${profile.inventory.boosterCharges ?? 0}` : 'Booster yoxdur.', inline: false }
    );
}

function collectiblePurpose(item) {
  const descriptions = {
    'Güzgü parçası': 'craft materialı; titul üçün yığılır.',
    'Mirror Shard': 'köhnə adı: craft materialı; titul üçün yığılır.',
    'Neon lent': 'craft materialı; profil tituluna gedir.',
    'Neon Lace': 'köhnə adı: craft materialı; profil tituluna gedir.',
    'Aura tokeni': 'market materialı; recycle etsən Aura verir.',
    'Aura Token': 'köhnə adı: market materialı; recycle etsən Aura verir.',
    'Prestij sapı': 'nadir craft materialı; titul yaratmaq üçün saxla.',
    'Prestige Thread': 'köhnə adı: nadir craft materialı; titul yaratmaq üçün saxla.',
    'Oktyabr nişanı': 'event collectible; craft, recycle və ya salvage üçün istifadə olunur.',
    'October Crest': 'köhnə adı: event collectible; craft, recycle və ya salvage üçün istifadə olunur.'
  };
  return descriptions[item] ?? 'collectible materialı; craft, recycle və ya salvage üçün istifadə olunur.';
}

function shopEmbed() {
  const itemLines = Object.entries(shopItems)
    .map(([key, item]) => `**${item.name}** - ${item.price} Aura \`${key}\`\n${shopItemDescription(key)}`)
    .join('\n\n');
  return gameEmbed()
    .setTitle('🛒 Aura mağazası')
    .setDescription(`Buradakı item-lar title almaq üçün yox, casino və sandıq loop-u üçün istifadə olunur.\n\n${itemLines}`);
}

function shopItemDescription(key) {
  const descriptions = {
    bronze_key: 'İstifadə: `/market open`. Sandığın yoxdursa bonus cache açır və reward 1x-5x arası çıxa bilər. Sandıq/açar alış limiti: gündə 10.',
    ticket: 'İstifadə: hər casino oyununda avtomatik. Mərcin ilk 500 Aura hissəsini ödəyir.',
    lucky_booster: 'İstifadə: növbəti pullu casino raundunda avtomatik. Win bonus payout, loss shield refund verir.',
    starter_chest: 'İstifadə: `/market open`. Aura + collectible materialı verir. Sandıq/açar alış limiti: gündə 10.',
    gold_chest: 'İstifadə: `/market open`. Daha premium Aura + collectible reward verir. Sandıq/açar alış limiti: gündə 10.'
  };
  return descriptions[key] ?? 'Profil inventarına əlavə olunur.';
}

function shopBuyTitle(result, successTitle) {
  if (result.ok) return successTitle;
  if (result.reason === 'insufficient') return 'Balans kifayət deyil';
  if (result.reason === 'chests_disabled') return 'Sandıq sistemi bağlıdır';
  if (result.reason === 'daily_chest_limit') return 'Gündəlik sandıq limiti';
  return 'Əşya tapılmadı';
}

function shopBuyDescription(result, missingText) {
  if (result.reason === 'chests_disabled') {
    return 'Admin sandıq/açar alma və açma sistemini müvəqqəti bağlayıb.';
  }

  if (result.reason === 'daily_chest_limit') {
    return `Sandıq alma limiti gündə **${result.limit}** ədəddir. Bu gün qalan limit: **${result.remaining ?? 0}**.`;
  }

  return result.item ? `${result.item.name} - ${result.item.price} Aura` : missingText;
}

function chestOpenTitle(result) {
  if (result.ok) return 'Sandıq açıldı';
  if (result.reason === 'chests_disabled') return 'Sandıq sistemi bağlıdır';
  if (result.reason === 'debt_locked') return 'Balans mənfidir';
  return 'Sandıq yoxdur';
}

function chestOpenDescription(result, rich) {
  if (result.ok) {
    const separator = rich ? '\n' : ' ';
    const collectible = rich ? `**${result.collectible}**` : result.collectible;
    const bonus = result.cacheMultiplier > 1
      ? rich ? `\nBürünc Açar bonusu: **${result.cacheMultiplier}x** cache reward.` : ` • ${result.cacheMultiplier}x açar bonusu`
      : '';
    return `${result.chestName}: +${formatNumber(result.reward)} Aura və ${collectible}${separator}${collectiblePurpose(result.collectible)}${bonus}`;
  }

  if (result.reason === 'chests_disabled') {
    return 'Admin sandıq/açar alma və açma sistemini müvəqqəti bağlayıb.';
  }

  if (result.reason === 'debt_locked') {
    return 'Borcdan çıxana qədər sandıq/açar aça bilməzsən.';
  }

  return rich ? '`/earn daily` ilə sandıq qazana bilərsən.' : 'Açılacaq sandıq yoxdur.';
}

function listEmbed(title, items) {
  return gameEmbed()
    .setTitle(title)
    .setDescription(items.length ? items.join('\n') : 'Hələ heç nə açılmayıb.');
}

function statisticsEmbed(profile) {
  return gameEmbed()
    .setTitle('📊 Aura statistikası')
    .addFields(
      { name: 'Oyunlar', value: `${profile.stats.gamesPlayed}`, inline: true },
      { name: 'Qələbə', value: `${profile.stats.gamesWon}`, inline: true },
      { name: 'Məğlubiyyət', value: `${profile.stats.gamesLost}`, inline: true },
      { name: 'Qələbə faizi', value: `${winRate(profile)}%`, inline: true },
      { name: 'Ən böyük qazanc', value: `${profile.stats.biggestWin}`, inline: true },
      { name: 'Ən böyük itki', value: `${profile.stats.biggestLoss}`, inline: true },
      { name: 'Orta mərc', value: `${profile.stats.averageBet}`, inline: true },
      { name: 'Ən yüksək çarpan', value: `${profile.stats.highestMultiplier.toFixed(2)}x`, inline: true },
      { name: 'Qazanılan Aura', value: `${profile.stats.auraEarned}`, inline: true }
    );
}

function settingsEmbed(profile) {
  return gameEmbed()
    .setTitle('⚙️ Profil ayarları')
    .addFields(
      { name: 'Public profile', value: profile.settings.publicProfile ? 'aktiv' : 'deaktiv', inline: true },
      { name: 'DM rewards', value: profile.settings.dmRewards ? 'aktiv' : 'deaktiv', inline: true },
      { name: 'Compact mode', value: profile.settings.compactMode ? 'aktiv' : 'deaktiv', inline: true }
    );
}

function milestonesEmbed(profile) {
  const rows = levelUnlocks.map(unlock => {
    const status = profile.level >= unlock.level ? 'açılıb' : `Lv.${unlock.level - profile.level} qalır`;
    return `Lv.${unlock.level} - ${unlock.name}: ${status}`;
  });

  return gameEmbed()
    .setTitle('🗺️ MMORPG açılış xəritəsi')
    .setDescription(rows.join('\n'))
    .addFields(
      { name: 'Hazırkı level', value: xpLine(profile), inline: false },
      { name: 'Prestij', value: `${profile.prestige}`, inline: true },
      { name: 'Rank', value: profile.rank, inline: true }
    );
}

function marketBoardEmbed(section) {
  const descriptions = {
    auction: 'Hərrac sistemi Aura iqtisadiyyatı üçün hazırdır: sandıq, collectible və kosmetiklər burada dövr edəcək.'  ,
    trade: 'Trade sistemi üzvlər arası Aura və collectible mübadiləsi üçün nəzərdə tutulub. Hazırda təhlükəsiz transfer üçün `/social gift` və `/wallet transfer` istifadə olunur.',
    listings: 'Aktiv server listləri bu lövhədə göstərilir. Mağaza əşyaları hazırdır, üzv listləri növbəti storage genişlənməsində artırıla bilər.'
  };

  return gameEmbed()
    .setTitle(`🧾 Market: ${section}`)
    .setDescription(descriptions[section])
    .addFields(
      { name: 'Aktiv iqtisadiyyat', value: 'Shop, buy, sell, open, craft, recycle, salvage, bank, transfer, history.', inline: false },
      { name: 'Daimi yaddaş', value: 'Bütün Aura dəyişiklikləri transaction jurnalında saxlanır.', inline: false }
    );
}

function progressEmbed(profile) {
  return gameEmbed()
    .setTitle('📈 Progress')
    .setDescription(`${xpLine(profile)}\n${streakLine(profile)}`)
    .addFields(
      { name: 'Rank', value: profile.rank, inline: true },
      { name: 'Prestij', value: `${profile.prestige}`, inline: true },
      { name: 'Növbəti açılış', value: nextUnlockLine(profile), inline: false },
      { name: 'Aura', value: `${profile.balance} wallet | ${profile.bank} bank`, inline: false }
    );
}

function compareEmbed(firstUser, firstProfile, secondUser, secondProfile) {
  return gameEmbed()
    .setTitle('⚖️ Profil müqayisəsi')
    .addFields(
      { name: primeDisplayName(firstUser, firstProfile), value: `${firstProfile.balance} Aura\nLv.${firstProfile.level}\n${firstProfile.rank}\n${winRate(firstProfile)}% win`, inline: true },
      { name: primeDisplayName(secondUser, secondProfile), value: `${secondProfile.balance} Aura\nLv.${secondProfile.level}\n${secondProfile.rank}\n${winRate(secondProfile)}% win`, inline: true },
      { name: 'Fərq', value: `${Math.abs(firstProfile.balance - secondProfile.balance)} Aura balans fərqi`, inline: false }
    );
}

function socialStatsEmbed(profile) {
  return gameEmbed()
    .setTitle('🤝 Community statusu')
    .addFields(
      { name: 'Reputasiya', value: `${profile.reputation}/100`, inline: true },
      { name: 'Rank', value: profile.rank, inline: true },
      { name: 'Badges', value: profile.badges.join(' ') || 'yoxdur', inline: false }
    );
}

function quickActionRow() {
  return new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId('game_daily')
      .setLabel('Gündəlik')
      .setStyle(ButtonStyle.Success), 'daily', '🎁'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId('game_leaderboard')
      .setLabel('Liderlər')
      .setStyle(ButtonStyle.Primary), 'leaderboard', '🏆'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId('panel_games')
      .setLabel('Oyunlar')
      .setStyle(ButtonStyle.Secondary), 'games', '🎮')
  );
}

function mainMenuRows(userId, page = 'home') {
  const first = new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_bonus', page, userId))
      .setLabel('First Bonus')
      .setStyle(ButtonStyle.Success), 'bonus', '🎁'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('game_daily', page, userId))
      .setLabel('Daily')
      .setStyle(ButtonStyle.Success), 'daily', '🎁'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_profile', page, userId))
      .setLabel('Profil')
      .setStyle(ButtonStyle.Secondary), 'profile', '👤'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_commands', page, userId))
      .setLabel('Komandalar')
      .setStyle(ButtonStyle.Secondary), 'commands', '📋')
  );

  const second = new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_missions', page, userId))
      .setLabel('Earn')
      .setStyle(ButtonStyle.Secondary), 'daily', '💼'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_games', page, userId))
      .setLabel('Casino')
      .setStyle(ButtonStyle.Primary), 'games', '🎮'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_wallet', page, userId))
      .setLabel('Wallet')
      .setStyle(ButtonStyle.Secondary), 'wallet', '👛'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_market', page, userId))
      .setLabel('Market')
      .setStyle(ButtonStyle.Secondary), 'market', '🛒')
  );

  const third = new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_inventory', page, userId))
      .setLabel('Inventory')
      .setStyle(ButtonStyle.Secondary), 'inventory', '🎒'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_progress', page, userId))
      .setLabel('Progress')
      .setStyle(ButtonStyle.Secondary), 'progress', '📈'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_social', page, userId))
      .setLabel('Social')
      .setStyle(ButtonStyle.Secondary), 'social', '🤝'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_style', page, userId))
      .setLabel('Style')
      .setStyle(ButtonStyle.Secondary), 'style', '✨')
  );

  return [first, second, third, navRow(userId, page)];
}

function helpRows(userId, page = 'help') {
  const normalized = normalizeHelpPage(page === 'help' ? 'home' : page);
  const index = helpPageIndex(normalized);
  const previous = helpPages[(index - 1 + helpPages.length) % helpPages.length];
  const next = helpPages[(index + 1) % helpPages.length];

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`help_select:${normalized}:${userId}`)
        .setPlaceholder('Modul seç: komandalar, casino, wallet, market...')
        .addOptions(helpPages.map(item => ({
          label: item.label,
          value: item.id,
          emoji: item.emoji,
          description: helpSelectDescription(item.id),
          default: item.id === normalized
        })))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`help_prev:${normalized}:${userId}`)
        .setLabel(previous.label)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️'),
      new ButtonBuilder()
        .setCustomId(`help_page:${normalized}:${userId}`)
        .setLabel(`${index + 1}/${helpPages.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      withUiEmoji(new ButtonBuilder()
        .setCustomId(scopedId('ux_home', normalized, userId))
        .setLabel('Ana Panel')
        .setStyle(ButtonStyle.Primary), 'home', '🏠'),
      new ButtonBuilder()
        .setCustomId(`help_next:${normalized}:${userId}`)
        .setLabel(next.label)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('➡️'),
      withUiEmoji(new ButtonBuilder()
        .setCustomId(scopedId('ux_close', normalized, userId))
        .setLabel('Bağla')
        .setStyle(ButtonStyle.Danger), 'close', '❌')
    ),
    new ActionRowBuilder().addComponents(
      withUiEmoji(new ButtonBuilder()
        .setCustomId(scopedId('ux_profile', normalized, userId))
        .setLabel('Profil')
        .setStyle(ButtonStyle.Secondary), 'profile', '👤'),
      withUiEmoji(new ButtonBuilder()
        .setCustomId(scopedId('ux_commands', normalized, userId))
        .setLabel('Komandalar')
        .setStyle(ButtonStyle.Secondary), 'commands', '📋'),
      withUiEmoji(new ButtonBuilder()
        .setCustomId(scopedId('ux_games', normalized, userId))
        .setLabel('Casino')
        .setStyle(ButtonStyle.Primary), 'games', '🎮'),
      new ButtonBuilder()
        .setCustomId(scopedId('ux_world', normalized, userId))
        .setLabel('Dünya')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🌍')
    )
  ];
}

function helpSelectDescription(page) {
  const descriptions = {
    home: 'Başlanğıc yolu və əsas sistemlər.',
    commands: 'Bütün slash command xəritəsi.',
    aura: 'Aura nədir, necə qazanılır?',
    games: 'Casino oyunları və mərc qaydaları.',
    wallet: 'Balans, bank, transfer və kredit.',
    missions: 'Daily, work, quest və risk missiyaları.',
    world: 'İş, biznes, əmlak, kəşf və nüfuz.',
    market: 'Mağaza, sandıq, craft və satış.',
    inventory: 'Əşyalar, nişanlar, titullar.',
    progress: 'Level, rank, XP və statistikalar.',
    social: 'Duel, gift, rob və PvP oyunlar.',
    style: 'Stylecheck və rutin alətləri.'
  };
  return descriptions[page] ?? 'Modul səhifəsi.';
}

function navRow(userId, page = 'nav') {
  return new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_back', page, userId))
      .setLabel('Geri')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 'home'), 'back', '⬅️'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_home', page, userId))
      .setLabel('Ana Panel')
      .setStyle(ButtonStyle.Primary), 'home', '🏠'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(scopedId('ux_close', page, userId))
      .setLabel('Bağla')
      .setStyle(ButtonStyle.Danger), 'close', '❌')
  );
}

function scopedId(action, page = 'panel', userId = 'all') {
  return `${action}:${page}:${userId}`;
}

function parseAction(customId) {
  return customId.split(':')[0];
}

function parseOwner(customId) {
  return customId.split(':')[2];
}

function isScopedUxButton(customId) {
  return customId.startsWith('ux_') || /^(game_daily|game_balance|game_leaderboard):/.test(customId);
}

function panelRows() {
  return new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId('panel_style')
      .setLabel('Tərz yoxla')
      .setStyle(ButtonStyle.Primary), 'style', '✨'),
    new ButtonBuilder()
      .setCustomId('panel_skin')
      .setLabel('Dəri rutini')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel_photo')
      .setLabel('Foto rutini')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel_quote')
      .setLabel('Qısa qeyd')
      .setStyle(ButtonStyle.Success),
    withUiEmoji(new ButtonBuilder()
      .setCustomId('panel_games')
      .setLabel('Oyunlar')
      .setStyle(ButtonStyle.Success), 'games', '🎮')
  );
}

function gameRows(userId = 'all') {
  return [
    new ActionRowBuilder().addComponents(
      withUiEmoji(new ButtonBuilder()
        .setCustomId(scopedId('game_daily', 'game', userId))
        .setLabel('Gündəlik')
        .setStyle(ButtonStyle.Success), 'daily', '🎁'),
      withUiEmoji(new ButtonBuilder()
        .setCustomId(scopedId('game_balance', 'game', userId))
        .setLabel('Profil')
        .setStyle(ButtonStyle.Secondary), 'profile', '👤'),
      withUiEmoji(new ButtonBuilder()
        .setCustomId(scopedId('game_leaderboard', 'game', userId))
        .setLabel('Liderlər')
        .setStyle(ButtonStyle.Primary), 'leaderboard', '🏆'),
      withUiEmoji(new ButtonBuilder()
        .setCustomId(scopedId('game_party', 'game', userId))
        .setLabel('Party')
        .setStyle(ButtonStyle.Success), 'party', '🎉')
    ),
    new ActionRowBuilder().addComponents(
      withUiEmoji(new ButtonBuilder()
        .setCustomId(scopedId('ux_games', 'game', userId))
        .setLabel('Necə işləyir?')
        .setStyle(ButtonStyle.Secondary), 'help', '❓')
    ),
    navRow(userId, 'game')
  ];
}

function partyRow(partyId) {
  return new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`party_join:${partyId}`)
      .setLabel('Qoşul')
      .setStyle(ButtonStyle.Success), 'join', '➕'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`party_status:${partyId}`)
      .setLabel('Status')
      .setStyle(ButtonStyle.Primary), 'status', '📊'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`party_leave:${partyId}`)
      .setLabel('Çıx')
      .setStyle(ButtonStyle.Secondary), 'leave', '🚪')
  );
}

function duelRows(duelId) {
  return new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`duel_accept:${duelId}`)
      .setLabel('Qəbul et')
      .setStyle(ButtonStyle.Success), 'accept', '✅'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`duel_decline:${duelId}`)
      .setLabel('Rədd et')
      .setStyle(ButtonStyle.Secondary), 'decline', '✖️')
  );
}

function pvpChallengeRow(type, id) {
  return new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`${type}_accept:${id}`)
      .setLabel('Qəbul et')
      .setStyle(ButtonStyle.Success), 'accept', '✅'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`${type}_decline:${id}`)
      .setLabel('Rədd et')
      .setStyle(ButtonStyle.Secondary), 'decline', '✖️')
  );
}

function quickDrawRow(quickId, disabled) {
  return new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`quick_press:${quickId}`)
      .setLabel(disabled ? 'Hazır ol...' : 'BAS!')
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Danger)
      .setDisabled(false), 'start', '🔥')
  );
}

function heistRow(heistId, closed) {
  return new ActionRowBuilder().addComponents(
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`heist_join:${heistId}`)
      .setLabel('Qoşul')
      .setStyle(ButtonStyle.Success)
      .setDisabled(closed), 'join', '➕'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId(`heist_start:${heistId}`)
      .setLabel('Başlat')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(closed), 'start', '🚨'),
    withUiEmoji(new ButtonBuilder()
      .setCustomId('casino_help:heist')
      .setLabel('Necə işləyir?')
      .setStyle(ButtonStyle.Secondary), 'help', '❔')
  );
}

function routineRows() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('routine_skin')
      .setLabel('Dəri')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('routine_hair')
      .setLabel('Saç')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('routine_posture')
      .setLabel('Duruş')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('routine_photo')
      .setLabel('Foto')
      .setStyle(ButtonStyle.Secondary)
  );
}

function singleButtonRow(customId, label, style) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(style)
  );
}

function inferStyleProfile(goal, outfit) {
  const text = `${goal} ${outfit}`.toLowerCase();

  if (text.includes('görüş') || text.includes('date')) return styleProfiles.date;
  if (text.includes('kamera') || text.includes('foto') || text.includes('yayın')) return styleProfiles.camera;
  if (text.includes('hoodie') || text.includes('street')) return styleProfiles.street;

  return styleProfiles.clean;
}

function buildStyleSuggestion(outfit, concern, profile) {
  const text = outfit.toLowerCase();
  const suggestions = [];

  if (text.includes('qara') || text.includes('black')) {
    suggestions.push('Qara baza yaxşıdır; üzə yaxın hissədə kontrast üçün ağ, boz və ya metal detal əlavə et.');
  }

  if (text.includes('hoodie')) {
    suggestions.push('Hoodie geyinirsənsə, şalvarın forması daha təmiz düşsün ki, fit ağır görünməsin.');
  }

  if (text.includes('sneaker') || text.includes('ayaqqabı')) {
    suggestions.push('Ayaqqabı təmizliyi fitin səviyyəsini dərhal dəyişir; ilk baxılan detaldır.');
  }

  suggestions.push(`${concern} üçün bir düzəliş seç və qalan detalları sadə saxla.`);
  suggestions.push(`Bu məqsəd üçün ən uyğun istiqamət: ${profile.label}.`);

  return suggestions.slice(0, 3).join('\n');
}

async function notEnoughAura(interaction, amount) {
  const balance = await getBalance(interaction.user.id);

  await interaction.reply({
    embeds: [
      gameEmbed()
        .setTitle('Balans kifayət etmir')
        .setDescription(`Bu oyun üçün ${amount} ${gameCopy.currency} lazımdır.`)
        .addFields({ name: 'Balansın', value: `${balance} ${gameCopy.currency}` })
    ],
    ephemeral: true
  });
}

async function blockedCasinoEntry(interaction, amount, result) {
  if (result?.reason === 'casino_restricted') {
    const maxBet = result.restriction?.maxBet ?? 0;
    await interaction.reply({
      embeds: [
        gameEmbed()
          .setTitle('Casino mərc limiti')
          .setDescription(maxBet <= 0
            ? 'Casino oyunların admin yoxlamasına görə müvəqqəti bağlanıb.'
            : `Bu hesab üçün maksimum casino mərci **${formatNumber(maxBet)} ${gameCopy.currency}**-dır.`)
          .addFields(
            { name: 'İstənən mərc', value: `${formatNumber(amount)} ${gameCopy.currency}`, inline: true }
          )
      ],
      ephemeral: true
    });
    return;
  }

  await notEnoughAura(interaction, amount);
}

function xpLine(profile) {
  if (profile.level >= 50) {
    return `Sv.50 ${progressBar(100)} MAX LEVEL (100%)`;
  }

  const needed = xpNeeded(profile.level);
  const percent = Math.min(100, Math.round((profile.xp / needed) * 100));
  return `Lv.${profile.level} ${progressBar(percent)} ${profile.xp}/${needed} XP (${percent}%)`;
}

function streakLine(profile) {
  const percent = Math.min(100, Math.round(((profile.dailyStreak % 7) / 7) * 100));
  return `🔥 Streak: ${profile.dailyStreak} gün ${progressBar(percent)} ${percent}%`;
}

function nextUnlockLine(profile) {
  const next = levelUnlocks.find(unlock => unlock.level > profile.level);
  return next ? `Lv.${next.level} - ${next.name}` : 'Bütün əsas açılışlar hazırdır. Prestij üçün hazırsan.';
}

function nextActionLine(profile) {
  if (!profile.onboarding.beginnerBonusClaimed) {
    return '`/earn bonus` ilə bir dəfəlik başlanğıc bonusunu götür.';
  }

  const today = new Date().toISOString().slice(0, 10);
  if (profile.lastDaily !== today) {
    return '`/earn daily` ilə günlük Aura, XP və sandıq şansını götür.';
  }

  if (profile.inventory.chests && Object.keys(profile.inventory.chests).length > 0) {
    return '`/market open` ilə sandıq aç, Aura və collectible qazan.';
  }

  if (profile.inventory.keys > 0) {
    return '`/market open` ilə açar istifadə edib bonus cache aç.';
  }

  if (profile.bank === 0 && profile.balance >= 100) {
    return '`/wallet deposit amount:100` ilə Aura-nı bankda saxla.';
  }

  return '`/casino mines bet:10` və ya `/social duel` ilə interaktiv oyun yoxla.';
}

function winRate(profile) {
  if (!profile.stats.gamesPlayed) return 0;
  return Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100);
}

function statsLine(profile) {
  return [
    `Oyun: ${profile.stats.gamesPlayed}`,
    `Qələbə: ${profile.stats.gamesWon}`,
    `Qələbə faizi: ${winRate(profile)}%`,
    `Ən böyük qazanc: ${profile.stats.biggestWin}`
  ].join(' | ');
}

function inventoryLine(profile) {
  const chests = Object.entries(profile.inventory.chests)
    .map(([name, count]) => `${name} x${count}`)
    .join(', ');
  const badges = profile.badges.slice(-4).join(' ');
  return [
    chests || 'Sandıq yoxdur',
    badges ? `Badges: ${badges}` : 'Badges: yoxdur',
    `Titul: ${profile.title}`
  ].join('\n');
}

function formatDuration(milliseconds) {
  if (milliseconds < 60000) {
    return `${Math.max(1, Math.ceil(milliseconds / 1000))} saniyə`;
  }

  const totalMinutes = Math.max(1, Math.ceil(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} dəqiqə`;
  }

  return minutes > 0 ? `${hours} saat ${minutes} dəqiqə` : `${hours} saat`;
}

function transferFailureTitle(reason) {
  if (reason === 'loan_frozen') return 'Hesab dondurulub';
  if (reason === 'single_limit') return 'Transfer limiti';
  if (reason === 'daily_limit') return 'Gündəlik transfer limiti';
  return 'Balans kifayət deyil';
}

function transferFailureMessage(result, amount) {
  if (result.reason === 'loan_frozen') {
    return 'Vaxtı keçmiş kredit borcuna görə transfer bağlıdır. Əvvəl `/wallet payloan` ilə borcu ödə.';
  }

  if (result.reason === 'single_limit') {
    return `Sənin hazırkı balansına görə bir transfer limiti **${formatNumber(result.limit)} ${gameCopy.currency}**-dır. Balansın artdıqca limit də artır. Adminlər /admin give ilə limitsiz verə bilər.`;
  }

  if (result.reason === 'daily_limit') {
    return `Sənin hazırkı balansına görə gündəlik transfer limiti **${formatNumber(result.limit)} ${gameCopy.currency}**-dır. Bu gün qalan limit: **${formatNumber(result.remaining ?? 0)} ${gameCopy.currency}**.`;
  }

  return `${amount} ${gameCopy.currency} göndərmək üçün balansın çatmır.`;
}

function isAdmin(userId) {
  return adminUserIds.has(userId);
}

function shortErrorId() {
  return randomUUID().slice(0, 8).toUpperCase();
}

function interactionAckError(error) {
  const code = error?.code ?? error?.rawError?.code;

  return code === 10062
    || code === 40060
    || code === 'InteractionNotReplied'
    || code === 'InteractionAlreadyReplied'
    || /already been acknowledged/i.test(error?.message ?? '');
}

async function deferInteractionResponse(interaction, options = {}) {
  if (interaction.deferred || interaction.replied) {
    return false;
  }

  try {
    await interaction.deferReply(options);
    return true;
  } catch (error) {
    if (interactionAckError(error)) {
      return false;
    }

    throw error;
  }
}

function logInteractionError(interaction, error) {
  const errorId = shortErrorId();
  let subcommand = null;
  let subcommandGroup = null;

  if (typeof interaction.isChatInputCommand === 'function' && interaction.isChatInputCommand()) {
    try {
      subcommand = interaction.options.getSubcommand(false) ?? null;
    } catch {}

    try {
      subcommandGroup = interaction.options.getSubcommandGroup(false) ?? null;
    } catch {}
  }

  console.error('Interaction failure', {
    errorId,
    interactionType: interaction?.type ?? null,
    command: interaction?.commandName ?? null,
    subcommandGroup,
    subcommand,
    customId: interaction?.customId ?? null,
    userId: interaction?.user?.id ?? null,
    guildId: interaction?.guildId ?? null,
    channelId: interaction?.channelId ?? null,
    code: error?.code ?? error?.rawError?.code ?? null,
    message: error?.message ?? String(error),
    details: error?.details ?? error?.rawError?.details ?? null,
    hint: error?.hint ?? error?.rawError?.hint ?? null,
    stack: error?.stack ?? null
  });

  return errorId;
}

function commandErrorMessage(error, errorId) {
  const code = error?.code ?? error?.rawError?.code;
  const idLine = `Xəta ID: ${errorId}`;

  if (code === 50013 || code === 50001) {
    return `Botun bu kanalda icazəsi çatmır. Server ayarlarında Octoson üçün **Send Messages**, **Embed Links**, **Use Slash Commands**, **Read Message History** icazələrini aç.\n\n${idLine}`;
  }

  if (code === 40060 || /already been acknowledged/i.test(error?.message ?? '')) {
    return `Discord bu interaction-u artıq cavablanmış saydı. Komandanı bir dəfə yenidən yoxla.\n\n${idLine}`;
  }

  if (code === 50035) {
    return `Discord komanda cavabını qəbul etmədi. Amount/claim dəyərlərini azaldıb yenidən yoxla.\n\n${idLine}`;
  }

  return `Bir xəta oldu. Bot yenilənibsə prosesi restart et və komandanı yenidən yoxla.\n\n${idLine}`;
}

function makeInteractionResponsesSafe(interaction) {
  if (interaction.__octosonSafeResponses) {
    return;
  }

  interaction.__octosonSafeResponses = true;
  const originalReply = interaction.reply?.bind(interaction);
  const originalUpdate = interaction.update?.bind(interaction);
  const originalFollowUp = interaction.followUp?.bind(interaction);
  const originalEditReply = interaction.editReply?.bind(interaction);

  if (originalReply) {
    interaction.reply = async payload => {
      try {
        if (interaction.deferred && !interaction.replied && originalEditReply) {
          return await originalEditReply(payload);
        }

        if (interaction.replied && originalFollowUp) {
          return await originalFollowUp(payload);
        }

        return await originalReply(payload);
      } catch (error) {
        return handleSafeInteractionError(error, 'reply');
      }
    };
  }

  if (originalUpdate) {
    interaction.update = async payload => {
      try {
        return await originalUpdate(payload);
      } catch (error) {
        return handleSafeInteractionError(error, 'update');
      }
    };
  }

  if (originalFollowUp) {
    interaction.followUp = async payload => {
      try {
        if (!interaction.deferred && !interaction.replied && originalReply) {
          return await originalReply(payload);
        }

        return await originalFollowUp(payload);
      } catch (error) {
        return handleSafeInteractionError(error, 'followUp');
      }
    };
  }

  if (originalEditReply) {
    interaction.editReply = async payload => {
      try {
        return await originalEditReply(payload);
      } catch (error) {
        return handleSafeInteractionError(error, 'editReply');
      }
    };
  }
}

function handleSafeInteractionError(error, action) {
  if (interactionAckError(error)) {
    console.warn(`Skipped expired interaction ${action}: ${error.code}`);
    return null;
  }

  throw error;
}

function duelTheme() {
  return pick([
    'silhouette',
    'rəng balansı',
    'kamera hazırlığı',
    'duruş',
    'profil enerjisi',
    'detal seçimi'
  ]);
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred && !interaction.replied && interaction.editReply) {
      await interaction.editReply(payload);
    } else if (interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (error) {
    return handleSafeInteractionError(error, 'reply');
  }
}


function parseMentionAmount(value) {
  if (!value) return null;

  const match = String(value)
    .toLowerCase()
    .replace(/,/g, '')
    .match(/^(\d+(?:\.\d+)?)(k|m)?$/);

  if (!match) return null;

  let amount = Number(match[1]);

  if (match[2] === 'k') amount *= 1_000;
  if (match[2] === 'm') amount *= 1_000_000;

  amount = Math.floor(amount);

  return Number.isSafeInteger(amount) && amount > 0
    ? amount
    : null;
}

function mentionCommandText(message) {
  if (!client.user) return null;
  if (!message.mentions.users.has(client.user.id)) return null;

  return message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), ' ')
    .trim();
}

async function handleMentionGift(message, text) {
  if (!/^gift\b/i.test(text)) return false;

  const target = message.mentions.users
    .filter((user, id) => id !== client.user.id)
    .first();

  const withoutMentions = text
    .replace(/<@!?\d+>/g, ' ')
    .replace(/\baura\b/gi, ' ')
    .trim();

  const amountToken = withoutMentions
    .split(/\s+/)
    .find(token => parseMentionAmount(token));

  const amount = parseMentionAmount(amountToken);

  if (!target || target.bot || target.id === message.author.id) {
    await message.reply({
      content:
        'Real başqa üzv seç.\nMəsələn: `@Octoson gift @user 1k aura`',
      allowedMentions: { repliedUser: false }
    });

    return true;
  }

  if (!amount) {
    await message.reply({
      content:
        'Düzgün məbləğ yaz.\nMəsələn: `@Octoson gift @user 1k aura`',
      allowedMentions: { repliedUser: false }
    });

    return true;
  }

  // ADMIN = infinite Aura gifting.
  // Adminın öz balansından heç nə çıxmır.
  if (isAdmin(message.author.id)) {
    await adminGiveAura(
      target.id,
      amount,
      message.author.id
    );

    scheduleLiveLeaderboardRefresh();

    const profile = await getProfile(target.id);

    await message.reply({
      content:
        `<@${target.id}> sənə **${formatNumber(amount)} Aura** verildi.\n` +
        `Yeni balans: **${formatNumber(profile.balance)} Aura**.`,
      allowedMentions: {
        users: [target.id],
        repliedUser: false
      }
    });

    return true;
  }

  // NORMAL USER = öz balansından göndərir.
  const result = await transferAura(
    message.author.id,
    target.id,
    amount,
    'mention_gift'
  );

  if (result.ok) {
    scheduleLiveLeaderboardRefresh();
  }

  await message.reply({
    content: result.ok
      ? `<@${target.id}> sənə **${formatNumber(amount)} Aura** hədiyyə edildi.`
      : transferFailureMessage(result, amount),

    allowedMentions: {
      users: [target.id],
      repliedUser: false
    }
  });

  return true;
}

function makeMentionInteraction(
  message,
  commandName,
  subcommand,
  text
) {
  const target = message.mentions.users
    .filter((user, id) => id !== client.user.id)
    .first() ?? null;

  const numeric = [
    ...text
      .replace(/<@!?\d+>/g, ' ')
      .matchAll(/\b\d+(?:\.\d+)?[km]?\b/gi)
  ]
    .map(match => parseMentionAmount(match[0]))
    .find(Boolean) ?? null;

  let deferred = false;
let replied = false;
let lastReplyMessage = null;

  return {
    commandName,

    user: message.author,
    member: message.member,
    memberPermissions: message.member?.permissions,

    guild: message.guild,
    guildId: message.guildId,

    channel: message.channel,
    channelId: message.channelId,

    client: message.client,

    get deferred() {
      return deferred;
    },

    get replied() {
      return replied;
    },

    options: {
      getSubcommand: () => subcommand,
      getSubcommandGroup: () => null,

      getUser: () => target,

      getAttachment: () =>
        message.attachments.first() ?? null,

      getInteger: () => numeric,

      getNumber: () => numeric,

      getString: () => null,

      getBoolean: () => null
    },

async deferReply() {
  deferred = true;
},

async reply(payload) {
  replied = true;

  lastReplyMessage = await message.reply({
    ...payload,
    ephemeral: undefined,
    allowedMentions:
      payload?.allowedMentions ??
      { repliedUser: false }
  });

  return lastReplyMessage;
},

async editReply(payload) {
  replied = true;

  if (lastReplyMessage?.editable) {
    lastReplyMessage = await lastReplyMessage.edit({
      ...payload,
      ephemeral: undefined,
      allowedMentions:
        payload?.allowedMentions ??
        { repliedUser: false }
    });

    return lastReplyMessage;
  }

  lastReplyMessage = await message.reply({
    ...payload,
    ephemeral: undefined,
    allowedMentions:
      payload?.allowedMentions ??
      { repliedUser: false }
  });

  return lastReplyMessage;
},

async fetchReply() {
  if (lastReplyMessage) {
    return lastReplyMessage;
  }

  throw new Error(
    '[MENTION INTERACTION] fetchReply() called before reply/editReply created a message'
  );
},

async followUp(payload) {
  return message.reply({
    ...payload,
    ephemeral: undefined,
    allowedMentions:
      payload?.allowedMentions ??
      { repliedUser: false }
  });
}
  };
}


async function findGiftMembers(message, query) {
  if (!message.guild) return [];

  const cleaned = String(query ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '');

  if (!cleaned) return [];

  // Try Discord member search first.
  let fetched = null;

  try {
    fetched = await message.guild.members.search({
      query: cleaned,
      limit: 25
    });
  } catch {}

  // Fall back to cached members.
  const source = fetched?.size
    ? [...fetched.values()]
    : [...message.guild.members.cache.values()];

  const normalized = value =>
    String(value ?? '').toLowerCase();

  const matches = source
    .filter(member => !member.user.bot)
  .filter(member => {
  // Normal users can't send Aura to themselves.
  // Admins are allowed to select themselves because
  // admin give creates Aura instead of transferring it.
  if (
    member.id === message.author.id &&
    !isAdmin(message.author.id)
  ) {
    return false;
  }

  return true;
})
    .map(member => {
      const username = normalized(member.user.username);
      const globalName = normalized(member.user.globalName);
      const displayName = normalized(member.displayName);
      const nickname = normalized(member.nickname);

      let score = 0;

      if (username === cleaned) score += 100;
      if (displayName === cleaned) score += 95;
      if (globalName === cleaned) score += 90;
      if (nickname === cleaned) score += 90;

      if (username.startsWith(cleaned)) score += 60;
      if (displayName.startsWith(cleaned)) score += 55;
      if (globalName.startsWith(cleaned)) score += 50;
      if (nickname.startsWith(cleaned)) score += 50;

      if (username.includes(cleaned)) score += 30;
      if (displayName.includes(cleaned)) score += 25;
      if (globalName.includes(cleaned)) score += 20;
      if (nickname.includes(cleaned)) score += 20;

      return {
        member,
        score
      };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);

  return matches.map(entry => entry.member);
}

function giftMemberSelectEmbed(message, query, matches, amount) {
  const admin = isAdmin(message.author.id);

  return baseEmbed()
    .setTitle('Aura göndər • Üzv seç')
    .setDescription(
      `**${query}** üçün uyğun üzvlər tapıldı.\n\n` +
      `Aşağıdakı menyudan Aura göndərmək istədiyin şəxsi seç.`
    )
    .addFields(
      {
        name: 'Göndərən',
        value: `<@${message.author.id}>`,
        inline: true
      },
      {
        name: 'Rejim',
        value: admin
          ? 'Admin • limitsiz'
          : 'Şəxsi balans',
        inline: true
      },
      {
        name: 'Məbləğ',
        value: amount
          ? `**${formatNumber(amount)} Aura**`
          : 'Seçimdən sonra yazılacaq',
        inline: true
      },
      {
        name: 'Tapılan üzv',
        value: `${matches.length}`,
        inline: true
      }
    )
    .setFooter({
      text: admin
        ? 'Admin göndərişində balansından Aura çıxılmır.'
        : 'Aura sənin wallet balansından çıxılacaq.'
    });
}

async function startMentionGiftMemberSelection(message, {
  query,
  amount = null,
  command = 'give'
}) {
  const matches = await findGiftMembers(message, query);

  if (!matches.length) {
    await message.reply({
      content:
        `**${query}** adına uyğun üzv tapa bilmədim.\n` +
        `Username/display name-i yoxla və yenidən yaz.`,
      allowedMentions: {
        repliedUser: false
      }
    });

    return true;
  }

  const sessionId = randomUUID()
    .replace(/-/g, '')
    .slice(0, 12);

  pendingMentionGifts.set(sessionId, {
    ownerId: message.author.id,
    guildId: message.guild.id,
    channelId: message.channel.id,
    command,
    query,
    amount,
    createdAt: Date.now()
  });

  // Auto-delete stale session.
  setTimeout(() => {
    pendingMentionGifts.delete(sessionId);
  }, 5 * 60 * 1000).unref?.();

  const menu = new StringSelectMenuBuilder()
    .setCustomId(
      `mention_gift_user:${sessionId}:${message.author.id}`
    )
    .setPlaceholder('Aura göndəriləcək üzvü seç')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      matches.map(member => {
        const display =
          member.displayName ||
          member.user.globalName ||
          member.user.username;

        const username = member.user.username;

        return {
          label: display.slice(0, 100),
          description:
            display.toLowerCase() === username.toLowerCase()
              ? `@${username}`.slice(0, 100)
              : `@${username} • ${member.id}`.slice(0, 100),
          value: member.id
        };
      })
    );

  const row = new ActionRowBuilder()
    .addComponents(menu);

  await message.reply({
    embeds: [
      giftMemberSelectEmbed(
        message,
        query,
        matches,
        amount
      )
    ],
    components: [row],
    allowedMentions: {
      repliedUser: false
    }
  });

  return true;
}

function buildMentionGiftAmountModal({
  sessionId,
  ownerId,
  targetId
}) {
  const modal = new ModalBuilder()
    .setCustomId(
      `mention_gift_amount:${sessionId}:${ownerId}:${targetId}`
    )
    .setTitle('Aura göndər');

  const amountInput = new TextInputBuilder()
    .setCustomId('amount')
    .setLabel('Məbləğ')
    .setPlaceholder('Məsələn: 200, 1k, 25k, 1m')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20);

  modal.addComponents(
    new ActionRowBuilder().addComponents(amountInput)
  );

  return modal;
}

async function executeMentionGift({
  interaction,
  session,
  targetId,
  amount
}) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    await interaction.reply({
      content: 'Düzgün Aura məbləği yaz.',
      ephemeral: true
    });

    return;
  }

  if (targetId === interaction.user.id) {
    await interaction.reply({
      content: 'Özünə Aura göndərə bilməzsən.',
      ephemeral: true
    });

    return;
  }

  const target = await interaction.client.users
    .fetch(targetId)
    .catch(() => null);

  if (!target || target.bot) {
    await interaction.reply({
      content: 'Bu üzvə Aura göndərmək mümkün deyil.',
      ephemeral: true
    });

    return;
  }

  // ADMIN:
  // Aura yaradılır, adminın balansından çıxılmır.
  if (isAdmin(interaction.user.id)) {
    const profile = await adminGiveAura(
      targetId,
      amount,
      interaction.user.id
    );

    scheduleLiveLeaderboardRefresh();

    pendingMentionGifts.delete(session.id);

    await interaction.reply({
      embeds: [
        gameEmbed()
          .setTitle('Aura verildi')
          .setDescription(
            `<@${targetId}> üzvünə **${formatNumber(amount)} Aura** verildi.`
          )
          .addFields(
            {
              name: 'Rejim',
              value: 'Admin • limitsiz',
              inline: true
            },
            {
              name: 'Yeni balans',
              value: `${formatNumber(profile.balance)} Aura`,
              inline: true
            }
          )
      ],
      allowedMentions: {
        users: [targetId]
      }
    });

    return;
  }

  // NORMAL USER:
  // Aura göndərənin real balansından çıxılır.
  const result = await transferAura(
    interaction.user.id,
    targetId,
    amount,
    `mention_${session.command || 'gift'}`
  );

  if (result.ok) {
    scheduleLiveLeaderboardRefresh();
    pendingMentionGifts.delete(session.id);
  }

  await interaction.reply(
    await transferPayload(
      result.ok
        ? 'Aura hədiyyəsi göndərildi'
        : transferFailureTitle(result.reason),
      result.from,
      result.to,
      interaction.user,
      target,
      result.ok
        ? `${primeMention(interaction.user, result.from)} -> ` +
          `${primeMention(target, result.to)}: **${formatNumber(amount)} Aura**`
        : transferFailureMessage(result, amount),
      {
        allowedMentions: {
          users: [targetId]
        },
        ephemeral: !result.ok,
        amount: result.ok ? amount : null,
        kind: result.ok ? 'gift' : 'error'
      }
    )
  );
}

async function handleMentionGiftUserSelect(interaction) {
  const [, sessionId, ownerId] =
    interaction.customId.split(':');

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'Bu Aura paneli başqa üzvə aiddir.',
      ephemeral: true
    });

    return;
  }

  const session = pendingMentionGifts.get(sessionId);

  if (!session) {
    await interaction.reply({
      content:
        'Bu Aura panelinin vaxtı bitib. Komandanı yenidən yaz.',
      ephemeral: true
    });

    return;
  }

  session.id = sessionId;

  const targetId = interaction.values[0];

  if (!targetId) {
    await interaction.reply({
      content: 'Üzv seçilmədi.',
      ephemeral: true
    });

    return;
  }

  // Amount was already typed:
  // @Octoson give javexia 1k
  if (session.amount) {
    await executeMentionGift({
      interaction,
      session,
      targetId,
      amount: session.amount
    });

    return;
  }

  // No amount:
  // @Octoson give javexia
  // Open modal.
  await interaction.showModal(
    buildMentionGiftAmountModal({
      sessionId,
      ownerId,
      targetId
    })
  );
}

async function handleMentionGiftAmountModal(interaction) {
  const [, sessionId, ownerId, targetId] =
    interaction.customId.split(':');

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'Bu Aura əməliyyatı başqa üzvə aiddir.',
      ephemeral: true
    });

    return;
  }

  const session = pendingMentionGifts.get(sessionId);

  if (!session) {
    await interaction.reply({
      content:
        'Bu Aura əməliyyatının vaxtı bitib. Yenidən başla.',
      ephemeral: true
    });

    return;
  }

  session.id = sessionId;

  const rawAmount =
    interaction.fields.getTextInputValue('amount');

  const amount = parseMentionAmount(rawAmount);

  if (!amount) {
    await interaction.reply({
      content:
        'Məbləğ düzgün deyil. `200`, `1k`, `25k` və ya `1m` kimi yaz.',
      ephemeral: true
    });

    return;
  }

  await executeMentionGift({
    interaction,
    session,
    targetId,
    amount
  });
}


async function handleMentionCommand(message) {
  const raw = mentionCommandText(message);

  if (raw == null || !raw) {
    return false;
  }

  const parts = raw.split(/\s+/);

  const command = (parts.shift() || '')
    .toLowerCase()
    .replace(/^\//, '');

  const aliases = {
  bal: 'balance',
  balans: 'balance',
  lb: 'leaderboard',
  richest: 'leaderboard',
  inv: 'inventory'
};

// Casino games that can be called directly:
// @Octoson blackjack 200
// @Octoson slots 1k
// @Octoson roulette 500
// etc.
const casinoAliases = new Set([
  'blackjack',
  'slots',
  'roulette',
  'mines',
  'crash',
  'coinflip',
  'dice',
  'risk',
  'rps',
  'higherlower',
  'tower',
  'wheel',
  'lottery',
  'jackpot',
  'baccarat',
  'poker',
  'horse',
  'penalty'
]);

if (casinoAliases.has(command)) {
  await handleCasinoCommand(
    makeMentionInteraction(
      message,
      'casino',
      command,
      raw
    )
  );

  return true;
}

// ======================================================
// DIRECT PVP COMMANDS
//
// @Octoson quickdraw @user 1k
// @Octoson quickdraw with @user 1k
// @Octoson duel @user 500
// @Octoson dicebattle with @user 2k
// ======================================================

const pvpAliases = {
  quickdraw: 'quickdraw',
  quick: 'quickdraw',

  duel: 'duel',

  dicebattle: 'dicebattle',
  diceb: 'dicebattle'
};

if (pvpAliases[command]) {
  const opponent = message.mentions.users
    .filter((user, id) => id !== client.user.id)
    .first();

  if (!opponent) {
    await message.reply({
      content:
        'Rəqibi tag et.\n' +
        `Məsələn: \`@Octoson ${command} @user 1k\``,
      allowedMentions: {
        repliedUser: false
      }
    });

    return true;
  }

  // Remove Discord mentions and filler words before
  // looking for the wager.
  const cleaned = raw
    .replace(/<@!?\d+>/g, ' ')
    .replace(/\bwith\b/gi, ' ')
    .replace(/\bile\b/gi, ' ')
    .trim();

  const amountToken = cleaned
    .split(/\s+/)
    .find(token => parseMentionAmount(token));

  const stake = parseMentionAmount(amountToken);

  if (!stake) {
    await message.reply({
      content:
        'Mərc məbləğini də yaz.\n' +
        `Məsələn: \`@Octoson ${command} @user 1k\``,
      allowedMentions: {
        repliedUser: false
      }
    });

    return true;
  }

  const interaction = makeMentionInteraction(
    message,
    'social',
    pvpAliases[command],
    raw
  );

  interaction.options.getUser = name => {
    if (name === 'opponent' || name === 'user') {
      return opponent;
    }

    return null;
  };

  interaction.options.getInteger = name => {
    if (name === 'stake' || name === 'amount') {
      return stake;
    }

    return null;
  };

  await handleSocialCommand(interaction);
  return true;
}


const name = aliases[command] ?? command;


// ======================================================
// GIVE / GIFT
// ======================================================
if (name === 'gift' || name === 'give') {
  // If an actual Discord @mention exists,
  // keep using the direct fast gift system.
  const directTarget = message.mentions.users
    .filter((user, id) => id !== client.user.id)
    .first();

  if (directTarget) {
    const giftText = raw.replace(/^give\b/i, 'gift');
    return handleMentionGift(message, giftText);
  }

  // No @mention.
  // Example:
  // @Octoson give javexia
  // @Octoson give javexia 1k

  let giftParts = raw
  .replace(/^(give|gift)\b/i, '')
  .trim()
  .split(/\s+/)
  .filter(Boolean);

let amount = null;

// Remove filler words that aren't usernames.
const fillerWords = new Set([
  'aura',
  'auras',
  'please',
  'pls',
  'plss',
  'plsss',
  'plssss',
  'zəhmət',
  'olmasa'
]);

giftParts = giftParts.filter(
  part => !fillerWords.has(part.toLowerCase())
);

// Find amount ANYWHERE instead of only checking last word.
// Example:
// give jave 1k aura
// give jave aura 1k
for (let i = giftParts.length - 1; i >= 0; i--) {
  const parsed = parseMentionAmount(giftParts[i]);

  if (parsed) {
    amount = parsed;
    giftParts.splice(i, 1);
    break;
  }
}

// "me" means the person writing the command.
const selfWords = new Set([
  'me',
  'mən',
  'mene',
  'mənə',
  'ozume',
  'özümə'
]);

const isSelfRequest = giftParts.some(
  part => selfWords.has(part.toLowerCase())
);

if (isSelfRequest) {
  // Giving Aura to yourself only makes sense for admins.
  if (!isAdmin(message.author.id)) {
    await message.reply({
      content:
        'Özünə Aura göndərə bilməzsən.',
      allowedMentions: {
        repliedUser: false
      }
    });

    return true;
  }

  // Admin said:
  // @Octoson give me some aura plsss
  //
  // No amount -> open amount modal/flow for themselves.
  // We'll use their username so the selector finds them.
  giftParts = [message.author.username];
}

const query = giftParts.join(' ').trim();

  if (!query) {
    await message.reply({
      content:
        'Kimə göndərəcəyini yaz.\n' +
        '`@Octoson give javexia`\n' +
        '`@Octoson give javexia 1k`',
      allowedMentions: {
        repliedUser: false
      }
    });

    return true;
  }

  return startMentionGiftMemberSelection(message, {
    query,
    amount,
    command: name
  });
}
  // HELP
  if (name === 'help') {
    await message.reply({
      embeds: [helpEmbed()],
      components: helpRows(
        message.author.id,
        'home'
      ),
      allowedMentions: {
        repliedUser: false
      }
    });

    return true;
  }

  // PANEL
  if (name === 'panel') {
    const interaction = makeMentionInteraction(
      message,
      'panel',
      null,
      raw
    );

    await interaction.reply({
      embeds: [welcomeEmbed(interaction)],
      components: mainMenuRows(
        message.author.id,
        'home'
      )
    });

    return true;
  }

  // TUTORIAL
  if (name === 'tutorial') {
    await message.reply({
      embeds: [tutorialEmbed()],
      allowedMentions: {
        repliedUser: false
      }
    });

    return true;
  }

  // BALANCE
  if (name === 'balance') {
    await sendBalance(
      makeMentionInteraction(
        message,
        'wallet',
        'balance',
        raw
      )
    );

    return true;
  }

  // LEADERBOARD
  if (
    name === 'leaderboard' ||
    name === 'richest'
  ) {
    await sendLeaderboard(
      makeMentionInteraction(
        message,
        'progress',
        'leaderboard',
        raw
      )
    );

    return true;
  }

  // Existing command handlers
  const handlers = {
    profile: i => sendProfileHelp(i),
    game: i => handleGameCommand(i),
    party: i => handlePartyCommand(i),
    wallet: i => handleWalletCommand(i),
    earn: i => handleEarnCommand(i),
    inventory: i => handleInventoryCommand(i),
    casino: i => handleCasinoCommand(i),
    quest: i => handleQuestCommand(i),
    market: i => handleMarketCommand(i),
    progress: i => handleProgressCommand(i),
    social: i => handleSocialCommand(i),
    world: i => handleWorldCommand(i),
    admin: i => handleAdminCommand(i)
  };

  if (!handlers[name]) {
    return false;
  }

  const subcommand =
    (parts.shift() || '').toLowerCase() || null;

  if (!subcommand && name !== 'profile') {
    await message.reply({
      content:
        `Alt komandanı da yaz. Məsələn: ` +
        `\`@Octoson ${name} ...\``,
      allowedMentions: {
        repliedUser: false
      }
    });

    return true;
  }

  if (
    name === 'admin' &&
    !isAdmin(message.author.id)
  ) {
    await message.reply({
      content: 'Bu komanda yalnız admin üçündür.',
      allowedMentions: {
        repliedUser: false
      }
    });

    return true;
  }

  await handlers[name](
    makeMentionInteraction(
      message,
      name,
      subcommand,
      raw
    )
  );

  return true;
}


// ======================================================
// AI MESSAGE / MENTION HANDLER
// ======================================================

client.on(Events.MessageCreate, async message => {
  try {
    if (message.author.bot) return;

    // ==========================================
    // EXISTING MESSAGE-BASED BOT FEATURES FIRST
    // ==========================================

// All @Octoson commands FIRST.
// This makes @Octoson give always use the new selector UI.
if (await handleMentionCommand(message)) {
  return;
}

// Legacy admin handler after the new mention-command system.
if (await handleAdminAuraGrantMessage(message)) {
  return;
}

// UI emoji/sticker capture
if (await handleUiEmojiCapture(message)) {
  return;
}

    // ==========================================
    // AI MENTION CHAT
    // ==========================================

    if (!shouldAnswerMessage(message)) {
      return;
    }

    const prompt = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
      .trim();

    if (!prompt) {
      await message.reply({
        content: 'nə var',
        allowedMentions: {
          repliedUser: false
        }
      });
      return;
    }

    if (!openai) {
      console.warn('[AI] OpenAI client unavailable.');
      return;
    }

    await message.channel.sendTyping().catch(() => {});

    const result = await askOpenAI(
      prompt,
      message.author.username,
      message.author.id
    );

    if (!result?.answer) return;

    let response = result.answer;

    if (result.gift) {
      response += `\n\n+${formatNumber(result.gift)} Aura`;
    }

    await message.reply({
      content: response.slice(0, 2000),
      allowedMentions: {
        repliedUser: false
      }
    });

  } catch (error) {
    console.error('[MESSAGE CREATE ERROR]', error);
  }
});

// ======================================================
// DISCORD INTERACTION DISPATCHER
// ======================================================

client.on(Events.InteractionCreate, async interaction => {
  makeInteractionResponsesSafe(interaction);

  try {
    // ------------------------------------------
    // MODALS
    // ------------------------------------------
    if (interaction.isModalSubmit()) {
      await handleModal(interaction);
      return;
    }

    // ------------------------------------------
    // BUTTONS
    // ------------------------------------------
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    // ------------------------------------------
    // SELECT MENUS
    // ------------------------------------------
    if (
      interaction.isStringSelectMenu?.()
      || interaction.isUserSelectMenu?.()
      || interaction.isRoleSelectMenu?.()
      || interaction.isChannelSelectMenu?.()
      || interaction.isMentionableSelectMenu?.()
    ) {
      await handleSelectMenu(interaction);
      return;
    }

    // ------------------------------------------
    // SLASH COMMANDS
    // ------------------------------------------
    if (!interaction.isChatInputCommand()) {
      return;
    }

       switch (interaction.commandName) {
        case 'help':
  await interaction.reply({
    embeds: [helpEmbed()],
    components: helpRows(
      interaction.user.id,
      'home'
    ),
    ephemeral: true
  });
  break;

case 'panel':
  await interaction.reply({
    embeds: [welcomeEmbed(interaction)],
    components: mainMenuRows(
      interaction.user.id,
      'home'
    ),
    ephemeral: true
  });
  break;

case 'tutorial':
  await interaction.reply({
    embeds: [tutorialEmbed()],
    ephemeral: true
  });
  break;

      case 'profile':
        await sendProfileHelp(interaction);
        break;

      case 'user':
        await handleUserCommand(interaction);
        break;

      case 'ai':
        await sendAiAnswer(interaction);
        break;

      case 'live':
        await sendLivePanel(interaction);
        break;

      case 'mogger':
        await handleMoggerCommand(interaction);
        break;

      case 'game':
        await handleGameCommand(interaction);
        break;

      case 'party':
        await handlePartyCommand(interaction);
        break;

      case 'wallet':
        await handleWalletCommand(interaction);
        break;

      case 'earn':
        await handleEarnCommand(interaction);
        break;

      case 'inventory':
        await handleInventoryCommand(interaction);
        break;

      case 'casino':
        await handleCasinoCommand(interaction);
        break;

      case 'quest':
        await handleQuestCommand(interaction);
        break;

      case 'market':
        await handleMarketCommand(interaction);
        break;

      case 'progress':
        await handleProgressCommand(interaction);
        break;

      case 'social':
        await handleSocialCommand(interaction);
        break;

      case 'world':
        await handleWorldCommand(interaction);
        break;

      case 'admin':
        await handleAdminCommand(interaction);
        break;

      default:
        console.warn(
          `[INTERACTION] No handler for /${interaction.commandName}`
        );

        await interaction.reply({
          content: `/${interaction.commandName} üçün handler tapılmadı.`,
          ephemeral: true
        }).catch(() => {});

        break;
    }
  } catch (error) {
    const errorId = logInteractionError(interaction, error);

    const message = commandErrorMessage(error, errorId);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: message,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: message,
          ephemeral: true
        });
      }
    } catch (replyError) {
      console.error(
        `[INTERACTION] Could not send error response ${errorId}:`,
        replyError
      );
    }
  }
});

console.log('[STARTUP] InteractionCreate listener registered');
console.log(`[STARTUP] Octoson ready as ${readyClient.user.tag}`);
console.log('[STARTUP] Ready for Discord commands');

  } catch (error) {
    console.error('ClientReady initialization failed:', error);
  }
});

console.log('[STARTUP] Reached client.login()');

client.login(discordToken)
  .then(() => {
    console.log('[STARTUP] client.login() resolved');
  })
  .catch((error) => {
    console.error('[STARTUP] client.login() FAILED:', error);
  });