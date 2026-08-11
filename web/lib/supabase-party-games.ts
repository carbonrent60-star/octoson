import {
  createInitialGameState,
  type PartyGameKey,
  type PartyRoomState,
} from "@/lib/octoson-party-games";

import {
  startPartyGame,
} from "@/lib/octoson-party-engine";

export const SUPABASE_TO_PARTY_GAME = {
  lastbutton: "last-button",
  undercover: "undercover",
  pixelwars: "pixel-wars",
  vault: "vault",
  kingofthehill: "king-hill",
  octoparty: "octo-party",
} as const;

export type SupabasePartyGameId =
  keyof typeof SUPABASE_TO_PARTY_GAME;

export function isSupabasePartyGame(
  game: string,
): game is SupabasePartyGameId {
  return game in SUPABASE_TO_PARTY_GAME;
}

export function toPartyGameKey(
  game: string,
): PartyGameKey | null {
  if (!isSupabasePartyGame(game)) {
    return null;
  }

  return SUPABASE_TO_PARTY_GAME[game];
}

type MatchPlayer = {
  user_id: string;
  player_data?: {
    name?: string;
  } | null;
};

export function createSupabasePartyMatchState(input: {
  game: string;
  code: string;
  hostId: string;
  players: MatchPlayer[];
}) {
  const partyGame =
    toPartyGameKey(input.game);

  if (!partyGame) {
    return null;
  }

  const now = Date.now();

  const room: PartyRoomState = {
    code: input.code,
    game: partyGame,
    hostId: input.hostId,

    status: "waiting",

    players: input.players.map(
      (player, index) => ({
        id: String(
          player.user_id,
        ),

        name:
          player.player_data?.name ??
          `Player ${index + 1}`,

        score: 0,
        alive: true,
        joinedAt: now + index,
      }),
    ),

    round: 0,

    gameState:
      createInitialGameState(
        partyGame,
      ),

    createdAt: now,
    updatedAt: now,
  };

  const result =
    startPartyGame(room);

  if (!result.ok) {
    throw new Error(
      result.message,
    );
  }

  return room;
}

export function getPartyWinner(
  room: PartyRoomState,
) {
  return [...room.players].sort(
    (a, b) =>
      b.score - a.score,
  )[0] ?? null;
}
