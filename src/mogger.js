import { randomUUID } from 'node:crypto';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { brand } from './content.js';
import { clone, nowMs } from './db/helpers.js';
import {
  loadMoggerSession,
  loadMoggerSessionBundle,
  loadMoggerVoteCount,
  saveMoggerGeneration,
  saveMoggerSession,
  saveMoggerVote
} from './db/mogger-store.js';
import { renderMoggerCard } from './canvas-renderer.js';

export const MOGGER_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const moggerModeMeta = {
  analysis: { label: 'Analiz', emoji: '🔎', accent: '#22c55e' },
  hair: { label: 'Saç', emoji: '💇', accent: '#ec4899' },
  grooming: { label: 'Grooming', emoji: '🧼', accent: '#14b8a6' },
  camera: { label: 'Kamera', emoji: '📷', accent: '#38bdf8' },
  style: { label: 'Style', emoji: '✨', accent: '#f59e0b' },
  stack: { label: 'Stack', emoji: '🧱', accent: '#818cf8' },
  compare: { label: 'Müqayisə', emoji: '🪞', accent: '#c084fc' },
  share: { label: 'Share', emoji: '🌐', accent: '#22c55e' },
  reset: { label: 'Sıfırla', emoji: '↩️', accent: '#f97316' },
  close: { label: 'Bağla', emoji: '❌', accent: '#ef4444' }
};

const moggerSynonyms = new Map([
  ['hair', 'hair'],
  ['saç', 'hair'],
  ['sac', 'hair'],
  ['grooming', 'grooming'],
  ['groom', 'grooming'],
  ['temizlik', 'grooming'],
  ['təmizlik', 'grooming'],
  ['camera', 'camera'],
  ['kamera', 'camera'],
  ['photo', 'camera'],
  ['foto', 'camera'],
  ['lens', 'camera'],
  ['style', 'style'],
  ['stil', 'style'],
  ['fit', 'style'],
  ['stack', 'stack'],
  ['combo', 'stack'],
  ['multi', 'stack'],
  ['compare', 'compare'],
  ['müqayisə', 'compare'],
  ['mukayise', 'compare'],
  ['share', 'share'],
  ['public', 'share'],
  ['publish', 'share'],
  ['reset', 'reset'],
  ['clear', 'reset'],
  ['sıfırla', 'reset'],
  ['sifirla', 'reset'],
  ['close', 'close'],
  ['bagla', 'close'],
  ['bağla', 'close']
]);

function moggerMeta(mode) {
  return moggerModeMeta[mode] ?? moggerModeMeta.analysis;
}

function moggerButton(customId, label, style, emoji, disabled = false) {
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(disabled);

  if (emoji) {
    button.setEmoji(emoji);
  }

  return button;
}

