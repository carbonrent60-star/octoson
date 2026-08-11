"use server";

import { auth } from "@/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  blackjackHandValue,
  createInitialBlackjackState,
  nextBlackjackTurn,
  playDealer,
  type PartyBlackjackState,
} from "@/lib/party-blackjack";

import {
  getMultiplayerGame,
  isMultiplayerGame,
} from "@/lib/multiplayer-games";

import {
  createSupabasePartyMatchState,
  getPartyWinner,
  isSupabasePartyGame,
} from "@/lib/supabase-party-games";

import {
  performPartyAction,
} from "@/lib/octoson-party-engine";

import type {
  PartyRoomState,
} from "@/lib/octoson-party-games";

export type GameActionResult = {
  ok: boolean;
  message: string;
  code?: string;
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function getUser() {
  const session = await auth();

  if (!session?.user?.discordId) {
    return null;
  }

  return {
    id: session.user.discordId,
    name: session.user.name ?? "Player",
    image: session.user.image ?? null,
  };
}

function makeRoomCode() {
  let code = "";

  for (let i = 0; i < 6; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }

  return code;
}

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

const ROOM_ACTIVE_WINDOW_MS = 45_000;

function activeRoomCutoff() {
  return new Date(Date.now() - ROOM_ACTIVE_WINDOW_MS).toISOString();
}

async function createUniqueRoomCode(supabase: any) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = makeRoomCode();

    const { data, error } = await supabase
      .from("game_rooms")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return code;
    }
  }

  throw new Error("Unique room code could not be generated");
}

export async function createRoomAction(
  _previousState: GameActionResult,
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  const requestedGame = String(formData.get("game") ?? "lobby");

  const game = isMultiplayerGame(requestedGame)
    ? requestedGame
    : "reaction";

  const gameDefinition = getMultiplayerGame(game);

  const supabase = getSupabaseServerClient();

  // A user should not leave multiple ghost public lobbies behind.
  // Before creating a fresh room, close their previous waiting rooms.
  const { data: oldHostedRooms } = await supabase
    .from("game_rooms")
    .select("id")
    .eq("host_id", user.id)
    .eq("status", "waiting");

  const oldHostedRoomIds = (oldHostedRooms ?? []).map((oldRoom: any) =>
    String(oldRoom.id),
  );

  if (oldHostedRoomIds.length > 0) {
    await supabase
      .from("game_rooms")
      .update({
        status: "closed",
      })
      .in("id", oldHostedRoomIds);

    await supabase
      .from("game_room_players")
      .delete()
      .in("room_id", oldHostedRoomIds);
  }

  const code = await createUniqueRoomCode(supabase);

  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .insert({
      code,
      game,
      host_id: user.id,
      status: "waiting",
      is_public: true,
      settings: {},
      max_players: gameDefinition?.maxPlayers ?? 8,
    })
    .select("id,code")
    .single();

  if (roomError || !room) {
    console.error("create room:", roomError);

    return {
      ok: false,
      message: "Otaq yaradıla bilmədi.",
    };
  }

  const { error: playerError } = await supabase
    .from("game_room_players")
    .insert({
      room_id: room.id,
      user_id: user.id,
      ready: false,
      seat: 0,
      score: 0,
      player_data: {
        name: user.name,
        image: user.image,
        host: true,
      },
    });

  if (playerError) {
    await supabase.from("game_rooms").delete().eq("id", room.id);

    console.error("create room player:", playerError);

    return {
      ok: false,
      message: "Otağa daxil olmaq mümkün olmadı.",
    };
  }

  redirect(`/dashboard/games/room/${code}`);
}

export async function joinRoomAction(
  _previousState: GameActionResult,
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  const code = normalizeCode(formData.get("code"));

  if (code.length !== 6) {
    return {
      ok: false,
      message: "6 simvolluq otaq kodu daxil et.",
    };
  }

  const supabase = getSupabaseServerClient();

  const { data: room, error } = await supabase
    .from("game_rooms")
    .select("id,code,status,max_players,is_public")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.error("join room lookup:", error);

    return {
      ok: false,
      message: "Otağı yoxlamaq mümkün olmadı.",
    };
  }

  if (!room) {
    return {
      ok: false,
      message: "Bu kodla otaq tapılmadı.",
    };
  }

  if (room.status === "closed") {
    return {
      ok: false,
      message: "Bu otaq artıq bağlanıb.",
    };
  }

  const { data: existing } = await supabase
    .from("game_room_players")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    redirect(`/dashboard/games/room/${code}`);
  }

  const { data: roomBan, error: roomBanError } = await supabase
    .from("game_room_bans")
    .select("user_id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (roomBanError) {
    console.error("join room ban check:", roomBanError);

    return {
      ok: false,
      message: "Otağa giriş icazəsi yoxlanıla bilmədi.",
    };
  }

  if (roomBan) {
    return {
      ok: false,
      message: "Bu lobby-dən çıxarılmısan və yenidən qoşula bilməzsən.",
    };
  }

  const { count, error: countError } = await supabase
    .from("game_room_players")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("room_id", room.id);

  if (countError) {
    return {
      ok: false,
      message: "Otağın vəziyyəti yoxlanıla bilmədi.",
    };
  }

  if (Number(count ?? 0) >= Number(room.max_players ?? 8)) {
    return {
      ok: false,
      message: "Otaq doludur.",
    };
  }

  const { error: joinError } = await supabase.from("game_room_players").insert({
    room_id: room.id,
    user_id: user.id,
    ready: false,
    score: 0,
    player_data: {
      name: user.name,
      image: user.image,
      host: false,
    },
  });

  if (joinError) {
    console.error("join room:", joinError);

    return {
      ok: false,
      message: "Otağa daxil olmaq mümkün olmadı.",
    };
  }

  redirect(`/dashboard/games/room/${code}`);
}

export async function setRoomPrivacyAction(
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const code = normalizeCode(formData.get("code"));

  const isPublic = String(formData.get("isPublic") ?? "") === "true";

  const supabase = getSupabaseServerClient();

  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("id,host_id,status")
    .eq("code", code)
    .maybeSingle();

  if (roomError || !room) {
    return {
      ok: false,
      message: "Otaq tapılmadı.",
    };
  }

  if (room.host_id !== user.id) {
    return {
      ok: false,
      message: "Lobby görünüşünü yalnız host dəyişə bilər.",
    };
  }

  if (room.status === "closed") {
    return {
      ok: false,
      message: "Bağlanmış lobby dəyişdirilə bilməz.",
    };
  }

  const { error } = await supabase
    .from("game_rooms")
    .update({
      is_public: isPublic,
    })
    .eq("id", room.id);

  if (error) {
    console.error("set room privacy:", error);

    return {
      ok: false,
      message: "Lobby görünüşü dəyişdirilə bilmədi.",
    };
  }

  revalidatePath(`/dashboard/games/room/${code}`);

  revalidatePath("/dashboard/games");

  return {
    ok: true,
    message: isPublic ? "Lobby artıq public-dir." : "Lobby artıq private-dır.",
  };
}

