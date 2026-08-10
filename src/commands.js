import { SlashCommandBuilder } from 'discord.js';

const publicCommand = command => command
  .setDefaultMemberPermissions(null)
  .toJSON();

const betOption = (option, name = 'bet', max = 20000) => option
  .setName(name)
  .setDescription('Aura miqdarı')
  .setMinValue(10)
  .setMaxValue(max)
  .setRequired(true);

const amountOption = option => option
  .setName('amount')
  .setDescription('Aura miqdarı')
  .setMinValue(1)
  .setMaxValue(100000)
  .setRequired(true);

const optionalAmountOption = option => option
  .setName('amount')
  .setDescription('Aura miqdarı')
  .setMinValue(1)
  .setMaxValue(100000)
  .setRequired(false);

const adminAmountOption = option => option
  .setName('amount')
  .setDescription('Aura miqdarı')
  .setMinValue(1)
  .setMaxValue(100000000)
  .setRequired(true);

const adminCountOption = option => option
  .setName('count')
  .setDescription('Say')
  .setMinValue(1)
  .setMaxValue(100000)
  .setRequired(true);

const adminLevelOption = option => option
  .setName('level')
  .setDescription('Yeni level')
  .setMinValue(1)
  .setMaxValue(50)
  .setRequired(true);

const adminCasinoMaxBetOption = option => option
  .setName('maxbet')
  .setDescription('Bu üzv üçün maksimum casino mərcidir. 0 bütün casino oyunlarını bağlayır.')
  .setMinValue(0)
  .setMaxValue(20000)
  .setRequired(true);

const uiEmojiOption = option => option
  .setName('key')
  .setDescription('Hansı UI düyməsinin emotesi dəyişsin')
  .setRequired(true)
  .addChoices(
    { name: '🎁 Gündəlik', value: 'daily' },
    { name: '🏆 Liderlər', value: 'leaderboard' },
    { name: '🎮 Oyunlar', value: 'games' },
    { name: '👤 Profil', value: 'profile' },
    { name: '📋 Komandalar', value: 'commands' },
    { name: '👛 Wallet', value: 'wallet' },
    { name: '🛒 Market', value: 'market' },
    { name: '🎒 Inventory', value: 'inventory' },
    { name: '📈 Progress', value: 'progress' },
    { name: '🤝 Social', value: 'social' },
    { name: '✨ Style', value: 'style' },
    { name: '💎 Prime badge', value: 'prime_badge' },
    { name: '❔ Help', value: 'help' },
    { name: '⬅️ Geri', value: 'back' },
    { name: '🏠 Ana panel', value: 'home' },
    { name: '❌ Bağla', value: 'close' },
    { name: '✨ Claim', value: 'claim' },
    { name: '✅ Qəbul et', value: 'accept' },
    { name: '✖️ Rədd et', value: 'decline' },
    { name: '⬆️ Yuxarı', value: 'up' },
    { name: '⬇️ Aşağı', value: 'down' },
    { name: '✏️ Xüsusi', value: 'custom' },
    { name: '💰 Cashout', value: 'cashout' },
    { name: '➕ Join', value: 'join' },
    { name: '🚨 Start', value: 'start' }
  );

const userOption = (option, description = 'Üzv seç') => option
  .setName('user')
  .setDescription(description)
  .setRequired(true);

const adminItemOption = option => option
  .setName('item')
  .setDescription('Veriləcək əşya')
  .setRequired(true)
  .addChoices(
    { name: 'Bürünc Açar', value: 'bronze_key' },
    { name: 'Reward Ticket', value: 'ticket' },
    { name: 'Lucky Booster', value: 'lucky_booster' },
    { name: 'Bürünc Sandıq', value: 'starter_chest' },
    { name: 'Qızıl Sandıq', value: 'gold_chest' }
  );