function discordValue(value, fallback = '—', maxLength = 900) {
  const text = `${value ?? fallback}`.trim() || fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function normalizeList(values, fallback = []) {
  const items = Array.isArray(values) ? values.flatMap(value => `${value}`.split(/\r?\n/)) : [];
  const normalized = items.map(item => item.trim()).filter(Boolean);
  return normalized.length ? normalized : fallback;
}

function normalizeAnalysisPayload(payload = {}, fallback = {}) {
  const visibleFeatures = normalizeList(payload.visibleFeatures, fallback.visibleFeatures ?? []);
  const strengths = normalizeList(payload.strengths, fallback.strengths ?? []);
  const cautions = normalizeList(payload.cautions, fallback.cautions ?? []);
  const stackSuggestions = Array.isArray(payload.stackSuggestions)
    ? payload.stackSuggestions.map(item => ({
      id: `${item?.id ?? item?.mode ?? item?.label ?? randomUUID()}`,
      label: `${item?.label ?? item?.mode ?? 'Step'}`,
      reason: `${item?.reason ?? item?.summary ?? item?.note ?? ''}`.trim()
    })).filter(item => item.label)
    : normalizeStackSuggestionPayload(fallback.stackSuggestions ?? []);

  return {
    summary: `${payload.summary ?? fallback.summary ?? ''}`.trim() || fallback.summary || 'Şəkil qəbul olundu və Looks Lab hazırdır.',
    visibleFeatures,
    strengths,
    cautions,
    hair: normalizeSection(payload.hair, fallback.hair ?? buildSectionFallback('hair')),
    grooming: normalizeSection(payload.grooming, fallback.grooming ?? buildSectionFallback('grooming')),
    camera: normalizeSection(payload.camera, fallback.camera ?? buildSectionFallback('camera')),
    style: normalizeSection(payload.style, fallback.style ?? buildSectionFallback('style')),
    stackSuggestions,
    privacyNote: `${payload.privacyNote ?? fallback.privacyNote ?? ''}`.trim() || 'Private by default. Identity, region və medical claim edilməyəcək.',
    identityLock: `${payload.identityLock ?? fallback.identityLock ?? ''}`.trim() || 'Identity locked to the declared subject.',
    regionLock: `${payload.regionLock ?? fallback.regionLock ?? ''}`.trim() || 'Region inference disabled.',
    rawText: payload.rawText ?? fallback.rawText ?? ''
  };
}

function normalizeSimulationPayload(payload = {}, fallback = {}) {
  const changes = normalizeList(payload.changes, fallback.changes ?? []);
  const warnings = normalizeList(payload.warnings, fallback.warnings ?? []);
  return {
    summary: `${payload.summary ?? fallback.summary ?? ''}`.trim() || fallback.summary || 'Düzəliş tətbiq olundu.',
    changes,
    focus: `${payload.focus ?? fallback.focus ?? ''}`.trim() || fallback.focus || 'Looks Lab',
    nextStackHint: `${payload.nextStackHint ?? fallback.nextStackHint ?? ''}`.trim() || fallback.nextStackHint || 'Daha yaxşı nəticə üçün əlavə bir addım seç.',
    warnings,
    rawText: payload.rawText ?? fallback.rawText ?? ''
  };
}

function normalizeSection(section, fallback) {
  const input = section && typeof section === 'object' ? section : {};
  return {
    summary: `${input.summary ?? fallback.summary ?? ''}`.trim() || fallback.summary || '',
    bestFor: normalizeList(input.bestFor, fallback.bestFor ?? []),
    avoid: normalizeList(input.avoid, fallback.avoid ?? [])
  };
}

function normalizeStackSuggestionPayload(suggestions) {
  return suggestions.map(item => ({
    id: `${item?.id ?? item?.mode ?? item?.label ?? randomUUID()}`,
    label: `${item?.label ?? item?.mode ?? 'Step'}`,
    reason: `${item?.reason ?? item?.summary ?? item?.note ?? ''}`.trim()
  })).filter(item => item.label);
}

function buildSectionFallback(mode) {
  const meta = moggerMeta(mode);
  return {
    summary: `${meta.label} fokusu daha təmiz, daha intentional və daha ardıcıl görünüş verir.`,
    bestFor: [meta.label],
    avoid: ['Həddindən artıq qarışıq düzəlişlər']
  };
}

function parseJsonBlock(text) {
  const raw = `${text ?? ''}`.trim();
  if (!raw) return null;

  const candidates = [raw];
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  if (fenced) candidates.unshift(fenced.trim());

  const objectMatch = raw.match(/\{[\s\S]*\}$/);
  if (objectMatch) {
    candidates.unshift(objectMatch[0]);
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // keep trying other candidates
    }
  }

  return null;
}

function buildModeLabelList(modes) {
  return normalizeList(modes).map(mode => moggerMeta(mode).label);
}

function buildModeChipText(modes) {
  const labels = buildModeLabelList(modes);
  return labels.length ? labels.join(' + ') : 'No edits yet';
}