export async function kickRoomPlayerAction(
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const code = normalizeCode(formData.get("code"));

  const targetUserId = String(formData.get("userId") ?? "").trim();

  if (!targetUserId) {
    return {
      ok: false,
      message: "Oyunçu tapılmadı.",
    };
  }

  const supabase = getSupabaseServerClient();

  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("id,host_id,status")
    .eq("code", code)
    .maybeSingle();

  if (roomError || !room) {
    return {
      ok: false,
      message: "Otaq tapılmadı.",
    };
  }

  if (room.host_id !== user.id) {
    return {
      ok: false,
      message: "Oyunçunu yalnız host çıxara bilər.",
    };
  }

  if (targetUserId === user.id) {
    return {
      ok: false,
      message: "Host özünü kick edə bilməz.",
    };
  }

  if (room.status === "playing") {
    return {
      ok: false,
      message: "Aktiv match zamanı oyunçu kick edilə bilməz.",
    };
  }

  const { data: targetPlayer, error: targetError } = await supabase
    .from("game_room_players")
    .select("user_id")
    .eq("room_id", room.id)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetError || !targetPlayer) {
    return {
      ok: false,
      message: "Bu oyunçu lobby-də deyil.",
    };
  }

  const { error: banError } = await supabase.from("game_room_bans").upsert(
    {
      room_id: room.id,
      user_id: targetUserId,
      banned_by: user.id,
      reason: "host_kick",
    },
    {
      onConflict: "room_id,user_id",
    },
  );

  if (banError) {
    console.error("kick player ban:", banError);

    return {
      ok: false,
      message: "Oyunçu bloklana bilmədi.",
    };
  }

  const { error: deleteError } = await supabase
    .from("game_room_players")
    .delete()
    .eq("room_id", room.id)
    .eq("user_id", targetUserId);

  if (deleteError) {
    console.error("kick player remove:", deleteError);

    return {
      ok: false,
      message: "Oyunçu lobby-dən çıxarıla bilmədi.",
    };
  }

  await supabase
    .from("game_wager_acceptances")
    .delete()
    .eq("room_id", room.id)
    .eq("user_id", targetUserId);

  revalidatePath(`/dashboard/games/room/${code}`);

  revalidatePath("/dashboard/games");

  return {
    ok: true,
    message:
      "Oyunçu lobby-dən çıxarıldı və bu lobby-yə yenidən daxil ola bilməz.",
  };
}

export async function toggleReadyAction(
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const code = normalizeCode(formData.get("code"));

  const supabase = getSupabaseServerClient();

  const { data: room } = await supabase
    .from("game_rooms")
    .select("id,status")
    .eq("code", code)
    .maybeSingle();

  if (!room) {
    return {
      ok: false,
      message: "Otaq tapılmadı.",
    };
  }

  if (room.status !== "waiting") {
    return {
      ok: false,
      message: "Oyun artıq başlayıb.",
    };
  }

  const { data: player } = await supabase
    .from("game_room_players")
    .select("id,ready")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!player) {
    return {
      ok: false,
      message: "Sən bu otaqda deyilsən.",
    };
  }

  const { error } = await supabase
    .from("game_room_players")
    .update({
      ready: !Boolean(player.ready),
      last_seen: new Date().toISOString(),
    })
    .eq("id", player.id);

  if (error) {
    return {
      ok: false,
      message: "Hazırlıq statusu dəyişdirilə bilmədi.",
    };
  }

  revalidatePath(`/dashboard/games/room/${code}`);

  return {
    ok: true,
    message: !player.ready ? "Hazırsan." : "Hazır statusu söndürüldü.",
  };
}

