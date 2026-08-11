import {
  createInitialGameState,
  randomRoomCode,
  type PartyGameKey,
  type PartyRoomState,
} from "@/lib/octoson-party-games";

type RoomMap =
  Map<string, PartyRoomState>;

declare global {
  // eslint-disable-next-line no-var
  var __octosonPartyRooms:
    | RoomMap
    | undefined;
}

const rooms =
  globalThis.__octosonPartyRooms ??
  new Map<string, PartyRoomState>();

globalThis.__octosonPartyRooms = rooms;

export function getPartyRoom(
  code: string
) {
  return (
    rooms.get(code.toUpperCase()) ??
    null
  );
}

export function createPartyRoom(input: {
  game: PartyGameKey;
  hostId: string;
  hostName: string;
}) {
  let code = randomRoomCode();

  while (rooms.has(code)) {
    code = randomRoomCode();
  }

  const now = Date.now();

  const room: PartyRoomState = {
    code,
    game: input.game,
    hostId: input.hostId,

    status: "waiting",

    players: [
      {
        id: input.hostId,
        name: input.hostName,
        score: 0,
        alive: true,
        joinedAt: now,
      },
    ],

    round: 0,

    gameState:
      createInitialGameState(input.game),

    createdAt: now,
    updatedAt: now,
  };

  rooms.set(code, room);

  return room;
}

export function savePartyRoom(
  room: PartyRoomState
) {
  room.updatedAt = Date.now();

  rooms.set(room.code, room);

  return room;
}

export function joinPartyRoom(input: {
  code: string;
  playerId: string;
  playerName: string;
  maxPlayers: number;
}) {
  const room =
    getPartyRoom(input.code);

  if (!room) {
    return {
      ok: false as const,
      reason: "missing",
    };
  }

  const existing =
    room.players.find(
      (player) =>
        player.id === input.playerId
    );

  if (existing) {
    return {
      ok: true as const,
      room,
    };
  }

  if (
    room.players.length >=
    input.maxPlayers
  ) {
    return {
      ok: false as const,
      reason: "full",
    };
  }

  if (room.status !== "waiting") {
    return {
      ok: false as const,
      reason: "started",
    };
  }

  room.players.push({
    id: input.playerId,
    name: input.playerName,
    score: 0,
    alive: true,
    joinedAt: Date.now(),
  });

  savePartyRoom(room);

  return {
    ok: true as const,
    room,
  };
}

export function removePartyPlayer(
  code: string,
  playerId: string
) {
  const room = getPartyRoom(code);

  if (!room) return null;

  room.players =
    room.players.filter(
      (player) =>
        player.id !== playerId
    );

  if (room.players.length === 0) {
    rooms.delete(room.code);

    return null;
  }

  if (
    room.hostId === playerId
  ) {
    room.hostId =
      room.players[0].id;
  }

  return savePartyRoom(room);
}