function buildAnalysisFallback(session) {
  const visibleFeatures = [
    session.targetUserId ? `Declared subject: ${session.subjectLabel}` : 'Uploaded image only',
    'Private by default',
    'Identity locked',
    'Region not inferred'
  ];

  return normalizeAnalysisPayload({
    summary: session.targetUserId
      ? `Looks Lab hazırdır. ${session.subjectLabel} üçün vizual stack yaratmaq olar, amma bütün nəticələr kosmetik və privacy-first qalır.`
      : 'Looks Lab hazırdır. Yüklənən şəkil üçün private preview və stacked looks simulation açıldı.',
    visibleFeatures,
    strengths: ['Clean framing', 'Stable subject', 'Room for stacked refinement'],
    cautions: ['No medical claims', 'No identity drift', 'No region inference'],
    hair: buildSectionFallback('hair'),
    grooming: buildSectionFallback('grooming'),
    camera: buildSectionFallback('camera'),
    style: buildSectionFallback('style'),
    stackSuggestions: [
      { id: 'hair', label: 'Hair', reason: 'Saç xətti və həcminin necə dəyişəcəyini test et.' },
      { id: 'grooming', label: 'Grooming', reason: 'Daha təmiz və intentional görünüş üçün.' },
      { id: 'camera', label: 'Camera', reason: 'Bucaq, crop və işıq düzəlişləri üçün.' },
      { id: 'style', label: 'Style', reason: 'Ümumi vibe, fit və rəng balansı üçün.' }
    ],
    privacyNote: 'Private by default. No medical, identity or region claims.',
    identityLock: 'Identity locked to the uploaded subject.',
    regionLock: 'Region inference disabled.'
  });
}

function buildSimulationFallback(session, mode, note = '') {
  const meta = moggerMeta(mode);
  const stackText = buildModeChipText(session.stack);
  const noteText = note ? ` ${note}` : '';

  return normalizeSimulationPayload({
    summary: `${meta.label} stack tətbiq olundu.${noteText} Nəticə daha intentional və daha səliqəli görünüşə yönəlir.`,
    changes: [
      `${meta.label} fokusu saxlandı`,
      `${stackText}`,
      'Private preview updated'
    ],
    focus: meta.label,
    nextStackHint: session.stack.length >= 3 ? 'Stack artıq doludur. Compare et və ya share et.' : 'Bir addım da əlavə edib compare et.',
    warnings: ['Identity stays locked', 'No medical claims', 'No region inference']
  });
}

function buildStackPromptSteps(steps) {
  return normalizeList(steps)
    .map(step => normalizeMoggerMode(step))
    .filter(Boolean);
}

function buildAnalysisPrompt(session) {
  const subjectLine = session.targetUserId
    ? `Declared subject: ${session.subjectLabel} (${session.targetUserId})`
    : 'Declared subject: uploaded image only';

  return [
    'You are Mogger, a private Discord Looks Lab assistant.',
    'Return ONLY valid JSON with the following shape:',
    '{',
    '  "summary": "short Azerbaijani summary",',
    '  "visibleFeatures": ["..."],',
    '  "strengths": ["..."],',
    '  "cautions": ["..."],',
    '  "hair": { "summary": "...", "bestFor": ["..."], "avoid": ["..."] },',
    '  "grooming": { "summary": "...", "bestFor": ["..."], "avoid": ["..."] },',
    '  "camera": { "summary": "...", "bestFor": ["..."], "avoid": ["..."] },',
    '  "style": { "summary": "...", "bestFor": ["..."], "avoid": ["..."] },',
    '  "stackSuggestions": [{ "id": "hair", "label": "Hair", "reason": "..." }],',
    '  "privacyNote": "...",',
    '  "identityLock": "...",',
    '  "regionLock": "..."',
    '}',
    'Safety rules:',
    '- Keep the subject identity locked. Do not claim to know the real person, ethnicity, nationality, region or medical condition.',
    '- Do not make medical, dermatology or diagnosis claims.',
    '- Keep the feedback visual, cosmetic and privacy-first.',
    '- Use Azerbaijani and stay concise.',
    subjectLine,
    `Uploaded image URL: ${session.originalImage}`,
    `Reference images: ${session.referenceImages.length}`,
    `Current stack: ${buildModeChipText(session.stack)}`
  ].join('\n');
}

