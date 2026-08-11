export type BlackjackSuit =
  | "spades"
  | "hearts"
  | "diamonds"
  | "clubs";

export type BlackjackRank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type BlackjackCard = {
  suit: BlackjackSuit;
  rank: BlackjackRank;
};

export type BlackjackPlayerState = {
  user_id: string;
  hand: BlackjackCard[];
  status:
    | "playing"
    | "stand"
    | "bust"
    | "blackjack"
    | "finished";
};

export type PartyBlackjackState = {
  phase: "playing" | "dealer" | "finished";
  bet: number;
  deck: BlackjackCard[];
  dealer: BlackjackCard[];
  players: BlackjackPlayerState[];
  turn_index: number;
  turn: string | null;
  winners: string[];
  result: Record<
    string,
    "win" | "lose" | "push"
  >;
};

const SUITS: BlackjackSuit[] = [
  "spades",
  "hearts",
  "diamonds",
  "clubs",
];

const RANKS: BlackjackRank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [
      result[j],
      result[i],
    ];
  }

  return result;
}

export function createBlackjackDeck(): BlackjackCard[] {
  return shuffle(
    SUITS.flatMap((suit) =>
      RANKS.map((rank) => ({
        suit,
        rank,
      })),
    ),
  );
}

export function blackjackHandValue(
  hand: BlackjackCard[],
): number {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === "A") {
      total += 11;
      aces += 1;
    } else if (
      card.rank === "K" ||
      card.rank === "Q" ||
      card.rank === "J"
    ) {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

export function isNaturalBlackjack(
  hand: BlackjackCard[],
): boolean {
  return (
    hand.length === 2 &&
    blackjackHandValue(hand) === 21
  );
}

export function createInitialBlackjackState(
  playerIds: string[],
  bet: number,
): PartyBlackjackState {
  const deck = createBlackjackDeck();

  const players: BlackjackPlayerState[] =
    playerIds.map((userId) => ({
      user_id: userId,
      hand: [],
      status: "playing",
    }));

  const dealer: BlackjackCard[] = [];

  /*
   * Deal like a real table:
   * one card to every player,
   * one to dealer,
   * then repeat.
   */
  for (let round = 0; round < 2; round += 1) {
    for (const player of players) {
      const card = deck.pop();

      if (card) {
        player.hand.push(card);
      }
    }

    const dealerCard = deck.pop();

    if (dealerCard) {
      dealer.push(dealerCard);
    }
  }

  for (const player of players) {
    if (isNaturalBlackjack(player.hand)) {
      player.status = "blackjack";
    }
  }

  let turnIndex = players.findIndex(
    (player) => player.status === "playing",
  );

  if (turnIndex < 0) {
    turnIndex = players.length;
  }

  return {
    phase:
      turnIndex >= players.length
        ? "dealer"
        : "playing",

    bet,

    deck,

    dealer,

    players,

    turn_index: turnIndex,

    turn:
      turnIndex < players.length
        ? players[turnIndex].user_id
        : null,

    winners: [],

    result: {},
  };
}

export function nextBlackjackTurn(
  state: PartyBlackjackState,
): PartyBlackjackState {
  let index = state.turn_index + 1;

  while (
    index < state.players.length &&
    state.players[index].status !== "playing"
  ) {
    index += 1;
  }

  if (index >= state.players.length) {
    return {
      ...state,
      phase: "dealer",
      turn_index: state.players.length,
      turn: null,
    };
  }

  return {
    ...state,
    turn_index: index,
    turn: state.players[index].user_id,
  };
}

export function playDealer(
  state: PartyBlackjackState,
): PartyBlackjackState {
  const deck = [...state.deck];
  const dealer = [...state.dealer];

  // Dealer hits until 17 or higher.
  while (blackjackHandValue(dealer) < 17) {
    const card = deck.pop();

    if (!card) {
      break;
    }

    dealer.push(card);
  }

  const dealerValue =
    blackjackHandValue(dealer);

  const dealerBust =
    dealerValue > 21;

  const dealerNatural =
    isNaturalBlackjack(dealer);

  const result: Record<
    string,
    "win" | "lose" | "push"
  > = {};

  const winners: string[] = [];

  /*
   * Blackjack is player vs dealer.
   * Every player is evaluated independently.
   */
  for (const player of state.players) {
    const playerValue =
      blackjackHandValue(player.hand);

    const playerNatural =
      isNaturalBlackjack(player.hand);

    let playerResult:
      | "win"
      | "lose"
      | "push";

    if (playerValue > 21) {
      playerResult = "lose";
    } else if (playerNatural && !dealerNatural) {
      playerResult = "win";
    } else if (dealerNatural && !playerNatural) {
      playerResult = "lose";
    } else if (playerNatural && dealerNatural) {
      playerResult = "push";
    } else if (dealerBust) {
      playerResult = "win";
    } else if (playerValue > dealerValue) {
      playerResult = "win";
    } else if (playerValue < dealerValue) {
      playerResult = "lose";
    } else {
      playerResult = "push";
    }

    result[player.user_id] =
      playerResult;

    if (playerResult === "win") {
      winners.push(player.user_id);
    }
  }

  return {
    ...state,

    deck,

    dealer,

    players: state.players.map(
      (player) => ({
        ...player,
        status:
          player.status === "bust"
            ? "bust"
            : "finished",
      }),
    ),

    phase: "finished",

    turn: null,

    winners,

    result,
  };
}
