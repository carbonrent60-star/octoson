import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMoggerAction,
  applyMoggerStack,
  assertMoggerSessionOwner,
  buildMoggerRows,
  initializeMoggerSession,
  isMoggerImageAttachment,
  loadMoggerSession,
  loadMoggerSessionBundle,
  loadMoggerVoteCount,
  moggerSessionIsExpired,
  normalizeMoggerMode,
  parseMoggerStackInput,
  publishMoggerSession,
  updateMoggerVote
} from '../src/mogger.js';
import { loadMoggerSessions, loadMoggerVotes, saveMoggerSession } from '../src/db/mogger-store.js';
import { resetMemoryState } from '../src/db/memory-state.js';

beforeEach(() => {
  resetMemoryState();
});

function createOwner(id = 'mogger-owner') {
  return {
    id,
    username: 'mogger-owner',
    displayName: 'Mogger Owner'
  };
}

function createAttachment({ name = 'portrait.png', contentType = 'image/png' } = {}) {
  return {
    url: `https://example.com/${name}`,
    name,
    contentType
  };
}

test('mogger helpers normalize actions and stack input', () => {
  assert.equal(normalizeMoggerMode('saç'), 'hair');
  assert.equal(normalizeMoggerMode('MUKAYISE'), 'compare');
  assert.deepEqual(parseMoggerStackInput('hair, grooming > camera'), ['hair', 'grooming', 'camera']);
  assert.equal(isMoggerImageAttachment(createAttachment()), true);
  assert.equal(isMoggerImageAttachment({ name: 'notes.txt', contentType: 'text/plain' }), false);
});

test('mogger sessions preserve camelCase reference images in memory storage', async () => {
  const now = Date.now();

  await saveMoggerSession({
    sessionId: 'mogger_manual_case',
    ownerId: 'mogger-owner',
    subjectLabel: 'Manual subject',
    originalImage: 'https://example.com/original.png',
    referenceImages: ['https://example.com/original.png', 'https://example.com/reference.png'],
    history: [],
    stack: [],
    analysis: {},
    generationCount: 0,
    auraSpent: 0,
    isPublic: false,
    shareChannelId: null,
    shareMessageId: null,
    latestGenerationId: null,
    lastMode: 'analysis',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    expiresAt: null
  });

  const stored = await loadMoggerSession('mogger_manual_case');
  assert.equal(stored.referenceImages.length, 2);
  assert.equal(stored.referenceImages[1], 'https://example.com/reference.png');
  assert.equal(assertMoggerSessionOwner(stored, 'mogger-owner'), true);
  assert.equal(assertMoggerSessionOwner(stored, 'other-user'), false);
});

test('mogger session initialization rejects non-image attachments without creating a session', async () => {
  await assert.rejects(
    initializeMoggerSession({
      openai: null,
      model: 'gpt-test',
      owner: createOwner(),
      attachment: { url: 'https://example.com/readme.txt', name: 'readme.txt', contentType: 'text/plain' }
    }),
    error => error.code === 'invalid_mogger_image'
  );

  const sessions = await loadMoggerSessions();
  assert.equal(sessions.length, 0);
});

test('mogger session initialization stores the uploaded image and creates a panel', async () => {
  const result = await initializeMoggerSession({
    openai: null,
    model: 'gpt-test',
    owner: createOwner(),
    attachment: createAttachment(),
    targetUser: null
  });

  assert.equal(result.session.generationCount, 1);
  assert.equal(result.session.lastMode, 'analysis');
  assert.equal(result.session.referenceImages.length, 1);
  assert.equal(result.session.originalImage, 'https://example.com/portrait.png');
  assert.equal(buildMoggerRows(result.session).length, 3);

  const bundle = await loadMoggerSessionBundle(result.session.sessionId);
  assert.equal(bundle.session.sessionId, result.session.sessionId);
  assert.equal(bundle.generations.length, 1);
  assert.equal(bundle.voteCount, 0);
});

test('mogger action and stack applications advance the session state', async () => {
  const { session: createdSession } = await initializeMoggerSession({
    openai: null,
    model: 'gpt-test',
    owner: createOwner(),
    attachment: createAttachment(),
    targetUser: null
  });

  const actionResult = await applyMoggerAction({
    openai: null,
    model: 'gpt-test',
    session: createdSession,
    action: 'hair'
  });

  assert.equal(actionResult.session.generationCount, 2);
  assert.equal(actionResult.session.lastMode, 'hair');
  assert.deepEqual(actionResult.session.stack, ['hair']);

  const stackResult = await applyMoggerStack({
    openai: null,
    model: 'gpt-test',
    session: actionResult.session,
    steps: ['grooming', 'camera'],
    note: 'layered check'
  });

  assert.equal(stackResult.session.generationCount, 3);
  assert.equal(stackResult.session.lastMode, 'stack');
  assert.deepEqual(stackResult.session.stack, ['hair', 'grooming', 'camera']);
});

test('expired mogger sessions cannot be mutated', async () => {
  const now = Date.now();
  const expiredSession = await saveMoggerSession({
    sessionId: 'mogger_expired_case',
    ownerId: 'mogger-owner',
    subjectLabel: 'Expired subject',
    originalImage: 'https://example.com/expired.png',
    referenceImages: ['https://example.com/expired.png'],
    history: [],
    stack: [],
    analysis: {},
    generationCount: 0,
    auraSpent: 0,
    isPublic: false,
    shareChannelId: null,
    shareMessageId: null,
    latestGenerationId: null,
    lastMode: 'analysis',
    status: 'active',
    createdAt: now - 1000,
    updatedAt: now - 1000,
    expiresAt: now - 1
  });

  assert.equal(moggerSessionIsExpired(expiredSession, now), true);

  await assert.rejects(
    applyMoggerAction({
      openai: null,
      model: 'gpt-test',
      session: expiredSession,
      action: 'style'
    }),
    error => error.code === 'mogger_session_expired'
  );
});

test('mogger votes remain unique per voter and public publish marks the session', async () => {
  const { session } = await initializeMoggerSession({
    openai: null,
    model: 'gpt-test',
    owner: createOwner(),
    attachment: createAttachment(),
    targetUser: null
  });

  const channel = {
    id: 'mogger-channel',
    send: async payload => ({ id: 'mogger-message', payload })
  };

  const publishResult = await publishMoggerSession({
    session,
    channel,
    voteCount: 0,
    analysis: session.analysis
  });

  assert.equal(publishResult.message.id, 'mogger-message');

  const publicSession = await loadMoggerSession(session.sessionId);
  assert.equal(publicSession.isPublic, true);
  assert.equal(publicSession.shareChannelId, 'mogger-channel');
  assert.equal(publicSession.shareMessageId, 'mogger-message');

  await updateMoggerVote(session.sessionId, 'voter-a', 1);
  await updateMoggerVote(session.sessionId, 'voter-a', 1);
  await updateMoggerVote(session.sessionId, 'voter-b', 1);

  const votes = await loadMoggerVotes(session.sessionId);
  const voteCount = await loadMoggerVoteCount(session.sessionId);

  assert.equal(votes.length, 2);
  assert.equal(voteCount, 2);
});