function buildSimulationPrompt(session, mode, note = '') {
  const meta = moggerMeta(mode);

  return [
    'You are continuing an existing Mogger Looks Lab session.',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "summary": "...",',
    '  "changes": ["..."],',
    '  "focus": "...",',
    '  "nextStackHint": "...",',
    '  "warnings": ["..."]',
    '}',
    'Rules:',
    '- Keep the subject identity locked and avoid region or medical claims.',
    '- Do not invent unsupported anatomy changes.',
    '- Keep the simulation cosmetic, visual and private-first.',
    '- Use Azerbaijani and keep the answer short.',
    `Current mode: ${meta.label}`,
    `Current stack: ${buildModeChipText(session.stack)}`,
    `Note: ${note || 'none'}`,
    `Previous analysis summary: ${session.analysis?.summary ?? 'none'}`,
    `Visible features: ${normalizeList(session.analysis?.visibleFeatures, []).join(' | ') || 'none'}`
  ].join('\n');
}

export function normalizeMoggerMode(value) {
  if (!value) return null;
  const normalized = `${value}`.trim().toLowerCase();
  return moggerSynonyms.get(normalized) ?? (moggerModeMeta[normalized] ? normalized : null);
}

export function moggerModeMetaFor(mode) {
  return moggerMeta(normalizeMoggerMode(mode) ?? mode);
}

export function isMoggerImageAttachment(attachment) {
  if (!attachment) return false;
  const contentType = `${attachment.contentType ?? ''}`.toLowerCase();
  if (contentType.startsWith('image/')) {
    return true;
  }

  return /\.(png|jpe?g|webp|gif)$/i.test(`${attachment.name ?? attachment.url ?? ''}`);
}

export function parseMoggerStackInput(input) {
  return buildStackPromptSteps(`${input ?? ''}`.split(/[\n,;+>\/|]+/g));
}

export function describeMoggerStack(stack = []) {
  const labels = buildModeLabelList(stack);
  return labels.length ? labels.join(' → ') : 'No edits yet';
}

export function moggerSessionIsExpired(session, at = nowMs()) {
  if (!session?.expiresAt) {
    return false;
  }

  return session.expiresAt <= at;
}

export function assertMoggerSessionOwner(session, userId) {
  return Boolean(session) && session.ownerId === userId;
}

export function buildMoggerSessionTitle(session, publicShare = false) {
  if (publicShare) {
    return 'Anonymous Looks Lab';
  }

  return `Looks Lab • ${session.subjectLabel ?? 'Uploaded image'}`;
}

export function buildMoggerRows(session) {
  const currentMode = normalizeMoggerMode(session.lastMode) ?? 'analysis';
  const disabled = session.status === 'closed';

  return [
    new ActionRowBuilder().addComponents(
      moggerButton(`mogger_action:hair:${session.sessionId}:${session.ownerId}`, 'Saç', currentMode === 'hair' ? ButtonStyle.Primary : ButtonStyle.Secondary, moggerMeta('hair').emoji, disabled),
      moggerButton(`mogger_action:grooming:${session.sessionId}:${session.ownerId}`, 'Grooming', currentMode === 'grooming' ? ButtonStyle.Primary : ButtonStyle.Secondary, moggerMeta('grooming').emoji, disabled),
      moggerButton(`mogger_action:camera:${session.sessionId}:${session.ownerId}`, 'Kamera', currentMode === 'camera' ? ButtonStyle.Primary : ButtonStyle.Secondary, moggerMeta('camera').emoji, disabled),
      moggerButton(`mogger_action:style:${session.sessionId}:${session.ownerId}`, 'Style', currentMode === 'style' ? ButtonStyle.Primary : ButtonStyle.Secondary, moggerMeta('style').emoji, disabled)
    ),
    new ActionRowBuilder().addComponents(
      moggerButton(`mogger_stack:${session.sessionId}:${session.ownerId}`, 'Stack', ButtonStyle.Secondary, moggerMeta('stack').emoji, disabled),
      moggerButton(`mogger_compare:${session.sessionId}:${session.ownerId}`, 'Compare', ButtonStyle.Secondary, moggerMeta('compare').emoji, disabled),
      moggerButton(`mogger_share:${session.sessionId}:${session.ownerId}`, session.isPublic ? 'Update share' : 'Share', ButtonStyle.Success, moggerMeta('share').emoji, disabled),
      moggerButton(`mogger_reset:${session.sessionId}:${session.ownerId}`, 'Reset', ButtonStyle.Danger, moggerMeta('reset').emoji, disabled)
    ),
    new ActionRowBuilder().addComponents(
      moggerButton(`mogger_close:${session.sessionId}:${session.ownerId}`, 'Close', ButtonStyle.Secondary, moggerMeta('close').emoji, session.status === 'closed')
    )
  ];
}

