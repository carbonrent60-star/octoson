import { loadPartyStore as loadPartyRepositoryStore, savePartyStore as savePartyRepositoryStore } from './db/party-store.js';

const partyStates = new Map();

export async function initPartyStore() {
  const store = await loadPartyRepositoryStore();
  partyStates.clear();
  for (const [partyId, party] of store.parties.entries()) {
    partyStates.set(partyId, party);
  }
}

export function getParty(partyId) {
  return partyStates.get(partyId) ?? null;
}

export function getPartyByUser(userId) {
  return [...partyStates.values()].find(party => party.members.some(member => member.id === userId)) ?? null;
}

export function createParty(hostId, hostUsername) {
  const partyId = `party_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const party = {
    id: partyId,
    hostId,
    hostUsername,
    channelId: null,
    createdAt: Date.now(),
    members: [{ id: hostId, username: hostUsername }],
    status: 'waiting',
    xp: 0,
    level: 1,
    potBonusPercent: 10,
    maxPlayers: 8,
    gameQueue: []
  };
  partyStates.set(partyId, party);
  savePartyStore().catch(() => {});
  return party;
}

export function joinParty(partyId, userId, username) {
  const party = getParty(partyId);
  if (!party) return null;
  if (party.members.some(member => member.id === userId)) return party;
  if (party.members.length >= party.maxPlayers) return null;
  party.members.push({ id: userId, username });
  savePartyStore().catch(() => {});
  return party;
}

export function leaveParty(userId) {
  const party = getPartyByUser(userId);
  if (!party) return null;
  party.members = party.members.filter(member => member.id !== userId);
  if (party.hostId === userId && party.members.length > 0) {
    party.hostId = party.members[0].id;
    party.hostUsername = party.members[0].username;
  }
  if (party.members.length === 0) {
    partyStates.delete(party.id);
  }
  savePartyStore().catch(() => {});
  return party;
}

export function formatPartyEmbed(party) {
  return {
    title: `🎉 Casino Party • ${party.level} lvl`,
    description: `Host: <@${party.hostId}>\nParty XP: ${party.xp} • Bonus: +${party.potBonusPercent}%\nStatus: ${party.status}`,
    fields: [
      { name: 'Üzvlər', value: party.members.map(member => member.username).join('\n') || 'Heç kim yoxdur.', inline: true },
      { name: 'Limit', value: `${party.members.length}/${party.maxPlayers}`, inline: true },
      { name: 'Game Queue', value: party.gameQueue.length ? party.gameQueue.join(', ') : 'Sırada oyun yoxdur.', inline: false }
    ]
  };
}

async function savePartyStore() {
  await savePartyRepositoryStore({ parties: new Map(partyStates) });
}
