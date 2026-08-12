import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { xpNeeded } from './economy.js';

const FONT_DIR = join(process.cwd(), 'assets', 'fonts');

GlobalFonts.registerFromPath(
  join(FONT_DIR, 'Inter_18pt-Regular.ttf'),
  'Octoson Inter'
);

GlobalFonts.registerFromPath(
  join(FONT_DIR, 'Inter_18pt-Medium.ttf'),
  'Octoson Inter'
);

GlobalFonts.registerFromPath(
  join(FONT_DIR, 'Inter_18pt-SemiBold.ttf'),
  'Octoson Inter'
);

GlobalFonts.registerFromPath(
  join(FONT_DIR, 'Inter_18pt-Bold.ttf'),
  'Octoson Inter'
);

GlobalFonts.registerFromPath(
  join(FONT_DIR, 'Inter_18pt-ExtraBold.ttf'),
  'Octoson Inter'
);

console.log('[FONT CHECK]', {
  inter: GlobalFonts.has('Octoson Inter')
});


const iconCache = new Map();

// ======================================================
// CANVAS DEBUG BUILD
// ======================================================
// TEMPORARILY left ON so we can prove exactly which renderer
// Discord is using and inspect the raw scene before compositing.
const CANVAS_DEBUG_BUILD = 'OCTOSON-CANVAS-DEBUG-V6';
const CANVAS_DEBUG_ENABLED = false;
const CANVAS_DEBUG_DIR = join(process.cwd(), 'data', 'canvas-debug');
let canvasDebugCounter = 0;

console.log(
  `[CANVAS DEBUG] LOADED ${CANVAS_DEBUG_BUILD}`,
  {
    file: import.meta.url,
    cwd: process.cwd(),
    node: process.version
  }
);

function canvasDebugLog(event, payload = {}) {
  if (!CANVAS_DEBUG_ENABLED) return;
  console.log(`[CANVAS DEBUG] ${event}`, payload);
}

function safeDebugName(value) {
  return `${value ?? 'unknown'}`
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'unknown';
}

async function dumpCanvasDebug(canvas, label, game, renderId) {
  if (!CANVAS_DEBUG_ENABLED) return null;

  try {
    await mkdir(CANVAS_DEBUG_DIR, { recursive: true });

    const fileName =
      `${String(renderId).padStart(4, '0')}-${safeDebugName(game)}-${safeDebugName(label)}.png`;

    const filePath = join(CANVAS_DEBUG_DIR, fileName);
    const buffer = canvas.toBuffer('image/png');

    await writeFile(filePath, buffer);

    canvasDebugLog('PNG_DUMP', {
      label,
      game,
      renderId,
      bytes: buffer.length,
      filePath
    });

    return filePath;
  } catch (error) {
    console.error('[CANVAS DEBUG] dump failed', {
      label,
      game,
      renderId,
      message: error?.message,
      stack: error?.stack
    });

    return null;
  }
}

// Casino renderer v6 debug: isolated off-screen scene rendering.
// We also dump the scene PNG and final PNG separately so we can see
// exactly which stage introduces the giant N/M/S shape.

const iconPaths = {
  wallet: 'wallet-fill.svg',
  bank: 'bank-fill.svg',
  trophy: 'trophy-fill.svg',
  medal: 'medal-fill.svg',
  star: 'star-fill.svg',
  lightning: 'lightning-fill.svg',
  chart: 'chart-line-up-fill.svg',
  crown: 'crown-fill.svg',
  users: 'users-three-fill.svg',
  sparkle: 'sparkle-fill.svg',
  diamond: 'diamond-fill.svg'
};