export function buildMoggerVoteRows(sessionId, voteCount = 0) {
  return [
    new ActionRowBuilder().addComponents(
      moggerButton(`mogger_vote:${sessionId}`, 'Anon səs ver', ButtonStyle.Success, '👍'),
      moggerButton(`mogger_vote_count:${sessionId}`, `${voteCount} səs`, ButtonStyle.Secondary, '📊', true)
    )
  ];
}

export function buildMoggerStackModal(session) {
  const modal = new ModalBuilder()
    .setCustomId(`mogger_stack:${session.sessionId}:${session.ownerId}`)
    .setTitle('Mogger Stack');

  const steps = new TextInputBuilder()
    .setCustomId('steps')
    .setLabel('Edits')
    .setPlaceholder('hair, grooming, camera, style')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(180);

  const note = new TextInputBuilder()
    .setCustomId('note')
    .setLabel('Note')
    .setPlaceholder('What should the stack emphasize?')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(120);

  modal.addComponents(
    new ActionRowBuilder().addComponents(steps),
    new ActionRowBuilder().addComponents(note)
  );

  return modal;
}

export async function initializeMoggerSession({ openai, model, owner, attachment, targetUser = null }) {
  if (!isMoggerImageAttachment(attachment)) {
    const error = new Error('invalid_mogger_image');
    error.code = 'invalid_mogger_image';
    throw error;
  }

  const now = nowMs();
  const targetAvatar = targetUser?.displayAvatarURL?.({ extension: 'png', size: 512, forceStatic: true }) ?? null;
  const session = await saveMoggerSession({
    sessionId: `mogger_${randomUUID()}`,
    ownerId: owner.id,
    targetUserId: targetUser?.id ?? null,
    subjectLabel: targetUser?.displayName ?? targetUser?.username ?? `${attachment.name ?? 'Uploaded image'}`,
    originalImage: attachment.url,
    referenceImages: [attachment.url, targetAvatar].filter(Boolean),
    history: [
      {
        kind: 'session_created',
        createdAt: now,
        mode: 'analysis',
        note: 'Initial mogger session created.'
      }
    ],
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
    expiresAt: now + MOGGER_SESSION_TTL_MS
  });

  const analysis = await analyzeMoggerImage({
    openai,
    model,
    session,
    imageUrl: attachment.url,
    referenceImages: [attachment.url, targetAvatar].filter(Boolean)
  });

  const generation = await saveMoggerGeneration({
    id: `mogger_gen_${randomUUID()}`,
    sessionId: session.sessionId,
    kind: 'analysis',
    mode: 'analysis',
    label: 'Initial analysis',
    prompt: buildAnalysisPrompt(session),
    summary: analysis.summary,
    analysis,
    stackSnapshot: [],
    details: {
      ownerId: owner.id,
      targetUserId: targetUser?.id ?? null,
      sourceImage: attachment.url
    },
    auraSpent: 0,
    createdAt: now
  });

  const updatedSession = await saveMoggerSession({
    ...session,
    analysis,
    history: [
      ...session.history,
      {
        kind: 'analysis',
        createdAt: nowMs(),
        mode: 'analysis',
        generationId: generation.id,
        summary: analysis.summary
      }
    ],
    generationCount: 1,
    latestGenerationId: generation.id,
    lastMode: 'analysis',
    updatedAt: nowMs()
  });

  return {
    session: updatedSession,
    analysis,
    generation
  };
}

