import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

import { getSupabaseClient } from './db/supabase.js';

function supabase() {
  return getSupabaseClient();
}

function normalizeState(value) {
  if (!value || typeof value !== 'object') return {};
  return value;
}

function handText(cards = []) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return '—';
  }

  return cards.join('  ');
}

function playerName(players, userId) {
  return (
    players?.find((player) => player.id === userId)?.username ??
    `<@${userId}>`
  );
}

function getStatePlayers(state) {
  const raw = state?.players;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw;
}

function getDealerHand(state) {
  if (Array.isArray(state?.dealer_hand)) {
    return state.dealer_hand;
  }

  if (Array.isArray(state?.dealerHand)) {
    return state.dealerHand;
  }

  return [];
}

function getPlayerHand(entry) {
  if (Array.isArray(entry?.hand)) return entry.hand;
  if (Array.isArray(entry?.cards)) return entry.cards;
  if (Array.isArray(entry?.player_hand)) return entry.player_hand;
  return [];
}

function getPlayerStatus(entry) {
  return String(
    entry?.status ??
    entry?.state ??
    'playing'
  );
}

function handValue(entry) {
  const value =
    entry?.value ??
    entry?.total ??
    entry?.hand_value ??
    null;

  return Number.isFinite(Number(value))
    ? Number(value)
    : null;
}

function matchButtons(matchId, myUserId, state, disabled = false) {
  const playerState =
    getStatePlayers(state).find(
      (entry) =>
        String(
          entry?.user_id ??
          entry?.id ??
          entry?.userId
        ) === String(myUserId)
    ) ?? null;

  const status = getPlayerStatus(playerState);

  const canAct =
    !disabled &&
    status !== 'stood' &&
    status !== 'bust' &&
    status !== 'blackjack' &&
    status !== 'finished' &&
    status !== 'lost' &&
    status !== 'won';

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`party_bj_hit:${matchId}`)
      .setLabel('Hit')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canAct),

    new ButtonBuilder()
      .setCustomId(`party_bj_stand:${matchId}`)
      .setLabel('Stand')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!canAct),

    new ButtonBuilder()
      .setCustomId(`party_bj_refresh:${matchId}`)
      .setLabel('Yenilə')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`party_bj_cancel:${matchId}`)
      .setLabel('Ləğv et')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