const baseCommands = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Octoson başlanğıc panelini açır.'),
  new SlashCommandBuilder()
    .setName('commands')
    .setDescription('Bütün əsas Octoson komandalarını qısa izahla göstərir.'),
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Server üçün əsas bot panelini açır.'),
  new SlashCommandBuilder()
    .setName('user')
    .setDescription('Open moderation control panel for a user')
    .addUserOption(option => option.setName('user').setDescription('Üzv seç').setRequired(true)),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Octoson botunu, Aura sistemini və əsas komandaları izah edir.')
    .addStringOption(option => option
      .setName('category')
      .setDescription('Açmaq istədiyin help bölməsi')
      .setRequired(false)
      .addChoices(
        { name: 'Başlanğıc', value: 'home' },
        { name: 'Komandalar', value: 'commands' },
        { name: 'Aura sistemi', value: 'aura' },
        { name: 'Casino oyunları', value: 'games' },
        { name: 'Wallet və bank', value: 'wallet' },
        { name: 'Qazanc və quest', value: 'missions' },
        { name: 'Dünya / MMORPG', value: 'world' },
        { name: 'Market', value: 'market' },
        { name: 'İnventar', value: 'inventory' },
        { name: 'Progress', value: 'progress' },
        { name: 'Sosial', value: 'social' },
        { name: 'Stil', value: 'style' }
      )),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Canlı Aura lider tablosunu göstərir.'),
  new SlashCommandBuilder()
    .setName('stylecheck')
    .setDescription('Modal ilə fit və tərz analizi al.'),
  new SlashCommandBuilder()
    .setName('routine')
    .setDescription('Dəri, saç, duruş və ya foto üçün praktik rutin verir.')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Rutin növü')
        .setRequired(true)
        .addChoices(
          { name: 'deri', value: 'skin' },
          { name: 'sac', value: 'hair' },
          { name: 'durus', value: 'posture' },
          { name: 'foto', value: 'photo' }
        )
    ),
  new SlashCommandBuilder()
    .setName('mogger')
    .setDescription('Upload a photo and open the private Looks Lab.')
    .addAttachmentOption(option => option
      .setName('image')
      .setDescription('Analyze olunacaq şəkil')
      .setRequired(true))
    .addUserOption(option => option
      .setName('user')
      .setDescription('İstəsən declared subject seç')
      .setRequired(false)),
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Özünün və ya başqa üzvün Aura profilini göstərir.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Profilinə baxmaq istədiyin üzv')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Admin-only AI cavab komandası. Hazırda söndürülüb.')
    .addStringOption(option =>
      option
        .setName('question')
        .setDescription('Sualını yaz')
        .setRequired(true)
        .setMaxLength(500)
    ),
  new SlashCommandBuilder()
    .setName('livepanel')
    .setDescription('Admin-only TikTok live/reminder paneli yaradır.')
    .addStringOption(option =>
      option
        .setName('link')
        .setDescription('TikTok live linki')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('topic')
        .setDescription('Bugünkü yayın mövzusu')
        .setRequired(false)
        .setMaxLength(120)
    )
];

