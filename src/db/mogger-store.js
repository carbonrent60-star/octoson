import { clone, isMemoryStorageEnabled, nowMs, toEpochMs, toNumber } from './helpers.js';
import { getSupabaseClient } from './supabase.js';
import { memoryState } from './memory-state.js';

function normalizeMoggerSession(row) {
  if (!row) return null;

  return {
    sessionId: row.session_id ?? row.sessionId,
    ownerId: row.owner_id ?? row.ownerId,
    targetUserId: row.target_user_id ?? row.targetUserId ?? null,
    subjectLabel: row.subject_label ?? row.subjectLabel ?? null,
    originalImage: row.original_image ?? row.originalImage ?? null,
    referenceImages: Array.isArray(row.reference_images)
      ? clone(row.reference_images)
      : Array.isArray(row.referenceImages)
        ? clone(row.referenceImages)
        : clone(row.reference_images ?? row.referenceImages ?? []),
    history: Array.isArray(row.history) ? clone(row.history) : clone(row.history ?? []),
    stack: Array.isArray(row.stack) ? clone(row.stack) : clone(row.stack ?? []),
    analysis: clone(row.analysis ?? {}),
    generationCount: toNumber(row.generation_count ?? row.generationCount, 0),
    auraSpent: toNumber(row.aura_spent ?? row.auraSpent, 0),
    isPublic: Boolean(row.is_public ?? row.isPublic),
    shareChannelId: row.share_channel_id ?? row.shareChannelId ?? null,
    shareMessageId: row.share_message_id ?? row.shareMessageId ?? null,
    latestGenerationId: row.latest_generation_id ?? row.latestGenerationId ?? null,
    lastMode: row.last_mode ?? row.lastMode ?? 'analysis',
    status: row.status ?? 'active',
    createdAt: toEpochMs(row.created_at ?? row.createdAt, nowMs()),
    updatedAt: toEpochMs(row.updated_at ?? row.updatedAt, nowMs()),
    expiresAt: row.expires_at == null && row.expiresAt == null ? null : toEpochMs(row.expires_at ?? row.expiresAt, null)
  };
}

function normalizeMoggerGeneration(row) {
  if (!row) return null;

  return {
    id: row.id,
    sessionId: row.session_id ?? row.sessionId,
    kind: row.kind ?? 'analysis',
    mode: row.mode ?? row.kind ?? 'analysis',
    label: row.label ?? '',
    prompt: row.prompt ?? '',
    summary: row.summary ?? '',
    analysis: clone(row.analysis ?? {}),
    stackSnapshot: Array.isArray(row.stack_snapshot) ? clone(row.stack_snapshot) : clone(row.stack_snapshot ?? []),
    details: clone(row.details ?? {}),
    auraSpent: toNumber(row.aura_spent ?? row.auraSpent, 0),
    createdAt: toEpochMs(row.created_at ?? row.createdAt, nowMs())
  };
}

function normalizeMoggerVote(row) {
  if (!row) return null;

  return {
    id: row.id ?? `${row.session_id ?? row.sessionId}:${row.voter_id ?? row.voterId}`,
    sessionId: row.session_id ?? row.sessionId,
    voterId: row.voter_id ?? row.voterId,
    vote: toNumber(row.vote, 1),
    createdAt: toEpochMs(row.created_at ?? row.createdAt, nowMs()),
    updatedAt: toEpochMs(row.updated_at ?? row.updatedAt, nowMs())
  };
}

function moggerSessionRows(store) {
  return [...store.sessions.values()].map(session => clone(session));
}

function moggerGenerationRows(store) {
  return [...store.generations.values()].map(generation => clone(generation));
}

function moggerVoteRows(store) {
  return [...store.votes.values()].map(vote => clone(vote));
}