export async function analyzeMoggerImage({ openai, model, session, imageUrl, referenceImages = [] }) {
  const fallback = buildAnalysisFallback(session);
  if (!openai || typeof openai.responses?.create !== 'function') {
    return fallback;
  }

  try {
    const response = await openai.responses.create({
      model,
      instructions: buildAnalysisPrompt(session),
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Analyze the image and return the JSON payload only.' },
            { type: 'input_image', image_url: imageUrl },
            ...referenceImages.slice(1).map(url => ({ type: 'input_image', image_url: url }))
          ]
        }
      ],
      temperature: 0.35,
      max_output_tokens: 700
    });

    const parsed = parseJsonBlock(response.output_text);
    if (!parsed) {
      return {
        ...fallback,
        rawText: response.output_text ?? ''
      };
    }

    return normalizeAnalysisPayload(parsed, {
      ...fallback,
      rawText: response.output_text ?? ''
    });
  } catch (error) {
    console.error('Mogger analysis failed, using fallback:', error);
    return {
      ...fallback,
      rawText: `${error?.message ?? ''}`
    };
  }
}

export async function applyMoggerAction({ openai, model, session, action, note = '' }) {
  const mode = normalizeMoggerMode(action);
  if (!mode || !['hair', 'grooming', 'camera', 'style'].includes(mode)) {
    throw new Error('invalid_mogger_action');
  }

  if (session.status === 'closed') {
    const error = new Error('mogger_session_closed');
    error.code = 'mogger_session_closed';
    throw error;
  }

  if (moggerSessionIsExpired(session)) {
    const error = new Error('mogger_session_expired');
    error.code = 'mogger_session_expired';
    throw error;
  }

  const analysis = await simulateMoggerAction({
    openai,
    model,
    session,
    mode,
    note
  });

  const createdAt = nowMs();
  const stack = [...(session.stack ?? []), mode];
  const generation = await saveMoggerGeneration({
    id: `mogger_gen_${randomUUID()}`,
    sessionId: session.sessionId,
    kind: 'simulation',
    mode,
    label: moggerMeta(mode).label,
    prompt: buildSimulationPrompt({ ...session, analysis, stack }, mode, note),
    summary: analysis.summary,
    analysis,
    stackSnapshot: stack,
    details: {
      note,
      mode,
      sourceGenerationId: session.latestGenerationId ?? null
    },
    auraSpent: 0,
    createdAt
  });

  const updatedSession = await saveMoggerSession({
    ...session,
    stack,
    analysis,
    history: [
      ...(session.history ?? []),
      {
        kind: 'simulation',
        createdAt,
        mode,
        note,
        generationId: generation.id,
        summary: analysis.summary
      }
    ],
    generationCount: (session.generationCount ?? 0) + 1,
    latestGenerationId: generation.id,
    lastMode: mode,
    updatedAt: createdAt
  });

  return {
    session: updatedSession,
    analysis,
    generation
  };
}

export async function applyMoggerStack({ openai, model, session, steps = [], note = '' }) {
  const stackSteps = normalizeList(steps).map(step => normalizeMoggerMode(step)).filter(Boolean);
  if (!stackSteps.length) {
    const error = new Error('mogger_stack_empty');
    error.code = 'mogger_stack_empty';
    throw error;
  }

  if (session.status === 'closed') {
    const error = new Error('mogger_session_closed');
    error.code = 'mogger_session_closed';
    throw error;
  }

  if (moggerSessionIsExpired(session)) {
    const error = new Error('mogger_session_expired');
    error.code = 'mogger_session_expired';
    throw error;
  }

  const analysis = await simulateMoggerStack({
    openai,
    model,
    session,
    steps: stackSteps,
    note
  });

  const createdAt = nowMs();
  const stack = [...(session.stack ?? []), ...stackSteps];
  const generation = await saveMoggerGeneration({
    id: `mogger_gen_${randomUUID()}`,
    sessionId: session.sessionId,
    kind: 'stack',
    mode: 'stack',
    label: 'Stack',
    prompt: buildStackPrompt(session, stackSteps, note),
    summary: analysis.summary,
    analysis,
    stackSnapshot: stack,
    details: {
      note,
      steps: stackSteps,
      sourceGenerationId: session.latestGenerationId ?? null
    },
    auraSpent: 0,
    createdAt
  });

  const updatedSession = await saveMoggerSession({
    ...session,
    stack,
    analysis,
    history: [
      ...(session.history ?? []),
      {
        kind: 'stack',
        createdAt,
        mode: 'stack',
        note,
        steps: stackSteps,
        generationId: generation.id,
        summary: analysis.summary
      }
    ],
    generationCount: (session.generationCount ?? 0) + 1,
    latestGenerationId: generation.id,
    lastMode: 'stack',
    updatedAt: createdAt
  });

  return {
    session: updatedSession,
    analysis,
    generation
  };
}