export async function renderProfileCard(user, profile, options = {}) {
  const width = 1200;
  const height = 650;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // ============================================================
  // SAME PROFILE CONTRACT AS WEB
  // ============================================================

  const identity =
    profile?.identity &&
    typeof profile.identity === 'object' &&
    !Array.isArray(profile.identity)
      ? profile.identity
      : {};

  const appearance =
    profile?.appearance &&
    typeof profile.appearance === 'object' &&
    !Array.isArray(profile.appearance)
      ? profile.appearance
      : {};

  const verified =
    identity.verified === true ||
    profile?.verified === true;

  const primaryColor =
    verified && /^#[0-9a-fA-F]{6}$/.test(String(appearance.primaryColor ?? ''))
      ? String(appearance.primaryColor)
      : '#67e8f9';

  const secondaryColor =
    verified && /^#[0-9a-fA-F]{6}$/.test(String(appearance.secondaryColor ?? ''))
      ? String(appearance.secondaryColor)
      : '#6366f1';

  const profileGradient =
    verified
      ? String(appearance.gradient ?? 'cyan')
      : 'cyan';

  const bannerAnimation =
    verified
      ? String(appearance.bannerAnimation ?? 'aurora')
      : 'none';

  const glowIntensity = Math.min(
    100,
    Math.max(
      0,
      Number(appearance.glowIntensity ?? 55)
    )
  );

  // ============================================================
  // HELPERS LOCAL TO PROFILE RENDERER
  // ============================================================

  function hexRgb(hex) {
    const clean = String(hex).replace('#', '');

    if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
      return { r: 103, g: 232, b: 249 };
    }

    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }

  function rgba(hex, alpha) {
    const { r, g, b } = hexRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function webText(
    value,
    x,
    y,
    {
      size = 12,
      weight = 500,
      color = '#ffffff',
      align = 'left',
      maxWidth = undefined
    } = {}
  ) {
    ctx.save();

    ctx.font =
      `${weight} ${size}px "Octoson Inter"`;

    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';

    if (maxWidth) {
      ctx.fillText(String(value), x, y, maxWidth);
    } else {
      ctx.fillText(String(value), x, y);
    }

    ctx.restore();
  }

  function lineIcon(type, x, y, size, color, lineWidth = 1.7) {
    const s = size;

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = 'transparent';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (type === 'gem') {
      ctx.beginPath();
      ctx.moveTo(s * .28, s * .13);
      ctx.lineTo(s * .72, s * .13);
      ctx.lineTo(s * .93, s * .38);
      ctx.lineTo(s * .50, s * .90);
      ctx.lineTo(s * .07, s * .38);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(s * .07, s * .38);
      ctx.lineTo(s * .93, s * .38);
      ctx.moveTo(s * .28, s * .13);
      ctx.lineTo(s * .39, s * .38);
      ctx.lineTo(s * .50, s * .90);
      ctx.moveTo(s * .72, s * .13);
      ctx.lineTo(s * .61, s * .38);
      ctx.lineTo(s * .50, s * .90);
      ctx.stroke();
    }

    if (type === 'wallet') {
      roundRect(ctx, s * .08, s * .20, s * .84, s * .62, s * .10);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(s * .16, s * .20);
      ctx.lineTo(s * .70, s * .20);
      ctx.lineTo(s * .70, s * .12);
      ctx.lineTo(s * .18, s * .12);
      ctx.stroke();

      roundRect(ctx, s * .62, s * .39, s * .30, s * .23, s * .06);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(s * .72, s * .505, s * .018, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (type === 'bank') {
      ctx.beginPath();
      ctx.moveTo(s * .08, s * .31);
      ctx.lineTo(s * .50, s * .08);
      ctx.lineTo(s * .92, s * .31);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(s * .12, s * .39);
      ctx.lineTo(s * .88, s * .39);

      for (const cx of [.22, .42, .62, .82]) {
        ctx.moveTo(s * cx, s * .42);
        ctx.lineTo(s * cx, s * .72);
      }

      ctx.moveTo(s * .10, s * .78);
      ctx.lineTo(s * .90, s * .78);
      ctx.moveTo(s * .06, s * .88);
      ctx.lineTo(s * .94, s * .88);
      ctx.stroke();
    }

    if (type === 'crown') {
      ctx.beginPath();
      ctx.moveTo(s * .10, s * .30);
      ctx.lineTo(s * .30, s * .54);
      ctx.lineTo(s * .50, s * .20);
      ctx.lineTo(s * .70, s * .54);
      ctx.lineTo(s * .90, s * .30);
      ctx.lineTo(s * .80, s * .78);
      ctx.lineTo(s * .20, s * .78);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(s * .22, s * .88);
      ctx.lineTo(s * .78, s * .88);
      ctx.stroke();
    }

    if (type === 'badgecheck') {
      // Lucide BadgeCheck-like 8-lobed badge.
      const cx = s / 2;
      const cy = s / 2;
      const outer = s * .43;
      const inner = s * .34;
      const points = 16;

      ctx.beginPath();

      for (let i = 0; i < points; i++) {
        const angle =
          -Math.PI / 2 +
          (Math.PI * 2 * i) / points;

        const radius =
          i % 2 === 0 ? outer : inner;

        const px =
          cx + Math.cos(angle) * radius;

        const py =
          cy + Math.sin(angle) * radius;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      ctx.closePath();

      ctx.fillStyle = rgba(primaryColor, .10);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(s * .30, s * .51);
      ctx.lineTo(s * .44, s * .65);
      ctx.lineTo(s * .72, s * .35);
      ctx.stroke();
    }

    ctx.restore();
  }

  function statusPill(x, y, label, accent = false) {
    ctx.save();

    ctx.font = `500 10px "Octoson Inter"`;

    const tw = ctx.measureText(label).width;
    const w = tw + 28;
    const h = 28;

    roundRect(ctx, x, y, w, h, 14);

    ctx.fillStyle =
      accent
        ? rgba(primaryColor, .03)
        : 'rgba(255,255,255,.025)';

    ctx.fill();

    ctx.strokeStyle =
      accent
        ? rgba(primaryColor, .09)
        : 'rgba(255,255,255,.065)';

    ctx.lineWidth = 1;
    ctx.stroke();

    webText(label, x + 14, y + 18, {
      size: 10,
      weight: 500,
      color:
        accent
          ? rgba(primaryColor, .55)
          : 'rgba(255,255,255,.30)'
    });

    ctx.restore();

    return w;
  }

  function heroStat({
    x,
    label,
    value,
    suffix = '',
    icon,
    accent = false
  }) {
    const y = 139;
    const w = 112;
    const h = 112;

    roundRect(ctx, x, y, w, h, 15);

    ctx.fillStyle =
      accent
        ? rgba(primaryColor, .025)
        : 'rgba(0,0,0,.20)';

    ctx.fill();

    ctx.strokeStyle =
      accent
        ? rgba(primaryColor, .085)
        : 'rgba(255,255,255,.055)';

    ctx.lineWidth = 1;
    ctx.stroke();

    webText(label, x + 14, y + 28, {
      size: 8,
      weight: 500,
      color: 'rgba(255,255,255,.20)',
      maxWidth: 72
    });

    lineIcon(
      icon,
      x + 87,
      y + 17,
      12,
      accent
        ? rgba(primaryColor, .45)
        : 'rgba(255,255,255,.18)',
      1.5
    );

    webText(value, x + 14, y + 72, {
      size: 14,
      weight: 600,
      color: 'rgba(255,255,255,.65)',
      maxWidth: 88
    });

    if (suffix) {
      webText(suffix.toUpperCase(), x + 14, y + 91, {
        size: 7,
        weight: 600,
        color: 'rgba(255,255,255,.15)'
      });
    }
  }

  // ============================================================
  // DATA — SAME INTENT AS WEB HERO
  // ============================================================

  const stats =
    profile?.stats &&
    typeof profile.stats === 'object'
      ? profile.stats
      : {};

  const world =
    profile?.world &&
    typeof profile.world === 'object'
      ? profile.world
      : {};

  const wallet = Number(profile?.balance ?? 0);
  const bank = Number(profile?.bank ?? 0);

  const storedNetWorth = Number(world.netWorth ?? 0);

  const netWorth =
    storedNetWorth > 0
      ? storedNetWorth
      : wallet + bank;

  const level =
    Math.max(1, Number(profile?.level ?? 1));

  const xp =
    Math.max(0, Number(profile?.xp ?? 0));

  const prestige =
    Math.max(0, Number(profile?.prestige ?? 0));

  const gamesPlayed =
    Math.max(0, Number(stats.gamesPlayed ?? 0));

  const gamesWon =
    Math.max(0, Number(stats.gamesWon ?? 0));

  const winRate =
    gamesPlayed > 0
      ? Math.round((gamesWon / gamesPlayed) * 100)
      : 0;

  const luck =
    Number(profile?.luck ?? 50);

  const streak =
    Number(profile?.dailyStreak ?? 0);

  const rank =
    cleanRank(profile?.rank ?? 'Yeni başlayan');

  const title =
    String(profile?.title ?? 'Yeni üzv');

  const needed =
    xpNeeded(Math.min(level, 50));

  const isMaxLevel =
    level >= 50;

  const xpProgress =
    isMaxLevel
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            needed > 0
              ? (xp / needed) * 100
              : 0
          )
        );

  // ============================================================
  // PAGE / HERO BACKGROUND
  // ============================================================

  ctx.fillStyle = '#07080b';
  ctx.fillRect(0, 0, width, height);

  // Very subtle website-style dotted atmosphere.
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.022)';

  for (let yy = 22; yy < height; yy += 24) {
    for (let xx = 22; xx < width; xx += 24) {
      ctx.beginPath();
      ctx.arc(xx, yy, .7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  // Main hero
  const cardX = 30;
  const cardY = 30;
  const cardW = 1140;
  const cardH = 590;

  roundRect(
    ctx,
    cardX,
    cardY,
    cardW,
    cardH,
    26
  );

  ctx.fillStyle = '#09090c';
  ctx.fill();

  ctx.strokeStyle =
    verified
      ? rgba(primaryColor, .14)
      : 'rgba(255,255,255,.07)';

  ctx.lineWidth = 1;
  ctx.stroke();

  // ============================================================
  // VERIFIED THEME ATMOSPHERE
  // ============================================================

  if (verified) {
    // Primary top-right radial glow
    const primaryGlow =
      ctx.createRadialGradient(
        930,
        70,
        0,
        930,
        70,
        360
      );

    primaryGlow.addColorStop(
      0,
      rgba(
        primaryColor,
        Math.max(
          .035,
          (glowIntensity / 100) * .22
        )
      )
    );

    primaryGlow.addColorStop(
      .42,
      rgba(
        primaryColor,
        Math.max(
          .015,
          (glowIntensity / 100) * .075
        )
      )
    );

    primaryGlow.addColorStop(
      1,
      rgba(primaryColor, 0)
    );

    ctx.fillStyle = primaryGlow;
    ctx.fillRect(
      cardX,
      cardY,
      cardW,
      cardH
    );

    // Secondary lower-left glow
    const secondaryGlow =
      ctx.createRadialGradient(
        220,
        575,
        0,
        220,
        575,
        310
      );

    secondaryGlow.addColorStop(
      0,
      rgba(
        secondaryColor,
        Math.max(
          .025,
          (glowIntensity / 100) * .15
        )
      )
    );

    secondaryGlow.addColorStop(
      1,
      rgba(secondaryColor, 0)
    );

    ctx.fillStyle = secondaryGlow;
    ctx.fillRect(
      cardX,
      cardY,
      cardW,
      cardH
    );

    // Static PNG representation of selected gradient.
    const diagonal =
      ctx.createLinearGradient(
        cardX,
        cardY,
        cardX + cardW,
        cardY + cardH
      );

    diagonal.addColorStop(
      0,
      rgba(primaryColor, .04)
    );

    diagonal.addColorStop(
      .45,
      'rgba(0,0,0,0)'
    );

    diagonal.addColorStop(
      1,
      rgba(secondaryColor, .05)
    );

    ctx.fillStyle = diagonal;
    ctx.fillRect(
      cardX,
      cardY,
      cardW,
      cardH
    );

    // Exact web concept: thin top theme line.
    const themeLine =
      ctx.createLinearGradient(
        cardX + 150,
        0,
        cardX + cardW - 150,
        0
      );

    themeLine.addColorStop(
      0,
      rgba(primaryColor, 0)
    );

    themeLine.addColorStop(
      .5,
      rgba(primaryColor, .42)
    );

    themeLine.addColorStop(
      1,
      rgba(primaryColor, 0)
    );

    ctx.fillStyle = themeLine;
    ctx.fillRect(
      cardX + 120,
      cardY,
      cardW - 240,
      1
    );
  } else {
    // Same default cyan haze as web non-verified hero.
    const defaultGlow =
      ctx.createRadialGradient(
        1030,
        30,
        0,
        1030,
        30,
        400
      );

    defaultGlow.addColorStop(
      0,
      'rgba(165,243,252,.065)'
    );

    defaultGlow.addColorStop(
      1,
      'rgba(165,243,252,0)'
    );

    ctx.fillStyle = defaultGlow;
    ctx.fillRect(
      cardX,
      cardY,
      cardW,
      cardH
    );
  }

  // ============================================================
  // OCTOSON IDENTITY EYEBROW
  // ============================================================

  ctx.beginPath();
  ctx.arc(72, 75, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#a5f3fc';
  ctx.fill();

  webText(
    'OCTOSON IDENTITY',
    84,
    79,
    {
      size: 10,
      weight: 600,
      color: 'rgba(165,243,252,.55)'
    }
  );

  webText(
    'Aura economy status',
    72,
    103,
    {
      size: 11,
      weight: 400,
      color: 'rgba(255,255,255,.25)'
    }
  );

  // ============================================================
  // AVATAR
  // ============================================================

  let avatar = null;

  try {
    avatar = await loadRemoteImage(
      user.displayAvatarURL({
        extension: 'png',
        size: 256,
        forceStatic: true
      })
    );
  } catch {}

  const avatarX = 72;
  const avatarY = 151;
  const avatarSize = 92;
  const avatarRadius = 22;

  ctx.save();

  roundRect(
    ctx,
    avatarX,
    avatarY,
    avatarSize,
    avatarSize,
    avatarRadius
  );

  ctx.clip();

  if (avatar) {
    ctx.drawImage(
      avatar,
      avatarX,
      avatarY,
      avatarSize,
      avatarSize
    );
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.03)';
    ctx.fillRect(
      avatarX,
      avatarY,
      avatarSize,
      avatarSize
    );
  }

  ctx.restore();

  roundRect(
    ctx,
    avatarX,
    avatarY,
    avatarSize,
    avatarSize,
    avatarRadius
  );

  ctx.strokeStyle =
    'rgba(255,255,255,.10)';

  ctx.lineWidth = 1;
  ctx.stroke();

  // Level badge — same placement/concept as web.
  const levelBadge =
    String(level);

  ctx.font =
    `700 11px "Octoson Inter"`;

  const levelWidth =
    Math.max(
      32,
      ctx.measureText(levelBadge).width + 20
    );

  const levelX =
    avatarX +
    avatarSize -
    levelWidth +
    7;

  const levelY =
    avatarY +
    avatarSize -
    19;

  roundRect(
    ctx,
    levelX,
    levelY,
    levelWidth,
    32,
    10
  );

  ctx.fillStyle =
    verified
      ? primaryColor
      : '#cffafe';

  ctx.fill();

  ctx.strokeStyle = '#09090c';
  ctx.lineWidth = 3;
  ctx.stroke();

  webText(
    levelBadge,
    levelX + levelWidth / 2,
    levelY + 21,
    {
      size: 11,
      weight: 700,
      color: '#05070a',
      align: 'center'
    }
  );

  // ============================================================
  // IDENTITY
  // ============================================================

  const name =
    displayName(user);

  const nameX = 190;
  const nameY = 179;

  webText(
    name,
    nameX,
    nameY,
    {
      size: 30,
      weight: 600,
      color: '#ffffff',
      maxWidth: 360
    }
  );

  // Put the web BadgeCheck directly beside rendered name.
  if (verified) {
    ctx.save();

    ctx.font =
      `600 30px "Octoson Inter"`;

    const measuredName =
      Math.min(
        ctx.measureText(name).width,
        360
      );

    lineIcon(
      'badgecheck',
      nameX + measuredName + 10,
      nameY - 18,
      18,
      rgba(primaryColor, .90),
      2.0
    );

    ctx.restore();
  }

  webText(
    `@${user.username ?? 'user'}`,
    nameX,
    205,
    {
      size: 11,
      weight: 400,
      color: 'rgba(255,255,255,.25)',
      maxWidth: 350
    }
  );

  let pillX = nameX;

  const rankWidth =
    statusPill(
      pillX,
      221,
      rank,
      false
    );

  pillX += rankWidth + 8;

  const titleWidth =
    statusPill(
      pillX,
      221,
      title,
      true
    );

  pillX += titleWidth + 8;

  if (prestige > 0) {
    statusPill(
      pillX,
      221,
      `Prestige ${prestige}`,
      false
    );
  }

  // ============================================================
  // EXACT WEB HERO STATS
  // ============================================================

  heroStat({
    x: 650,
    label: 'Net Worth',
    value: formatNumber(netWorth),
    suffix: 'Aura',
    icon: 'gem',
    accent: true
  });

  heroStat({
    x: 769,
    label: 'Wallet',
    value: formatNumber(wallet),
    icon: 'wallet'
  });

  heroStat({
    x: 888,
    label: 'Bank',
    value: formatNumber(bank),
    icon: 'bank'
  });

  heroStat({
    x: 1007,
    label: 'Prestige',
    value: formatNumber(prestige),
    icon: 'crown'
  });

  // ============================================================
  // LEVEL PROGRESS — WEB HERO LAYOUT
  // ============================================================

  ctx.beginPath();
  ctx.moveTo(72, 285);
  ctx.lineTo(1128, 285);
  ctx.strokeStyle =
    'rgba(255,255,255,.055)';
  ctx.lineWidth = 1;
  ctx.stroke();

  webText(
    'LEVEL PROGRESS',
    72,
    326,
    {
      size: 9,
      weight: 500,
      color: 'rgba(255,255,255,.20)'
    }
  );

  webText(
    `Lv. ${level}`,
    72,
    365,
    {
      size: 25,
      weight: 600,
      color: 'rgba(255,255,255,.80)'
    }
  );

  webText(
    isMaxLevel
      ? 'MAX LEVEL'
      : `${formatNumber(xp)} XP`,
    72,
    390,
    {
      size: 9,
      weight: 400,
      color: 'rgba(255,255,255,.20)'
    }
  );

  webText(
    `${Math.round(xpProgress)}%`,
    1128,
    382,
    {
      size: 9,
      weight: 500,
      color: rgba(primaryColor, .65),
      align: 'right'
    }
  );

  // progress track
  roundRect(
    ctx,
    325,
    342,
    803,
    5,
    2.5
  );

  ctx.fillStyle =
    'rgba(255,255,255,.045)';
  ctx.fill();

  const progressWidth =
    803 * (xpProgress / 100);

  if (progressWidth > 0) {
    const progressGradient =
      ctx.createLinearGradient(
        325,
        0,
        1128,
        0
      );

    progressGradient.addColorStop(
      0,
      rgba(primaryColor, .50)
    );

    progressGradient.addColorStop(
      1,
      rgba(primaryColor, 1)
    );

    roundRect(
      ctx,
      325,
      342,
      progressWidth,
      5,
      2.5
    );

    ctx.fillStyle =
      progressGradient;

    ctx.fill();
  }

  // ============================================================
  // SECONDARY METRICS
  // ============================================================

  const metrics = [
    {
      label: 'WIN RATE',
      value: `${winRate}%`,
      detail: `${formatNumber(gamesWon)} qələbə`,
      accent: true
    },
    {
      label: 'OYUN',
      value: formatNumber(gamesPlayed),
      detail: 'ümumi oyun'
    },
    {
      label: 'UĞUR',
      value: `${luck}%`,
      detail: 'luck score',
      accent: true
    },
    {
      label: 'SERİYA',
      value: `${streak} gün`,
      detail: 'daily streak'
    }
  ];

  metrics.forEach(
    (metric, index) => {
      const x =
        72 + index * 266;

      const y = 430;
      const w = 257;
      const h = 105;

      roundRect(
        ctx,
        x,
        y,
        w,
        h,
        18
      );

      ctx.fillStyle =
        'rgba(255,255,255,.018)';

      ctx.fill();

      ctx.strokeStyle =
        'rgba(255,255,255,.06)';

      ctx.lineWidth = 1;
      ctx.stroke();

      // Small restrained icon marker matching web visual weight.
      ctx.beginPath();
      ctx.arc(
        x + 21,
        y + 25,
        3.5,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        metric.accent
          ? rgba(primaryColor, .70)
          : 'rgba(255,255,255,.22)';

      ctx.fill();

      webText(
        metric.label,
        x + 38,
        y + 29,
        {
          size: 8,
          weight: 500,
          color: 'rgba(255,255,255,.20)'
        }
      );

      webText(
        metric.value,
        x + 17,
        y + 69,
        {
          size: 23,
          weight: 600,
          color: 'rgba(255,255,255,.75)',
          maxWidth: w - 34
        }
      );

      webText(
        metric.detail,
        x + 17,
        y + 90,
        {
          size: 8,
          weight: 400,
          color: 'rgba(255,255,255,.15)',
          maxWidth: w - 34
        }
      );
    }
  );

  // ============================================================
  // FOOTER
  // ============================================================

  webText(
    'OCTOSON',
    72,
    583,
    {
      size: 8,
      weight: 600,
      color: 'rgba(255,255,255,.25)'
    }
  );

  webText(
    verified
      ? `${profileGradient.toUpperCase()} THEME  •  OCTOSON VERIFIED`
      : 'AURA ECONOMY',
    600,
    583,
    {
      size: 8,
      weight: 500,
      color:
        verified
          ? rgba(primaryColor, .25)
          : 'rgba(255,255,255,.15)',
      align: 'center'
    }
  );

  webText(
    'Discord ilə sinxron  •  Aura yalnız server içi valyutadır',
    1128,
    583,
    {
      size: 8,
      weight: 400,
      color: 'rgba(255,255,255,.15)',
      align: 'right'
    }
  );

  return canvas.toBuffer('image/png');
}

export async function renderLeaderboardImage(rows, totalAura, refreshSeconds = 10) {
  const width = 1100;
  const height = 780;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const maxBalance = Math.max(1, ...rows.map(row => row.balance));

  drawBackground(ctx, width, height);
  drawGlow(ctx, 200, 90, 200, 'rgba(245, 158, 11, 0.20)');
  drawGlow(ctx, 930, 700, 240, 'rgba(99, 102, 241, 0.18)');

  await drawIcon(ctx, 'trophy', 64, 54, 54, '#f59e0b');
  drawText(ctx, 'Aura Lider Tablosu', 134, 90, { size: 44, weight: 900, color: '#f8fafc' });
  drawText(ctx, `Top 10 • ${formatNumber(totalAura)} izlənən Aura • ${refreshSeconds}s yenilənir`, 136, 124, { size: 21, color: '#94a3b8' });

  for (const row of rows) {
    const index = row.place - 1;
    const y = 158 + index * 56;
    roundRect(ctx, 54, y, 992, 46, 16);
    ctx.fillStyle = index === 0 ? 'rgba(245,158,11,0.16)' : 'rgba(15, 18, 28, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();

    const avatar = await loadRemoteImage(row.avatarUrl);
    drawAvatar(ctx, avatar, 70, y + 6, 34);

    drawText(ctx, `#${row.place}`, 120, y + 31, { size: 22, weight: 900, color: placeColor(index), maxWidth: 54 });
    drawText(ctx, row.displayName, 180, y + 31, { size: 23, weight: 800, color: '#f8fafc', maxWidth: row.primeBadge ? 220 : 285 });
    const levelX = row.primeBadge ? 500 : 460;
    const progressX = 610;
    const progressW = 260;
    if (row.primeBadge) {
      await drawBadgePill(ctx, 410, y + 10, 'PRIME', '#818cf8', '#eef2ff', 14);
    }
    drawPill(ctx, levelX, y + 10, `Sv.${row.level}`, '#14b8a6', '#06201d', 15);

    drawProgressBar(ctx, progressX, y + 18, progressW, 12, row.balance / maxBalance, placeColor(index), '#334155');
    drawText(ctx, `${formatNumber(row.balance)} Aura`, 1022, y + 31, { size: 22, weight: 900, color: '#f8fafc', align: 'right' });
  }

  roundRect(ctx, 54, 726, 992, 34, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fill();
  await drawIcon(ctx, 'users', 78, 733, 20, '#94a3b8');
  drawText(ctx, 'Octoson iqtisadiyyatı • yalnız server içi Aura • real pul dəyəri yoxdur', 110, 750, { size: 17, color: '#94a3b8' });

  return canvas.toBuffer('image/png');
}

export async function renderCasinoCard({
  title,
  subtitle,
  game,
  bet,
  balance,
  multiplier,
  status,
  details = [],
  board = null,
  tone = 'active',
  primeBadge = null,
  blackjackState = null
}) {
  const renderId = ++canvasDebugCounter;

  canvasDebugLog('renderCasinoCard START', {
    build: CANVAS_DEBUG_BUILD,
    renderId,
    game,
    tone,
    bet,
    balance,
    multiplier,
    status,
    board: `${board ?? ''}`.slice(0, 240)
  });

  const width = 1100;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const accent = tone === 'win' ? '#22c55e' : tone === 'lose' ? '#ef4444' : tone === 'push' ? '#94a3b8' : '#38bdf8';
  const [headline, context] = splitCasinoTitle(title, subtitle);
  const gameLabel = casinoGameLabel(game);

  drawCasinoBackground(ctx, width, height, accent);

  // Main glass panel
  roundRect(ctx, 30, 30, width - 60, height - 60, 30);
  ctx.fillStyle = 'rgba(8, 12, 22, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Header
  await drawIcon(ctx, casinoIcon(game), 64, 62, 42, accent);
  drawText(ctx, headline, 120, 88, { size: 34, weight: 900, color: '#f8fafc', maxWidth: 600 });
  drawText(ctx, `${gameLabel}  •  ${context}`, 122, 120, { size: 17, weight: 700, color: '#94a3b8', maxWidth: 690 });
  drawCasinoStatePill(ctx, 820, 64, tone, accent);
  if (primeBadge) await drawBadgePill(ctx, 950, 64, 'PRIME', '#818cf8', '#eef2ff', 14);

  // Render the game scene on its OWN off-screen canvas.
  // This is deliberate: @napi-rs/canvas keeps the current path alive across some
  // clip/stroke operations, and the old shared-context renderer could replay stale
  // glyph/SVG paths as enormous N/M/S-like shapes. A separate canvas gives the
  // casino scene a completely isolated path, transform and clipping state.
  const sceneCanvas = createCanvas(660, 330);
  const sceneCtx = sceneCanvas.getContext('2d');

  canvasDebugLog('SCENE START', {
    renderId,
    game,
    canvas: '660x330'
  });

  await drawCasinoScene(
    sceneCtx,
    game,
    0,
    0,
    660,
    330,
    accent,
    tone,
    board,
    { multiplier, status, bet, blackjackState }
  );

  canvasDebugLog('SCENE COMPLETE', {
    renderId,
    game,
  });

  // CRITICAL DEBUG FILE:
  // If the giant shape is already in this PNG, the bug is inside
  // drawCasinoScene / the game renderer. If this PNG is clean but
  // the final card is broken, the corruption happens during/after composition.
  await dumpCanvasDebug(sceneCanvas, 'scene-raw', game, renderId);

  ctx.drawImage(sceneCanvas, 60, 150, 660, 330);

  canvasDebugLog('SCENE COMPOSITED', {
    renderId,
    game,
    destination: { x: 60, y: 150, width: 660, height: 330 }
  });

  // Compact result rail; no decorative fake metrics.
  drawCasinoSummary(ctx, 748, 150, 292, 330, { bet, balance, multiplier, status, accent, tone });

  // Bottom information strip.
// Bottom information strip.
roundRect(ctx, 60, 504, 980, 54, 16);
ctx.fillStyle = 'rgba(255,255,255,0.045)';
ctx.fill();
ctx.strokeStyle = 'rgba(255,255,255,0.06)';
ctx.stroke();

const footerText = casinoFooterText(board, status);

drawText(ctx, footerText, 84, 538, {
  size: 16,
  weight: 700,
  color: '#94a3b8',
  maxWidth: 920
});
  // Visible build proof without relying on font rendering:
  // three tiny magenta/cyan blocks in the absolute bottom-right.
  // If these are present in Discord, this exact V6 file produced the image.


  await dumpCanvasDebug(canvas, 'final-card', game, renderId);

  const output = canvas.toBuffer('image/png');

  canvasDebugLog('renderCasinoCard END', {
    build: CANVAS_DEBUG_BUILD,
    renderId,
    game,
    bytes: output.length
  });

  return output;
}

function splitCasinoTitle(title, subtitle) {
  const parts = `${title}`.split(' - ');
  if (parts.length > 1) return [parts[0], `${parts.slice(1).join(' - ')} • ${subtitle}`.slice(0, 105)];
  return [title, `${subtitle ?? ''}`.slice(0, 105)];
}

function casinoGameLabel(game) {
  const labels = {
    crash: 'KRAŞ',
    mines: 'MİNALAR',
    blackjack: 'BƏLKƏCƏK',
    roulette: 'RULETKA',
    coinflip: 'SİKKƏ',
    slots: 'SLOT',
    tower: 'QÜLLƏ',
    wheel: 'ŞANS ÇARXI',
    lottery: 'LOTEREYA',
    jackpot: 'CEKPOT',
    risk: 'RİSK',
    dice: 'ZƏR',
    rps: 'DAŞ • KAĞIZ • QAYÇI',
    penalty: 'PENALTİ',
    horse: 'AT YARIŞI',
    higherlower: 'YÜKSƏK / AŞAĞI',
    baccarat: 'BAKKARA',
    poker: 'POKER'
  };

  return labels[game] ?? 'KAZİNO';
}

function drawCasinoBackground(ctx, width, height, accent) {
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#070b14');
  bg.addColorStop(0.52, '#0b1120');
  bg.addColorStop(1, '#07101a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  drawGlow(ctx, 120, 80, 250, `${accent}22`);
  drawGlow(ctx, width - 80, height - 60, 300, 'rgba(56,189,248,0.08)');
  ctx.strokeStyle = 'rgba(255,255,255,0.018)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 44) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += 44) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
}

function drawCasinoStatePill(ctx, x, y, tone, accent) {
  const label = tone === 'win' ? 'QƏLƏBƏ' : tone === 'lose' ? 'MƏĞLUBİYYƏT' : tone === 'push' ? 'BƏRABƏR' : 'CANLI';
  roundRect(ctx, x, y, 112, 34, 17);
  ctx.fillStyle = `${accent}1f`;
  ctx.fill();
  ctx.strokeStyle = `${accent}70`;
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(x + 18, y + 17, 4, 0, Math.PI * 2); ctx.fill();
  drawText(ctx, label, x + 31, y + 23, { size: 13, weight: 900, color: '#f8fafc', maxWidth: 72 });
}

function drawCasinoSummary(ctx, x, y, w, h, { bet, balance, multiplier, status, accent, tone }) {
  roundRect(ctx, x, y, w, h, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.075)';
  ctx.stroke();

  drawText(ctx, 'RAUND XÜLASƏSİ', x + 24, y + 34, { size: 13, weight: 900, color: '#64748b' });
  drawText(ctx, multiplier || '—', x + 24, y + 94, { size: 46, weight: 900, color: accent, maxWidth: w - 48 });
  drawText(ctx, 'ÇARPAN', x + 26, y + 118, { size: 13, weight: 900, color: '#94a3b8' });

  drawSummaryRow(ctx, x + 24, y + 150, w - 48, 'Mərc', `${formatNumber(bet)} Aura`, '#f8fafc');
  drawSummaryRow(ctx, x + 24, y + 200, w - 48, 'Balans', balance == null ? 'Gözlənir' : `${formatNumber(balance)} Aura`, '#f8fafc');

  const net = parseStatusAura(status);
  const resultColor = net == null ? accent : net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : '#cbd5e1';
  drawSummaryRow(ctx, x + 24, y + 250, w - 48, 'Nəticə', net == null ? shortText(status, 24) : `${net > 0 ? '+' : net < 0 ? '-' : ''}${formatNumber(Math.abs(net))} Aura`, resultColor);

  roundRect(ctx, x + 24, y + h - 42, w - 48, 18, 9);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
  roundRect(ctx, x + 24, y + h - 42, Math.max(18, (w - 48) * (tone === 'win' ? 1 : tone === 'lose' ? 0.32 : 0.62)), 18, 9);
  ctx.fillStyle = `${accent}cc`; ctx.fill();
}

function drawSummaryRow(ctx, x, y, w, label, value, color) {
  ctx.strokeStyle = 'rgba(255,255,255,0.055)';
  ctx.beginPath(); ctx.moveTo(x, y + 28); ctx.lineTo(x + w, y + 28); ctx.stroke();
  drawText(ctx, label, x, y + 18, { size: 14, weight: 800, color: '#64748b' });
  drawText(ctx, value, x + w, y + 18, { size: 17, weight: 900, color, align: 'right', maxWidth: 170 });
}

function parseStatusAura(status) {
  const match = `${status ?? ''}`.replaceAll(',', '').match(/Nəticə:\s*([+-]?\d+)\s*Aura/i);
  return match ? Number(match[1]) : null;
}

function casinoFooterText(board, status) {
  const clean = safeCasinoText(stripMarkdown(`${board ?? ''}`.replace(/\s+/g, ' ').trim()));
  if (clean && !/^Düymə ilə seçim et/i.test(clean)) return shortText(clean, 110);
  return shortText(safeCasinoText(stripMarkdown(status ?? 'Raund məlumatı yenilənir')), 110);
}


function safeCasinoText(value) {
  return `${value ?? ''}`
    .replace(/♠/g, 'S')
    .replace(/♥/g, 'H')
    .replace(/♦/g, 'D')
    .replace(/♣/g, 'C')
    .replace(/🍒/g, 'CHERRY')
    .replace(/[🍋🍊🍉]/g, 'FRUIT')
    .replace(/⭐/g, 'STAR')
    .replace(/💎/g, 'DIAMOND')
    .replace(/🔔/g, 'BELL')
    .replace(/7️⃣/g, '7')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortText(value, limit) {
  const text = `${value ?? ''}`.replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

async function drawCasinoScene(ctx, game, x, y, w, h, accent, tone, board, meta = {}) {
  canvasDebugLog('drawCasinoScene DISPATCH', {
    game,
    x,
    y,
    w,
    h,
    tone,
    meta
  });

  roundRect(ctx, x, y, w, h, 24);
  const panel = ctx.createLinearGradient(x, y, x, y + h);
  panel.addColorStop(0, '#111827');
  panel.addColorStop(1, '#0b1220');
  ctx.fillStyle = panel; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.075)'; ctx.lineWidth = 1.5; ctx.stroke();

  if (game === 'crash') return drawCrashScene(ctx, x, y, w, h, accent, tone, meta);
  if (game === 'mines') return drawMinesScene(ctx, x, y, w, h, accent, tone, board);
 if (game === 'blackjack') {
  return drawBlackjackScene(
    ctx,
    x,
    y,
    w,
    h,
    accent,
    board,
    tone,
    meta.blackjackState
  );
}
  if (game === 'roulette') return drawRouletteScene(ctx, x, y, w, h, accent, board, meta);
  if (game === 'coinflip') return drawCoinflipScene(ctx, x, y, w, h, accent, board, tone);
  if (game === 'slots') return drawSlotsScene(ctx, x, y, w, h, accent, board, tone);
  if (game === 'tower') return drawTowerScene(ctx, x, y, w, h, accent, board, meta);
  if (game === 'wheel') return drawWheelScene(ctx, x, y, w, h, accent, board);
  if (game === 'lottery') return drawLotteryScene(ctx, x, y, w, h, accent, board);
  if (game === 'jackpot') return drawJackpotScene(ctx, x, y, w, h, accent, meta);
  if (game === 'risk') return drawRiskScene(ctx, x, y, w, h, accent, tone, meta);
  if (game === 'dice') return drawDiceScene(ctx, x, y, w, h, accent, board);
  if (game === 'rps') return drawRpsScene(ctx, x, y, w, h, accent, board, tone);
  if (game === 'penalty') return drawPenaltyScene(ctx, x, y, w, h, accent, parsePenaltyBoard(board), tone);
  if (game === 'horse') return drawHorseScene(ctx, x, y, w, h, accent, board, tone);
  if (game === 'higherlower') return drawHigherLowerScene(ctx, x, y, w, h, accent, board, tone);
  if (game === 'baccarat') return drawTableCardScene(ctx, x, y, w, h, accent, 'PLAYER', 'BANKER', board);
  if (game === 'poker') return drawPokerScene(ctx, x, y, w, h, accent, board);

  await drawIcon(ctx, casinoIcon(game), x + w / 2 - 42, y + 92, 84, accent);
  drawText(ctx, casinoGameLabel(game), x + w / 2, y + 220, { size: 26, weight: 900, color: '#f8fafc', align: 'center' });
  drawText(ctx, 'Raund davam edir', x + w / 2, y + 250, { size: 16, weight: 700, color: '#94a3b8', align: 'center' });
}

function drawSceneGrid(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(148,163,184,0.10)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const gy = y + 42 + i * ((h - 78) / 5);
    ctx.beginPath(); ctx.moveTo(x + 46, gy); ctx.lineTo(x + w - 28, gy); ctx.stroke();
  }
  for (let i = 0; i <= 7; i += 1) {
    const gx = x + 46 + i * ((w - 74) / 7);
    ctx.beginPath(); ctx.moveTo(gx, y + 30); ctx.lineTo(gx, y + h - 36); ctx.stroke();
  }
  ctx.restore();
}

function drawCrashScene(ctx, x, y, w, h, accent, tone, meta) {
  drawSceneGrid(ctx, x, y, w, h);
  const mult = Number.parseFloat(`${meta.multiplier ?? ''}`) || 1;
  const normalized = Math.max(0.08, Math.min(0.96, Math.log(Math.max(1.01, mult)) / Math.log(10)));
  const left = x + 50, bottom = y + h - 46, right = x + w - 34, top = y + 38;

  const area = ctx.createLinearGradient(0, top, 0, bottom);
  area.addColorStop(0, `${accent}38`); area.addColorStop(1, `${accent}00`);
  ctx.beginPath(); ctx.moveTo(left, bottom);
  for (let i = 0; i <= 50; i += 1) {
    const t = i / 50;
    const px = left + (right - left) * t;
    const rise = (Math.exp(t * 2.25) - 1) / (Math.exp(2.25) - 1);
    const py = bottom - (bottom - top) * rise * (0.34 + normalized * 0.62);
    ctx.lineTo(px, py);
  }
  ctx.lineTo(right, bottom); ctx.closePath(); ctx.fillStyle = area; ctx.fill();

  ctx.beginPath();
  for (let i = 0; i <= 50; i += 1) {
    const t = i / 50;
    const px = left + (right - left) * t;
    const rise = (Math.exp(t * 2.25) - 1) / (Math.exp(2.25) - 1);
    const py = bottom - (bottom - top) * rise * (0.34 + normalized * 0.62);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = accent; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();

  const endY = bottom - (bottom - top) * (0.34 + normalized * 0.62);
  ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(right, endY, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `${accent}55`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(right, endY); ctx.lineTo(right, bottom); ctx.stroke();

  drawText(ctx, `${meta.multiplier || '1.00x'}`, x + 58, y + 82, { size: 52, weight: 900, color: '#f8fafc' });
  drawText(ctx, tone === 'lose' ? 'CRASH NÖQTƏSİ' : tone === 'win' ? 'CASH OUT' : 'CANLI ƏYRİ', x + 60, y + 108, { size: 14, weight: 900, color: accent });
  drawText(ctx, '1.00x', left, bottom + 25, { size: 13, weight: 800, color: '#64748b' });
  drawText(ctx, meta.multiplier || '—', right, bottom + 25, { size: 13, weight: 900, color: accent, align: 'right' });
}

function drawMinesScene(ctx, x, y, w, h, accent, tone, board) {
  const cells = parseMinesBoard(board);
  const cols = cells.length >= 25 ? 5 : 3;
  const count = cols === 5 ? 25 : 9;
  while (cells.length < count) cells.push('hidden');
  const gap = cols === 5 ? 10 : 14;
  const cell = cols === 5 ? 48 : 70;
  const gridW = cols * cell + (cols - 1) * gap;
  const rows = Math.ceil(count / cols);
  const gridH = rows * cell + (rows - 1) * gap;
  const sx = x + 46;
  const sy = y + (h - gridH) / 2;

  for (let i = 0; i < count; i += 1) {
    const cx = sx + (i % cols) * (cell + gap);
    const cy = sy + Math.floor(i / cols) * (cell + gap);
    roundRect(ctx, cx, cy, cell, cell, 12);
    const state = cells[i];
    ctx.fillStyle = state === 'mine' ? 'rgba(239,68,68,0.22)' : state === 'safe' ? 'rgba(34,197,94,0.18)' : 'rgba(51,65,85,0.55)';
    ctx.fill();
    ctx.strokeStyle = state === 'mine' ? '#ef4444' : state === 'safe' ? '#22c55e' : 'rgba(148,163,184,0.14)'; ctx.stroke();
    if (state === 'mine') drawMineGlyph(ctx, cx + cell / 2, cy + cell / 2, Math.max(9, cell * 0.17), '#ef4444');
    if (state === 'safe') drawGemGlyph(ctx, cx + cell / 2, cy + cell / 2, Math.max(10, cell * 0.18), '#22c55e');
  }

  const safe = cells.filter(v => v === 'safe').length;
  const mines = cells.filter(v => v === 'mine').length;
  drawText(ctx, 'MINES', x + w - 190, y + 68, { size: 28, weight: 900, color: '#f8fafc' });
  drawText(ctx, `${safe} təhlükəsiz`, x + w - 190, y + 104, { size: 17, weight: 800, color: '#22c55e' });
  drawText(ctx, `${mines} mina açıq`, x + w - 190, y + 134, { size: 17, weight: 800, color: mines ? '#ef4444' : '#64748b' });
  drawText(ctx, tone === 'lose' ? 'Mina tapıldı' : 'Təhlükəsiz xanaları aç', x + w - 190, y + 190, { size: 15, weight: 750, color: '#94a3b8', maxWidth: 160 });
}

function drawMineGlyph(ctx, cx, cy, r, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 8; i += 1) {
    const a = i * Math.PI / 4;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
    ctx.lineTo(cx + Math.cos(a) * (r + 8), cy + Math.sin(a) * (r + 8)); ctx.stroke();
  }
  ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(cx - r * .32, cy - r * .32, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function drawGemGlyph(ctx, cx, cy, r, color) {
  ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = '#bbf7d0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy - r * .2); ctx.lineTo(cx + r * .55, cy + r); ctx.lineTo(cx - r * .55, cy + r); ctx.lineTo(cx - r, cy - r * .2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawBlackjackScene(ctx, x, y, w, h, accent, board, tone, blackjackState = null) {
  drawFelt(ctx, x + 22, y + 22, w - 44, h - 44);

  const fallback = parseBlackjackBoard(board);

  const playerCards =
    blackjackState?.player?.length
      ? blackjackState.player
      : (fallback.player.length ? fallback.player : ['?', '?']);

  const dealerCards =
    blackjackState?.dealer?.length
      ? blackjackState.dealer
      : (fallback.dealer.length ? fallback.dealer : ['?', '?']);

  const playerTotal =
    Number.isFinite(blackjackState?.playerTotal)
      ? blackjackState.playerTotal
      : fallback.playerTotal;

  const dealerTotal =
    Number.isFinite(blackjackState?.dealerTotal)
      ? blackjackState.dealerTotal
      : null;

  // ================================
  // DEALER
  // ================================

  drawText(ctx, 'DİLER', x + 48, y + 54, {
    size: 13,
    weight: 900,
    color: '#86efac'
  });

  const dealerCardW = 58;
  const dealerCardH = 82;
  const dealerGap = 68;

  dealerCards.slice(0, 6).forEach((card, i) => {
    drawPlayingCard(
      ctx,
      x + 48 + i * dealerGap,
      y + 66,
      dealerCardW,
      dealerCardH,
      card,
      '#f8fafc'
    );
  });

  if (dealerTotal !== null) {
    drawText(ctx, `${dealerTotal}`, x + w - 72, y + 122, {
      size: 38,
      weight: 900,
      color: '#86efac',
      align: 'center'
    });

    drawText(ctx, 'DİLER', x + w - 72, y + 143, {
      size: 11,
      weight: 900,
      color: '#64748b',
      align: 'center'
    });
  }

  // Divider
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(x + 42, y + 164);
  ctx.lineTo(x + w - 42, y + 164);
  ctx.stroke();

  ctx.restore();

  // ================================
  // PLAYER
  // ================================

  drawText(ctx, 'SƏN', x + 48, y + 192, {
    size: 13,
    weight: 900,
    color: accent
  });

  const playerCardW = 58;
  const playerCardH = 82;
  const playerGap = 68;

  playerCards.slice(0, 7).forEach((card, i) => {
    drawPlayingCard(
      ctx,
      x + 48 + i * playerGap,
      y + 204,
      playerCardW,
      playerCardH,
      card,
      '#f8fafc'
    );
  });

  if (playerTotal !== null && playerTotal !== undefined) {
    const busted = playerTotal > 21;

    drawText(ctx, `${playerTotal}`, x + w - 72, y + 256, {
      size: 46,
      weight: 900,
      color: busted ? '#ef4444' : accent,
      align: 'center'
    });

    drawText(ctx, busted ? 'YANDIN' : 'CƏM', x + w - 72, y + 280, {
      size: 11,
      weight: 900,
      color: busted ? '#ef4444' : '#64748b',
      align: 'center'
    });
  }

  // ================================
  // ROUND STATE
  // ================================

  let stateText = 'KART GÖTÜR / DAYAN';
  let stateColor = accent;

  if (tone === 'win') {
    stateText = 'QƏLƏBƏ';
    stateColor = '#22c55e';
  } else if (tone === 'lose') {
    stateText = 'MƏĞLUBİYYƏT';
    stateColor = '#ef4444';
  } else if (tone === 'push') {
    stateText = 'BƏRABƏR';
    stateColor = '#94a3b8';
  }

  drawText(ctx, stateText, x + w - 170, y + 46, {
    size: 13,
    weight: 900,
    color: stateColor,
    align: 'center',
    maxWidth: 180
  });
}

function drawFelt(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 28);
  const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w / 2);
  g.addColorStop(0, '#123d34'); g.addColorStop(1, '#08251f'); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(134,239,172,0.18)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(x + w / 2, y + h + 80, w * .46, Math.PI, Math.PI * 2); ctx.stroke();
}

function drawPlayingCard(ctx, x, y, w, h, label, fill = '#f8fafc') {
  const parsed = parseCardToken(label);
  const color = parsed.suit === 'heart' || parsed.suit === 'diamond' ? '#dc2626' : '#111827';

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = Math.max(4, w * 0.08);
  ctx.shadowOffsetY = Math.max(2, h * 0.025);
  roundRect(ctx, x, y, w, h, Math.max(7, w * 0.12));
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();

  roundRect(ctx, x, y, w, h, Math.max(7, w * 0.12));
  ctx.strokeStyle = 'rgba(15,23,42,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (parsed.hidden) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#172033');
    g.addColorStop(1, '#0b1220');
    roundRect(ctx, x + 4, y + 4, w - 8, h - 8, Math.max(5, w * 0.09));
    ctx.fillStyle = g;
    ctx.fill();
    drawCardBackPattern(ctx, x + 8, y + 8, w - 16, h - 16);
    return;
  }

  drawText(ctx, parsed.rank, x + 8, y + Math.max(20, h * 0.28), {
    size: Math.max(15, Math.min(23, w * 0.34)),
    weight: 900,
    color,
    maxWidth: w * 0.45,
    minSize: 12
  });

  drawSuitVector(ctx, parsed.suit, x + w / 2, y + h * 0.62, Math.min(w, h) * 0.20, color);
}

function parseCardToken(label) {
  const raw = `${label ?? ''}`.trim();
  if (!raw || raw === '?') return { hidden: true, rank: '?', suit: 'spade' };
  let suit = 'spade';
  if (/♥|heart/i.test(raw)) suit = 'heart';
  else if (/♦|diamond/i.test(raw)) suit = 'diamond';
  else if (/♣|club/i.test(raw)) suit = 'club';
  else if (/♠|spade/i.test(raw)) suit = 'spade';
  let rank = raw.replace(/[♠♥♦♣]/g, '').replace(/(spades?|hearts?|diamonds?|clubs?)/ig, '').replace(/[^0-9AJQK]/ig, '').toUpperCase();
  if (!rank) rank = raw.match(/10|[2-9AJQK]/i)?.[0]?.toUpperCase() ?? 'A';
  return { hidden: false, rank, suit };
}

function drawSuitVector(ctx, suit, cx, cy, r, color) {
  ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color;
  if (suit === 'diamond') {
    ctx.beginPath(); ctx.moveTo(cx, cy-r*1.15); ctx.lineTo(cx+r*.78, cy); ctx.lineTo(cx, cy+r*1.15); ctx.lineTo(cx-r*.78, cy); ctx.closePath(); ctx.fill(); ctx.restore(); return;
  }
  if (suit === 'heart') {
    ctx.beginPath(); ctx.moveTo(cx, cy+r*.92); ctx.bezierCurveTo(cx-r*1.25,cy+r*.10,cx-r*.95,cy-r*.95,cx-r*.38,cy-r*.62); ctx.bezierCurveTo(cx-r*.08,cy-r*.45,cx,cy-r*.18,cx,cy-r*.02); ctx.bezierCurveTo(cx,cy-r*.18,cx+r*.08,cy-r*.45,cx+r*.38,cy-r*.62); ctx.bezierCurveTo(cx+r*.95,cy-r*.95,cx+r*1.25,cy+r*.10,cx,cy+r*.92); ctx.fill(); ctx.restore(); return;
  }
  if (suit === 'club') {
    ctx.beginPath(); ctx.arc(cx,cy-r*.48,r*.52,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx-r*.48,cy+r*.05,r*.52,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx+r*.48,cy+r*.05,r*.52,0,Math.PI*2); ctx.fill(); drawSuitStem(ctx,cx,cy+r*.18,r,color); ctx.restore(); return;
  }
  ctx.beginPath(); ctx.moveTo(cx,cy-r*1.10); ctx.bezierCurveTo(cx-r*.18,cy-r*.72,cx-r*1.05,cy-r*.12,cx-r*.82,cy+r*.46); ctx.bezierCurveTo(cx-r*.62,cy+r*.95,cx-r*.10,cy+r*.58,cx,cy+r*.34); ctx.bezierCurveTo(cx+r*.10,cy+r*.58,cx+r*.62,cy+r*.95,cx+r*.82,cy+r*.46); ctx.bezierCurveTo(cx+r*1.05,cy-r*.12,cx+r*.18,cy-r*.72,cx,cy-r*1.10); ctx.fill(); drawSuitStem(ctx,cx,cy+r*.28,r,color); ctx.restore();
}

function drawSuitStem(ctx, cx, cy, r, color) {
  ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(cx-r*.18,cy); ctx.lineTo(cx+r*.18,cy); ctx.lineTo(cx+r*.42,cy+r*.72); ctx.lineTo(cx-r*.42,cy+r*.72); ctx.closePath(); ctx.fill();
}

function drawCardBackPattern(ctx, x, y, w, h) {
  ctx.save(); roundRect(ctx,x,y,w,h,Math.max(4,w*.08)); ctx.clip(); ctx.strokeStyle='rgba(56,189,248,0.22)'; ctx.lineWidth=1; const step=Math.max(8,Math.min(w,h)*.16); for(let d=-h;d<w+h;d+=step){ctx.beginPath();ctx.moveTo(x+d,y);ctx.lineTo(x+d-h,y+h);ctx.stroke();ctx.beginPath();ctx.moveTo(x+d,y+h);ctx.lineTo(x+d-h,y);ctx.stroke();} ctx.restore();
}

function parseBlackjackBoard(board = '') {
  const text = `${board}`;
  const p = text.match(/Sən:\s*([^•]+?)(?:\s*\((\d+)\))?\s*•/i);
  const d = text.match(/Diler:\s*(.+)$/i);
  const splitCards = v => `${v ?? ''}`.split(/[,\s]+/).map(s => s.trim()).filter(Boolean).filter(s => s !== '?');
  return { player: splitCards(p?.[1]), playerTotal: p?.[2] ? Number(p[2]) : null, dealer: splitCards(d?.[1]) };
}

function drawRouletteScene(ctx, x, y, w, h, accent, board, meta) {
  const cx = x + 205, cy = y + h / 2, outer = 122;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 2);
  const colors = ['#16a34a', '#dc2626', '#111827'];
  for (let i = 0; i < 18; i += 1) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, outer, i * Math.PI * 2 / 18, (i + 1) * Math.PI * 2 / 18); ctx.closePath();
    ctx.fillStyle = i === 0 ? colors[0] : colors[i % 2 ? 1 : 2]; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, 78, 0, Math.PI * 2); ctx.fillStyle = '#8b5e34'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 54, 0, Math.PI * 2); ctx.fillStyle = '#d6b477'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fillStyle = '#111827'; ctx.fill(); ctx.restore();
  ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(cx + 74, cy - 74, 8, 0, Math.PI * 2); ctx.fill();
  drawText(ctx, 'ROULETTE', x + 390, y + 86, { size: 30, weight: 900, color: '#f8fafc' });
  drawText(ctx, shortText(board, 36) || 'Nəticə çarxda müəyyən olunur', x + 390, y + 122, { size: 16, weight: 750, color: '#94a3b8', maxWidth: 220 });
  drawText(ctx, meta.multiplier || '—', x + 390, y + 210, { size: 42, weight: 900, color: accent });
  drawText(ctx, 'ÖDƏNİŞ ÇARPANI', x + 392, y + 236, { size: 13, weight: 900, color: '#64748b' });
}

function drawCoinflipScene(ctx, x, y, w, h, accent, board, tone) {
  const cx = x + w / 2, cy = y + h / 2 - 12;
  ctx.save(); ctx.shadowColor = `${accent}88`; ctx.shadowBlur = 30;
  ctx.beginPath(); ctx.arc(cx, cy, 104, 0, Math.PI * 2); ctx.fillStyle = '#c7a64a'; ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = 9; ctx.strokeStyle = '#f4d97b'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 80, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(17,24,39,0.32)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  const side = /yazı|tails?/i.test(`${board}`) ? 'Y' : /gerb|heads?/i.test(`${board}`) ? 'G' : 'A';
  drawText(ctx, side, cx, cy + 30, { size: 88, weight: 900, color: '#33270b', align: 'center' });
  drawText(ctx, tone === 'active' ? 'SİKKƏ HAVADADIR' : 'NƏTİCƏ', cx, y + h - 30, { size: 15, weight: 900, color: accent, align: 'center' });
}

function drawSlotsScene(ctx, x, y, w, h, accent, board, tone) {
  const machineX = x + 58, machineY = y + 55, machineW = w - 116, machineH = 205;
  roundRect(ctx, machineX, machineY, machineW, machineH, 24); ctx.fillStyle = '#111827'; ctx.fill();
  ctx.strokeStyle = `${accent}88`; ctx.lineWidth = 3; ctx.stroke();
  const symbols = parseSlotSymbols(board);
  const reelW = 122, gap = 18, startX = x + w / 2 - (reelW * 3 + gap * 2) / 2;
  for (let i = 0; i < 3; i += 1) {
    roundRect(ctx, startX + i * (reelW + gap), machineY + 38, reelW, 126, 14);
    const rg = ctx.createLinearGradient(0, machineY + 38, 0, machineY + 164); rg.addColorStop(0, '#dbeafe'); rg.addColorStop(.5, '#ffffff'); rg.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = rg; ctx.fill();
    drawSlotSymbol(ctx, symbols[i], startX + i * (reelW + gap) + reelW / 2, machineY + 101, 34, i === 1 ? accent : '#111827');
  }
  ctx.strokeStyle = `${accent}aa`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(startX - 8, machineY + 101); ctx.lineTo(startX + reelW * 3 + gap * 2 + 8, machineY + 101); ctx.stroke();
  drawText(ctx, tone === 'win' ? 'PAYLINE HIT' : 'SLOTS', x + w / 2, y + 300, { size: 18, weight: 900, color: tone === 'win' ? '#22c55e' : '#94a3b8', align: 'center' });
}

function parseSlotSymbols(board = '') {
  const text = `${board ?? ''}`;
  const tokens = [];
  for (const char of text) {
    if (char === '🍒') tokens.push('cherry');
    else if (char === '🍋' || char === '🍊' || char === '🍉') tokens.push('fruit');
    else if (char === '⭐') tokens.push('star');
    else if (char === '💎') tokens.push('diamond');
    else if (char === '🔔') tokens.push('bell');
  }
  const sevens = text.match(/7(?:️⃣)?/g) ?? [];
  for (let i = 0; i < sevens.length; i += 1) tokens.push('seven');
  return tokens.length >= 3 ? tokens.slice(0, 3) : ['seven','diamond','seven'];
}

function drawSlotSymbol(ctx, token, cx, cy, r, color) {
  ctx.save();
  if (token === 'seven') { drawText(ctx,'7',cx,cy+r*.62,{size:r*1.9,weight:900,color:'#dc2626',align:'center',maxWidth:r*1.7,minSize:18}); ctx.restore(); return; }
  if (token === 'diamond') { drawSuitVector(ctx,'diamond',cx,cy,r*.85,'#2563eb'); ctx.restore(); return; }
  if (token === 'star') { drawStarVector(ctx,cx,cy,r,'#f59e0b'); ctx.restore(); return; }
  if (token === 'cherry') { drawCherryVector(ctx,cx,cy,r); ctx.restore(); return; }
  if (token === 'bell') { drawBellVector(ctx,cx,cy,r,'#f59e0b'); ctx.restore(); return; }
  drawFruitVector(ctx,cx,cy,r,'#f59e0b'); ctx.restore();
}

function drawStarVector(ctx,cx,cy,r,color){ctx.beginPath();for(let i=0;i<10;i+=1){const a=-Math.PI/2+i*Math.PI/5;const rr=i%2===0?r:r*.44;const px=cx+Math.cos(a)*rr,py=cy+Math.sin(a)*rr;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fillStyle=color;ctx.fill();}
function drawCherryVector(ctx,cx,cy,r){ctx.strokeStyle='#16a34a';ctx.lineWidth=Math.max(2,r*.08);ctx.beginPath();ctx.moveTo(cx-r*.42,cy-r*.10);ctx.quadraticCurveTo(cx-r*.15,cy-r*1.0,cx+r*.15,cy-r*.85);ctx.stroke();ctx.beginPath();ctx.moveTo(cx+r*.40,cy-r*.06);ctx.quadraticCurveTo(cx+r*.18,cy-r*.92,cx+r*.15,cy-r*.85);ctx.stroke();ctx.fillStyle='#dc2626';ctx.beginPath();ctx.arc(cx-r*.43,cy+r*.30,r*.40,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx+r*.38,cy+r*.32,r*.40,0,Math.PI*2);ctx.fill();}
function drawBellVector(ctx,cx,cy,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(cx-r*.75,cy+r*.45);ctx.quadraticCurveTo(cx-r*.60,cy-r*.75,cx,cy-r*.82);ctx.quadraticCurveTo(cx+r*.60,cy-r*.75,cx+r*.75,cy+r*.45);ctx.closePath();ctx.fill();ctx.fillRect(cx-r*.86,cy+r*.38,r*1.72,r*.20);ctx.beginPath();ctx.arc(cx,cy+r*.70,r*.18,0,Math.PI*2);ctx.fill();}
function drawFruitVector(ctx,cx,cy,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(cx,cy+r*.08,r*.72,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#16a34a';ctx.lineWidth=Math.max(2,r*.08);ctx.beginPath();ctx.moveTo(cx,cy-r*.60);ctx.quadraticCurveTo(cx+r*.18,cy-r*1.0,cx+r*.52,cy-r*.90);ctx.stroke();}

function drawTowerScene(ctx, x, y, w, h, accent, board, meta) {
  canvasDebugLog('drawTowerScene', {
    x,
    y,
    w,
    h,
    board: `${board ?? ''}`.slice(0, 180),
    meta
  });

  const floor = Number(`${board}`.match(/Mərtəbə\s*(\d+)/i)?.[1] ?? 3);
  const max = Number(`${board}`.match(/\/(\d+)/)?.[1] ?? 7);
  const levels = Math.max(5, Math.min(8, max));
  const bx = x + 92, bw = 330, bh = 28, gap = 9;
  for (let i = 0; i < levels; i += 1) {
    const level = levels - i;
    const yy = y + 35 + i * (bh + gap);
    roundRect(ctx, bx + i * 8, yy, bw - i * 16, bh, 8);
    ctx.fillStyle = level <= floor ? `${accent}38` : 'rgba(51,65,85,0.40)'; ctx.fill();
    ctx.strokeStyle = level <= floor ? `${accent}99` : 'rgba(148,163,184,0.12)'; ctx.stroke();
    drawText(ctx, `${level}`, bx + 18 + i * 8, yy + 20, { size: 13, weight: 900, color: level <= floor ? '#f8fafc' : '#64748b' });
  }
  drawText(ctx, `LEVEL ${floor}`, x + w - 190, y + 105, { size: 25, weight: 900, color: accent });
  drawText(ctx, meta.multiplier || '—', x + w - 190, y + 165, { size: 42, weight: 900, color: '#f8fafc' });
  drawText(ctx, 'CURRENT CASHOUT', x + w - 188, y + 191, { size: 13, weight: 900, color: '#64748b' });
}

function drawWheelScene(ctx, x, y, w, h, accent, board) {
  const cx = x + 250, cy = y + h / 2, r = 126;
  const colors = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#4f46e5'];
  for (let i = 0; i < 12; i += 1) {
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, i * Math.PI * 2 / 12, (i + 1) * Math.PI * 2 / 12); ctx.closePath();
    ctx.fillStyle = colors[i % colors.length]; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2); ctx.fillStyle = '#0f172a'; ctx.fill(); ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - r - 4); ctx.lineTo(cx - 12, cy - r - 28); ctx.lineTo(cx + 12, cy - r - 28); ctx.closePath(); ctx.fillStyle = '#f8fafc'; ctx.fill();
  drawText(ctx, 'ŞANS ÇARXI', x + 430, y + 118, { size: 26, weight: 900, color: '#f8fafc' });
  drawText(ctx, shortText(board, 34) || 'Seqment nəticəsi', x + 430, y + 154, { size: 16, weight: 750, color: '#94a3b8', maxWidth: 180 });
}

function drawLotteryScene(ctx, x, y, w, h, accent, board) {
  roundRect(ctx, x + 80, y + 76, 500, 180, 22); ctx.fillStyle = '#f8fafc'; ctx.fill();
  ctx.fillStyle = '#111827'; ctx.fillRect(x + 112, y + 76, 16, 180);
  ctx.setLineDash([8, 7]); ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(x + 460, y + 88); ctx.lineTo(x + 460, y + 244); ctx.stroke(); ctx.setLineDash([]);
  drawText(ctx, 'OCTOSON', x + 160, y + 124, { size: 16, weight: 900, color: '#64748b' });
  drawText(ctx, 'LOTTERY', x + 160, y + 174, { size: 38, weight: 900, color: '#111827' });
  drawText(ctx, 'AURA DRAW', x + 160, y + 206, { size: 15, weight: 900, color: accent });
  drawText(ctx, '# ' + String(Math.abs(hashText(`${board}`)) % 900000 + 100000), x + 482, y + 172, { size: 22, weight: 900, color: '#111827' });
  drawText(ctx, 'TICKET', x + 482, y + 202, { size: 13, weight: 900, color: '#64748b' });
}

function drawJackpotScene(ctx, x, y, w, h, accent, meta) {
  const cx = x + w / 2;
  ctx.save(); ctx.shadowColor = `${accent}66`; ctx.shadowBlur = 36;
  ctx.beginPath(); ctx.arc(cx, y + 142, 94, 0, Math.PI * 2); ctx.fillStyle = `${accent}22`; ctx.fill(); ctx.restore();
  drawText(ctx, 'JACKPOT', cx, y + 106, { size: 23, weight: 900, color: '#94a3b8', align: 'center' });
  drawText(ctx, meta.multiplier || '—', cx, y + 174, { size: 58, weight: 900, color: accent, align: 'center' });
  drawText(ctx, 'POT MULTIPLIER', cx, y + 205, { size: 13, weight: 900, color: '#64748b', align: 'center' });
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2; const px = cx + Math.cos(a) * 145; const py = y + 142 + Math.sin(a) * 108;
    ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.fillStyle = i % 2 ? '#f59e0b' : '#818cf8'; ctx.fill();
  }
}

function drawRiskScene(ctx, x, y, w, h, accent, tone, meta) {
  const cx = x + w / 2, cy = y + 176, r = 116;
  ctx.lineWidth = 24; ctx.lineCap = 'round';
  ctx.strokeStyle = '#1e293b'; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * .82, Math.PI * 2.18); ctx.stroke();
  const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0); g.addColorStop(0, '#22c55e'); g.addColorStop(.5, '#f59e0b'); g.addColorStop(1, '#ef4444');
  ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * .82, Math.PI * 2.18); ctx.stroke();
  const risk = tone === 'lose' ? .86 : tone === 'win' ? .42 : .62; const a = Math.PI * .82 + (Math.PI * 1.36) * risk;
  ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 88, cy + Math.sin(a) * 88); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fillStyle = '#f8fafc'; ctx.fill();
  drawText(ctx, 'RİSK', cx, y + 168, { size: 18, weight: 900, color: '#94a3b8', align: 'center' });
  drawText(ctx, meta.multiplier || '—', cx, y + 210, { size: 34, weight: 900, color: accent, align: 'center' });
}