const gameCommand = new SlashCommandBuilder()
  .setName('game')
  .setDescription('Tərz temalı əsas Aura oyunları.')
  .addSubcommand(subcommand => subcommand.setName('menu').setDescription('Oyun panelini açır.'))
  .addSubcommand(subcommand => subcommand
    .setName('balance')
    .setDescription('Aura balansını göstərir.')
    .addUserOption(option => option.setName('user').setDescription('Başqa üzvün balansına bax').setRequired(false)))
  .addSubcommand(subcommand => subcommand.setName('daily').setDescription('Gündəlik hazırlıq missiyasını tamamlayıb Aura qazan.'))
  .addSubcommand(subcommand => subcommand.setName('slots').setDescription('Server Aura-sı ilə tərz slotları oyna.').addIntegerOption(option => betOption(option, 'bet', 400000)))
  .addSubcommand(subcommand => subcommand
    .setName('risk')
    .setDescription('Server Aura-sı ilə risk və mükafat oyunu.')
    .addIntegerOption(option => betOption(option, 'bet', 400000))
    .addStringOption(option =>
      option
        .setName('level')
        .setDescription('Risk səviyyəsi')
        .setRequired(true)
        .addChoices(
          { name: 'sakit oyun', value: 'safe' },
          { name: 'kəskin oyun', value: 'balanced' },
          { name: 'cəsarətli oyun', value: 'bold' }
        )))
  .addSubcommand(subcommand => subcommand
    .setName('duel')
    .setDescription('Başqa üzvə Aura qoyuluşu ilə tərz dueli təklif et.')
    .addUserOption(option => option.setName('opponent').setDescription('Duel rəqibi').setRequired(true))
    .addIntegerOption(option => option.setName('stake').setDescription('Hər oyunçunun qoyduğu Aura').setMinValue(25).setMaxValue(1000).setRequired(true)))
  .addSubcommand(subcommand => subcommand
    .setName('party')
    .setDescription('Casino party lobbisini aç və ya qoşul.')
    .addStringOption(option => option.setName('action').setDescription('create/join/leave/status').setRequired(true))
    .addStringOption(option => option.setName('party_id').setDescription('Qoşulmaq üçün party ID').setRequired(false)))
  .addSubcommand(subcommand => subcommand.setName('leaderboard').setDescription('Ən çox Aura toplayanları göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('prestige').setDescription('Səviyyə 50-də prestij aç və daimi Aura bonusu qazan.'));

const partyCommand = new SlashCommandBuilder()
  .setName('party')
  .setDescription('Casino party lobbisini aç və ya qoşul.')
  .addSubcommand(subcommand => subcommand.setName('create').setDescription('Yeni party yarat.'))
  .addSubcommand(subcommand => subcommand.setName('join').setDescription('Mövcud party-yə qoşul.').addStringOption(option => option.setName('party_id').setDescription('Party ID').setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('leave').setDescription('Partydən çıx.'))
  .addSubcommand(subcommand => subcommand.setName('status').setDescription('Partynin statusunu göstər.'));

const walletCommand = new SlashCommandBuilder()
  .setName('wallet')
  .setDescription('Aura pul kisəsi, bank və əməliyyatlar.')
  .addSubcommand(subcommand => subcommand.setName('balance').setDescription('Balans və bank hesabını göstərir.').addUserOption(option => option.setName('user').setDescription('Başqa üzv').setRequired(false)))
  .addSubcommand(subcommand => subcommand.setName('bank').setDescription('Bank hesabını göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('deposit').setDescription('Aura bankına yatır.').addIntegerOption(amountOption))
  .addSubcommand(subcommand => subcommand.setName('withdraw').setDescription('Bankdan Aura çıxar.').addIntegerOption(amountOption))
  .addSubcommand(subcommand => subcommand.setName('transfer').setDescription('Başqa üzvə Aura göndər.').addUserOption(userOption).addIntegerOption(amountOption))
  .addSubcommand(subcommand => subcommand.setName('gift').setDescription('Başqa üzvə hədiyyə Aura ver.').addUserOption(userOption).addIntegerOption(amountOption))
  .addSubcommand(subcommand => subcommand.setName('loan').setDescription('OctoBank və Kölgə Kredit təkliflərini açır.'))
  .addSubcommand(subcommand => subcommand.setName('prime').setDescription('10k Aura Prime al və ayda 6 casino loss refund haqqı qazan.'))
  .addSubcommand(subcommand => subcommand.setName('payloan').setDescription('Aktiv krediti ödə.').addIntegerOption(optionalAmountOption))
  .addSubcommand(subcommand => subcommand.setName('credit').setDescription('Kredit profili, reytinq və borc statusu.'))
  .addSubcommand(subcommand => subcommand.setName('helploan').setDescription('Başqa üzvün borcunu ödəməyə kömək et.').addUserOption(userOption).addIntegerOption(amountOption))
  .addSubcommand(subcommand => subcommand.setName('insurance').setDescription('Aylıq kredit sığortası al.'))
  .addSubcommand(subcommand => subcommand.setName('history').setDescription('Son Aura əməliyyatlarını göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('transactions').setDescription('Əməliyyat jurnalını göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('interest').setDescription('Gündəlik bank faizini götür.'))
  .addSubcommand(subcommand => subcommand.setName('taxes').setDescription('Gündəlik varlılıq vergisini hesabla.'));

const earnCommand = new SlashCommandBuilder()
  .setName('earn')
  .setDescription('Missiyalar, işlər və mükafatlar.')
  .addSubcommand(subcommand => subcommand.setName('daily').setDescription('Gündəlik Aura mükafatı.'))
  .addSubcommand(subcommand => subcommand.setName('weekly').setDescription('Həftəlik Aura və açar mükafatı.'))
  .addSubcommand(subcommand => subcommand.setName('monthly').setDescription('Aylıq böyük Aura mükafatı.'))
  .addSubcommand(subcommand => subcommand.setName('work').setDescription('Təhlükəsiz iş gör və Aura qazan.'))
  .addSubcommand(subcommand => subcommand.setName('crime').setDescription('Riskli iş gör, böyük mükafat və ya cərimə al.'))
  .addSubcommand(subcommand => subcommand.setName('hunt').setDescription('Ov missiyası.'))
  .addSubcommand(subcommand => subcommand.setName('fish').setDescription('Balıqçılıq missiyası.'))
  .addSubcommand(subcommand => subcommand.setName('mine').setDescription('Mədən missiyası.'))
  .addSubcommand(subcommand => subcommand.setName('beg').setDescription('Kiçik Aura şansı.'))
  .addSubcommand(subcommand => subcommand.setName('rob').setDescription('Başqa üzvdən Aura soymağa çalış.').addUserOption(option => option.setName('user').setDescription('Soymaq istədiyin üzv').setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('collect').setDescription('Gündəlik əşya və Aura toplama.'))
  .addSubcommand(subcommand => subcommand.setName('rewards').setDescription('Mükafat statusunu göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('bonus').setDescription('Bir dəfəlik başlanğıc bonusu.'));

const inventoryCommand = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('Profil, inventar, mağaza və kosmetiklər.')
  .addSubcommand(subcommand => subcommand.setName('profile').setDescription('Tam Aura profilini göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('items').setDescription('İnventardakı əşyaları göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('shop').setDescription('Mağazadakı əşyaları göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('buy').setDescription('Mağazadan əşya al.').addStringOption(option => option.setName('item').setDescription('Əşya').setRequired(true).addChoices(
    { name: 'Bürünc Açar', value: 'bronze_key' },
    { name: 'Reward Ticket', value: 'ticket' },
    { name: 'Lucky Booster', value: 'lucky_booster' },
    { name: 'Bürünc Sandıq', value: 'starter_chest' },
    { name: 'Qızıl Sandıq', value: 'gold_chest' }
  )))
  .addSubcommand(subcommand => subcommand.setName('sell').setDescription('Collectible sat.').addStringOption(option => option.setName('item').setDescription('Əşyanın adı').setRequired(true).setMaxLength(80)))
  .addSubcommand(subcommand => subcommand.setName('open').setDescription('Ən yaxşı mövcud sandığı aç.'))
  .addSubcommand(subcommand => subcommand.setName('craft').setDescription('3 collectible ilə titul craft et.'))
  .addSubcommand(subcommand => subcommand.setName('recycle').setDescription('Collectible recycle edib Aura al.'))
  .addSubcommand(subcommand => subcommand.setName('salvage').setDescription('Collectible parçala və açar al.'))
  .addSubcommand(subcommand => subcommand.setName('achievements').setDescription('Açılmış nailiyyətləri göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('badges').setDescription('Nişanları göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('titles').setDescription('Titulları göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('statistics').setDescription('Oyun statistikalarını göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('settings').setDescription('Profil ayarlarını göstərir.'));

const casinoCommand = new SlashCommandBuilder()
  .setName('casino')
  .setDescription('Aura casino oyunları. Real pul deyil.')
  .addSubcommand(subcommand => subcommand.setName('slots').setDescription('3 simvollu slot oyunu.').addIntegerOption(option => betOption(option, 'bet', 400000)))
  .addSubcommand(subcommand => subcommand.setName('risk').setDescription('Risk səviyyəsi ilə çarpan oyunu.').addIntegerOption(option => betOption(option, 'bet', 400000)))
  .addSubcommand(subcommand => subcommand.setName('coinflip').setDescription('Sikkə atışı.').addIntegerOption(option => betOption(option, 'bet', 400000)).addStringOption(option => option.setName('side').setDescription('Tərəf').setRequired(false).addChoices({ name: 'üz', value: 'heads' }, { name: 'arxa', value: 'tails' })))
  .addSubcommand(subcommand => subcommand.setName('dice').setDescription('Zər atışı.').addIntegerOption(option => betOption(option, 'bet', 400000)))
  .addSubcommand(subcommand => subcommand.setName('roulette').setDescription('Qırmızı/qara rulet.').addIntegerOption(option => betOption(option, 'bet', 400000)).addStringOption(option => option.setName('color').setDescription('Rəng').setRequired(false).addChoices({ name: 'qırmızı', value: 'red' }, { name: 'qara', value: 'black' })))
  .addSubcommand(subcommand => subcommand.setName('blackjack').setDescription('Sadə blackjack raundu.').addIntegerOption(option => betOption(option, 'bet', 400000)))
  .addSubcommand(subcommand => subcommand.setName('crash').setDescription('Crash çarpanını tut.').addIntegerOption(option => betOption(option, 'bet', 400000)).addNumberOption(option => option.setName('cashout').setDescription('İstəyə bağlı çıxış çarpanı').setMinValue(1.1).setMaxValue(10).setRequired(false)))
  .addSubcommand(subcommand => subcommand.setName('mines').setDescription('Mina sahəsində şansını yoxla.').addIntegerOption(option => betOption(option, 'bet', 400000)))
  .addSubcommand(subcommand => subcommand.setName('tower').setDescription('Qüllə mərtəbələri ilə çarpan qazan.').addIntegerOption(option => betOption(option, 'bet', 400000)))
  .addSubcommand(subcommand => subcommand.setName('higherlower').setDescription('Yuxarı/aşağı kart oyunu.').addIntegerOption(option => betOption(option, 'bet', 400000)).addStringOption(option => option.setName('guess').setDescription('Təxmin').setRequired(false).addChoices({ name: 'yuxarı', value: 'higher' }, { name: 'aşağı', value: 'lower' })))
  .addSubcommand(subcommand => subcommand.setName('wheel').setDescription('Lucky wheel fırlat.').addIntegerOption(option => betOption(option, 'bet', 400000)))
  .addSubcommand(subcommand => subcommand.setName('lottery').setDescription('Lotereya bileti aç. Reward Ticket 500 Aura cover verir.').addIntegerOption(option => betOption(option, 'bet', 400000)))
  .addSubcommand(subcommand => subcommand.setName('jackpot').setDescription('Jackpot raundu.').addIntegerOption(option => betOption(option, 'bet', 400000)))
  .addSubcommand(subcommand => subcommand.setName('rps').setDescription('Daş kağız qayçı.').addIntegerOption(option => betOption(option, 'bet', 400000)).addStringOption(option => option.setName('move').setDescription('Gediş').setRequired(false).addChoices({ name: 'daş', value: 'rock' }, { name: 'kağız', value: 'paper' }, { name: 'qayçı', value: 'scissors' })))
  .addSubcommand(subcommand => subcommand.setName('baccarat').setDescription('Sadə baccarat raundu.').addIntegerOption(option => betOption(option, 'bet', 400000)))
  .addSubcommand(subcommand => subcommand.setName('poker').setDescription('Sadə poker hand raundu.').addIntegerOption(option => betOption(option, 'bet', 400000)))
  .addSubcommand(subcommand => subcommand.setName('horse').setDescription('At yarışı mərci.').addIntegerOption(option => betOption(option, 'bet', 400000)))
  .addSubcommand(subcommand => subcommand.setName('penalty').setDescription('Penalti oyunu.').addIntegerOption(option => betOption(option, 'bet', 400000)));

const questCommand = new SlashCommandBuilder()
  .setName('quest')
  .setDescription('Gündəlik, həftəlik və aylıq MMORPG missiyaları.')
  .addSubcommand(subcommand => subcommand.setName('board').setDescription('Missiya lövhəsini açır.'))
  .addSubcommand(subcommand => subcommand.setName('daily').setDescription('Gündəlik missiyanı tamamla.'))
  .addSubcommand(subcommand => subcommand.setName('weekly').setDescription('Həftəlik missiyanı tamamla.'))
  .addSubcommand(subcommand => subcommand.setName('monthly').setDescription('Aylıq missiyanı tamamla.'))
  .addSubcommand(subcommand => subcommand.setName('work').setDescription('İş missiyasına başla.'))
  .addSubcommand(subcommand => subcommand.setName('crime').setDescription('Riskli missiyaya başla.'))
  .addSubcommand(subcommand => subcommand.setName('hunt').setDescription('Ov missiyası.'))
  .addSubcommand(subcommand => subcommand.setName('fish').setDescription('Balıqçılıq missiyası.'))
  .addSubcommand(subcommand => subcommand.setName('mine').setDescription('Mədən missiyası.'))
  .addSubcommand(subcommand => subcommand.setName('collect').setDescription('Toplama missiyası.'))
  .addSubcommand(subcommand => subcommand.setName('progress').setDescription('Missiya və streak statusu.'))
  .addSubcommand(subcommand => subcommand.setName('milestones').setDescription('Açılan hədəfləri göstərir.'));

const marketCommand = new SlashCommandBuilder()
  .setName('market')
  .setDescription('Mağaza, bazar, hərrac və crafting iqtisadiyyatı.')
  .addSubcommand(subcommand => subcommand.setName('shop').setDescription('Mağaza kataloqu.'))
  .addSubcommand(subcommand => subcommand.setName('prices').setDescription('Qiymət siyahısı.'))
  .addSubcommand(subcommand => subcommand.setName('buy').setDescription('Mağazadan əşya al.').addStringOption(option => option.setName('item').setDescription('Əşya').setRequired(true).addChoices(
    { name: 'Bürünc Açar', value: 'bronze_key' },
    { name: 'Reward Ticket', value: 'ticket' },
    { name: 'Lucky Booster', value: 'lucky_booster' },
    { name: 'Bürünc Sandıq', value: 'starter_chest' },
    { name: 'Qızıl Sandıq', value: 'gold_chest' }
  )))
  .addSubcommand(subcommand => subcommand.setName('sell').setDescription('Collectible sat.').addStringOption(option => option.setName('item').setDescription('Əşya adı').setRequired(true).setMaxLength(80)))
  .addSubcommand(subcommand => subcommand.setName('open').setDescription('Sandıq aç.'))
  .addSubcommand(subcommand => subcommand.setName('craft').setDescription('Craft sistemi.'))
  .addSubcommand(subcommand => subcommand.setName('recycle').setDescription('Recycle sistemi.'))
  .addSubcommand(subcommand => subcommand.setName('salvage').setDescription('Salvage sistemi.'))
  .addSubcommand(subcommand => subcommand.setName('auction').setDescription('Hərrac lövhəsi.'))
  .addSubcommand(subcommand => subcommand.setName('trade').setDescription('Trade sistemi.'))
  .addSubcommand(subcommand => subcommand.setName('listings').setDescription('Aktiv bazar listlərini göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('inventory').setDescription('Bazar üçün inventarı göstərir.'));

const progressCommand = new SlashCommandBuilder()
  .setName('progress')
  .setDescription('Level, rank, statistikalar və profil inkişafı.')
  .addSubcommand(subcommand => subcommand.setName('profile').setDescription('Tam profil kartı.'))
  .addSubcommand(subcommand => subcommand.setName('season').setDescription('Mövsüm progressi və reward track.'))
  .addSubcommand(subcommand => subcommand.setName('goals').setDescription('Bugünkü və həftəlik növbəti hədəflər.'))
  .addSubcommand(subcommand => subcommand.setName('collection').setDescription('Collection book və set progressi.'))
  .addSubcommand(subcommand => subcommand.setName('level').setDescription('Level və XP statusu.'))
  .addSubcommand(subcommand => subcommand.setName('rank').setDescription('Rank statusu.'))
  .addSubcommand(subcommand => subcommand.setName('richest').setDescription('Ən zəngin üzvlər.'))
  .addSubcommand(subcommand => subcommand.setName('leaderboard').setDescription('Aura lider tablosu.'))
  .addSubcommand(subcommand => subcommand.setName('statistics').setDescription('Oyun statistikaları.'))
  .addSubcommand(subcommand => subcommand.setName('achievements').setDescription('Nailiyyətlər.'))
  .addSubcommand(subcommand => subcommand.setName('badges').setDescription('Nişanlar.'))
  .addSubcommand(subcommand => subcommand.setName('titles').setDescription('Titullar.'))
  .addSubcommand(subcommand => subcommand.setName('prestige').setDescription('Prestij statusu və açılışı.'))
  .addSubcommand(subcommand => subcommand.setName('history').setDescription('Son əməliyyat tarixi.'))
  .addSubcommand(subcommand => subcommand.setName('settings').setDescription('Profil ayarları.'));

const socialCommand = new SlashCommandBuilder()
  .setName('social')
  .setDescription('Community, duel, transfer və üzv qarşılıqlı əlaqələri.')
  .addSubcommand(subcommand => subcommand.setName('profile').setDescription('Üzv profilinə bax.').addUserOption(option => option.setName('user').setDescription('Üzv').setRequired(false)))
  .addSubcommand(subcommand => subcommand.setName('gift').setDescription('Üzvə Aura hədiyyə et.').addUserOption(userOption).addIntegerOption(amountOption))
  .addSubcommand(subcommand => subcommand.setName('transfer').setDescription('Üzvə Aura transfer et.').addUserOption(userOption).addIntegerOption(amountOption))
  .addSubcommand(subcommand => subcommand.setName('rob').setDescription('Başqa üzvdən Aura soymağa çalış.').addUserOption(userOption))
  .addSubcommand(subcommand => subcommand.setName('duel').setDescription('Üzvü duelə çağır.').addUserOption(option => option.setName('opponent').setDescription('Rəqib').setRequired(true)).addIntegerOption(option => option.setName('stake').setDescription('Qoyuluş').setMinValue(25).setMaxValue(1000).setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('dicebattle').setDescription('3 zərli PvP Aura döyüşü başlat.').addUserOption(option => option.setName('opponent').setDescription('Rəqib').setRequired(true)).addIntegerOption(option => option.setName('stake').setDescription('Hər oyunçunun qoyduğu Aura').setMinValue(25).setMaxValue(5000).setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('quickdraw').setDescription('Reaksiya sürəti ilə PvP Aura oyunu.').addUserOption(option => option.setName('opponent').setDescription('Rəqib').setRequired(true)).addIntegerOption(option => option.setName('stake').setDescription('Hər oyunçunun qoyduğu Aura').setMinValue(25).setMaxValue(5000).setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('heist').setDescription('Çox nəfərlik Aura soyğunu lobby-si aç.').addIntegerOption(option => option.setName('stake').setDescription('Hər qoşulan üzvün riski').setMinValue(50).setMaxValue(5000).setRequired(true)))
  .addSubcommand(subcommand => subcommand
    .setName('gamerequests')
    .setDescription('PvP oyun çağırışlarını aç/bağla.')
    .addStringOption(option => option
      .setName('mode')
      .setDescription('Çağırış ayarı')
      .setRequired(true)
      .addChoices(
        { name: 'on', value: 'on' },
        { name: 'off', value: 'off' },
        { name: 'status', value: 'status' }
      )))
  .addSubcommand(subcommand => subcommand.setName('compare').setDescription('Öz profilini başqa üzvlə müqayisə et.').addUserOption(userOption))
  .addSubcommand(subcommand => subcommand.setName('leaderboard').setDescription('Community liderləri.'))
  .addSubcommand(subcommand => subcommand.setName('richest').setDescription('Ən zəngin üzvlər.'))
  .addSubcommand(subcommand => subcommand.setName('reputation').setDescription('Reputasiya statusu.'))
  .addSubcommand(subcommand => subcommand.setName('badges').setDescription('Community nişanları.'))
  .addSubcommand(subcommand => subcommand.setName('stats').setDescription('Community statistikası.'));

const worldCommand = new SlashCommandBuilder()
  .setName('world')
  .setDescription('Octoson dünyası: iş, biznes, əmlak, macəra və nüfuz.')
  .addSubcommand(subcommand => subcommand.setName('profile').setDescription('Dünya progress profilini göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('jobs').setDescription('Aura iş siyahısını göstərir.'))
  .addSubcommand(subcommand => subcommand
    .setName('job')
    .setDescription('Özünə iş seç.')
    .addStringOption(option => option
      .setName('type')
      .setDescription('Job növü')
      .setRequired(true)
      .addChoices(
        { name: 'Polis', value: 'police' },
        { name: 'Haker', value: 'hacker' },
        { name: 'Dizayner', value: 'designer' },
        { name: 'Aşpaz', value: 'chef' },
        { name: 'Musiqi prodüseri', value: 'producer' },
        { name: 'Küçə yarışçısı', value: 'racer' },
        { name: 'Detektiv', value: 'detective' },
        { name: 'Biznes sahibi', value: 'owner' }
      )))
  .addSubcommand(subcommand => subcommand
    .setName('mission')
    .setDescription('Job missiyası et.')
    .addStringOption(option => option
      .setName('choice')
      .setDescription('Missiya seçimi')
      .setRequired(true)
      .addChoices(
        { name: 'Cəsarətli seçim', value: 'bold' },
        { name: 'Ağıllı seçim', value: 'smart' },
        { name: 'Sakit seçim', value: 'safe' }
      )))
  .addSubcommand(subcommand => subcommand.setName('businesses').setDescription('Alına bilən biznesləri göstərir.'))
  .addSubcommand(subcommand => subcommand
    .setName('buybusiness')
    .setDescription('Biznes al.')
    .addStringOption(option => option
      .setName('type')
      .setDescription('Biznes növü')
      .setRequired(true)
      .addChoices(
        { name: 'Restoran', value: 'restaurant' },
        { name: 'Bərbər', value: 'barber' },
        { name: 'Oyun kafesi', value: 'gaming_cafe' },
        { name: 'Maşın salonu', value: 'car_dealer' },
        { name: 'Kofe dükanı', value: 'coffee_shop' }
      )))
  .addSubcommand(subcommand => subcommand
    .setName('upgradebusiness')
    .setDescription('Səndə olan biznesi upgrade et.')
    .addStringOption(option => option
      .setName('type')
      .setDescription('Biznes növü')
      .setRequired(true)
      .addChoices(
        { name: 'Restoran', value: 'restaurant' },
        { name: 'Bərbər', value: 'barber' },
        { name: 'Oyun kafesi', value: 'gaming_cafe' },
        { name: 'Maşın salonu', value: 'car_dealer' },
        { name: 'Kofe dükanı', value: 'coffee_shop' }
      )))
  .addSubcommand(subcommand => subcommand.setName('collect').setDescription('Biznes və əmlak gəlirlərini topla.'))
  .addSubcommand(subcommand => subcommand
    .setName('property')
    .setDescription('Əmlak al.')
    .addStringOption(option => option
      .setName('type')
      .setDescription('Əmlak növü')
      .setRequired(true)
      .addChoices(
        { name: 'Mənzil', value: 'apartment' },
        { name: 'Ev', value: 'house' },
        { name: 'Villa', value: 'mansion' },
        { name: 'Ofis', value: 'office' },
        { name: 'Ada', value: 'island' }
      )))
  .addSubcommand(subcommand => subcommand
    .setName('vehicle')
    .setDescription('Bonus verən nəqliyyat al.')
    .addStringOption(option => option
      .setName('type')
      .setDescription('Nəqliyyat növü')
      .setRequired(true)
      .addChoices(
        { name: 'Bicycle', value: 'bicycle' },
        { name: 'BMW', value: 'bmw' },
        { name: 'Ferrari', value: 'ferrari' },
        { name: 'Helicopter', value: 'helicopter' }
      )))
  .addSubcommand(subcommand => subcommand
    .setName('adventure')
    .setDescription('Gündəlik seçimli macəra.')
    .addStringOption(option => option
      .setName('choice')
      .setDescription('Seçim')
      .setRequired(true)
      .addChoices(
        { name: 'Kömək et', value: 'help' },
        { name: 'Yox say', value: 'ignore' },
        { name: 'Risk et', value: 'risk' }
      )))
  .addSubcommand(subcommand => subcommand
    .setName('explore')
    .setDescription('Xəritə kəşf et.')
    .addStringOption(option => option
      .setName('map')
      .setDescription('Xəritə')
      .setRequired(true)
      .addChoices(
        { name: 'Meşə', value: 'forest' },
        { name: 'Səhra', value: 'desert' },
        { name: 'Şəhər', value: 'city' },
        { name: 'Dağ', value: 'mountain' },
        { name: 'Zindan', value: 'dungeon' },
        { name: 'Kosmos', value: 'space' }
      )))
  .addSubcommand(subcommand => subcommand.setName('event').setDescription('Hazırkı şəhər hadisəsini göstərir.'))
  .addSubcommand(subcommand => subcommand.setName('influence').setDescription('Aura nüfuz statusunu göstərir.'));

const adminCommand = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin Aura idarəetməsi.')
  .addSubcommand(subcommand => subcommand.setName('give').setDescription('Üzvə limitsiz Aura ver.').addUserOption(userOption).addIntegerOption(adminAmountOption))
  .addSubcommand(subcommand => subcommand.setName('take').setDescription('Üzvdən Aura sil.').addUserOption(userOption).addIntegerOption(adminAmountOption))
  .addSubcommand(subcommand => subcommand.setName('setbalance').setDescription('Üzvün Aura balansını təyin et.').addUserOption(userOption).addIntegerOption(adminAmountOption))
  .addSubcommand(subcommand => subcommand.setName('setlevel').setDescription('Üzvün levelini təyin et.').addUserOption(userOption).addIntegerOption(adminLevelOption))
  .addSubcommand(subcommand => subcommand.setName('badge').setDescription('Üzvə nişan ver.').addUserOption(userOption).addStringOption(option => option.setName('badge').setDescription('Nişan adı və ya emoji').setMaxLength(40).setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('item').setDescription('Üzvə item, key, ticket və ya sandıq ver.').addUserOption(userOption).addStringOption(adminItemOption).addIntegerOption(adminCountOption))
  .addSubcommand(subcommand => subcommand.setName('casinorestrict').setDescription('Üzv üçün casino mərc limitini təyin et.').addUserOption(userOption).addIntegerOption(adminCasinoMaxBetOption).addStringOption(option => option.setName('reason').setDescription('Səbəb').setMaxLength(80).setRequired(false)))
  .addSubcommand(subcommand => subcommand.setName('chests').setDescription('Sandıq/açar alma və açma sistemini aç-bağla.').addBooleanOption(option => option.setName('enabled').setDescription('Aktiv olsun?').setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('safemode').setDescription('Economy safe mode-u aç-bağla.').addBooleanOption(option => option.setName('enabled').setDescription('Aktiv olsun?').setRequired(true)))
  .addSubcommand(subcommand => subcommand
    .setName('cleanup')
    .setDescription('Bu kanalda botun göndərdiyi mesajları sil.')
    .addStringOption(option => option
      .setName('scope')
      .setDescription('Nəyi silsin?')
      .setRequired(false)
      .addChoices(
        { name: 'Bütün bot mesajları', value: 'all' },
        { name: 'Yalnız leaderboard mesajları', value: 'leaderboard' }
      )))
  .addSubcommand(subcommand => subcommand.setName('profile').setDescription('Admin üçün detallı üzv audit paneli.').addUserOption(userOption))
  .addSubcommand(subcommand => subcommand.setName('audit').setDescription('Üzvün balans və transaction auditini göstər.').addUserOption(userOption))
  .addSubcommand(subcommand => subcommand
    .setName('drop')
    .setDescription('Claim düyməli Aura portalı aç.')
    .addIntegerOption(adminAmountOption)
    .addIntegerOption(option => option.setName('claims').setDescription('Neçə nəfər claim edə bilər').setMinValue(1).setMaxValue(25).setRequired(true))
    .addIntegerOption(option => option.setName('duration').setDescription('Portal neçə saniyə açıq qalsın').setMinValue(5).setMaxValue(86400).setRequired(true))
    .addStringOption(option => option
      .setName('mode')
      .setDescription('Paylaşım növü')
      .setRequired(false)
      .addChoices(
        { name: 'Hər kəs eyni amount alsın', value: 'same' },
        { name: 'Amount claim edənlər arasında random bölünsün', value: 'random' }
      )))
  .addSubcommand(subcommand => subcommand
    .setName('uiemoji')
    .setDescription('Bot UI düyməsi üçün emote seç.')
    .addStringOption(uiEmojiOption)
    .addStringOption(option => option
      .setName('emoji')
      .setDescription('İstəyə bağlı: custom emoji paste et, məsələn <:cash:123>')
      .setMaxLength(120)
      .setRequired(false)));

export const commands = [
  ...baseCommands,
  gameCommand,
  partyCommand,
  walletCommand,
  earnCommand,
  inventoryCommand,
  casinoCommand,
  questCommand,
  marketCommand,
  progressCommand,
  socialCommand,
  worldCommand,
  adminCommand
].map(publicCommand);