export async function getPartyBlackjackMatch(matchId) {
  const { data, error } = await supabase()
    .from('game_matches')
    .select('*')
    .eq('id', matchId)
    .eq('game', 'blackjack')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function startPartyBlackjack({
  roomId,
  hostId,
  amount,
}) {
  const client = supabase();

  const {
    data: match,
    error: matchError,
  } = await client
    .from('game_matches')
    .insert({
      room_id: roomId,
      game: 'blackjack',
      status: 'waiting',
      state: {},
    })
    .select('*')
    .single();

  if (matchError) {
    throw matchError;
  }

  const {
    data: result,
    error: startError,
  } = await client.rpc(
    'start_blackjack_match',
    {
      p_match_id: match.id,
      p_user_id: hostId,
      p_amount: Number(amount),
    }
  );

  if (startError) {
    await client
      .from('game_matches')
      .delete()
      .eq('id', match.id)
      .catch(() => {});

    throw startError;
  }

  let finalResult = result;

  // If everybody received a natural blackjack, there is no
  // Hit/Stand click to trigger settlement, so settle now.
  if (result?.phase === 'dealer') {
    const {
      data: settled,
      error: settleError,
    } = await client.rpc(
      'settle_blackjack_match',
      {
        p_match_id: match.id,
      }
    );

    if (settleError) {
      throw settleError;
    }

    finalResult = settled;
  }

  return {
    matchId: match.id,
    result: finalResult,
  };
}

export async function playPartyBlackjackAction({
  matchId,
  userId,
  action,
}) {
  const {
    data,
    error,
  } = await supabase().rpc(
    'play_blackjack_action',
    {
      p_match_id: matchId,
      p_user_id: userId,
      p_action: action,
    }
  );

  if (error) {
    throw error;
  }

  // Last player finished -> immediately run dealer + settlement.
  if (data?.phase === 'dealer') {
    const {
      data: settled,
      error: settleError,
    } = await supabase().rpc(
      'settle_blackjack_match',
      {
        p_match_id: matchId,
      }
    );

    if (settleError) {
      throw settleError;
    }

    return settled;
  }

  return data;
}

export async function settlePartyBlackjack({
  matchId,
}) {
  const {
    data,
    error,
  } = await supabase().rpc(
    'settle_blackjack_match',
    {
      p_match_id: matchId,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function cancelPartyBlackjack({
  matchId,
  userId,
}) {
  const {
    data,
    error,
  } = await supabase().rpc(
    'cancel_blackjack_match',
    {
      p_match_id: matchId,
      p_user_id: userId,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function partyBlackjackEmbed({
  match,
  party,
  viewerId,
}) {
  const state =
    normalizeState(match?.state);

  const dealerHand =
    getDealerHand(state);

  const statePlayers =
    getStatePlayers(state);

  const lines =
    party.members.map((member) => {
      const entry =
        statePlayers.find(
          (item) =>
            String(
              item?.user_id ??
              item?.id ??
              item?.userId
            ) === String(member.id)
        ) ?? {};

      const cards =
        getPlayerHand(entry);

      const value =
        handValue(entry);

      const status =
        getPlayerStatus(entry);

      const isMe =
        String(member.id) ===
        String(viewerId);

      const suffix =
        [
          value !== null
            ? `${value}`
            : null,
          status !== 'playing'
            ? status
            : null,
        ]
          .filter(Boolean)
          .join(' • ');

      return [
        `${isMe ? '▶ ' : ''}**${member.username}**`,
        handText(cards),
        suffix
          ? `\`${suffix}\``
          : '',
      ]
        .filter(Boolean)
        .join(' — ');
    });

  const phase =
    String(
      state?.phase ??
      match?.status ??
      'waiting'
    );

  const dealerVisible =
    phase === 'finished' ||
    match?.status === 'finished';

  const dealer =
    dealerVisible
      ? handText(dealerHand)
      : dealerHand.length
        ? `${dealerHand[0]}  ??`
        : '??';

  const currentTurn =
    state?.turn ??
    state?.current_turn ??
    null;

  const embed =
    new EmbedBuilder()
      .setTitle('🃏 Party Blackjack')
      .setDescription(
        [
          `Party: **${party.id}**`,
          match?.id
            ? `Match: \`${match.id}\``
            : null,
          '',
          `**Dealer** — ${dealer}`,
          '',
          ...lines,
        ]
          .filter(
            (line) =>
              line !== null &&
              line !== undefined
          )
          .join('\n')
      )
      .setColor(0x7dd3fc);

  if (currentTurn) {
    embed.addFields({
      name: 'Növbə',
      value: playerName(
        party.members,
        String(currentTurn)
      ),
      inline: true,
    });
  }

  const bet =
    state?.bet ??
    state?.amount ??
    state?.wager ??
    null;

  if (bet !== null) {
    embed.addFields({
      name: 'Mərc',
      value:
        `${Number(bet).toLocaleString('en-US')} Aura`,
      inline: true,
    });
  }

  embed.addFields({
    name: 'Status',
    value: phase,
    inline: true,
  });

  if (match?.winner_id) {
    embed.addFields({
      name: 'Qalib',
      value: `<@${match.winner_id}>`,
      inline: true,
    });
  }

  return {
    embeds: [embed],
    components: [
      matchButtons(
        match.id,
        viewerId,
        state,
        match.status === 'finished' ||
        match.status === 'cancelled'
      ),
    ],
  };
}