function drawDiceScene(ctx, x, y, w, h, accent, board) {
  const nums = (`${board}`.match(/\b[1-6]\b/g) ?? []).map(Number);

  const a = nums[0] ?? 5;
  const b = nums[1] ?? 3;

  drawDie3D(
    ctx,
    x + 170,
    y + 92,
    116,
    accent,
    a
  );

  drawDie3D(
    ctx,
    x + 374,
    y + 92,
    116,
    '#38bdf8',
    b
  );

  drawText(ctx, `${a}`, x + 228, y + 265, {
    size: 26,
    weight: 900,
    color: accent,
    align: 'center'
  });

  drawText(ctx, `${b}`, x + 432, y + 265, {
    size: 26,
    weight: 900,
    color: '#38bdf8',
    align: 'center'
  });

  drawText(ctx, 'VS', x + w / 2, y + 165, {
    size: 20,
    weight: 900,
    color: '#64748b',
    align: 'center'
  });
}

function drawDie3D(ctx, x, y, size, color, value) {
  canvasDebugLog('drawDie3D', {
    x,
    y,
    size,
    color,
    value,
    transform: typeof ctx.getTransform === 'function'
      ? ctx.getTransform()
      : 'getTransform unavailable'
  });

  roundRect(ctx, x + 8, y + 10, size, size, 20); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
  roundRect(ctx, x, y, size, size, 20); const g = ctx.createLinearGradient(x, y, x + size, y + size); g.addColorStop(0, '#f8fafc'); g.addColorStop(1, '#cbd5e1'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = `${color}aa`; ctx.lineWidth = 4; ctx.stroke();
  const spots = dieSpots(value); ctx.fillStyle = '#111827'; for (const [px, py] of spots) { ctx.beginPath(); ctx.arc(x + size * px, y + size * py, 8, 0, Math.PI * 2); ctx.fill(); }
}

function dieSpots(value) {
  const p = { tl:[.28,.28], tr:[.72,.28], ml:[.28,.5], c:[.5,.5], mr:[.72,.5], bl:[.28,.72], br:[.72,.72] };
  const map = { 1:[p.c], 2:[p.tl,p.br], 3:[p.tl,p.c,p.br], 4:[p.tl,p.tr,p.bl,p.br], 5:[p.tl,p.tr,p.c,p.bl,p.br], 6:[p.tl,p.tr,p.ml,p.mr,p.bl,p.br] };
  return map[value] ?? map[3];
}

function drawRpsScene(ctx, x, y, w, h, accent, board, tone) {
  const text = `${board}`.toLowerCase();
  const choices = ['daş', 'kağız', 'qayçı'];
  const found = choices.filter(v => text.includes(v));
  const left = found[0] ?? 'daş', right = found[1] ?? 'qayçı';
  drawRpsBadge(ctx, x + 112, y + 88, 150, left, accent);
  drawRpsBadge(ctx, x + w - 262, y + 88, 150, right, '#818cf8');
  drawText(ctx, 'VS', x + w / 2, y + 174, { size: 32, weight: 900, color: '#64748b', align: 'center' });
  drawText(ctx, tone === 'win' ? 'QƏLƏBƏ' : tone === 'lose' ? 'MƏĞLUBİYYƏT' : 'SEÇİM', x + w / 2, y + 270, { size: 17, weight: 900, color: accent, align: 'center' });
}

function drawRpsBadge(ctx, x, y, size, choice, color) {
  ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.fillStyle = `${color}1f`; ctx.fill(); ctx.strokeStyle = `${color}88`; ctx.lineWidth = 3; ctx.stroke();
  const glyph = choice === 'daş' ? '●' : choice === 'kağız' ? '▤' : '✂';
  drawText(ctx, glyph, x + size / 2, y + 94, { size: 58, weight: 900, color, align: 'center' });
  drawText(ctx, choice.toUpperCase(), x + size / 2, y + 128, { size: 14, weight: 900, color: '#f8fafc', align: 'center' });
}

function drawHorseScene(ctx, x, y, w, h, accent, board, tone) {
  const trackX = x + 44, trackW = w - 88;
  for (let lane = 0; lane < 4; lane += 1) {
    const yy = y + 54 + lane * 62;
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(trackX, yy + 36); ctx.lineTo(trackX + trackW, yy + 36); ctx.stroke();
    const progress = [0.86,0.69,0.56,0.43][lane];
    const px = trackX + trackW * progress;
    drawHorseGlyph(ctx, px, yy + 14, lane === 0 ? accent : '#94a3b8');
    drawText(ctx, `#${lane + 1}`, trackX, yy + 20, { size: 13, weight: 900, color: '#64748b' });
  }
  ctx.strokeStyle = '#f8fafc'; ctx.setLineDash([6,5]); ctx.beginPath(); ctx.moveTo(trackX + trackW - 8, y + 38); ctx.lineTo(trackX + trackW - 8, y + h - 34); ctx.stroke(); ctx.setLineDash([]);
  drawText(ctx, tone === 'win' ? 'FINISH' : 'RACE', x + w - 92, y + 28, { size: 13, weight: 900, color: accent, align: 'right' });
}

function drawHorseGlyph(ctx, x, y, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, 25, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 23, y - 13, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 12,y+8);ctx.lineTo(x-22,y+25);ctx.moveTo(x+8,y+8);ctx.lineTo(x+19,y+25);ctx.stroke();
}