async function simulateMoggerAction({ openai, model, session, mode, note = '' }) {
  const fallback = buildSimulationFallback(session, mode, note);
  if (!openai || typeof openai.responses?.create !== 'function') {
    return fallback;
  }

  try {
    const response = await openai.responses.create({
      model,
      instructions: buildSimulationPrompt(session, mode, note),
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Return the simulation JSON only.' }
          ]
        }
      ],
      temperature: 0.45,
      max_output_tokens: 420
    });

    const parsed = parseJsonBlock(response.output_text);
    if (!parsed) {
      return {
        ...fallback,
        rawText: response.output_text ?? ''
      };
    }

    return normalizeSimulationPayload(parsed, {
      ...fallback,
      rawText: response.output_text ?? ''
    });
  } catch (error) {
    console.error('Mogger simulation failed, using fallback:', error);
    return {
      ...fallback,
      rawText: `${error?.message ?? ''}`
    };
  }
}

async function simulateMoggerStack({ openai, model, session, steps, note = '' }) {
  const fallback = normalizeSimulationPayload({
    summary: `Stack tətbiq olundu: ${buildModeChipText(steps)}. Daha intentional və daha qatlı bir nəticə hədəflənir.`,
    changes: [
      ...buildModeLabelList(steps).map(label => `${label} layer added`),
      'Private preview updated'
    ],
    focus: 'Stack',
    nextStackHint: 'Compare et, sonra share et.',
    warnings: ['Identity stays locked', 'No medical claims', 'No region inference']
  });

  if (!openai || typeof openai.responses?.create !== 'function') {
    return fallback;
  }

  try {
    const response = await openai.responses.create({
      model,
      instructions: buildStackPrompt(session, steps, note),
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Return the stack simulation JSON only.' }
          ]
        }
      ],
      temperature: 0.45,
      max_output_tokens: 420
    });

    const parsed = parseJsonBlock(response.output_text);
    if (!parsed) {
      return {
        ...fallback,
        rawText: response.output_text ?? ''
      };
    }

    return normalizeSimulationPayload(parsed, {
      ...fallback,
      rawText: response.output_text ?? ''
    });
  } catch (error) {
    console.error('Mogger stack simulation failed, using fallback:', error);
    return {
      ...fallback,
      rawText: `${error?.message ?? ''}`
    };
  }
}

function buildStackPrompt(session, steps, note = '') {
  return [
    'You are continuing an existing Mogger Looks Lab stack session.',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "summary": "...",',
    '  "changes": ["..."],',
    '  "focus": "...",',
    '  "nextStackHint": "...",',
    '  "warnings": ["..."]',
    '}',
    'Rules:',
    '- Keep the subject identity locked and do not make medical claims.',
    '- Keep the result purely cosmetic and visual.',
    '- Keep the answer concise and in Azerbaijani.',
    `Current stack: ${buildModeChipText(session.stack)}`,
    `New stack steps: ${buildModeChipText(steps)}`,
    `Note: ${note || 'none'}`,
    `Previous analysis summary: ${session.analysis?.summary ?? 'none'}`
  ].join('\n');
}

export async function publishMoggerSession({ session, channel, voteCount = 0, analysis = session.analysis ?? {} }) {
  const payload = await buildMoggerPublicPayload({
    session,
    analysis,
    voteCount
  });

  const message = await channel.send(payload);
  await saveMoggerSession({
    ...session,
    isPublic: true,
    shareChannelId: channel.id,
    shareMessageId: message.id,
    updatedAt: nowMs()
  });

  return { payload, message };
}

export async function toggleMoggerPublicState(session, channel, voteCount = 0) {
  return publishMoggerSession({ session, channel, voteCount, analysis: session.analysis ?? {} });
}

export async function updateMoggerVote(sessionId, voterId, vote = 1) {
  return saveMoggerVote({
    sessionId,
    voterId,
    vote,
    createdAt: nowMs(),
    updatedAt: nowMs()
  });
}