export async function leaveRoomAction(
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const code = normalizeCode(formData.get("code"));

  const supabase = getSupabaseServerClient();

  const { data: room } = await supabase
    .from("game_rooms")
    .select("id,host_id")
    .eq("code", code)
    .maybeSingle();

  if (!room) {
    redirect("/dashboard/games");
  }

  await supabase
    .from("game_room_players")
    .delete()
    .eq("room_id", room.id)
    .eq("user_id", user.id);

  if (room.host_id === user.id) {
    const { data: nextPlayer } = await supabase
      .from("game_room_players")
      .select("user_id")
      .eq("room_id", room.id)
      .order("joined_at", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (nextPlayer?.user_id) {
      await supabase
        .from("game_rooms")
        .update({
          host_id: nextPlayer.user_id,
        })
        .eq("id", room.id);
    } else {
      await supabase
        .from("game_rooms")
        .update({
          status: "closed",
        })
        .eq("id", room.id);
    }
  }

  redirect("/dashboard/games");
}

export async function startRoomAction(
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const code = normalizeCode(formData.get("code"));

  const supabase = getSupabaseServerClient();

  const { data: room } = await supabase
    .from("game_rooms")
    .select("id,host_id,game,status,settings")
    .eq("code", code)
    .maybeSingle();

  if (!room) {
    return {
      ok: false,
      message: "Otaq tapılmadı.",
    };
  }

  if (room.host_id !== user.id) {
    return {
      ok: false,
      message: "Oyunu yalnız host başlada bilər.",
    };
  }

  if (room.status !== "waiting") {
    return {
      ok: false,
      message: "Oyun artıq başlayıb.",
    };
  }

  const { data: players } = await supabase
    .from("game_room_players")
    .select("user_id,ready,player_data")
    .eq("room_id", room.id);

  if (!players || players.length < 2) {
    return {
      ok: false,
      message: "Başlamaq üçün ən azı 2 oyunçu lazımdır.",
    };
  }

  const everyoneReady = players.every((player: any) => Boolean(player.ready));

  if (!everyoneReady) {
    return {
      ok: false,
      message: "Bütün oyunçular hazır olmalıdır.",
    };
  }

  const requestedBet = Math.floor(Number(formData.get("bet") ?? 0));

  const bet =
    room.game === "reaction" &&
    Number.isFinite(requestedBet) &&
    requestedBet >= 0
      ? Math.min(requestedBet, 1000000)
      : 0;

  const startedAt = Date.now();

  const playerIds = players.map((player: any) => String(player.user_id));

  const initialMatchState =
    room.game === "reaction"
      ? {
          phase: "waiting",
          go_at: new Date(
            startedAt + 1800 + Math.floor(Math.random() * 3200),
          ).toISOString(),
          results: [],
          bet,
        }
      : room.game === "connect4"
        ? {
            phase: "playing",
            board: Array.from({ length: 6 }, () =>
              Array.from({ length: 7 }, () => null),
            ),
            players: playerIds.slice(0, 2),
            turn: playerIds[0],
            moves: 0,
            last_move: null,
            draw: false,
            bet,
          }
        : room.game === "blackjack"
          ? createInitialBlackjackState(
              playerIds,
              bet,
            )
          : isSupabasePartyGame(room.game)
            ? createSupabasePartyMatchState({
                game: room.game,
                code,
                hostId: room.host_id,
                players: players as any,
              })
            : {
                bet,
              };

  const { data: createdMatch, error: matchError } = await supabase
    .from("game_matches")
    .insert({
      room_id: room.id,
      game: room.game,
      status: "playing",
      state: initialMatchState,
      started_at: new Date(startedAt).toISOString(),
    })
    .select("id")
    .single();

  if (matchError || !createdMatch) {
    console.error("start match:", matchError);

    return {
      ok: false,
      message: "Match yaradıla bilmədi.",
    };
  }

  if (bet > 0) {
    const { error: wagerError } = await supabase.rpc("lock_room_game_wagers", {
      p_match_id: createdMatch.id,
      p_amount: bet,
    });

    if (wagerError) {
      console.error("lock room wagers:", wagerError);

      await supabase.from("game_matches").delete().eq("id", createdMatch.id);

      return {
        ok: false,
        message: wagerError.message.includes("insufficient_aura")
          ? "Oyunçulardan birinin kifayət qədər Aura-sı yoxdur."
          : "Aura mərci kilidlənə bilmədi.",
      };
    }
  }

  await supabase
    .from("game_rooms")
    .update({
      status: "playing",
    })
    .eq("id", room.id);

  revalidatePath(`/dashboard/games/room/${code}`);

  return {
    ok: true,
    message: "Oyun başladı.",
  };
}

export async function reactionClickAction(
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const code = normalizeCode(formData.get("code"));
  const supabase = getSupabaseServerClient();

  const { data: room } = await supabase
    .from("game_rooms")
    .select("id,game,status")
    .eq("code", code)
    .maybeSingle();

  if (!room || room.game !== "reaction" || room.status !== "playing") {
    return {
      ok: false,
      message: "Aktiv Reaction oyunu tapılmadı.",
    };
  }

  const { data: membership } = await supabase
    .from("game_room_players")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return {
      ok: false,
      message: "Sən bu otaqda deyilsən.",
    };
  }

  const { data: match } = await supabase
    .from("game_matches")
    .select("id,state,status")
    .eq("room_id", room.id)
    .eq("game", "reaction")
    .eq("status", "playing")
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (!match) {
    return {
      ok: false,
      message: "Aktiv match tapılmadı.",
    };
  }

  const state =
    match.state && typeof match.state === "object"
      ? { ...(match.state as Record<string, any>) }
      : {};

  const results = Array.isArray(state.results) ? [...state.results] : [];

  if (results.some((result: any) => result?.user_id === user.id)) {
    return {
      ok: false,
      message: "Bu raundda artıq basmısan.",
    };
  }

  const goAtMs = Date.parse(String(state.go_at ?? ""));

  if (!Number.isFinite(goAtMs)) {
    return {
      ok: false,
      message: "Reaction siqnalı hazırlanmayıb.",
    };
  }

  const clickedAt = Date.now();
  const falseStart = clickedAt < goAtMs;

  results.push({
    user_id: user.id,
    reaction_ms: falseStart ? 0 : Math.max(0, clickedAt - goAtMs),
    false_start: falseStart,
    clicked_at: new Date(clickedAt).toISOString(),
  });

  const { count } = await supabase
    .from("game_room_players")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("room_id", room.id);

  const finished = results.length >= Number(count ?? 0);

  const validResults = results
    .filter((result: any) => !result.false_start)
    .sort((a: any, b: any) => Number(a.reaction_ms) - Number(b.reaction_ms));

  const winnerId =
    finished && validResults.length ? validResults[0].user_id : null;

  const nextState = {
    ...state,
    phase: finished ? "finished" : (state.phase ?? "waiting"),
    results,
  };

  const { error } = await supabase
    .from("game_matches")
    .update({
      state: nextState,
      ...(finished
        ? {
            status: "finished",
            winner_id: winnerId,
            ended_at: new Date().toISOString(),
          }
        : {}),
    })
    .eq("id", match.id)
    .eq("status", "playing");

  if (error) {
    console.error("reaction click:", error);

    return {
      ok: false,
      message: "Nəticə qeydə alına bilmədi.",
    };
  }

  if (finished) {
    await supabase
      .from("game_rooms")
      .update({
        status: "finished",
      })
      .eq("id", room.id);

    if (winnerId) {
      const { error: settlementError } = await supabase.rpc(
        "settle_game_wagers",
        {
          p_match_id: match.id,
          p_winner_id: winnerId,
        },
      );

      if (settlementError) {
        console.error("reaction wager settlement:", settlementError);
      }
    } else {
      const { error: refundError } = await supabase.rpc("refund_game_wagers", {
        p_match_id: match.id,
      });

      if (refundError) {
        console.error("reaction wager refund:", refundError);
      }
    }
  }

  revalidatePath(`/dashboard/games/room/${code}`);

  return {
    ok: true,
    message: falseStart ? "Çox tez basdın." : `${clickedAt - goAtMs} ms`,
  };
}


async function finishBlackjackMatch(
  supabase: any,
  roomId: string,
  matchId: string,
  state: PartyBlackjackState,
): Promise<{
  ok: boolean;
  state: PartyBlackjackState;
  message?: string;
}> {
  const finishedState = playDealer(state);

  const winners =
    finishedState.winners ?? [];

  const winnerId =
    winners.length === 1
      ? winners[0]
      : null;

  /*
   * Blackjack is NOT winner-takes-all.
   *
   * Every player's locked wager is independently
   * settled against the dealer:
   *
   * win  -> 2x bet returned
   * push -> original bet returned
   * lose -> nothing returned
   */
  const { error: settlementError } =
    await supabase.rpc(
      "settle_blackjack_wagers",
      {
        p_match_id: matchId,
        p_results:
          finishedState.result ?? {},
      },
    );

  if (settlementError) {
    console.error(
      "blackjack settlement:",
      settlementError,
    );

    return {
      ok: false,
      state: finishedState,
      message:
        "Blackjack bitdi, amma Aura mərcləri ödənə bilmədi.",
    };
  }

  const { error: matchError } =
    await supabase
      .from("game_matches")
      .update({
        state: finishedState,
        status: "finished",
        winner_id: winnerId,
        ended_at:
          new Date().toISOString(),
      })
      .eq("id", matchId)
      .eq("status", "playing");

  if (matchError) {
    console.error(
      "blackjack match finish:",
      matchError,
    );

    return {
      ok: false,
      state: finishedState,
      message:
        "Blackjack nəticəsi yadda saxlanıla bilmədi.",
    };
  }

  const { error: roomError } =
    await supabase
      .from("game_rooms")
      .update({
        status: "finished",
      })
      .eq("id", roomId)
      .eq("status", "playing");

  if (roomError) {
    console.error(
      "blackjack room finish:",
      roomError,
    );
  }

  return {
    ok: true,
    state: finishedState,
  };
}

