import { clone } from './helpers.js';

function createEconomyState() {
  return {
    settings: {
      chestsEnabled: true,
      chestsUpdatedAt: null,
      chestsUpdatedBy: null,
      safeModeEnabled: false,
      safeModeUpdatedAt: null,
      safeModeUpdatedBy: null
    },
    users: new Map(),
    transactions: [],
    restrictions: new Map()
  };
}

function createModerationState() {
  return {
    settings: { staffChannelId: null },
    cases: new Map(),
    reports: new Map(),
    nextCaseId: 1
  };
}

function createAppState() {
  return {
    liveLeaderboard: { channelId: null, messageId: null },
    uiEmotes: new Map(),
    auraDrops: new Map()
  };
}

function createPartyState() {
  return { parties: new Map() };
}

function createMoggerState() {
  return {
    sessions: new Map(),
    generations: new Map(),
    votes: new Map()
  };
}

export const memoryState = {
  economy: createEconomyState(),
  moderation: createModerationState(),
  app: createAppState(),
  party: createPartyState(),
  mogger: createMoggerState()
};

export function resetMemoryState() {
  memoryState.economy = createEconomyState();
  memoryState.moderation = createModerationState();
  memoryState.app = createAppState();
  memoryState.party = createPartyState();
  memoryState.mogger = createMoggerState();
}

export function cloneMemoryMap(map) {
  return new Map([...map.entries()].map(([key, value]) => [key, clone(value)]));
}
