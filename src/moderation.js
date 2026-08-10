import {
  createModerationCase,
  createModerationReport,
  getModerationCase,
  listOpenReports as listOpenModerationReports,
  loadModerationSettings,
  saveModerationSettings,
  resolveModerationCase
} from './db/moderation-store.js';

async function readStore() {
  const settings = await loadModerationSettings();
  return { nextCaseId: 1, cases: [], reports: [], settings };
}

async function writeStore(store) {
  if (store?.settings) {
    await saveModerationSettings(store.settings);
  }
}

export async function getSettings() {
  return loadModerationSettings();
}

export async function setSettings(newSettings) {
  return saveModerationSettings(newSettings);
}

export async function createCase({ type = 'action', moderatorId, targetId, reason = '', evidence = [], meta = {} }) {
  return createModerationCase({ type, moderatorId, targetId, reason, evidence, meta });
}

export async function resolveCase(caseId, { resolvedBy, resolution = 'done' } = {}) {
  return resolveModerationCase(caseId, { resolvedBy, resolution });
}

export async function getCase(caseId) {
  return getModerationCase(caseId);
}

export async function listOpenReports() {
  return listOpenModerationReports();
}

export async function createReport({ reporterId, targetId, messageLink = null, reason = '', evidence = [] }) {
  return createModerationReport({ reporterId, targetId, messageLink, reason, evidence });
}

export default {
  readStore,
  writeStore,
  getSettings,
  setSettings,
  createCase,
  resolveCase,
  getCase,
  listOpenReports,
  createReport
};