function drawHigherLowerScene(ctx, x, y, w, h, accent, board, tone) {
  const match = `${board}`.match(/İlk kart\s+([^\s(]+)/i);
  const first = match?.[1] ?? 'A';
  drawPlayingCard(ctx, x + 160, y + 74, 130, 182, first, '#f8fafc');
  drawText(ctx, '>', x + w / 2, y + 176, { size: 54, weight: 900, color: '#64748b', align: 'center' });
  drawPlayingCard(ctx, x + w - 290, y + 74, 130, 182, tone === 'active' ? '?' : 'K', '#f8fafc');
  drawText(ctx, 'YUXARI', x + w / 2, y + 72, { size: 15, weight: 900, color: '#22c55e', align: 'center' });
  drawText(ctx, 'AŞAĞI', x + w / 2, y + 270, { size: 15, weight: 900, color: '#ef4444', align: 'center' });
}

function drawTableCardScene(ctx, x, y, w, h, accent, leftLabel, rightLabel, board) {
  drawFelt(ctx, x + 22, y + 22, w - 44, h - 44);
  drawText(ctx, leftLabel, x + 80, y + 70, { size: 15, weight: 900, color: accent });
  drawText(ctx, rightLabel, x + w - 230, y + 70, { size: 15, weight: 900, color: '#818cf8' });
  ['A♠','8♥'].forEach((c,i)=>drawPlayingCard(ctx,x+80+i*70,y+95,58,82,c));
  ['K♦','7♣'].forEach((c,i)=>drawPlayingCard(ctx,x+w-230+i*70,y+95,58,82,c));
  drawText(ctx, 'VS', x + w/2, y + 148, { size: 22, weight: 900, color: '#64748b', align:'center' });
  drawText(ctx, shortText(board, 64) || 'Masa nəticəsi', x+w/2, y+260, { size:15, weight:750, color:'#94a3b8', align:'center', maxWidth:420 });
}

function drawPokerScene(ctx, x, y, w, h, accent, board) {
  drawFelt(ctx, x + 22, y + 22, w - 44, h - 44);
  const cards = ['A♠','K♠','Q♠','J♠','10♠'];
  const cw=72, gap=16, total=cw*5+gap*4, sx=x+w/2-total/2;
  cards.forEach((c,i)=>drawPlayingCard(ctx,sx+i*(cw+gap),y+92,cw,102,c));
  drawText(ctx, shortText(board, 58) || 'POKER HAND', x+w/2, y+250, { size:17, weight:900, color:accent, align:'center', maxWidth:460 });
}

function drawPenaltyScene(ctx, x, y, w, h, accent, result, tone) {
  const goalX = x + 115, goalY = y + 48, goalW = w - 230, goalH = 188;
  const zone = { left: goalX + goalW * .18, center: goalX + goalW * .5, right: goalX + goalW * .82 };
  const hasResult = result.hasResult && tone !== 'active';
  const ballX = zone[result.shot] ?? zone.center;
  const ballY = hasResult && !result.saved ? goalY + goalH * .28 : goalY + goalH + 44;
  const keeperX = zone[result.keeper] ?? zone.center;
  const keeperY = goalY + goalH * .58;

  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 5; ctx.strokeRect(goalX, goalY, goalW, goalH);
  ctx.strokeStyle = 'rgba(226,232,240,.16)'; ctx.lineWidth = 1;
  for(let i=1;i<8;i++){const gx=goalX+i*goalW/8;ctx.beginPath();ctx.moveTo(gx,goalY);ctx.lineTo(gx,goalY+goalH);ctx.stroke();}
  for(let i=1;i<5;i++){const gy=goalY+i*goalH/5;ctx.beginPath();ctx.moveTo(goalX,gy);ctx.lineTo(goalX+goalW,gy);ctx.stroke();}

  if (!hasResult) {
    [['left','SOL'],['center','ORTA'],['right','SAĞ']].forEach(([key,label])=>{roundRect(ctx,zone[key]-42,goalY+goalH+28,84,34,14);ctx.fillStyle='rgba(255,255,255,.06)';ctx.fill();drawText(ctx,label,zone[key],goalY+goalH+51,{size:13,weight:900,color:'#cbd5e1',align:'center'});});
    return;
  }

  drawKeeper(ctx, keeperX, keeperY, '#38bdf8', result.saved ? result.shot : result.keeper);
  ctx.strokeStyle = `${accent}aa`; ctx.lineWidth = 4; ctx.setLineDash([8,7]); ctx.beginPath(); ctx.moveTo(x+w/2,y+h-34); ctx.quadraticCurveTo((x+w/2+ballX)/2,y+h-115,ballX,ballY); ctx.stroke(); ctx.setLineDash([]);
  drawFootball(ctx, ballX, ballY, 14);
  drawText(ctx, result.saved ? 'SAVE' : 'GOAL', x+w/2, y+h-24, {size:20,weight:900,color:result.saved?'#ef4444':'#22c55e',align:'center'});
}

function drawKeeper(ctx, x, y, color, direction='center') {
  const lean = direction === 'left' ? -24 : direction === 'right' ? 24 : 0;
  ctx.strokeStyle=color;ctx.lineWidth=8;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y-18);ctx.lineTo(x+lean,y+20);ctx.moveTo(x,y-8);ctx.lineTo(x-40+lean,y-25);ctx.moveTo(x,y-8);ctx.lineTo(x+40+lean,y-25);ctx.moveTo(x+lean,y+20);ctx.lineTo(x-18+lean,y+58);ctx.moveTo(x+lean,y+20);ctx.lineTo(x+20+lean,y+58);ctx.stroke();
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y-34,13,0,Math.PI*2);ctx.fill();
}

