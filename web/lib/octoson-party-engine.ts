import {
  MICRO_GAMES,
  PARTY_GAMES,
  PIXEL_PROMPTS,
  UNDERCOVER_WORDS,
  VAULT_PUZZLES,
  createInitialGameState,
  randomMicroGame,
  type PartyRoomState,
} from "@/lib/octoson-party-games";

function shuffle<T>(
  values: T[]
): T[] {
  const copy = [...values];

  for (
    let i = copy.length - 1;
    i > 0;
    i -= 1
  ) {
    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [copy[i], copy[j]] = [
      copy[j],
      copy[i],
    ];
  }

  return copy;
}

export function startPartyGame(
  room: PartyRoomState
) {
  const config =
    PARTY_GAMES[room.game];

  if (
    room.players.length <
    config.minPlayers
  ) {
    return {
      ok: false,
      message:
        `Minimum ${config.minPlayers} oyunçu lazımdır.`,
    };
  }

  room.status = "playing";
  room.round = 1;

  for (const player of room.players) {
    player.score = 0;
    player.alive = true;
  }

  room.gameState =
    createInitialGameState(room.game);

  if (
    room.game === "undercover"
  ) {
    setupUndercover(room);
  }

  if (
    room.game === "pixel-wars"
  ) {
    setupPixelWars(room);
  }

  if (room.game === "vault") {
    setupVault(room);
  }

  if (
    room.game === "king-hill"
  ) {
    setupKingChallenge(room);
  }

  if (
    room.game === "octo-party"
  ) {
    setupOctoRound(room);
  }

  return {
    ok: true,
    message: "Oyun başladı.",
  };
}

function setupUndercover(
  room: PartyRoomState
) {
  const pair =
    UNDERCOVER_WORDS[
      Math.floor(
        Math.random() *
          UNDERCOVER_WORDS.length
      )
    ];

  const undercover =
    room.players[
      Math.floor(
        Math.random() *
          room.players.length
      )
    ];

  room.gameState = {
    phase: "clues",
    mainWord: pair[0],
    undercoverWord: pair[1],
    undercoverId:
      undercover.id,
    clues: {},
    votes: {},
  };
}

function setupPixelWars(
  room: PartyRoomState
) {
  room.gameState = {
    phase: "drawing",
    prompt:
      PIXEL_PROMPTS[
        Math.floor(
          Math.random() *
            PIXEL_PROMPTS.length
        )
      ],
    canvases: {},
    votes: {},
    deadline:
      Date.now() + 60_000,
  };
}

function setupVault(
  room: PartyRoomState
) {
  const puzzles =
    shuffle(VAULT_PUZZLES).slice(
      0,
      4
    );

  room.gameState = {
    stage: 0,
    strikes: 0,
    startedAt: Date.now(),
    solved: [],
    puzzles,
  };
}

function setupKingChallenge(
  room: PartyRoomState
) {
  const type =
    randomMicroGame();

  room.gameState = {
    ...(room.gameState ?? {}),
    challenge: type,
    challengeStartedAt:
      Date.now(),
    answers: {},
    target:
      Math.floor(
        Math.random() * 90
      ) + 10,
    round:
      Number(
        room.gameState.round ?? 0
      ) + 1,
  };
}

function setupOctoRound(
  room: PartyRoomState
) {
  room.gameState = {
    ...(room.gameState ?? {}),
    miniGame:
      MICRO_GAMES[
        Math.floor(
          Math.random() *
            MICRO_GAMES.length
        )
      ],
    miniRound:
      Number(
        room.gameState
          .miniRound ?? 0
      ) + 1,
    answers: {},
    roundStartedAt:
      Date.now(),
    target:
      Math.floor(
        Math.random() * 90
      ) + 10,
    totalRounds: 8,
  };
}