export async function buildMoggerPanelPayload({ session, analysis = session.analysis ?? {}, voteCount = 0, mode = session.lastMode ?? 'analysis' }) {
  const title = buildMoggerSessionTitle(session, false);
  const embed = buildMoggerEmbed({
    title,
    session,
    analysis,
    voteCount,
    mode,
    publicShare: false
  });

  const components = session.status === 'closed' ? [] : buildMoggerRows(session);
  const attachment = await buildMoggerAttachment({
    session,
    analysis,
    voteCount,
    mode,
    publicShare: false,
    title
  });

  const payload = {
    embeds: [embed],
    components,
    ephemeral: true
  };

  if (attachment) {
    payload.files = [attachment];
  }

  return payload;
}

export async function buildMoggerPublicPayload({ session, analysis = session.analysis ?? {}, voteCount = 0, mode = session.lastMode ?? 'analysis' }) {
  const title = buildMoggerSessionTitle(session, true);
  const embed = buildMoggerEmbed({
    title,
    session,
    analysis,
    voteCount,
    mode,
    publicShare: true
  });

  const attachment = await buildMoggerAttachment({
    session,
    analysis,
    voteCount,
    mode,
    publicShare: true,
    title
  });

  const payload = {
    embeds: [embed],
    components: buildMoggerVoteRows(session.sessionId, voteCount)
  };

  if (attachment) {
    payload.files = [attachment];
  }

  return payload;
}

async function buildMoggerAttachment({ session, analysis, voteCount, mode, publicShare, title }) {
  try {
    const image = await renderMoggerCard({
      session,
      analysis,
      voteCount,
      mode,
      publicShare,
      title
    });

    return new AttachmentBuilder(image, { name: `mogger-${session.sessionId}-${mode}.png` });
  } catch (error) {
    console.error('Mogger card render failed:', error);
    return null;
  }
}

function buildMoggerEmbed({ title, session, analysis, voteCount, mode, publicShare }) {
  const embed = new EmbedBuilder()
    .setColor(publicShare ? 0x22c55e : 0x38bdf8)
    .setFooter({ text: `${brand.footer} • private by default • no medical claims` })
    .setTimestamp()
    .setTitle(title)
    .setDescription([
      discordValue(analysis.summary, 'Mogger Looks Lab hazırdır.'),
      discordValue(analysis.privacyNote, 'Private by default.')
    ].join('\n'));

  const visible = normalizeList(analysis.visibleFeatures, []);
  const strengths = normalizeList(analysis.strengths, []);
  const cautions = normalizeList(analysis.cautions, []);
  const warnings = normalizeList(analysis.warnings, []);

  embed.addFields(
    { name: 'Mode', value: moggerMeta(mode).label, inline: true },
    { name: 'Status', value: session.status === 'closed' ? 'Closed' : session.isPublic ? 'Public' : 'Private', inline: true },
    { name: 'Votes', value: `${voteCount}`, inline: true },
    { name: 'Stack', value: discordValue(describeMoggerStack(session.stack), 'No edits yet'), inline: false },
    { name: 'Visible', value: discordValue(visible.join('\n') || 'No visible cues captured.'), inline: false },
    { name: 'Strengths', value: discordValue(strengths.join('\n') || '—'), inline: true },
    { name: 'Cautions', value: discordValue(cautions.join('\n') || '—'), inline: true },
    { name: 'Guardrails', value: discordValue([
      analysis.identityLock,
      analysis.regionLock,
      warnings.length ? warnings.join(' • ') : 'No extra warnings'
    ].join('\n')), inline: false },
    { name: 'Session', value: `#${session.sessionId.slice(-8)} • ${session.generationCount} generations`, inline: false }
  );

  if (session.targetUserId && !publicShare) {
    embed.addFields({
      name: 'Declared subject',
      value: discordValue(session.subjectLabel ?? `<@${session.targetUserId}>`),
      inline: true
    });
  }

  return embed;
}

export {
  moggerModeMeta as MOGGER_MODE_META,
  moggerSynonyms as MOGGER_SYNONYMS,
  loadMoggerSession,
  loadMoggerSessionBundle,
  loadMoggerVoteCount,
  saveMoggerSession
};
