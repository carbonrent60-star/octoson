export type MultiplayerGameDefinition = {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  category: "classic" | "party";
};

export const MULTIPLAYER_GAMES = {
  reaction: {
    id: "reaction",
    name: "Reaction",
    description: "Kim daha sürətlidir? Siqnal gələn kimi vur.",
    minPlayers: 2,
    maxPlayers: 8,
    category: "classic",
  },

  connect4: {
    id: "connect4",
    name: "Connect 4",
    description: "Klassik 1v1 strategiya oyunu.",
    minPlayers: 2,
    maxPlayers: 2,
    category: "classic",
  },

  blackjack: {
    id: "blackjack",
    name: "Party Blackjack",
    description: "Dostlarınla eyni masada blackjack.",
    minPlayers: 2,
    maxPlayers: 8,
    category: "classic",
  },

  lastbutton: {
    id: "lastbutton",
    name: "Last Button",
    description: "Vaxt bitməzdən əvvəl düyməni bas. Son basan qalibdir.",
    minPlayers: 2,
    maxPlayers: 10,
    category: "party",
  },

  undercover: {
    id: "undercover",
    name: "Undercover",
    description: "Gizli rolu tap və undercover oyunçunu üzə çıxar.",
    minPlayers: 3,
    maxPlayers: 10,
    category: "party",
  },

  pixelwars: {
    id: "pixelwars",
    name: "Pixel Wars",
    description: "Taxtanı ələ keçir və rəqiblərindən daha çox sahə qazan.",
    minPlayers: 2,
    maxPlayers: 8,
    category: "party",
  },

  vault: {
    id: "vault",
    name: "Vault",
    description: "Kodu tap, ipuclarını istifadə et və vault-u ilk açan ol.",
    minPlayers: 2,
    maxPlayers: 8,
    category: "party",
  },

  kingofthehill: {
    id: "kingofthehill",
    name: "King of the Hill",
    description: "Taxtı ələ keçir və raundun sonunda onu qoruyan sən ol.",
    minPlayers: 2,
    maxPlayers: 10,
    category: "party",
  },

  octoparty: {
    id: "octoparty",
    name: "OCTO Party",
    description: "Sürətli microgame-lərdən ibarət qarışıq multiplayer yarış.",
    minPlayers: 2,
    maxPlayers: 10,
    category: "party",
  },
} as const satisfies Record<string, MultiplayerGameDefinition>;

export type MultiplayerGameId = keyof typeof MULTIPLAYER_GAMES;

export const MULTIPLAYER_GAME_IDS = Object.keys(
  MULTIPLAYER_GAMES,
) as MultiplayerGameId[];

export function isMultiplayerGame(
  value: string,
): value is MultiplayerGameId {
  return value in MULTIPLAYER_GAMES;
}

export function getMultiplayerGame(
  value: string,
) {
  return isMultiplayerGame(value)
    ? MULTIPLAYER_GAMES[value]
    : null;
}