function lastButtonAction(
  room: PartyRoomState,
  playerId: string,
  action: string
) {
  const state =
    room.gameState as {
      turn: number;
      pressure: number;
      explosionAt: number;
      history: string[];
    };

  const alive =
    room.players.filter(
      (player) => player.alive
    );

  if (alive.length <= 1) {
    room.status = "finished";

    if (alive[0]) {
      alive[0].score += 5;
    }

    return;
  }

  const current =
    alive[
      state.turn %
        alive.length
    ];

  if (
    current?.id !== playerId
  ) {
    return;
  }

  if (action === "pass") {
    current.score =
      Math.max(
        0,
        current.score - 1
      );

    state.history.push(
      `${current.name} keçdi`
    );
  } else {
    state.pressure += 1;
    current.score += 1;

    state.history.push(
      `${current.name} düyməyə basdı`
    );

    if (
      state.pressure >=
      state.explosionAt
    ) {
      current.alive = false;

      state.history.push(
        `💥 ${current.name} partladı`
      );

      state.pressure = 0;

      state.explosionAt =
        4 +
        Math.floor(
          Math.random() * 12
        );
    }
  }

  state.turn += 1;
}

function undercoverAction(
  room: PartyRoomState,
  playerId: string,
  action: string,
  value?: unknown
) {
  const state =
    room.gameState as any;

  if (action === "clue") {
    const clue =
      String(value ?? "")
        .trim()
        .slice(0, 80);

    if (!clue) return;

    state.clues[playerId] =
      clue;

    if (
      Object.keys(
        state.clues
      ).length >=
      room.players.length
    ) {
      state.phase = "vote";
    }

    return;
  }

  if (
    action === "vote" &&
    state.phase === "vote"
  ) {
    const target =
      String(value ?? "");

    if (
      !room.players.some(
        (player) =>
          player.id === target
      )
    ) {
      return;
    }

    state.votes[playerId] =
      target;

    if (
      Object.keys(
        state.votes
      ).length <
      room.players.length
    ) {
      return;
    }

    const counts:
      Record<string, number> =
      {};

    for (
      const targetId of Object.values(
        state.votes
      ) as string[]
    ) {
      counts[targetId] =
        (counts[targetId] ?? 0) +
        1;
    }

    const accused =
      Object.entries(counts).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0];

    const found =
      accused ===
      state.undercoverId;

    for (
      const player of room.players
    ) {
      if (
        found &&
        player.id !==
          state.undercoverId
      ) {
        player.score += 3;
      }

      if (
        !found &&
        player.id ===
          state.undercoverId
      ) {
        player.score += 6;
      }
    }

    state.phase = "result";
    state.accused = accused;
    state.found = found;

    room.status = "finished";
  }
}

function pixelWarsAction(
  room: PartyRoomState,
  playerId: string,
  action: string,
  value?: unknown
) {
  const state =
    room.gameState as any;

  if (
    action === "submit"
  ) {
    const pixels =
      Array.isArray(value)
        ? value
            .slice(0, 100)
            .map(Boolean)
        : [];

    if (
      pixels.length !== 100
    ) {
      return;
    }

    state.canvases[playerId] =
      pixels;

    if (
      Object.keys(
        state.canvases
      ).length >=
      room.players.length
    ) {
      state.phase = "vote";
    }

    return;
  }

  if (
    action === "vote" &&
    state.phase === "vote"
  ) {
    const target =
      String(value ?? "");

    if (
      target === playerId ||
      !state.canvases[target]
    ) {
      return;
    }

    state.votes[playerId] =
      target;

    const eligible =
      room.players.filter(
        (player) =>
          Boolean(
            state.canvases[
              player.id
            ]
          )
      );

    if (
      Object.keys(
        state.votes
      ).length <
      Math.max(
        1,
        eligible.length
      )
    ) {
      return;
    }

    const counts:
      Record<string, number> =
      {};

    for (
      const targetId of Object.values(
        state.votes
      ) as string[]
    ) {
      counts[targetId] =
        (counts[targetId] ?? 0) +
        1;
    }

    const winnerId =
      Object.entries(counts).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0];

    const winner =
      room.players.find(
        (player) =>
          player.id === winnerId
      );

    if (winner) {
      winner.score += 5;
    }

    state.winnerId = winnerId;
    state.phase = "result";

    room.status = "finished";
  }
}