function drawFootball(ctx, x, y, r) {
  ctx.fillStyle='#f8fafc';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#111827';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#111827';ctx.beginPath();ctx.arc(x,y,r*.35,0,Math.PI*2);ctx.fill();
}

function parsePenaltyBoard(board = '') {
  const value = `${board}`.toLowerCase();
  const shot = value.match(/zərbə:\s*(sol|orta|sağ|sag)/)?.[1];
  const keeper = value.match(/qapıçı:\s*(sol|orta|sağ|sag)/)?.[1];
  const normalize = direction => direction === 'sol' ? 'left' : direction === 'sağ' || direction === 'sag' ? 'right' : direction === 'orta' ? 'center' : null;
  const normalizedShot = normalize(shot) ?? 'center';
  const normalizedKeeper = normalize(keeper) ?? 'center';
  return { shot: normalizedShot, keeper: normalizedKeeper, saved: normalizedShot === normalizedKeeper, hasResult: Boolean(shot && keeper) };
}

function parseMinesBoard(board = '') {
  return `${board}`.split(/\s+/).filter(Boolean).slice(0, 25).map(cell => {
    if (cell.includes('💣')) return 'mine';
    if (cell.includes('✅')) return 'safe';
    return 'hidden';
  });
}

function hashText(value) {
  let hash = 2166136261;
  for (const char of `${value}`) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

export async function renderTransactionCard({ title, description, profile, amount = null, kind = 'transfer' }) {
  const width = 880;
  const height = 330;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const accent = transactionColor(kind, amount);

  drawBackground(ctx, width, height);
  drawGlow(ctx, 120, 90, 160, `${accent}33`);
  drawGlow(ctx, 730, 270, 170, 'rgba(20, 184, 166, 0.14)');

  roundRect(ctx, 34, 34, width - 68, height - 68, 24);
  ctx.fillStyle = 'rgba(15, 18, 28, 0.90)';
  ctx.fill();
  ctx.strokeStyle = `${accent}66`;
  ctx.lineWidth = 2;
  ctx.stroke();

  await drawIcon(ctx, transactionIcon(kind), 70, 68, 44, accent);
  drawText(ctx, title, 132, 96, { size: 34, weight: 900, color: '#f8fafc', maxWidth: 560 });
  drawText(ctx, stripMarkdown(description), 134, 130, { size: 19, color: '#cbd5e1', maxWidth: 650 });

  if (amount !== null) {
    drawText(ctx, `${amount > 0 ? '+' : ''}${formatNumber(amount)} Aura`, 812, 104, {
      size: 32,
      weight: 900,
      color: accent,
      align: 'right',
      maxWidth: 240
    });
  }

  await drawMetric(ctx, 70, 172, 230, 82, 'wallet', 'Balans', `${formatNumber(profile.balance)} Aura`, '#f59e0b');
  await drawMetric(ctx, 326, 172, 230, 82, 'bank', 'Bank', `${formatNumber(profile.bank)} Aura`, '#14b8a6');
  await drawMetric(ctx, 582, 172, 230, 82, 'medal', 'Rank', cleanRank(profile.rank), '#818cf8');

  drawText(ctx, 'Octoson iqtisadiyyatı • əməliyyat yadda saxlandı', 72, 288, { size: 16, color: '#94a3b8' });

  return canvas.toBuffer('image/png');
}

export async function renderWalletCard(user, profile) {
  const width = 1200;
  const height = 540;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const balance = Number(profile.balance ?? 0);
  const bank = Number(profile.bank ?? 0);
  const total = balance + bank;

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#07080d');
  bg.addColorStop(0.55, '#0b0d14');
  bg.addColorStop(1, '#090b12');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  drawGlow(ctx, 1040, 90, 330, 'rgba(99,102,241,0.12)');
  drawGlow(ctx, 130, 470, 260, 'rgba(139,92,246,0.07)');

  roundRect(ctx, 34, 34, 1132, 472, 34);

  const panel = ctx.createLinearGradient(34, 34, 1166, 506);
  panel.addColorStop(0, 'rgba(255,255,255,0.050)');
  panel.addColorStop(1, 'rgba(255,255,255,0.020)');

  ctx.fillStyle = panel;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawText(ctx, 'OCTOSON', 76, 82, {
    size: 15,
    weight: 900,
    color: '#818cf8'
  });

  drawText(ctx, 'AURA WALLET', 76, 108, {
    size: 12,
    weight: 800,
    color: '#596275'
  });

  const avatar = await loadRemoteImage(
    user.displayAvatarURL({
      extension: 'png',
      size: 256,
      forceStatic: true
    })
  );

  drawAvatarModern(ctx, avatar, 76, 144, 86);

  drawText(ctx, displayName(user), 188, 173, {
    size: 30,
    weight: 900,
    color: '#f8fafc',
    maxWidth: 430
  });

  drawText(ctx, `@${user.username ?? 'member'}`, 190, 204, {
    size: 15,
    weight: 600,
    color: '#697386'
  });

  drawText(ctx, 'ÜMUMİ SƏRVƏT', 790, 145, {
    size: 12,
    weight: 900,
    color: '#687386'
  });

  drawText(ctx, `${formatNumber(total)} Aura`, 790, 193, {
    size: 42,
    weight: 900,
    color: '#f8fafc',
    maxWidth: 330
  });

  drawText(
    ctx,
    `${Math.round(total ? (balance / total) * 100 : 0)}% wallet  •  ` +
    `${Math.round(total ? (bank / total) * 100 : 0)}% bank`,
    792,
    224,
    {
      size: 14,
      weight: 700,
      color: '#737e91'
    }
  );

  await drawModernMetric(
    ctx,
    76,
    280,
    326,
    116,
    'wallet',
    'WALLET',
    `${formatNumber(balance)} Aura`
  );

  await drawModernMetric(
    ctx,
    437,
    280,
    326,
    116,
    'bank',
    'BANK',
    `${formatNumber(bank)} Aura`
  );

  await drawModernMetric(
    ctx,
    798,
    280,
    326,
    116,
    'diamond',
    'TOPLAM',
    `${formatNumber(total)} Aura`
  );

  roundRect(ctx, 76, 426, 1048, 46, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  ctx.fill();

  drawText(
    ctx,
    'Bank faizi 1.5% / gün  •  max 750 Aura',
    100,
    455,
    {
      size: 14,
      weight: 700,
      color: '#7d8799'
    }
  );

  drawText(
    ctx,
    'Vergi • 10K+ sərvət',
    1100,
    455,
    {
      size: 14,
      weight: 700,
      color: '#7d8799',
      align: 'right'
    }
  );

  return canvas.toBuffer('image/png');
}

export async function renderTransferCard({
  fromUser,
  toUser,
  fromProfile,
  toProfile,
  amount,
  title = 'Aura göndərildi',
  tone = 'transfer'
}) {
  const width = 1200;
  const height = 560;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const isGift = tone === 'gift';

  // Octoson 2026 palette — intentionally restrained.
  const accent = isGift ? '#a78bfa' : '#60a5fa';
  const accentSoft = isGift ? '#c4b5fd' : '#93c5fd';
  const secondary = isGift ? '#f0abfc' : '#67e8f9';

  const fromAvatar = await loadRemoteImage(
    fromUser.displayAvatarURL({
      extension: 'png',
      size: 256,
      forceStatic: true
    })
  );

  const toAvatar = await loadRemoteImage(
    toUser.displayAvatarURL({
      extension: 'png',
      size: 256,
      forceStatic: true
    })
  );

  // ----------------------------------------------------------
  // Background
  // ----------------------------------------------------------

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#07090f');
  bg.addColorStop(0.48, '#0b0e17');
  bg.addColorStop(1, '#080b12');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Very subtle ambient light.
  drawGlow(ctx, 155, 70, 260, `${accent}18`);
  drawGlow(ctx, 1060, 470, 300, `${secondary}10`);
  drawGlow(ctx, 600, 290, 280, `${accent}0c`);

  // Fine top highlight.
  const topLine = ctx.createLinearGradient(100, 0, 1100, 0);
  topLine.addColorStop(0, 'rgba(255,255,255,0)');
  topLine.addColorStop(0.5, `${accent}75`);
  topLine.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = topLine;
  ctx.fillRect(100, 0, 1000, 2);

  // ----------------------------------------------------------
  // Main glass surface
  // ----------------------------------------------------------

  roundRect(ctx, 34, 34, 1132, 492, 34);

  const panel = ctx.createLinearGradient(34, 34, 1166, 526);
  panel.addColorStop(0, 'rgba(255,255,255,0.055)');
  panel.addColorStop(0.55, 'rgba(255,255,255,0.025)');
  panel.addColorStop(1, 'rgba(255,255,255,0.038)');

  ctx.fillStyle = panel;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.095)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ----------------------------------------------------------
  // Header
  // ----------------------------------------------------------

  drawText(ctx, 'OCTOSON', 74, 82, {
    size: 15,
    weight: 900,
    color: accentSoft,
    maxWidth: 180
  });

  drawText(ctx, title, 74, 125, {
    size: 36,
    weight: 900,
    color: '#f8fafc',
    maxWidth: 500
  });

  drawText(
    ctx,
    isGift
      ? 'Aura hədiyyəsi uğurla tamamlandı'
      : 'Aura transferi uğurla tamamlandı',
    76,
    155,
    {
      size: 17,
      color: '#7f899c',
      maxWidth: 500
    }
  );

  // Status pill.
  const statusX = 934;
  const statusY = 72;

  roundRect(ctx, statusX, statusY, 168, 42, 21);
  ctx.fillStyle = `${accent}12`;
  ctx.fill();
  ctx.strokeStyle = `${accent}45`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(statusX + 22, statusY + 21, 5, 0, Math.PI * 2);
  ctx.fill();

  drawText(ctx, 'TAMAMLANDI', statusX + 38, statusY + 27, {
    size: 13,
    weight: 900,
    color: '#dbeafe',
    maxWidth: 112
  });

  // ----------------------------------------------------------
  // Sender / receiver cards
  // ----------------------------------------------------------

  drawPremiumTransferUser(
    ctx,
    fromAvatar,
    displayName(fromUser),
    'GÖNDƏRƏN',
    fromProfile,
    74,
    205,
    accent
  );

  drawPremiumTransferUser(
    ctx,
    toAvatar,
    displayName(toUser),
    'QƏBUL EDƏN',
    toProfile,
    806,
    205,
    secondary
  );

  // ----------------------------------------------------------
  // Central transaction
  // ----------------------------------------------------------

  const centerX = 600;

  drawText(ctx, isGift ? 'HƏDİYYƏ' : 'TRANSFER', centerX, 220, {
    size: 13,
    weight: 900,
    color: '#697386',
    align: 'center'
  });

  drawText(ctx, formatNumber(amount), centerX, 282, {
    size: 52,
    weight: 900,
    color: '#f8fafc',
    align: 'center',
    maxWidth: 300
  });

  drawText(ctx, 'AURA', centerX, 312, {
    size: 16,
    weight: 900,
    color: accentSoft,
    align: 'center'
  });

  // Minimal transfer rail.
  const railY = 352;

  const rail = ctx.createLinearGradient(410, railY, 790, railY);
  rail.addColorStop(0, `${accent}25`);
  rail.addColorStop(0.5, `${accent}dd`);
  rail.addColorStop(1, `${secondary}70`);

  ctx.strokeStyle = rail;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(416, railY);
  ctx.lineTo(774, railY);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(416, railY, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.moveTo(790, railY);
  ctx.lineTo(770, railY - 11);
  ctx.lineTo(770, railY + 11);
  ctx.closePath();
  ctx.fill();

  // ----------------------------------------------------------
  // Footer information
  // ----------------------------------------------------------

  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(74, 427);
  ctx.lineTo(1126, 427);
  ctx.stroke();

  drawPremiumTransferStat(
    ctx,
    74,
    455,
    'GÖNDƏRƏNİN BALANSI',
    `${formatNumber(fromProfile.balance)} Aura`
  );

  drawPremiumTransferStat(
    ctx,
    440,
    455,
    isGift ? 'HƏDİYYƏ EDİLƏN' : 'GÖNDƏRİLƏN',
    `${formatNumber(amount)} Aura`,
    true,
    accentSoft
  );

  drawPremiumTransferStat(
    ctx,
    806,
    455,
    'QƏBUL EDƏNİN BALANSI',
    `${formatNumber(toProfile.balance)} Aura`
  );

  return canvas.toBuffer('image/png');
}

function drawPremiumTransferUser(
  ctx,
  avatar,
  name,
  label,
  profile,
  x,
  y,
  color
) {
  const width = 320;
  const height = 184;

  roundRect(ctx, x, y, width, height, 26);

  const surface = ctx.createLinearGradient(x, y, x, y + height);
  surface.addColorStop(0, 'rgba(255,255,255,0.060)');
  surface.addColorStop(1, 'rgba(255,255,255,0.025)');

  ctx.fillStyle = surface;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.085)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Accent edge.
  const edge = ctx.createLinearGradient(x, y + 30, x, y + 150);
  edge.addColorStop(0, `${color}00`);
  edge.addColorStop(0.5, `${color}aa`);
  edge.addColorStop(1, `${color}00`);

  ctx.fillStyle = edge;
  ctx.fillRect(x, y + 24, 2, height - 48);

  drawPremiumAvatar(ctx, avatar, x + 24, y + 27, 86, color);

  drawText(ctx, label, x + 132, y + 51, {
    size: 12,
    weight: 900,
    color,
    maxWidth: 160
  });

  drawText(ctx, name, x + 132, y + 84, {
    size: 25,
    weight: 900,
    color: '#f8fafc',
    maxWidth: 160
  });

  drawText(ctx, cleanRank(profile.rank), x + 132, y + 110, {
    size: 15,
    color: '#7f899c',
    maxWidth: 160
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.065)';
  ctx.beginPath();
  ctx.moveTo(x + 24, y + 132);
  ctx.lineTo(x + width - 24, y + 132);
  ctx.stroke();

  drawText(ctx, 'BALANS', x + 24, y + 158, {
    size: 11,
    weight: 900,
    color: '#697386'
  });

  drawText(ctx, `${formatNumber(profile.balance)} Aura`, x + width - 24, y + 160, {
    size: 19,
    weight: 900,
    color: '#e5e7eb',
    align: 'right',
    maxWidth: 190
  });
}

function drawPremiumAvatar(ctx, image, x, y, size, color) {
  // Outer soft ring.
  ctx.save();

  ctx.beginPath();
  ctx.arc(
    x + size / 2,
    y + size / 2,
    size / 2 + 3,
    0,
    Math.PI * 2
  );

  ctx.strokeStyle = `${color}80`;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(
    x + size / 2,
    y + size / 2,
    size / 2,
    0,
    Math.PI * 2
  );

  ctx.clip();

  if (image) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, size, size);
  }

  ctx.restore();
}

