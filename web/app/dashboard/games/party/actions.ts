"use server";

import { auth } from "@/auth";

import {
  PARTY_GAMES,
  isPartyGameKey,
} from "@/lib/octoson-party-games";

import {
  createPartyRoom,
  getPartyRoom,
  joinPartyRoom,
  savePartyRoom,
} from "@/lib/octoson-party-store";

import {
  performPartyAction,
  startPartyGame,
} from "@/lib/octoson-party-engine";

async function user() {
  const session =
    await auth();

  const id =
    session?.user?.discordId;

  if (!id) return null;

  return {
    id,
    name:
      session.user.name ??
      "Octoson User",
  };
}

export async function createPartyRoomAction(
  game: string
) {
  const me = await user();

  if (!me) {
    return {
      ok: false,
      message:
        "Discord sessiyası tapılmadı.",
    };
  }

  if (
    !isPartyGameKey(game)
  ) {
    return {
      ok: false,
      message: "Oyun tapılmadı.",
    };
  }

  const room =
    createPartyRoom({
      game,
      hostId: me.id,
      hostName: me.name,
    });

  return {
    ok: true,
    room,
  };
}

export async function joinPartyRoomAction(
  rawCode: string
) {
  const me = await user();

  if (!me) {
    return {
      ok: false,
      message:
        "Discord sessiyası tapılmadı.",
    };
  }

  const code =
    String(rawCode ?? "")
      .trim()
      .toUpperCase();

  const existing =
    getPartyRoom(code);

  if (!existing) {
    return {
      ok: false,
      message:
        "Bu room tapılmadı.",
    };
  }

  const config =
    PARTY_GAMES[
      existing.game
    ];

  const result =
    joinPartyRoom({
      code,
      playerId: me.id,
      playerName: me.name,
      maxPlayers:
        config.maxPlayers,
    });

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "full"
          ? "Room doludur."
          : result.reason ===
              "started"
            ? "Oyun artıq başlayıb."
            : "Room tapılmadı.",
    };
  }

  return {
    ok: true,
    room: result.room,
  };
}

export async function getPartyRoomAction(
  code: string
) {
  const me = await user();

  if (!me) {
    return {
      ok: false,
      message:
        "Sessiya yoxdur.",
    };
  }

  const room =
    getPartyRoom(code);

  if (!room) {
    return {
      ok: false,
      message:
        "Room artıq mövcud deyil.",
    };
  }

  return {
    ok: true,
    room,
    me: me.id,
  };
}

export async function startPartyRoomAction(
  code: string
) {
  const me = await user();

  if (!me) {
    return {
      ok: false,
      message:
        "Sessiya yoxdur.",
    };
  }

  const room =
    getPartyRoom(code);

  if (!room) {
    return {
      ok: false,
      message:
        "Room tapılmadı.",
    };
  }

  if (
    room.hostId !== me.id
  ) {
    return {
      ok: false,
      message:
        "Oyunu yalnız host başlada bilər.",
    };
  }

  const result =
    startPartyGame(room);

  if (!result.ok) {
    return result;
  }

  savePartyRoom(room);

  return {
    ok: true,
    room,
  };
}

export async function partyGameAction(
  code: string,
  action: string,
  value?: unknown
) {
  const me = await user();

  if (!me) {
    return {
      ok: false,
      message:
        "Sessiya yoxdur.",
    };
  }

  const room =
    getPartyRoom(code);

  if (!room) {
    return {
      ok: false,
      message:
        "Room tapılmadı.",
    };
  }

  if (
    !room.players.some(
      (player) =>
        player.id === me.id
    )
  ) {
    return {
      ok: false,
      message:
        "Bu room-da deyilsən.",
    };
  }

  performPartyAction(
    room,
    me.id,
    action,
    value
  );

  savePartyRoom(room);

  return {
    ok: true,
    room,
  };
}
