export const PARTY_GAMES = {
  "last-button": {
    key: "last-button",
    title: "Last Button",
    description:
      "Düyməyə bas və partlamadan əvvəl oyunda qal.",
    minPlayers: 2,
    maxPlayers: 8,
    icon: "💣",
    accent: "rose",
  },

  undercover: {
    key: "undercover",
    title: "Undercover",
    description:
      "Hamının sözünü tap, undercover-i ifşa et.",
    minPlayers: 3,
    maxPlayers: 10,
    icon: "🕵️",
    accent: "violet",
  },

  "pixel-wars": {
    key: "pixel-wars",
    title: "Pixel Wars",
    description:
      "Prompt-a uyğun pixel art çək və səsverməni qazan.",
    minPlayers: 2,
    maxPlayers: 8,
    icon: "🎨",
    accent: "cyan",
  },

  vault: {
    key: "vault",
    title: "Vault",
    description:
      "Komanda ilə puzzle-ları həll et və vault-u aç.",
    minPlayers: 2,
    maxPlayers: 6,
    icon: "🔐",
    accent: "amber",
  },

  "king-hill": {
    key: "king-hill",
    title: "King of the Hill",
    description:
      "Sürətli microgame-lərdə tacı ələ keçir.",
    minPlayers: 2,
    maxPlayers: 8,
    icon: "👑",
    accent: "yellow",
  },

  "octo-party": {
    key: "octo-party",
    title: "OCTO Party",
    description:
      "Random microgame-lər, xal yarışı və final podium.",
    minPlayers: 2,
    maxPlayers: 8,
    icon: "🐙",
    accent: "sky",
  },
} as const;

export type PartyGameKey =
  keyof typeof PARTY_GAMES;

export function isPartyGameKey(
  value: string
): value is PartyGameKey {
  return value in PARTY_GAMES;
}

export type PartyPlayer = {
  id: string;
  name: string;
  score: number;
  alive: boolean;
  joinedAt: number;
};

export type PartyRoomState = {
  code: string;
  game: PartyGameKey;

  hostId: string;

  status:
    | "waiting"
    | "playing"
    | "finished";

  players: PartyPlayer[];

  round: number;

  gameState: Record<string, unknown>;

  createdAt: number;
  updatedAt: number;
};

export function randomRoomCode() {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 6; i += 1) {
    code +=
      alphabet[
        Math.floor(
          Math.random() * alphabet.length
        )
      ];
  }

  return code;
}

export function roomPlayer(
  room: PartyRoomState,
  id: string
) {
  return room.players.find(
    (player) => player.id === id
  );
}

export function createInitialGameState(
  game: PartyGameKey
): Record<string, unknown> {
  switch (game) {
    case "last-button":
      return {
        turn: 0,
        pressure: 0,
        explosionAt:
          5 + Math.floor(Math.random() * 14),
        history: [],
      };

    case "undercover":
      return {
        phase: "waiting",
        mainWord: null,
        undercoverWord: null,
        undercoverId: null,
        clues: {},
        votes: {},
      };

    case "pixel-wars":
      return {
        phase: "waiting",
        prompt: null,
        canvases: {},
        votes: {},
        deadline: null,
      };

    case "vault":
      return {
        stage: 0,
        strikes: 0,
        startedAt: null,
        solved: [],
        puzzle: null,
      };

    case "king-hill":
      return {
        kingId: null,
        challenge: null,
        challengeStartedAt: null,
        answers: {},
        round: 0,
      };

    case "octo-party":
      return {
        miniGame: null,
        miniRound: 0,
        answers: {},
        roundStartedAt: null,
        totalRounds: 8,
      };
  }
}

export const UNDERCOVER_WORDS = [
  ["TikTok", "Instagram"],
  ["Ferrari", "Lamborghini"],
  ["Discord", "Telegram"],
  ["CS2", "Valorant"],
  ["MacBook", "iPad"],
  ["YouTube", "Twitch"],
  ["Burger", "Pizza"],
  ["Nike", "Adidas"],
  ["BMW", "Mercedes"],
  ["Minecraft", "Roblox"],
  ["Batman", "Spider-Man"],
  ["Netflix", "Disney+"],
];

export const PIXEL_PROMPTS = [
  "Octopus",
  "CS bomb",
  "Diamond",
  "Crown",
  "Rocket",
  "Ghost",
  "Sword",
  "Heart",
  "Car",
  "Dragon",
  "Robot",
  "Castle",
];

export const VAULT_PUZZLES = [
  {
    question:
      "2, 4, 8, 16, ?",
    answer: "32",
  },
  {
    question:
      "A=1, B=2, C=3. CAB neçədir?",
    answer: "312",
  },
  {
    question:
      "5 maşın 5 dəqiqədə 5 item düzəldir. 1 maşın 1 item-i neçə dəqiqəyə düzəldir?",
    answer: "5",
  },
  {
    question:
      "3 → 9, 4 → 16, 7 → ?",
    answer: "49",
  },
  {
    question:
      "OCTOSON sözündə neçə O var?",
    answer: "3",
  },
];

export type MicroGame =
  | "reaction"
  | "odd"
  | "number"
  | "memory"
  | "timing"
  | "color";

export const MICRO_GAMES: MicroGame[] = [
  "reaction",
  "odd",
  "number",
  "memory",
  "timing",
  "color",
];

export function randomMicroGame() {
  return MICRO_GAMES[
    Math.floor(
      Math.random() * MICRO_GAMES.length
    )
  ];
}