function drawPremiumTransferStat(
  ctx,
  x,
  y,
  label,
  value,
  centered = false,
  valueColor = '#f8fafc'
) {
  const align = centered ? 'center' : 'left';
  const textX = centered ? x + 160 : x;

  drawText(ctx, label, textX, y, {
    size: 11,
    weight: 900,
    color: '#697386',
    align,
    maxWidth: 320
  });

  drawText(ctx, value, textX, y + 31, {
    size: 22,
    weight: 900,
    color: valueColor,
    align,
    maxWidth: 320
  });
}

export async function renderRobberyCard({ robberUser, targetUser, robberProfile, targetProfile, amount, success }) {
  const width = 1040;
  const height = 460;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const accent = success ? '#f59e0b' : '#ef4444';

  drawBackground(ctx, width, height);
  drawGlow(ctx, 165, 120, 220, `${accent}30`);
  drawGlow(ctx, 850, 350, 220, 'rgba(129,140,248,0.18)');

  roundRect(ctx, 36, 36, width - 72, height - 72, 30);
  ctx.fillStyle = 'rgba(15, 18, 28, 0.93)';
  ctx.fill();
  ctx.strokeStyle = `${accent}78`;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  drawText(ctx, success ? 'Soyğun uğurlu oldu' : 'Soyğun alınmadı', 70, 84, { size: 38, weight: 900, color: '#f8fafc', maxWidth: 520 });
  drawText(ctx, success ? 'Aura kölgədən çıxdı və balans yeniləndi.' : 'Cəhd tutuldu, cərimə tətbiq olundu.', 72, 116, { size: 18, color: '#cbd5e1' });

  const robberAvatar = await loadRemoteImage(robberUser.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }));
  const targetAvatar = await loadRemoteImage(targetUser.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }));
  drawUserPanel(ctx, robberAvatar, displayName(robberUser), success ? 'Soyğunçu' : 'Yaxalanan', 74, 158, accent);
  drawUserPanel(ctx, targetAvatar, displayName(targetUser), success ? 'Hədəf' : 'Qorundu', 720, 158, '#818cf8');
  drawRobberyScene(ctx, 412, 146, 220, 142, accent, success, Math.abs(amount));

  await drawMetric(ctx, 74, 342, 260, 72, 'wallet', 'Soyğunçunun balansı', `${formatNumber(robberProfile.balance)} Aura`, accent);
  await drawMetric(ctx, 390, 342, 260, 72, success ? 'sparkle' : 'medal', success ? 'Götürülən Aura' : 'Cərimə', `${success ? '+' : '-'}${formatNumber(Math.abs(amount))} Aura`, accent);
  await drawMetric(ctx, 706, 342, 260, 72, 'trophy', 'Hədəfin balansı', `${formatNumber(targetProfile.balance)} Aura`, '#818cf8');

  return canvas.toBuffer('image/png');
}

