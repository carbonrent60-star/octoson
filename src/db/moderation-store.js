import { clone, isMemoryStorageEnabled, nowMs, toNumber } from './helpers.js';
import { getSupabaseClient } from './supabase.js';
import { memoryState } from './memory-state.js';

function defaultModerationSettings() {
  return { staffChannelId: null };
}

function normalizeCase(row) {
  return {
    id: toNumber(row.id, 0),
    type: row.type ?? 'action',
    moderatorId: row.moderator_id ?? null,
    targetId: row.target_id ?? null,
    reason: row.reason ?? '',
    evidence: clone(row.evidence ?? []),
    meta: clone(row.meta ?? {}),
    status: row.status ?? 'open',
    createdAt: toNumber(row.created_at, nowMs()),
    resolvedAt: row.resolved_at == null ? null : toNumber(row.resolved_at, null),
    resolvedBy: row.resolved_by ?? null
  };
}

function normalizeReport(row) {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    targetId: row.target_id,
    messageLink: row.message_link ?? null,
    reason: row.reason ?? '',
    evidence: clone(row.evidence ?? []),
    status: row.status ?? 'open',
    createdAt: toNumber(row.created_at, nowMs())
  };
}

export async function loadModerationSettings() {
  if (isMemoryStorageEnabled()) {
    return clone(memoryState.moderation.settings ?? defaultModerationSettings());
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('moderation_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;

  return data ? { staffChannelId: data.staff_channel_id ?? null } : defaultModerationSettings();
}

export async function saveModerationSettings(settings) {
  const next = { staffChannelId: settings?.staffChannelId ?? null };

  if (isMemoryStorageEnabled()) {
    memoryState.moderation.settings = next;
    return next;
  }

  const client = getSupabaseClient();
  const { error } = await client.from('moderation_settings').upsert({
    id: 1,
    staff_channel_id: next.staffChannelId,
    updated_at: nowMs()
  }, { onConflict: 'id' });
  if (error) throw error;
  return next;
}

export async function createModerationCase({ type = 'action', moderatorId, targetId, reason = '', evidence = [], meta = {} }) {
  if (isMemoryStorageEnabled()) {
    const id = memoryState.moderation.nextCaseId;
    const record = normalizeCase({
      id,
      type,
      moderator_id: moderatorId,
      target_id: targetId,
      reason,
      evidence,
      meta,
      status: 'open',
      created_at: nowMs(),
      resolved_at: null,
      resolved_by: null
    });

    memoryState.moderation.cases.set(record.id, record);
    memoryState.moderation.nextCaseId += 1;
    return clone(record);
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('moderation_cases').insert({
    type,
    moderator_id: moderatorId,
    target_id: targetId,
    reason: `${reason ?? ''}`.slice(0, 1000),
    evidence: Array.isArray(evidence) ? evidence : [evidence].filter(Boolean),
    meta: meta ?? {},
    status: 'open',
    created_at: nowMs(),
    resolved_at: null,
    resolved_by: null
  }).select('*').single();

  if (error) throw error;
  return normalizeCase(data);
}

export async function resolveModerationCase(caseId, { resolvedBy, resolution = 'done' } = {}) {
  const numericCaseId = toNumber(caseId, null);

  if (isMemoryStorageEnabled()) {
    const record = memoryState.moderation.cases.get(numericCaseId);
    if (!record) return null;
    record.status = resolution;
    record.resolvedAt = nowMs();
    record.resolvedBy = resolvedBy ?? record.resolvedBy;
    memoryState.moderation.cases.set(numericCaseId, record);
    return clone(record);
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('moderation_cases').update({
    status: resolution,
    resolved_at: nowMs(),
    resolved_by: resolvedBy ?? null
  }).eq('id', numericCaseId).select('*').maybeSingle();

  if (error) throw error;
  return data ? normalizeCase(data) : null;
}

export async function getModerationCase(caseId) {
  const numericCaseId = toNumber(caseId, null);

  if (isMemoryStorageEnabled()) {
    return clone(memoryState.moderation.cases.get(numericCaseId) ?? null);
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('moderation_cases').select('*').eq('id', numericCaseId).maybeSingle();
  if (error) throw error;
  return data ? normalizeCase(data) : null;
}

export async function listOpenReports() {
  if (isMemoryStorageEnabled()) {
    return [...memoryState.moderation.reports.values()]
      .filter(report => report.status === 'open')
      .map(report => clone(report));
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('moderation_reports').select('*').eq('status', 'open').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeReport);
}

export async function createModerationReport({ reporterId, targetId, messageLink = null, reason = '', evidence = [] }) {
  const report = {
    id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    reporterId,
    targetId,
    messageLink,
    reason: `${reason}`.slice(0, 1000),
    evidence: Array.isArray(evidence) ? evidence : [evidence].filter(Boolean),
    status: 'open',
    createdAt: nowMs()
  };

  if (isMemoryStorageEnabled()) {
    memoryState.moderation.reports.set(report.id, clone(report));
    return clone(report);
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('moderation_reports').insert({
    id: report.id,
    reporter_id: reporterId,
    target_id: targetId,
    message_link: messageLink,
    reason: report.reason,
    evidence: report.evidence,
    status: 'open',
    created_at: report.createdAt
  }).select('*').single();

  if (error) throw error;
  return normalizeReport(data);
}