async function blackjackAction(
  formData: FormData,
  action: "hit" | "stand",
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const code = normalizeCode(formData.get("code"));

  const supabase = getSupabaseServerClient();

  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("id,game,status")
    .eq("code", code)
    .maybeSingle();

  if (
    roomError ||
    !room ||
    room.game !== "blackjack"
  ) {
    return {
      ok: false,
      message: "Blackjack otağı tapılmadı.",
    };
  }

  if (room.status !== "playing") {
    return {
      ok: false,
      message: "Blackjack raundu aktiv deyil.",
    };
  }

  const { data: membership, error: membershipError } =
    await supabase
      .from("game_room_players")
      .select("id")
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .maybeSingle();

  if (membershipError || !membership) {
    return {
      ok: false,
      message: "Sən bu otaqda deyilsən.",
    };
  }

  const { data: match, error: matchError } =
    await supabase
      .from("game_matches")
      .select("id,state,status")
      .eq("room_id", room.id)
      .eq("game", "blackjack")
      .eq("status", "playing")
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (matchError || !match) {
    return {
      ok: false,
      message: "Aktiv Blackjack match tapılmadı.",
    };
  }

  const state =
    match.state &&
    typeof match.state === "object"
      ? ({
          ...(match.state as PartyBlackjackState),
          deck: [
            ...((match.state as PartyBlackjackState).deck ?? []),
          ],
          dealer: [
            ...((match.state as PartyBlackjackState).dealer ?? []),
          ],
          players: (
            (match.state as PartyBlackjackState).players ?? []
          ).map((player) => ({
            ...player,
            hand: [...(player.hand ?? [])],
          })),
          winners: [
            ...((match.state as PartyBlackjackState).winners ?? []),
          ],
          result: {
            ...((match.state as PartyBlackjackState).result ?? {}),
          },
        } satisfies PartyBlackjackState)
      : null;

  if (!state) {
    return {
      ok: false,
      message: "Blackjack vəziyyəti oxuna bilmədi.",
    };
  }

  if (state.phase !== "playing") {
    return {
      ok: false,
      message: "Oyunçu mərhələsi artıq bitib.",
    };
  }

  if (state.turn !== user.id) {
    return {
      ok: false,
      message: "Hazırda sənin növbən deyil.",
    };
  }

  const playerIndex = state.players.findIndex(
    (player) => player.user_id === user.id,
  );

  if (playerIndex < 0) {
    return {
      ok: false,
      message: "Blackjack oyunçusu tapılmadı.",
    };
  }

  const player = state.players[playerIndex];

  if (player.status !== "playing") {
    return {
      ok: false,
      message: "Sənin bu raund üçün gedişin artıq bitib.",
    };
  }

  let message = "";

  if (action === "hit") {
    const card = state.deck.pop();

    if (!card) {
      return {
        ok: false,
        message: "Kart dəstində kart qalmayıb.",
      };
    }

    player.hand.push(card);

    const value = blackjackHandValue(player.hand);

    if (value > 21) {
      player.status = "bust";
      message = `Bust — ${value}.`;
    } else if (value === 21) {
      player.status = "stand";
      message = "21!";
    } else {
      /*
       * A normal hit below 21 keeps the same player's turn.
       */
      const { error: hitUpdateError } = await supabase
        .from("game_matches")
        .update({
          state,
        })
        .eq("id", match.id)
        .eq("status", "playing");

      if (hitUpdateError) {
        console.error("blackjack hit:", hitUpdateError);

        return {
          ok: false,
          message: "Kart qeydə alına bilmədi.",
        };
      }

      revalidatePath(`/dashboard/games/room/${code}`);

      return {
        ok: true,
        message: `Kart çəkildi — ${value}.`,
      };
    }
  } else {
    player.status = "stand";

    message = `Stand — ${blackjackHandValue(
      player.hand,
    )}.`;
  }

  /*
   * Bust, 21 and Stand all end this player's turn.
   */
  let nextState = nextBlackjackTurn(state);

  if (nextState.phase === "dealer") {
    const finished = await finishBlackjackMatch(
      supabase,
      room.id,
      match.id,
      nextState,
    );

    revalidatePath(`/dashboard/games/room/${code}`);

    if (!finished.ok) {
      return {
        ok: false,
        message:
          finished.message ??
          "Blackjack nəticəsi tamamlana bilmədi.",
      };
    }

    const myResult =
      finished.state.result[user.id];

    if (myResult === "win") {
      return {
        ok: true,
        message: `${message} Raund bitdi — qazandın.`,
      };
    }

    if (myResult === "push") {
      return {
        ok: true,
        message: `${message} Raund bitdi — push.`,
      };
    }

    return {
      ok: true,
      message: `${message} Raund bitdi.`,
    };
  }

  const { error: updateError } = await supabase
    .from("game_matches")
    .update({
      state: nextState,
    })
    .eq("id", match.id)
    .eq("status", "playing");

  if (updateError) {
    console.error("blackjack action:", updateError);

    return {
      ok: false,
      message: "Blackjack gedişi yadda saxlanıla bilmədi.",
    };
  }

  revalidatePath(`/dashboard/games/room/${code}`);

  return {
    ok: true,
    message,
  };
}

export async function blackjackHitAction(
  formData: FormData,
): Promise<GameActionResult> {
  return blackjackAction(formData, "hit");
}

export async function blackjackStandAction(
  formData: FormData,
): Promise<GameActionResult> {
  return blackjackAction(formData, "stand");
}