function drawUserPanel(ctx, avatar, name, label, x, y, color) {
  roundRect(ctx, x, y, 250, 132, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.055)';
  ctx.fill();
  ctx.strokeStyle = `${color}66`;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawAvatar(ctx, avatar, x + 18, y + 20, 84);
  drawText(ctx, label, x + 118, y + 50, { size: 16, weight: 800, color: color, maxWidth: 112 });
  drawText(ctx, name, x + 118, y + 83, { size: 24, weight: 900, color: '#f8fafc', maxWidth: 112 });
}

export async function renderMoggerCard({ session, analysis = {}, voteCount = 0, mode = 'analysis', publicShare = false, title = null }) {
  const width = 1260;
  const height = 840;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const accent = moggerAccent(mode, publicShare);
  const secondary = moggerSecondaryAccent(mode, publicShare);
  const original = await loadRemoteImage(session.originalImage);
  const reference = Array.isArray(session.referenceImages) && session.referenceImages.length > 1
    ? await loadRemoteImage(session.referenceImages[1])
    : null;

  drawBackground(ctx, width, height);
  drawGlow(ctx, 180, 120, 260, `${accent}26`);
  drawGlow(ctx, 1080, 160, 240, `${secondary}22`);
  drawGlow(ctx, 1010, 760, 260, 'rgba(245, 158, 11, 0.10)');

  roundRect(ctx, 34, 34, width - 68, height - 68, 34);
  ctx.fillStyle = 'rgba(15, 18, 28, 0.92)';
  ctx.fill();
  ctx.strokeStyle = `${accent}66`;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawText(ctx, title ?? 'Looks Lab', 74, 92, { size: 42, weight: 900, color: '#f8fafc', maxWidth: 560 });
  drawText(ctx, publicShare ? 'Anonymous community vote' : 'Private by default • identity locked', 76, 124, { size: 18, color: '#cbd5e1', maxWidth: 560 });

  let badgeX = 832;
  badgeX += drawPill(ctx, badgeX, 58, publicShare ? 'PUBLIC SHARE' : 'PRIVATE SESSION', publicShare ? '#22c55e' : accent, publicShare ? '#052e16' : '#111827', 14) + 14;
  badgeX += drawPill(ctx, badgeX, 58, `${voteCount} vote${voteCount === 1 ? '' : 's'}`, secondary, '#111827', 14) + 14;
  drawPill(ctx, badgeX, 58, moggerModeLabel(mode), accent, '#111827', 14);

  if (reference) {
    roundRect(ctx, 1130, 118, 104, 124, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = `${secondary}66`;
    ctx.stroke();
    drawAvatar(ctx, reference, 1152, 130, 60);
    drawText(ctx, 'Ref', 1182, 206, { size: 14, weight: 800, color: '#cbd5e1', align: 'center' });
  }

  drawMoggerFrame(ctx, {
    x: 60,
    y: 164,
    w: 540,
    h: 500,
    label: 'Before',
    description: 'Uploaded photo',
    image: original,
    accent: '#64748b',
    secondary: '#334155',
    simulate: false,
    mode
  });

  drawMoggerFrame(ctx, {
    x: 660,
    y: 164,
    w: 540,
    h: 500,
    label: 'Simulated after',
    description: moggerModeLabel(mode),
    image: original,
    accent,
    secondary,
    simulate: true,
    mode,
    reference
  });

  roundRect(ctx, 74, 680, 1112, 72, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.stroke();
  drawText(ctx, moggerShortSummary(analysis?.summary), 96, 714, { size: 20, weight: 800, color: '#f8fafc', maxWidth: 760 });
  drawText(ctx, analysis?.privacyNote ?? 'Private by default • no medical claims', 96, 738, { size: 15, color: '#94a3b8', maxWidth: 720 });
  drawText(ctx, analysis?.identityLock ?? 'Identity locked', 824, 714, { size: 15, color: accent, weight: 800, maxWidth: 320, align: 'right' });
  drawText(ctx, analysis?.regionLock ?? 'Region inference off', 824, 738, { size: 15, color: secondary, weight: 800, maxWidth: 320, align: 'right' });

  drawMoggerChips(ctx, 74, 770, 'Visible cues', analysis?.visibleFeatures ?? [], accent, secondary);
  drawMoggerChips(ctx, 660, 770, 'Stack', session.stack ?? [], accent, secondary, moggerModeLabel);

  drawText(ctx, 'Mogger simulation only. No medical claims, no identity drift, no region inference.', 74, 824, { size: 14, color: '#94a3b8', maxWidth: 1120 });

  return canvas.toBuffer('image/png');
}

function moggerAccent(mode, publicShare) {
  if (publicShare) {
    return '#22c55e';
  }

  const accents = {
    analysis: '#22c55e',
    hair: '#ec4899',
    grooming: '#14b8a6',
    camera: '#38bdf8',
    style: '#f59e0b',
    stack: '#818cf8',
    compare: '#c084fc',
    share: '#22c55e',
    reset: '#f97316',
    close: '#ef4444'
  };

  return accents[mode] ?? '#38bdf8';
}

function moggerSecondaryAccent(mode, publicShare) {
  if (publicShare) {
    return '#86efac';
  }

  const accents = {
    analysis: '#86efac',
    hair: '#f9a8d4',
    grooming: '#5eead4',
    camera: '#7dd3fc',
    style: '#fcd34d',
    stack: '#c4b5fd',
    compare: '#d8b4fe',
    share: '#86efac',
    reset: '#fdba74',
    close: '#fca5a5'
  };

  return accents[mode] ?? '#7dd3fc';
}

function moggerModeLabel(mode) {
  const labels = {
    analysis: 'Analysis',
    hair: 'Hair',
    grooming: 'Grooming',
    camera: 'Camera',
    style: 'Style',
    stack: 'Stack',
    compare: 'Compare',
    share: 'Share',
    reset: 'Reset',
    close: 'Closed'
  };

  return labels[mode] ?? 'Looks Lab';
}

function moggerShortSummary(summary) {
  const text = `${summary ?? ''}`.trim();
  if (!text) {
    return 'Looks Lab ready.';
  }

  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function drawMoggerFrame(ctx, { x, y, w, h, label, description, image, accent, secondary, simulate = false, mode = 'analysis', reference = null }) {
  roundRect(ctx, x, y, w, h, 26);
  ctx.fillStyle = simulate ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.035)';
  ctx.fill();
  ctx.strokeStyle = `${accent}66`;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawText(ctx, label, x + 22, y + 34, { size: 23, weight: 900, color: '#f8fafc', maxWidth: w - 180 });
  drawText(ctx, description, x + 22, y + 58, { size: 15, color: simulate ? secondary : '#94a3b8', maxWidth: w - 180 });

  const pad = 18;
  const mediaX = x + pad;
  const mediaY = y + 76;
  const mediaW = w - pad * 2;
  const mediaH = h - 150;
  drawMoggerImage(ctx, {
    image,
    x: mediaX,
    y: mediaY,
    w: mediaW,
    h: mediaH,
    accent,
    simulate,
    mode,
    reference
  });

  roundRect(ctx, x + 22, y + h - 54, w - 44, 34, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fill();
  drawText(ctx, simulate ? 'Simulated preview' : 'Original upload', x + 38, y + h - 32, { size: 14, weight: 800, color: '#f8fafc', maxWidth: w - 160 });
  drawText(ctx, moggerModeLabel(mode), x + w - 38, y + h - 32, { size: 14, weight: 800, color: accent, align: 'right', maxWidth: 160 });
}

function drawMoggerImage(ctx, { image, x, y, w, h, accent, simulate, mode, reference }) {
  roundRect(ctx, x, y, w, h, 22);
  ctx.save();
  ctx.clip();

  if (image) {
    if (simulate) {
      ctx.filter = 'saturate(1.12) contrast(1.08) brightness(1.06)';
    }
    drawCoverImage(ctx, image, x, y, w, h, simulate ? 1.06 : 1);
    ctx.filter = 'none';

    const overlay = ctx.createLinearGradient(0, y, 0, y + h);
    overlay.addColorStop(0, 'rgba(0,0,0,0.06)');
    overlay.addColorStop(1, simulate ? `${accent}26` : 'rgba(0,0,0,0.18)');
    ctx.fillStyle = overlay;
    ctx.fillRect(x, y, w, h);

    if (simulate) {
      ctx.fillStyle = `${accent}16`;
      ctx.fillRect(x, y, w, h);
    }
  } else {
    const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, '#1f2937');
    gradient.addColorStop(1, '#111827');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    drawText(ctx, 'Image unavailable', x + w / 2, y + h / 2 - 6, { size: 20, weight: 800, color: '#f8fafc', align: 'center' });
  }

  ctx.restore();

  if (reference && simulate) {
    roundRect(ctx, x + w - 118, y + 18, 94, 110, 18);
    ctx.fillStyle = 'rgba(15, 18, 28, 0.72)';
    ctx.fill();
    ctx.strokeStyle = `${accent}55`;
    ctx.stroke();
    drawAvatar(ctx, reference, x + w - 103, y + 32, 64);
    drawText(ctx, 'Ref', x + w - 71, y + 104, { size: 13, weight: 800, color: '#cbd5e1', align: 'center' });
  }

  if (simulate) {
    drawMoggerTransformOverlay(ctx, x, y, w, h, accent, mode);
  }
}

function drawMoggerTransformOverlay(ctx, x, y, w, h, accent, mode) {
  const labels = {
    hair: ['Hair', 'cleaner contour'],
    grooming: ['Grooming', 'cleaner detail'],
    camera: ['Camera', 'better light'],
    style: ['Style', 'balanced vibe'],
    stack: ['Stack', 'layered edit'],
    compare: ['Compare', 'before / after'],
    analysis: ['Analysis', 'private preview']
  };
  const [headline, subline] = labels[mode] ?? labels.analysis;

  roundRect(ctx, x + 18, y + 18, 176, 56, 18);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.fill();
  ctx.strokeStyle = `${accent}66`;
  ctx.stroke();
  drawText(ctx, headline, x + 36, y + 42, { size: 18, weight: 900, color: '#f8fafc', maxWidth: 140 });
  drawText(ctx, subline, x + 36, y + 62, { size: 13, color: '#cbd5e1', maxWidth: 140 });

  roundRect(ctx, x + w - 188, y + h - 78, 156, 44, 16);
  ctx.fillStyle = `${accent}1f`;
  ctx.fill();
  ctx.strokeStyle = `${accent}66`;
  ctx.stroke();
  drawText(ctx, 'Simulated only', x + w - 110, y + h - 49, { size: 15, weight: 800, color: accent, align: 'center' });
}

function drawCoverImage(ctx, image, x, y, w, h, zoom = 1) {
  const sourceWidth = image.width ?? w;
  const sourceHeight = image.height ?? h;
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = w / h;
  let sourceX = 0;
  let sourceY = 0;
  let sourceW = sourceWidth;
  let sourceH = sourceHeight;

  if (sourceAspect > targetAspect) {
    sourceW = sourceHeight * targetAspect;
    sourceX = (sourceWidth - sourceW) / 2;
  } else {
    sourceH = sourceWidth / targetAspect;
    sourceY = (sourceHeight - sourceH) / 2;
  }

  if (zoom !== 1) {
    const zoomW = sourceW / zoom;
    const zoomH = sourceH / zoom;
    sourceX += (sourceW - zoomW) / 2;
    sourceY += (sourceH - zoomH) / 2;
    sourceW = zoomW;
    sourceH = zoomH;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, x, y, w, h);
}

function drawMoggerChips(ctx, x, y, label, values, accent, secondary, translate = null) {
  const chips = Array.isArray(values) && values.length ? values.slice(0, 4) : ['—'];
  drawText(ctx, label, x, y - 12, { size: 17, weight: 900, color: '#f8fafc' });

  let cursorX = x;
  const maxWidth = 530;
  for (const item of chips) {
    const text = translate ? translate(item) : `${item}`;
    const chip = text.length > 22 ? `${text.slice(0, 21)}…` : text;
    const width = Math.max(92, Math.min(168, Math.ceil(chip.length * 8) + 28));
    if (cursorX + width > x + maxWidth) {
      break;
    }
    roundRect(ctx, cursorX, y + 8, width, 30, 15);
    ctx.fillStyle = `${accent}22`;
    ctx.fill();
    ctx.strokeStyle = `${secondary}66`;
    ctx.stroke();
    drawText(ctx, chip, cursorX + width / 2, y + 29, { size: 14, weight: 800, color: '#f8fafc', align: 'center', maxWidth: width - 18 });
    cursorX += width + 10;
  }
}

function drawTransferFlow(ctx, x, y, w, h, color, amount) {
  ctx.strokeStyle = `${color}bb`;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.bezierCurveTo(x + 55, y - 10, x + w - 55, y + h + 10, x + w, y + h / 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + w + 2, y + h / 2);
  ctx.lineTo(x + w - 28, y + h / 2 - 18);
  ctx.lineTo(x + w - 22, y + h / 2 + 20);
  ctx.closePath();
  ctx.fill();
  roundRect(ctx, x + 44, y + 18, 120, 54, 18);
  ctx.fillStyle = `${color}22`;
  ctx.fill();
  ctx.strokeStyle = `${color}66`;
  ctx.stroke();
  drawText(ctx, `${formatNumber(amount)}`, x + 104, y + 51, { size: 24, weight: 900, color: '#f8fafc', align: 'center' });
}

function drawRobberyScene(ctx, x, y, w, h, color, success, amount) {
  roundRect(ctx, x, y, w, h, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fill();
  ctx.strokeStyle = `${color}66`;
  ctx.stroke();
  ctx.strokeStyle = `${color}bb`;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 34, y + h - 42);
  ctx.quadraticCurveTo(x + w / 2, success ? y + 20 : y + 95, x + w - 34, y + 46);
  ctx.stroke();
  ctx.fillStyle = color;
  for (let index = 0; index < 3; index += 1) {
    ctx.beginPath();
    ctx.arc(x + 65 + index * 45, y + 68 + (index % 2) * 18, 14, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, 'A', x + 65 + index * 45, y + 76 + (index % 2) * 18, { size: 16, weight: 900, color: '#0f172a', align: 'center' });
  }
  drawText(ctx, success ? `+${formatNumber(amount)} Aura` : 'CƏHD TUTULDU', x + w / 2, y + h - 18, { size: 18, weight: 900, color: '#f8fafc', align: 'center' });
}

async function drawMetric(ctx, x, y, w, h, icon, label, value, color) {
  roundRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.stroke();
  const compact = w < 210;
  const iconSize = compact ? 28 : 34;
  const textX = compact ? x + 64 : x + 70;
  await drawIcon(ctx, icon, x + 22, y + (compact ? 28 : 25), iconSize, color);
  drawText(ctx, label, textX, y + 35, { size: compact ? 17 : 18, color: '#94a3b8' });
  drawText(ctx, value, textX, y + 66, { size: compact ? 24 : 27, weight: 900, color: '#f8fafc', maxWidth: w - (compact ? 76 : 86) });
}

async function drawMiniStat(ctx, x, y, icon, label, value) {
  await drawIcon(ctx, icon, x, y, 28, '#f59e0b');
  drawText(ctx, label, x + 40, y + 12, { size: 16, color: '#94a3b8' });
  drawText(ctx, value, x + 40, y + 40, { size: 24, weight: 800, color: '#f8fafc', maxWidth: 150 });
}

function drawBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#080a12');
  gradient.addColorStop(0.48, '#111827');
  gradient.addColorStop(1, '#0f172a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawGlow(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawAvatar(ctx, image, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  if (image) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    ctx.fillStyle = '#334155';
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
  ctx.lineWidth = Math.max(3, size * 0.04);
  ctx.strokeStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
}

function drawProgressBar(ctx, x, y, w, h, percent, fill, track) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = track;
  ctx.fill();
  const filled = Math.max(h, w * Math.max(0, Math.min(1, percent)));
  roundRect(ctx, x, y, filled, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawPill(ctx, x, y, label, bg, fg, fontSize = 17) {
  ctx.font = `800 ${fontSize}px "Octoson Inter", Inter, Arial, sans-serif`;
  const width = Math.min(320, Math.ceil(ctx.measureText(label).width) + 28);
  roundRect(ctx, x, y, width, 32, 16);
  ctx.fillStyle = bg;
  ctx.fill();
  drawText(ctx, label, x + 14, y + 22, { size: fontSize, weight: 800, color: fg, maxWidth: width - 24 });
  return width;
}

async function drawBadgePill(ctx, x, y, label, bg, fg, fontSize = 15) {
  ctx.font = `900 ${fontSize}px "Octoson Inter", Inter, Arial, sans-serif`;
  const width = Math.min(180, Math.ceil(ctx.measureText(label).width) + 48);
  roundRect(ctx, x, y, width, 32, 16);
  ctx.fillStyle = bg;
  ctx.fill();
  await drawIcon(ctx, 'diamond', x + 12, y + 8, 16, fg);
  drawText(ctx, label, x + 34, y + 22, { size: fontSize, weight: 900, color: fg, maxWidth: width - 42 });
  return width;
}

async function drawIcon(ctx, icon, x, y, size, color) {
  const image = await loadIcon(icon);
  if (!image && icon !== 'sparkle') {
    return drawIcon(ctx, 'sparkle', x, y, size, color);
  }
  if (!image) return;
  const iconCanvas = createCanvas(size, size);
  const iconCtx = iconCanvas.getContext('2d');
  iconCtx.drawImage(image, 0, 0, size, size);
  iconCtx.globalCompositeOperation = 'source-in';
  iconCtx.fillStyle = color;
  iconCtx.fillRect(0, 0, size, size);
  ctx.drawImage(iconCanvas, x, y, size, size);
}

async function loadIcon(icon) {
  if (iconCache.has(icon)) return iconCache.get(icon);
  try {
    const file = join(process.cwd(), 'node_modules', '@phosphor-icons', 'core', 'assets', 'fill', iconPaths[icon]);
    const image = await loadImage(await readFile(file));
    iconCache.set(icon, image);
    return image;
  } catch {
    iconCache.set(icon, null);
    return null;
  }
}

async function loadRemoteImage(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await loadImage(Buffer.from(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(
    0,
    Math.min(Number(r) || 0, Math.abs(w) / 2, Math.abs(h) / 2)
  );

  ctx.beginPath();

  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);

  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);

  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);

  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);

  ctx.closePath();
}
function normalizeCanvasText(value = '') {
  return `${value ?? ''}`
    .normalize('NFC')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function drawText(ctx, text, x, y, options = {}) {
  const {
    size = 20,
    weight = 600,
    color = '#ffffff',
    align = 'left',
    maxWidth,
    minSize = 14
  } = options;

  const safeText = normalizeCanvasText(text);
  if (!safeText) return;

  let fontSize = Number(size) || 20;
  const floorSize = Number(minSize) || 14;

  const pad = 16;

  let estimatedWidth =
    Number(maxWidth) ||
    Math.max(400, safeText.length * fontSize);

  estimatedWidth = Math.ceil(
    Math.max(64, estimatedWidth + pad * 2)
  );

  const estimatedHeight = Math.ceil(
    fontSize * 2.2 + pad * 2
  );

  const textCanvas = createCanvas(
    estimatedWidth,
    estimatedHeight
  );

  const textCtx = textCanvas.getContext('2d');

  textCtx.setTransform(1, 0, 0, 1, 0, 0);
  textCtx.clearRect(
    0,
    0,
    estimatedWidth,
    estimatedHeight
  );

  textCtx.globalAlpha = 1;
  textCtx.globalCompositeOperation = 'source-over';

  textCtx.font =
    `${Number(weight) || 600} ${fontSize}px "Octoson Inter"`;

  while (
    maxWidth &&
    fontSize > floorSize &&
    textCtx.measureText(safeText).width > maxWidth
  ) {
    fontSize -= 1;

    textCtx.font =
      `${Number(weight) || 600} ${fontSize}px "Octoson Inter"`;
  }

  const fitted = fitText(
    textCtx,
    safeText,
    maxWidth
  );

  textCtx.fillStyle = color;
  textCtx.textBaseline = 'alphabetic';

  let localX = pad;

  if (align === 'right') {
    textCtx.textAlign = 'right';
    localX = estimatedWidth - pad;
  } else if (align === 'center') {
    textCtx.textAlign = 'center';
    localX = estimatedWidth / 2;
  } else {
    textCtx.textAlign = 'left';
  }

  const baselineY = pad + fontSize;

  textCtx.fillText(
    fitted,
    localX,
    baselineY
  );

  let destX = Number(x) - pad;

  if (align === 'right') {
    destX =
      Number(x) -
      estimatedWidth +
      pad;
  } else if (align === 'center') {
    destX =
      Number(x) -
      estimatedWidth / 2;
  }

  const destY =
    Number(y) -
    baselineY;

  ctx.save();

  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(
      textCanvas,
      Math.round(destX),
      Math.round(destY)
    );
  } finally {
    ctx.restore();
  }

  ctx.beginPath();
}


function fitText(ctx, text, maxWidth) {
  const value = `${text}`;
  if (!maxWidth || ctx.measureText(value).width <= maxWidth) return value;
  let output = value;
  while (output.length > 1 && ctx.measureText(`${output}...`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}...`;
}

function displayName(user) {
  return user.globalName ?? user.displayName ?? user.username ?? 'Octoson User';
}

function cleanRank(rank = '') {
  return `${rank}`
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .trim() || 'Yeni başlayan';
}

function casinoIcon(game) {
  const icons = {
    blackjack: 'sparkle',
    higherlower: 'chart',
    mines: 'sparkle',
    tower: 'chart',
    crash: 'chart',
    jackpot: 'trophy',
    lottery: 'star',
    slots: 'sparkle',
    roulette: 'sparkle',
    dice: 'sparkle',
    risk: 'lightning',
    wheel: 'sparkle',
    baccarat: 'bank',
    poker: 'sparkle',
    horse: 'trophy',
    penalty: 'trophy'
  };
  return icons[game] ?? 'sparkle';
}

function transactionIcon(kind) {
  const icons = {
    transfer: 'wallet',
    gift: 'sparkle',
    bank: 'bank',
    reward: 'trophy',
    market: 'sparkle',
    admin: 'crown',
    error: 'medal'
  };
  return icons[kind] ?? 'wallet';
}

function transactionColor(kind, amount) {
  if (kind === 'error') return '#ef4444';
  if (kind === 'admin') return '#818cf8';
  if (kind === 'bank') return '#14b8a6';
  if (amount < 0) return '#ef4444';
  return '#f59e0b';
}

function stripMarkdown(value = '') {
  return `${value}`
    .replace(/<@!?(\d+)>/g, '@üzv')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function winRate(profile) {
  if (!profile.stats.gamesPlayed) return 0;
  return Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100);
}

function placeColor(index) {
  if (index === 0) return '#f59e0b';
  if (index === 1) return '#cbd5e1';
  if (index === 2) return '#fb923c';
  return '#38bdf8';
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}