function vaultAction(
  room: PartyRoomState,
  playerId: string,
  action: string,
  value?: unknown
) {
  if (action !== "answer") {
    return;
  }

  const state =
    room.gameState as any;

  const puzzles =
    state.puzzles ?? [];

  const puzzle =
    puzzles[state.stage];

  if (!puzzle) {
    return;
  }

  const answer =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (
    answer ===
    String(
      puzzle.answer
    ).toLowerCase()
  ) {
    state.solved.push(
      state.stage
    );

    state.stage += 1;

    const player =
      room.players.find(
        (entry) =>
          entry.id === playerId
      );

    if (player) {
      player.score += 2;
    }

    if (
      state.stage >=
      puzzles.length
    ) {
      room.status =
        "finished";

      if (player) {
        player.score += 5;
      }

      state.finishedAt =
        Date.now();
    }
  } else {
    state.strikes += 1;

    if (state.strikes >= 5) {
      room.status =
        "finished";
    }
  }
}

function speedChallengeAction(
  room: PartyRoomState,
  playerId: string,
  action: string,
  value: unknown,
  octo = false
) {
  if (action !== "answer") {
    return;
  }

  const state =
    room.gameState as any;

  if (
    state.answers[playerId] !=
    null
  ) {
    return;
  }

  const elapsed =
    Date.now() -
    Number(
      octo
        ? state.roundStartedAt
        : state.challengeStartedAt
    );

  const answer =
    String(value ?? "");

  let correct = false;

  switch (
    octo
      ? state.miniGame
      : state.challenge
  ) {
    case "reaction":
      correct =
        elapsed > 800;
      break;

    case "odd":
      correct =
        answer === "odd";
      break;

    case "number":
      correct =
        Number(answer) ===
        Number(state.target);
      break;

    case "memory":
      correct =
        answer === "octo";
      break;

    case "timing":
      correct =
        elapsed >= 1800 &&
        elapsed <= 3200;
      break;

    case "color":
      correct =
        answer === "cyan";
      break;
  }

  state.answers[playerId] = {
    correct,
    elapsed,
  };

  const player =
    room.players.find(
      (entry) =>
        entry.id === playerId
    );

  if (correct && player) {
    const speedBonus =
      Math.max(
        1,
        5 -
          Math.floor(
            elapsed / 1000
          )
      );

    player.score += speedBonus;

    if (!octo) {
      state.kingId =
        playerId;
    }
  }

  if (
    Object.keys(
      state.answers
    ).length >=
    room.players.length
  ) {
    if (octo) {
      if (
        Number(
          state.miniRound
        ) >=
        Number(
          state.totalRounds ?? 8
        )
      ) {
        room.status =
          "finished";
      } else {
        setupOctoRound(room);
      }
    } else if (
      Number(state.round) >= 8
    ) {
      room.status =
        "finished";
    } else {
      setupKingChallenge(room);
    }
  }
}

export function performPartyAction(
  room: PartyRoomState,
  playerId: string,
  action: string,
  value?: unknown
) {
  if (
    room.status !== "playing"
  ) {
    return;
  }

  switch (room.game) {
    case "last-button":
      lastButtonAction(
        room,
        playerId,
        action
      );
      break;

    case "undercover":
      undercoverAction(
        room,
        playerId,
        action,
        value
      );
      break;

    case "pixel-wars":
      pixelWarsAction(
        room,
        playerId,
        action,
        value
      );
      break;

    case "vault":
      vaultAction(
        room,
        playerId,
        action,
        value
      );
      break;

    case "king-hill":
      speedChallengeAction(
        room,
        playerId,
        action,
        value,
        false
      );
      break;

    case "octo-party":
      speedChallengeAction(
        room,
        playerId,
        action,
        value,
        true
      );
      break;
  }
}