export async function connect4MoveAction(
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const code = normalizeCode(formData.get("code"));

  const column = Math.floor(Number(formData.get("column")));

  if (!Number.isInteger(column) || column < 0 || column > 6) {
    return {
      ok: false,
      message: "Sütun düzgün deyil.",
    };
  }

  const supabase = getSupabaseServerClient();

  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("id,game,status")
    .eq("code", code)
    .maybeSingle();

  if (roomError || !room || room.game !== "connect4") {
    return {
      ok: false,
      message: "Connect 4 otağı tapılmadı.",
    };
  }

  if (room.status !== "playing") {
    return {
      ok: false,
      message: "Connect 4 match aktiv deyil.",
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("game_room_players")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return {
      ok: false,
      message: "Sən bu otaqda deyilsən.",
    };
  }

  const { data: match, error: matchError } = await supabase
    .from("game_matches")
    .select("id")
    .eq("room_id", room.id)
    .eq("game", "connect4")
    .eq("status", "playing")
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (matchError || !match) {
    return {
      ok: false,
      message: "Aktiv Connect 4 match tapılmadı.",
    };
  }

  const { data, error: moveError } = await supabase.rpc("play_connect4_move", {
    p_match_id: match.id,
    p_user_id: user.id,
    p_column: column,
  });

  if (moveError) {
    console.error("connect4 move:", moveError);

    const message = moveError.message ?? "";

    if (message.includes("not_your_turn")) {
      return {
        ok: false,
        message: "Hazırda sənin növbən deyil.",
      };
    }

    if (message.includes("column_full")) {
      return {
        ok: false,
        message: "Bu sütun artıq doludur.",
      };
    }

    if (message.includes("match_not_playing")) {
      return {
        ok: false,
        message: "Bu raund artıq bitib.",
      };
    }

    return {
      ok: false,
      message: "Gediş qeydə alına bilmədi.",
    };
  }

  const result =
    data && typeof data === "object"
      ? (data as {
          winner_id?: string | null;
          finished?: boolean;
          draw?: boolean;
        })
      : null;

  if (result?.finished) {
    const { error: roomFinishError } = await supabase
      .from("game_rooms")
      .update({
        status: "finished",
      })
      .eq("id", room.id)
      .eq("status", "playing");

    if (roomFinishError) {
      console.error("connect4 room finish:", roomFinishError);
    }

    if (result.winner_id) {
      const { error: settlementError } = await supabase.rpc(
        "settle_game_wagers",
        {
          p_match_id: match.id,
          p_winner_id: result.winner_id,
        },
      );

      if (settlementError) {
        console.error("connect4 settlement:", settlementError);

        return {
          ok: false,
          message: "Oyun bitdi, amma Aura potu ödənə bilmədi.",
        };
      }
    } else if (result.draw) {
      const { error: refundError } = await supabase.rpc("refund_game_wagers", {
        p_match_id: match.id,
      });

      if (refundError) {
        console.error("connect4 refund:", refundError);

        return {
          ok: false,
          message: "Heç-heçə qeydə alındı, amma Aura geri qaytarıla bilmədi.",
        };
      }
    }
  }

  revalidatePath(`/dashboard/games/room/${code}`);

  if (result?.winner_id) {
    return {
      ok: true,
      message: result.winner_id === user.id ? "Qazandın." : "Oyun bitdi.",
    };
  }

  if (result?.draw) {
    return {
      ok: true,
      message: "Heç-heçə. Mərclər geri qaytarıldı.",
    };
  }

  return {
    ok: true,
    message: "Gediş edildi.",
  };
}


export async function reopenRoomForRematchAction(
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const code = normalizeCode(formData.get("code"));

  const supabase = getSupabaseServerClient();

  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("id,host_id,game,status")
    .eq("code", code)
    .maybeSingle();

  if (roomError || !room) {
    return {
      ok: false,
      message: "Otaq tapılmadı.",
    };
  }

  if (room.host_id !== user.id) {
    return {
      ok: false,
      message: "Rematch-i yalnız host başlada bilər.",
    };
  }

  if (room.status !== "finished") {
    return {
      ok: false,
      message: "Rematch yalnız oyun bitdikdən sonra açıla bilər.",
    };
  }

  const { data: players, error: playersError } = await supabase
    .from("game_room_players")
    .select("user_id")
    .eq("room_id", room.id);

  if (playersError) {
    console.error("rematch players:", playersError);

    return {
      ok: false,
      message: "Oyunçular yoxlanıla bilmədi.",
    };
  }

  if (!players || players.length < 2) {
    return {
      ok: false,
      message: "Rematch üçün ən azı 2 oyunçu lazımdır.",
    };
  }

  const { error: readyError } = await supabase
    .from("game_room_players")
    .update({
      ready: false,
    })
    .eq("room_id", room.id);

  if (readyError) {
    console.error("rematch ready reset:", readyError);

    return {
      ok: false,
      message: "Oyunçu statusları sıfırlana bilmədi.",
    };
  }

  const { error: roomUpdateError } = await supabase
    .from("game_rooms")
    .update({
      status: "waiting",
    })
    .eq("id", room.id)
    .eq("status", "finished");

  if (roomUpdateError) {
    console.error("rematch room reopen:", roomUpdateError);

    return {
      ok: false,
      message: "Lobby rematch üçün açıla bilmədi.",
    };
  }

  revalidatePath(`/dashboard/games/room/${code}`);

  return {
    ok: true,
    message:
      "Lobby rematch üçün hazırdır. Yeni mərc seç və oyunu yenidən başlat.",
  };
}

export async function reactionRematchAction(
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const code = normalizeCode(formData.get("code"));

  const requestedBet = Math.floor(Number(formData.get("bet") ?? 0));

  const bet =
    Number.isFinite(requestedBet) && requestedBet >= 0
      ? Math.min(requestedBet, 1000000)
      : 0;

  const supabase = getSupabaseServerClient();

  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("id,host_id,game,status")
    .eq("code", code)
    .maybeSingle();

  if (roomError || !room || room.game !== "reaction") {
    return {
      ok: false,
      message: "Reaction otağı tapılmadı.",
    };
  }

  if (room.host_id !== user.id) {
    return {
      ok: false,
      message: "Rematch-i yalnız host təklif edə bilər.",
    };
  }

  if (room.status !== "finished") {
    return {
      ok: false,
      message: "Rematch yalnız raund bitdikdən sonra təklif edilə bilər.",
    };
  }

  const { count, error: countError } = await supabase
    .from("game_room_players")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("room_id", room.id);

  if (countError) {
    return {
      ok: false,
      message: "Oyunçular yoxlanıla bilmədi.",
    };
  }

  if (Number(count ?? 0) < 2) {
    return {
      ok: false,
      message: "Rematch üçün ən azı 2 oyunçu lazımdır.",
    };
  }

  const { error: waitingError } = await supabase
    .from("game_rooms")
    .update({
      status: "waiting",
    })
    .eq("id", room.id)
    .eq("status", "finished");

  if (waitingError) {
    console.error("reaction rematch waiting:", waitingError);

    return {
      ok: false,
      message: "Rematch mərhələsi açıla bilmədi.",
    };
  }

  /*
   * Accepting the rematch proposal is itself the
   * readiness confirmation, so mark the current
   * room members ready for the new round.
   */
  const { error: readyError } = await supabase
    .from("game_room_players")
    .update({
      ready: true,
    })
    .eq("room_id", room.id);

  if (readyError) {
    console.error("reaction rematch ready:", readyError);
  }

  /*
   * Create a normal wager proposal.
   *
   * Host is accepted automatically.
   * Everybody else must explicitly accept.
   * Nobody is charged here.
   */
  const { data: proposalId, error: proposalError } = await supabase.rpc(
    "propose_game_wager",
    {
      p_room_id: room.id,
      p_user_id: user.id,
      p_amount: bet,
    },
  );

  if (proposalError) {
    console.error("reaction rematch proposal:", proposalError);

    await supabase
      .from("game_rooms")
      .update({
        status: "finished",
      })
      .eq("id", room.id)
      .eq("status", "waiting");

    return {
      ok: false,
      message: proposalError.message.includes("invalid_wager")
        ? "Mərc məbləği düzgün deyil."
        : "Rematch təklifi yaradıla bilmədi.",
    };
  }

  revalidatePath(`/dashboard/games/room/${code}`);

  return {
    ok: true,
    message:
      bet > 0
        ? `${bet.toLocaleString(
            "en-US",
          )} Aura üçün rematch təklif edildi. Digər oyunçuların cavabı gözlənilir.`
        : "Pulsuz rematch təklif edildi. Digər oyunçuların cavabı gözlənilir.",
    code: String(proposalId ?? ""),
  };
}

/* ============================================================
 * MULTIPLAYER WAGER CONTRACT
 * ============================================================
 */

export async function proposeWagerAction(
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const code = normalizeCode(formData.get("code"));

  const requestedAmount = Number(formData.get("amount") ?? 0);

  const amount = Math.floor(requestedAmount);

  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) {
    return {
      ok: false,
      message: "Mərc 0–1,000,000 Aura arasında olmalıdır.",
    };
  }

  const supabase = getSupabaseServerClient();

  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("id,host_id,status")
    .eq("code", code)
    .maybeSingle();

  if (roomError || !room) {
    return {
      ok: false,
      message: "Otaq tapılmadı.",
    };
  }

  if (room.host_id !== user.id) {
    return {
      ok: false,
      message: "Mərc təklifini yalnız host dəyişə bilər.",
    };
  }

  if (room.status !== "waiting") {
    return {
      ok: false,
      message: "Aktiv oyun zamanı mərc dəyişdirilə bilməz.",
    };
  }

  const { count, error: countError } = await supabase
    .from("game_room_players")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("room_id", room.id);

  if (countError) {
    return {
      ok: false,
      message: "Oyunçular yoxlanıla bilmədi.",
    };
  }

  if (Number(count ?? 0) < 2) {
    return {
      ok: false,
      message: "Mərc üçün ən azı 2 oyunçu lazımdır.",
    };
  }

  const { error } = await supabase.rpc("propose_game_wager", {
    p_room_id: room.id,
    p_user_id: user.id,
    p_amount: amount,
  });

  if (error) {
    console.error(
      "propose_game_wager FULL ERROR",
      JSON.stringify(
        {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          name: error.name,
        },
        null,
        2,
      ),
    );

    if (error.message.includes("host_only")) {
      return {
        ok: false,
        message: "Mərci yalnız host təklif edə bilər.",
      };
    }

    if (error.message.includes("room_not_waiting")) {
      return {
        ok: false,
        message: "Oyun artıq başlayıb.",
      };
    }

    if (error.message.includes("invalid_wager")) {
      return {
        ok: false,
        message: "Mərc məbləği düzgün deyil.",
      };
    }

    return {
      ok: false,
      message: "Mərc təklifi yaradıla bilmədi.",
    };
  }

  revalidatePath(`/dashboard/games/room/${code}`);

  return {
    ok: true,
    message:
      amount === 0
        ? "Pulsuz oyun təklif edildi."
        : `${amount.toLocaleString("en-US")} Aura mərc təklif edildi.`,
  };
}