export async function loadMoggerSession(sessionId) {
  if (isMemoryStorageEnabled()) {
    return clone(memoryState.mogger.sessions.get(sessionId) ?? null);
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('mogger_sessions').select('*').eq('session_id', sessionId).maybeSingle();
  if (error) throw error;
  return normalizeMoggerSession(data);
}

export async function loadMoggerSessions() {
  if (isMemoryStorageEnabled()) {
    return moggerSessionRows(memoryState.mogger);
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('mogger_sessions').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeMoggerSession).filter(Boolean);
}

export async function saveMoggerSession(session) {
  const next = normalizeMoggerSession(session);
  if (!next) {
    throw new Error('mogger_session_required');
  }

  if (isMemoryStorageEnabled()) {
    memoryState.mogger.sessions.set(next.sessionId, clone(next));
    return next;
  }

  const client = getSupabaseClient();
  const { error } = await client.from('mogger_sessions').upsert({
    session_id: next.sessionId,
    owner_id: next.ownerId,
    target_user_id: next.targetUserId,
    subject_label: next.subjectLabel,
    original_image: next.originalImage,
    reference_images: clone(next.referenceImages),
    history: clone(next.history),
    stack: clone(next.stack),
    analysis: clone(next.analysis),
    generation_count: next.generationCount,
    aura_spent: next.auraSpent,
    is_public: next.isPublic,
    share_channel_id: next.shareChannelId,
    share_message_id: next.shareMessageId,
    latest_generation_id: next.latestGenerationId,
    last_mode: next.lastMode,
    status: next.status,
    created_at: next.createdAt,
    updated_at: nowMs(),
    expires_at: next.expiresAt
  }, { onConflict: 'session_id' });
  if (error) throw error;
  return next;
}

export async function loadMoggerSessionBundle(sessionId) {
  const [session, generations, votes] = await Promise.all([
    loadMoggerSession(sessionId),
    loadMoggerGenerations(sessionId),
    loadMoggerVotes(sessionId)
  ]);

  return {
    session,
    generations,
    votes,
    voteCount: votes.filter(vote => vote.vote > 0).length
  };
}

export async function loadMoggerGenerations(sessionId) {
  if (isMemoryStorageEnabled()) {
    return moggerGenerationRows(memoryState.mogger).filter(generation => generation.sessionId === sessionId)
      .sort((left, right) => left.createdAt - right.createdAt || String(left.id).localeCompare(String(right.id)));
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('mogger_generations').select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeMoggerGeneration).filter(Boolean);
}

export async function saveMoggerGeneration(generation) {
  const next = normalizeMoggerGeneration(generation);
  if (!next) {
    throw new Error('mogger_generation_required');
  }

  if (isMemoryStorageEnabled()) {
    memoryState.mogger.generations.set(next.id, clone(next));
    return next;
  }

  const client = getSupabaseClient();
  const { error } = await client.from('mogger_generations').upsert({
    id: next.id,
    session_id: next.sessionId,
    kind: next.kind,
    mode: next.mode,
    label: next.label,
    prompt: next.prompt,
    summary: next.summary,
    analysis: clone(next.analysis),
    stack_snapshot: clone(next.stackSnapshot),
    details: clone(next.details),
    aura_spent: next.auraSpent,
    created_at: next.createdAt
  }, { onConflict: 'id' });
  if (error) throw error;
  return next;
}

export async function loadMoggerVotes(sessionId) {
  if (isMemoryStorageEnabled()) {
    return moggerVoteRows(memoryState.mogger)
      .filter(vote => vote.sessionId === sessionId)
      .sort((left, right) => left.createdAt - right.createdAt || left.voterId.localeCompare(right.voterId));
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('mogger_votes').select('*').eq('session_id', sessionId).order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeMoggerVote).filter(Boolean);
}

export async function saveMoggerVote(vote) {
  const next = normalizeMoggerVote(vote);
  if (!next) {
    throw new Error('mogger_vote_required');
  }

  if (isMemoryStorageEnabled()) {
    memoryState.mogger.votes.set(`${next.sessionId}:${next.voterId}`, clone(next));
    return next;
  }

  const client = getSupabaseClient();
  const { error } = await client.from('mogger_votes').upsert({
    id: next.id,
    session_id: next.sessionId,
    voter_id: next.voterId,
    vote: next.vote,
    created_at: next.createdAt,
    updated_at: nowMs()
  }, { onConflict: 'session_id,voter_id' });
  if (error) throw error;
  return next;
}

export async function loadMoggerVoteCount(sessionId) {
  const votes = await loadMoggerVotes(sessionId);
  return votes.filter(vote => vote.vote > 0).length;
}

export async function deleteMoggerSession(sessionId) {
  if (isMemoryStorageEnabled()) {
    memoryState.mogger.sessions.delete(sessionId);
    for (const [generationId, generation] of memoryState.mogger.generations.entries()) {
      if (generation.sessionId === sessionId) {
        memoryState.mogger.generations.delete(generationId);
      }
    }
    for (const [voteId, vote] of memoryState.mogger.votes.entries()) {
      if (vote.sessionId === sessionId) {
        memoryState.mogger.votes.delete(voteId);
      }
    }
    return;
  }

  const client = getSupabaseClient();
  const { error } = await client.from('mogger_sessions').delete().eq('session_id', sessionId);
  if (error) throw error;
}