async function tryStartAcceptedWager(
  proposalId: string,
): Promise<GameActionResult | null> {
  const supabase = getSupabaseServerClient();

  const { data: proposal, error: proposalError } = await supabase
    .from("game_wager_proposals")
    .select("id,room_id,status")
    .eq("id", proposalId)
    .maybeSingle();

  if (proposalError || !proposal || proposal.status !== "pending") {
    return null;
  }

  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("code,status")
    .eq("id", proposal.room_id)
    .maybeSingle();

  if (roomError || !room || room.status !== "waiting") {
    return null;
  }

  const { data: players, error: playersError } = await supabase
    .from("game_room_players")
    .select("user_id")
    .eq("room_id", proposal.room_id);

  if (playersError || !players || players.length < 2) {
    return null;
  }

  const { data: acceptances, error: acceptancesError } = await supabase
    .from("game_wager_acceptances")
    .select("user_id,accepted,can_afford")
    .eq("proposal_id", proposalId);

  if (acceptancesError) {
    console.error("auto-start acceptance check:", acceptancesError);

    return null;
  }

  const everyoneAccepted = players.every((player: any) =>
    (acceptances ?? []).some(
      (acceptance: any) =>
        String(acceptance.user_id) === String(player.user_id) &&
        acceptance.accepted === true &&
        acceptance.can_afford === true,
    ),
  );

  if (!everyoneAccepted) {
    return null;
  }

  return startAcceptedRoom(normalizeCode(room.code), proposalId);
}

export async function acceptWagerAction(
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const proposalId = String(formData.get("proposalId") ?? "").trim();

  if (!proposalId) {
    return {
      ok: false,
      message: "Mərc təklifi tapılmadı.",
    };
  }

  const supabase = getSupabaseServerClient();

  const { error } = await supabase.rpc("respond_game_wager", {
    p_proposal_id: proposalId,
    p_user_id: user.id,
    p_accept: true,
  });

  if (error) {
    console.error("accept wager:", error);

    if (error.message.includes("insufficient_aura")) {
      return {
        ok: false,
        message: "Bu mərci qəbul etmək üçün kifayət qədər Aura-n yoxdur.",
      };
    }

    if (error.message.includes("not_in_room")) {
      return {
        ok: false,
        message: "Sən bu otaqda deyilsən.",
      };
    }

    if (error.message.includes("proposal_not_active")) {
      return {
        ok: false,
        message: "Bu mərc təklifi artıq aktiv deyil.",
      };
    }

    return {
      ok: false,
      message: "Mərc qəbul edilə bilmədi.",
    };
  }

  /*
   * IMPORTANT:
   * Accepting the wager only accepts the wager.
   * It MUST NOT start the match.
   *
   * Match start is controlled separately after every player
   * has pressed Hazıram.
   */
  revalidatePath("/dashboard/games");

  return {
    ok: true,
    message: "Mərc qəbul edildi. İndi Hazıram düyməsini bas.",
  };
}

export async function declineWagerAction(
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const proposalId = String(formData.get("proposalId") ?? "").trim();

  if (!proposalId) {
    return {
      ok: false,
      message: "Mərc təklifi tapılmadı.",
    };
  }

  const supabase = getSupabaseServerClient();

  const { error } = await supabase.rpc("respond_game_wager", {
    p_proposal_id: proposalId,
    p_user_id: user.id,
    p_accept: false,
  });

  if (error) {
    console.error("decline wager:", error);

    if (error.message.includes("not_in_room")) {
      return {
        ok: false,
        message: "Sən bu otaqda deyilsən.",
      };
    }

    if (error.message.includes("proposal_not_active")) {
      return {
        ok: false,
        message: "Bu mərc təklifi artıq aktiv deyil.",
      };
    }

    return {
      ok: false,
      message: "Mərc rədd edilə bilmədi.",
    };
  }

  revalidatePath("/dashboard/games");

  return {
    ok: true,
    message: "Rematch rədd edildi. Otaqdan çıxarıldın.",
  };
}

async function startAcceptedRoom(
  code: string,
  proposalId: string,
  expectedHostId?: string,
): Promise<GameActionResult> {
  if (!proposalId) {
    return {
      ok: false,
      message: "Aktiv mərc təklifi tapılmadı.",
    };
  }

  if (!proposalId) {
    return {
      ok: false,
      message: "Aktiv mərc təklifi tapılmadı.",
    };
  }

  const supabase = getSupabaseServerClient();

  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("id,host_id,game,status")
    .eq("code", code)
    .maybeSingle();

  if (roomError || !room) {
    return {
      ok: false,
      message: "Otaq tapılmadı.",
    };
  }

  if (expectedHostId && room.host_id !== expectedHostId) {
    return {
      ok: false,
      message: "Oyunu yalnız host başlada bilər.",
    };
  }

  /*
   * HARD READY GATE
   *
   * Even if this function is accidentally called from another
   * client/server path, a match cannot begin until every player
   * in the room has explicitly pressed Hazıram.
   */
  const { data: readyPlayers, error: readyPlayersError } = await supabase
    .from("game_room_players")
    .select("user_id,ready")
    .eq("room_id", room.id);

  if (readyPlayersError) {
    console.error("accepted wager ready check:", readyPlayersError);

    return {
      ok: false,
      message: "Hazır statusları yoxlanıla bilmədi.",
    };
  }

  if (!readyPlayers || readyPlayers.length < 2) {
    return {
      ok: false,
      message: "Başlamaq üçün ən azı 2 oyunçu lazımdır.",
    };
  }

  const everyoneReady = readyPlayers.every((player: any) =>
    Boolean(player.ready),
  );

  if (!everyoneReady) {
    return {
      ok: false,
      message: "Bütün oyunçular əvvəlcə Hazıram düyməsini basmalıdır.",
    };
  }

  if (room.status !== "waiting") {
    return {
      ok: false,
      message: "Oyun artıq başlayıb.",
    };
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("game_wager_proposals")
    .select("id,room_id,amount,status,game")
    .eq("id", proposalId)
    .eq("room_id", room.id)
    .maybeSingle();

  if (proposalError || !proposal) {
    return {
      ok: false,
      message: "Mərc təklifi bu otağa aid deyil.",
    };
  }

  if (proposal.status !== "pending") {
    return {
      ok: false,
      message: "Bu mərc təklifi artıq aktiv deyil.",
    };
  }

  if (proposal.game !== room.game) {
    return {
      ok: false,
      message: "Mərc başqa oyun üçün yaradılıb.",
    };
  }

  const { data: players } = await supabase
    .from("game_room_players")
    .select("user_id,ready,player_data")
    .eq("room_id", room.id);

  if (!players || players.length < 2) {
    return {
      ok: false,
      message: "Başlamaq üçün ən azı 2 oyunçu lazımdır.",
    };
  }

  const { data: activePlayers, error: activePlayersError } = await supabase
    .from("game_room_players")
    .select("user_id,last_seen")
    .eq("room_id", room.id)
    .gte("last_seen", activeRoomCutoff());

  if (activePlayersError) {
    console.error("start accepted room active players:", activePlayersError);

    return {
      ok: false,
      message: "Aktiv oyunçular yoxlanıla bilmədi.",
    };
  }

  const activePlayerIds = new Set(
    (activePlayers ?? []).map((player: any) => String(player.user_id)),
  );

  const everyoneActive = players.every((player: any) =>
    activePlayerIds.has(String(player.user_id)),
  );

  if (!everyoneActive) {
    return {
      ok: false,
      message: "Oyunçulardan biri otaqdan çıxıb və ya bağlantısı kəsilib.",
    };
  }

  const { data: acceptances } = await supabase
    .from("game_wager_acceptances")
    .select("user_id,accepted,can_afford")
    .eq("proposal_id", proposalId);

  const everyoneAccepted = players.every((player: any) =>
    (acceptances ?? []).some(
      (acceptance: any) =>
        acceptance.user_id === player.user_id &&
        acceptance.accepted === true &&
        acceptance.can_afford === true,
    ),
  );

  if (!everyoneAccepted) {
    return {
      ok: false,
      message: "Bütün oyunçular mərci qəbul etməlidir.",
    };
  }

  /*
   * Acceptance is authoritative consent to start the match.
   * Keep lobby readiness synchronized, but do not make the
   * start depend on a second asynchronous ready-state write.
   */
  const { error: readySyncError } = await supabase
    .from("game_room_players")
    .update({
      ready: true,
    })
    .eq("room_id", room.id);

  if (readySyncError) {
    console.error("accepted wager ready sync:", readySyncError);
  }

  const now = Date.now();

  const amount = Math.max(0, Math.floor(Number(proposal.amount ?? 0)));

  const playerIds = players.map((player: any) => String(player.user_id));

  const state =
    room.game === "reaction"
      ? {
          phase: "waiting",
          go_at: new Date(
            now + 1800 + Math.floor(Math.random() * 3200),
          ).toISOString(),
          results: [],
          bet: amount,
        }
      : room.game === "connect4"
        ? {
            phase: "playing",
            board: Array.from({ length: 6 }, () =>
              Array.from({ length: 7 }, () => null),
            ),
            players: playerIds.slice(0, 2),
            turn: playerIds[0],
            moves: 0,
            last_move: null,
            draw: false,
            bet: amount,
          }
        : room.game === "blackjack"
          ? createInitialBlackjackState(
              playerIds,
              amount,
            )
          : isSupabasePartyGame(room.game)
            ? createSupabasePartyMatchState({
                game: room.game,
                code,
                hostId: room.host_id,
                players: players as any,
              })
            : {
                bet: amount,
              };

  const { data: match, error: matchError } = await supabase
    .from("game_matches")
    .insert({
      room_id: room.id,
      game: room.game,
      status: "playing",
      state,
      started_at: new Date(now).toISOString(),
    })
    .select("id")
    .single();

  if (matchError || !match) {
    console.error("accepted match create:", matchError);

    return {
      ok: false,
      message: "Match yaradıla bilmədi.",
    };
  }

  const { data: pot, error: lockError } = await supabase.rpc(
    "lock_accepted_game_wagers",
    {
      p_proposal_id: proposalId,
      p_match_id: match.id,
    },
  );

  if (lockError) {
    console.error("lock accepted wagers:", lockError);

    await supabase.from("game_matches").delete().eq("id", match.id);

    if (lockError.message.includes("insufficient_aura")) {
      return {
        ok: false,
        message:
          "Oyunçulardan birinin artıq kifayət qədər Aura-sı yoxdur. Balanslar yenidən yoxlanıldı.",
      };
    }

    if (lockError.message.includes("not_everyone_accepted")) {
      return {
        ok: false,
        message: "Bütün oyunçular mərci qəbul etməyib.",
      };
    }

    if (lockError.message.includes("not_enough_players")) {
      return {
        ok: false,
        message: "Başlamaq üçün ən azı 2 oyunçu lazımdır.",
      };
    }

    return {
      ok: false,
      message: "Mərclər təhlükəsiz şəkildə kilidlənə bilmədi.",
    };
  }

  const { error: roomUpdateError } = await supabase
    .from("game_rooms")
    .update({
      status: "playing",
    })
    .eq("id", room.id)
    .eq("status", "waiting");

  if (roomUpdateError) {
    console.error("room playing update:", roomUpdateError);

    return {
      ok: false,
      message: "Match yaradıldı, amma otaq statusu yenilənmədi.",
    };
  }

  revalidatePath(`/dashboard/games/room/${code}`);

  return {
    ok: true,
    message:
      amount > 0
        ? `Match başladı — ${Number(pot ?? 0).toLocaleString(
            "en-US",
          )} Aura potda kilidləndi.`
        : "Pulsuz match başladı.",
  };
}

export async function startAcceptedRoomAction(
  formData: FormData,
): Promise<GameActionResult> {
  const user = await getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const code = normalizeCode(formData.get("code"));

  const proposalId = String(formData.get("proposalId") ?? "").trim();

  return startAcceptedRoom(code, proposalId, user.id);
}


export async function partyMatchAction(
  rawCode: string,
  action: string,
  value?: unknown,
) {
  const user = await getUser();

  if (!user) {
    return {
      ok: false as const,
      message: "Sessiya tapılmadı.",
    };
  }

  const code =
    normalizeCode(rawCode);

  const supabase =
    getSupabaseServerClient();

  const {
    data: room,
    error: roomError,
  } = await supabase
    .from("game_rooms")
    .select("id,code,game,status")
    .eq("code", code)
    .maybeSingle();

  if (
    roomError ||
    !room
  ) {
    return {
      ok: false as const,
      message: "Otaq tapılmadı.",
    };
  }

  if (
    !isSupabasePartyGame(
      room.game,
    )
  ) {
    return {
      ok: false as const,
      message: "Bu party oyunu deyil.",
    };
  }

  if (
    room.status !==
      "playing"
  ) {
    return {
      ok: false as const,
      message: "Match aktiv deyil.",
    };
  }

  const {
    data: membership,
  } = await supabase
    .from("game_room_players")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return {
      ok: false as const,
      message: "Sən bu otaqda deyilsən.",
    };
  }

  const {
    data: match,
    error: matchError,
  } = await supabase
    .from("game_matches")
    .select("id,status,state")
    .eq("room_id", room.id)
    .eq("game", room.game)
    .order(
      "created_at",
      {
        ascending: false,
      },
    )
    .limit(1)
    .maybeSingle();

  if (
    matchError ||
    !match ||
    match.status !==
      "playing"
  ) {
    return {
      ok: false as const,
      message: "Aktiv match tapılmadı.",
    };
  }

  const partyRoom =
    match.state as PartyRoomState;

  if (
    !partyRoom ||
    !Array.isArray(
      partyRoom.players,
    )
  ) {
    return {
      ok: false as const,
      message: "Match state düzgün deyil.",
    };
  }

  const player =
    partyRoom.players.find(
      (entry) =>
        entry.id === user.id,
    );

  if (!player) {
    return {
      ok: false as const,
      message: "Match oyunçusu tapılmadı.",
    };
  }

  performPartyAction(
    partyRoom,
    user.id,
    action,
    value,
  );

  partyRoom.updatedAt =
    Date.now();

  const finished =
    partyRoom.status ===
    "finished";

  const winner =
    finished
      ? getPartyWinner(
          partyRoom,
        )
      : null;

  const {
    error: updateError,
  } = await supabase
    .from("game_matches")
    .update({
      state: partyRoom,
      status: finished
        ? "finished"
        : "playing",
      winner_id:
        winner?.id ??
        null,
      ended_at: finished
        ? new Date().toISOString()
        : null,
    })
    .eq("id", match.id);

  if (updateError) {
    console.error(
      "party match update:",
      updateError,
    );

    return {
      ok: false as const,
      message: "Match yenilənə bilmədi.",
    };
  }

  await Promise.all(
    partyRoom.players.map(
      (entry) =>
        supabase
          .from("game_room_players")
          .update({
            score:
              entry.score,
          })
          .eq(
            "room_id",
            room.id,
          )
          .eq(
            "user_id",
            entry.id,
          ),
    ),
  );

  if (finished) {
    await supabase
      .from("game_rooms")
      .update({
        status: "finished",
      })
      .eq("id", room.id);
  }

  revalidatePath(
    `/dashboard/games/room/${code}`,
  );

  return {
    ok: true as const,
    message:
      finished
        ? "Match bitdi."
        : "Hərəkət qeydə alındı.",
    state: partyRoom,
  };
}
