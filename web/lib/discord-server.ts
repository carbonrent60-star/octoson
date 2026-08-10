import "server-only";

export type DiscordGuildMember = {
  user?: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  };
  nick?: string | null;
  roles?: string[];
  joined_at?: string;
  pending?: boolean;
};

export type OctosonPublicMember = {
  userId: string;
  name: string;
  username: string;
  avatar: string | null;
};

type CacheEntry = {
  member: OctosonPublicMember | null;
  expiresAt: number;
};

const CACHE_TTL = 5 * 60 * 1000;

const memberCache = new Map<string, CacheEntry>();

function sleep(ms: number) {
  return new Promise<void>((resolve) =>
    setTimeout(resolve, ms)
  );
}

function discordAvatarUrl(
  userId: string,
  avatarHash?: string | null
): string | null {
  if (!avatarHash) {
    return null;
  }

  const extension = avatarHash.startsWith("a_")
    ? "gif"
    : "png";

  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${extension}?size=128`;
}

async function requestGuildMember(
  userId: string
): Promise<DiscordGuildMember | null> {
  const guildId = process.env.OCTOSON_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!guildId) {
    throw new Error("OCTOSON_GUILD_ID is missing");
  }

  if (!botToken) {
    throw new Error("DISCORD_BOT_TOKEN is missing");
  }

  const url =
    `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`;

  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bot ${botToken}`,
        "User-Agent": "DiscordBot (OctosonWeb, 1.0.0)",
      },
      cache: "no-store",
    });

    if (response.status === 404) {
      return null;
    }

    if (response.status === 429) {
      let retryAfter = 1;

      try {
        const body = await response.json();

        if (
          typeof body?.retry_after === "number" &&
          Number.isFinite(body.retry_after)
        ) {
          retryAfter = body.retry_after;
        }
      } catch {
        // Fall back to one second.
      }

      const waitMs =
        Math.ceil(retryAfter * 1000) + 500;

      console.warn(
        `[OCTOSON WEB] Discord rate limit for ${userId}. Waiting ${waitMs}ms.`
      );

      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      const body = await response.text();

      console.error(
        `[OCTOSON WEB] Discord member ${userId} failed:`,
        response.status,
        body
      );

      return null;
    }

    const member =
      (await response.json()) as DiscordGuildMember;

    if (member.pending) {
      return null;
    }

    return member;
  }

  console.error(
    `[OCTOSON WEB] Discord member ${userId} exceeded retry limit`
  );

  return null;
}

export async function getOctosonGuildMember(
  userId: string
): Promise<DiscordGuildMember | null> {
  return requestGuildMember(userId);
}

async function resolvePublicMember(
  userId: string
): Promise<OctosonPublicMember | null> {
  const cached = memberCache.get(userId);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.member;
  }

  const member = await requestGuildMember(userId);

  if (!member?.user) {
    memberCache.set(userId, {
      member: null,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return null;
  }

  const user = member.user;

  const publicMember: OctosonPublicMember = {
    userId,
    name:
      member.nick?.trim() ||
      user.global_name?.trim() ||
      user.username ||
      `İstifadəçi ${userId.slice(-4)}`,
    username: user.username,
    avatar: discordAvatarUrl(
      user.id,
      user.avatar
    ),
  };

  memberCache.set(userId, {
    member: publicMember,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return publicMember;
}

export async function getOctosonGuildMembers(
  userIds: string[]
): Promise<Record<string, OctosonPublicMember>> {
  const uniqueIds = [
    ...new Set(userIds.filter(Boolean)),
  ];

  const members: Record<
    string,
    OctosonPublicMember
  > = {};

  /*
   * IMPORTANT:
   * Do not Promise.all these Discord requests.
   *
   * The individual guild-member endpoint works with the
   * current bot permissions, but sending many requests at
   * once triggers Discord's per-route rate limit.
   */
  for (const userId of uniqueIds) {
    try {
      const member =
        await resolvePublicMember(userId);

      if (member) {
        members[userId] = member;
      }

      /*
       * Small spacing prevents us from bursting Discord's
       * guild-member endpoint on a cold cache.
       */
      await sleep(350);
    } catch (error) {
      console.error(
        `[OCTOSON WEB] Could not resolve leaderboard member ${userId}:`,
        error
      );
    }
  }

  return members;
}


export type OctosonWorldActivity = {
  userId: string;
  title: string;
  description: string;
  emoji?: string;
  amount?: number;
  kind?:
    | "job"
    | "mission"
    | "business"
    | "upgrade"
    | "property"
    | "vehicle"
    | "income"
    | "explore";
};

const WORLD_ACTIVITY_CHANNEL_ID = "1536377802859880589";

function worldCanvasEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function worldCanvasPlainText(value: unknown) {
  return String(value ?? "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function worldCanvasNumber(value: number) {
  return Math.round(Number(value || 0)).toLocaleString("en-US");
}

function worldActivityMeta(
  kind?: OctosonWorldActivity["kind"],
  amount?: number
) {
  switch (kind) {
    case "mission":
      if (typeof amount === "number" && amount < 0) {
        return {
          label: "MISSİYA",
          accent: "#FB7185",
          glow: "#F43F5E",
        };
      }
      return {
        label: "MISSİYA",
        accent: "#67E8F9",
        glow: "#22D3EE",
      };

    case "income":
      return {
        label: "GƏLİR",
        accent: "#6EE7B7",
        glow: "#34D399",
      };

    case "business":
      return {
        label: "BİZNES",
        accent: "#7DD3FC",
        glow: "#38BDF8",
      };

    case "property":
      return {
        label: "ƏMLAK",
        accent: "#C4B5FD",
        glow: "#A78BFA",
      };

    case "vehicle":
      return {
        label: "NƏQLİYYAT",
        accent: "#FCD34D",
        glow: "#F59E0B",
      };

    case "upgrade":
      return {
        label: "UPGRADE",
        accent: "#A5B4FC",
        glow: "#818CF8",
      };

    case "explore":
      return {
        label: "KƏŞF",
        accent: "#5EEAD4",
        glow: "#2DD4BF",
      };

    case "job":
    default:
      return {
        label: "WORLD",
        accent: "#67E8F9",
        glow: "#22D3EE",
      };
  }
}

function buildWorldCanvasSvg(input: {
  displayName: string;
  title: string;
  description: string;
  amount?: number;
  kind?: OctosonWorldActivity["kind"];
}) {
  const width = 1200;
  const height = 630;

  const meta = worldActivityMeta(
    input.kind,
    input.amount
  );

  const name = worldCanvasEscape(
    worldCanvasPlainText(input.displayName).slice(0, 42)
  );

  const title = worldCanvasEscape(
    worldCanvasPlainText(input.title).slice(0, 58)
  );

  const description = worldCanvasEscape(
    worldCanvasPlainText(input.description).slice(0, 120)
  );

  const hasAmount =
    typeof input.amount === "number" &&
    Number.isFinite(input.amount);

  const amount = hasAmount
    ? Number(input.amount)
    : 0;

  const signedAmount =
    `${amount > 0 ? "+" : ""}${worldCanvasNumber(amount)}`;

  const amountLabel =
    amount > 0
      ? "QAZANC"
      : amount < 0
        ? "XƏRC"
        : "AURA";

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>
  <defs>
    <linearGradient id="worldBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#080B0F"/>
      <stop offset="52%" stop-color="#07090D"/>
      <stop offset="100%" stop-color="#040507"/>
    </linearGradient>

    <linearGradient id="worldHero" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#11171C"/>
      <stop offset="100%" stop-color="#090C10"/>
    </linearGradient>

    <radialGradient
      id="worldAmbient"
      cx="0"
      cy="0"
      r="1"
      gradientUnits="userSpaceOnUse"
      gradientTransform="translate(150 80) rotate(35) scale(650 470)"
    >
      <stop stop-color="#67E8F9" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#67E8F9" stop-opacity="0"/>
    </radialGradient>

    <radialGradient
      id="worldGlow"
      cx="0"
      cy="0"
      r="1"
      gradientUnits="userSpaceOnUse"
      gradientTransform="translate(900 330) scale(470 330)"
    >
      <stop stop-color="${meta.glow}" stop-opacity="0.17"/>
      <stop offset="1" stop-color="${meta.glow}" stop-opacity="0"/>
    </radialGradient>

    <filter id="worldShadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow
        dx="0"
        dy="24"
        stdDeviation="28"
        flood-color="#000000"
        flood-opacity="0.58"
      />
    </filter>
  </defs>

  <rect
    width="1200"
    height="630"
    rx="38"
    fill="url(#worldBg)"
  />

  <rect
    width="1200"
    height="630"
    rx="38"
    fill="url(#worldAmbient)"
  />

  <rect
    width="1200"
    height="630"
    rx="38"
    fill="url(#worldGlow)"
  />

  <rect
    x="46"
    y="38"
    width="1108"
    height="1"
    fill="#FFFFFF"
    opacity="0.08"
  />

  <circle
    cx="68"
    cy="72"
    r="5"
    fill="#A5F3FC"
  />

  <text
    x="87"
    y="80"
    fill="#A5F3FC"
    fill-opacity="0.74"
    font-size="18"
    font-family="Inter, Arial, sans-serif"
    font-weight="800"
    letter-spacing="5"
  >OCTOSON</text>

  <text
    x="1135"
    y="79"
    text-anchor="end"
    fill="#FFFFFF"
    fill-opacity="0.32"
    font-size="13"
    font-family="Inter, Arial, sans-serif"
    font-weight="700"
    letter-spacing="2.4"
  >WORLD ACTIVITY</text>

  <text
    x="62"
    y="137"
    fill="#FFFFFF"
    fill-opacity="0.30"
    font-size="13"
    font-family="Inter, Arial, sans-serif"
    font-weight="800"
    letter-spacing="2.4"
  >OYUNÇU</text>

  <text
    x="62"
    y="172"
    fill="#FFFFFF"
    fill-opacity="0.92"
    font-size="25"
    font-family="Inter, Arial, sans-serif"
    font-weight="750"
  >${name}</text>

  <text
    x="1138"
    y="137"
    text-anchor="end"
    fill="#FFFFFF"
    fill-opacity="0.30"
    font-size="13"
    font-family="Inter, Arial, sans-serif"
    font-weight="800"
    letter-spacing="2.4"
  >KATEQORİYA</text>

  <text
    x="1138"
    y="172"
    text-anchor="end"
    fill="${meta.accent}"
    fill-opacity="0.92"
    font-size="18"
    font-family="Inter, Arial, sans-serif"
    font-weight="850"
    letter-spacing="3"
  >${meta.label}</text>

  <rect
    x="44"
    y="202"
    width="1112"
    height="285"
    rx="30"
    fill="url(#worldHero)"
    stroke="#FFFFFF"
    stroke-opacity="0.075"
    filter="url(#worldShadow)"
  />

  <rect
    x="44"
    y="251"
    width="3"
    height="186"
    rx="1.5"
    fill="${meta.accent}"
    opacity="0.90"
  />

  <circle
    cx="88"
    cy="257"
    r="5"
    fill="${meta.accent}"
  />

  <text
    x="105"
    y="264"
    fill="${meta.accent}"
    font-size="14"
    font-family="Inter, Arial, sans-serif"
    font-weight="850"
    letter-spacing="3.5"
  >${meta.label}</text>

  <text
    x="82"
    y="333"
    fill="#FFFFFF"
    fill-opacity="0.96"
    font-size="42"
    font-family="Inter, Arial, sans-serif"
    font-weight="820"
    letter-spacing="-1"
  >${title}</text>

  <text
    x="84"
    y="386"
    fill="#FFFFFF"
    fill-opacity="0.52"
    font-size="20"
    font-family="Inter, Arial, sans-serif"
    font-weight="600"
  >${description}</text>

  ${
    hasAmount
      ? `
  <line
    x1="760"
    y1="254"
    x2="760"
    y2="435"
    stroke="#FFFFFF"
    stroke-opacity="0.07"
  />

  <text
    x="1110"
    y="287"
    text-anchor="end"
    fill="#FFFFFF"
    fill-opacity="0.28"
    font-size="12"
    font-family="Inter, Arial, sans-serif"
    font-weight="800"
    letter-spacing="2.3"
  >${amountLabel}</text>

  <text
    x="1110"
    y="365"
    text-anchor="end"
    fill="${meta.accent}"
    font-size="58"
    font-family="Inter, Arial, sans-serif"
    font-weight="850"
    letter-spacing="-2"
  >${signedAmount}</text>

  <text
    x="1110"
    y="402"
    text-anchor="end"
    fill="${meta.accent}"
    fill-opacity="0.65"
    font-size="13"
    font-family="Inter, Arial, sans-serif"
    font-weight="850"
    letter-spacing="4"
  >AURA</text>
      `
      : `
  <circle
    cx="1068"
    cy="345"
    r="56"
    fill="${meta.accent}"
    fill-opacity="0.035"
    stroke="${meta.accent}"
    stroke-opacity="0.14"
  />

  <circle
    cx="1068"
    cy="345"
    r="10"
    fill="${meta.accent}"
    opacity="0.78"
  />
      `
  }

  <rect
    x="44"
    y="511"
    width="1112"
    height="58"
    rx="18"
    fill="#FFFFFF"
    fill-opacity="0.025"
    stroke="#FFFFFF"
    stroke-opacity="0.055"
  />

  <text
    x="70"
    y="547"
    fill="#FFFFFF"
    fill-opacity="0.34"
    font-size="13"
    font-family="Inter, Arial, sans-serif"
    font-weight="700"
  >Octoson World hadisəsi Discord economy ilə sinxronlaşdırıldı</text>

  <circle
    cx="62"
    cy="600"
    r="3"
    fill="${meta.accent}"
    opacity="0.55"
  />

  <text
    x="75"
    y="605"
    fill="#FFFFFF"
    fill-opacity="0.27"
    font-size="12"
    font-family="Inter, Arial, sans-serif"
    font-weight="650"
  >Discord economy ilə canlı sinxron</text>

  <text
    x="1138"
    y="605"
    text-anchor="end"
    fill="#A5F3FC"
    fill-opacity="0.34"
    font-size="11"
    font-family="Inter, Arial, sans-serif"
    font-weight="850"
    letter-spacing="2.3"
  >OCTOSON.BAKHISHOV.COM</text>
</svg>
`;
}

async function renderWorldCanvasPng(input: {
  displayName: string;
  title: string;
  description: string;
  amount?: number;
  kind?: OctosonWorldActivity["kind"];
}): Promise<Buffer> {
  const svg = buildWorldCanvasSvg(input);

  const { Resvg } =
    await import("@resvg/resvg-js");

  const renderer =
    new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: 1200,
      },
    });

  return Buffer.from(
    renderer.render().asPng()
  );
}

export async function sendOctosonWorldActivity(
  activity: OctosonWorldActivity
): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    console.error(
      "[OCTOSON WORLD CANVAS] DISCORD_BOT_TOKEN is missing"
    );
    return false;
  }

  try {
    const member =
      await resolvePublicMember(activity.userId);

    const displayName =
      member?.name ||
      member?.username ||
      `İstifadəçi ${activity.userId.slice(-4)}`;

    const siteBase =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(
        /\/+$/,
        ""
      ) || "https://octoson.bakhishov.com";

    const worldUrl =
      `${siteBase}/dashboard/world`;

    const png =
      await renderWorldCanvasPng({
        displayName,
        title: activity.title,
        description: activity.description,
        amount: activity.amount,
        kind: activity.kind,
      });

    const payload = {
      allowed_mentions: {
        parse: [],
      },

      embeds: [
        {
          color: parseInt(
            worldActivityMeta(
              activity.kind,
              activity.amount
            ).accent.slice(1),
            16
          ),

          image: {
            url: "attachment://world-activity.png",
          },

          footer: {
            text: "Octoson • World activity",
          },

          timestamp: new Date().toISOString(),
        },
      ],

      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "World-a keç",
              emoji: {
                name: "🌐",
              },
              url: worldUrl,
            },
          ],
        },
      ],

      attachments: [
        {
          id: 0,
          filename: "world-activity.png",
          description:
            `${displayName} • ${worldCanvasPlainText(activity.title)}`,
        },
      ],
    };

    const form = new FormData();

    form.append(
      "payload_json",
      JSON.stringify(payload)
    );

    form.append(
      "files[0]",
      new Blob(
        [new Uint8Array(png)],
        {
          type: "image/png",
        }
      ),
      "world-activity.png"
    );

    const response = await fetch(
      `https://discord.com/api/v10/channels/${WORLD_ACTIVITY_CHANNEL_ID}/messages`,
      {
        method: "POST",

        headers: {
          Authorization: `Bot ${token}`,
          "User-Agent":
            "DiscordBot (OctosonWeb, 1.0.0)",
        },

        body: form,

        cache: "no-store",
      }
    );

    if (!response.ok) {
      const text =
        await response.text();

      console.error(
        "[OCTOSON WORLD CANVAS] Discord send failed:",
        response.status,
        text
      );

      return false;
    }

    const message =
      await response.json();

    console.log(
      `[OCTOSON WORLD CANVAS] Sent ${activity.kind ?? "activity"} → ${message.id}`
    );

    return true;
  } catch (error) {
    console.error(
      "[OCTOSON WORLD CANVAS] Unexpected error:",
      error
    );

    return false;
  }
}

export type OctosonCasinoActivity = {
  userId: string;
  game: string;
  bet: number;
  payout: number;
  net: number;
  multiplier: number;
  balance?: number;
  result?: string;
};

function casinoGameMeta(game: string) {
  const normalized = game.toLowerCase();

  const games: Record<
    string,
    {
      name: string;
      emoji: string;
    }
  > = {
    blackjack: {
      name: "Blackjack",
      emoji: "🃏",
    },
    baccarat: {
      name: "Baccarat",
      emoji: "🎴",
    },
    mines: {
      name: "Mines",
      emoji: "💣",
    },
    coinflip: {
      name: "Coinflip",
      emoji: "🪙",
    },
    wheel: {
      name: "Wheel",
      emoji: "🎡",
    },
    slots: {
      name: "Slots",
      emoji: "🎰",
    },
    risk: {
      name: "Risk",
      emoji: "⚡",
    },
    tower: {
      name: "Tower",
      emoji: "🏰",
    },
    higherlower: {
      name: "Higher / Lower",
      emoji: "🃏",
    },
    horse: {
      name: "Horse",
      emoji: "🏇",
    },
    lottery: {
      name: "Lottery",
      emoji: "🎟️",
    },
    penalty: {
      name: "Penalty",
      emoji: "⚽",
    },
    rps: {
      name: "Rock Paper Scissors",
      emoji: "✊",
    },
    jackpot: {
      name: "Jackpot",
      emoji: "💎",
    },
  };

  return (
    games[normalized] ?? {
      name:
        normalized.charAt(0).toUpperCase() +
        normalized.slice(1),
      emoji: "🎲",
    }
  );
}


function escapeSvgText(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function casinoCanvasNumber(value: number) {
  return Math.floor(
    Number(value) || 0
  ).toLocaleString("en-US");
}

function buildCasinoCanvasSvg(input: {
  displayName: string;
  gameName: string;
  gameEmoji: string;
  bet: number;
  payout: number;
  net: number;
  multiplier: number;
  balance?: number | null;
  result?: string;
}) {
  const width = 1200;
  const height = 630;

  const net = Number(input.net ?? 0);

  const won = net > 0;
  const lost = net < 0;

  const state = won
    ? "QAZANC"
    : lost
      ? "MƏĞLUBİYYƏT"
      : "HEÇ-HEÇƏ";

  const accent = won
    ? "#6EE7B7"
    : lost
      ? "#FB7185"
      : "#67E8F9";

  const glow = won
    ? "#34D399"
    : lost
      ? "#F43F5E"
      : "#22D3EE";

  const signedNet =
    `${net > 0 ? "+" : ""}${casinoCanvasNumber(net)}`;

  const name =
    escapeSvgText(input.displayName);

  const game =
    escapeSvgText(input.gameName);

  const result =
    escapeSvgText(
      input.result ||
        (
          won
            ? "Raund qazanc ilə tamamlandı."
            : lost
              ? "Bu raund məğlubiyyətlə bitdi."
              : "Balans dəyişmədi."
        )
    ).slice(0, 100);

  const balance =
    typeof input.balance === "number"
      ? `${casinoCanvasNumber(input.balance)} Aura`
      : "—";

  const bet =
    `${casinoCanvasNumber(input.bet)} Aura`;

  const payout =
    `${casinoCanvasNumber(input.payout)} Aura`;

  const multiplier =
    `${Number(input.multiplier || 0).toFixed(2)}×`;

  /*
   * Deliberately no emoji glyphs inside this SVG.
   * Resvg cannot reliably render system color emoji,
   * which caused the square/question-mark artifacts.
   */
  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#080B0F"/>
      <stop offset="52%" stop-color="#07090D"/>
      <stop offset="100%" stop-color="#040507"/>
    </linearGradient>

    <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#11171C"/>
      <stop offset="100%" stop-color="#090C10"/>
    </linearGradient>

    <linearGradient id="metric" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.055"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.018"/>
    </linearGradient>

    <radialGradient
      id="ambient"
      cx="0"
      cy="0"
      r="1"
      gradientUnits="userSpaceOnUse"
      gradientTransform="translate(155 55) rotate(35) scale(610 430)"
    >
      <stop stop-color="#67E8F9" stop-opacity="0.13"/>
      <stop offset="1" stop-color="#67E8F9" stop-opacity="0"/>
    </radialGradient>

    <radialGradient
      id="outcomeGlow"
      cx="0"
      cy="0"
      r="1"
      gradientUnits="userSpaceOnUse"
      gradientTransform="translate(850 310) scale(430 300)"
    >
      <stop stop-color="${glow}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>

    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow
        dx="0"
        dy="24"
        stdDeviation="28"
        flood-color="#000000"
        flood-opacity="0.58"
      />
    </filter>
  </defs>

  <!-- BACKGROUND -->
  <rect
    width="1200"
    height="630"
    rx="38"
    fill="url(#background)"
  />

  <rect
    width="1200"
    height="630"
    rx="38"
    fill="url(#ambient)"
  />

  <rect
    width="1200"
    height="630"
    rx="38"
    fill="url(#outcomeGlow)"
  />

  <!-- TOP HAIRLINE -->
  <rect
    x="46"
    y="38"
    width="1108"
    height="1"
    fill="#FFFFFF"
    opacity="0.08"
  />

  <!-- BRAND -->
  <circle
    cx="68"
    cy="72"
    r="5"
    fill="#A5F3FC"
  />

  <text
    x="87"
    y="80"
    fill="#A5F3FC"
    fill-opacity="0.74"
    font-size="18"
    font-family="Inter, Arial, sans-serif"
    font-weight="800"
    letter-spacing="5"
  >OCTOSON</text>

  <text
    x="1135"
    y="79"
    text-anchor="end"
    fill="#FFFFFF"
    fill-opacity="0.32"
    font-size="13"
    font-family="Inter, Arial, sans-serif"
    font-weight="700"
    letter-spacing="2.4"
  >WEB CASINO</text>

  <!-- IDENTITY -->
  <text
    x="62"
    y="137"
    fill="#FFFFFF"
    fill-opacity="0.30"
    font-size="13"
    font-family="Inter, Arial, sans-serif"
    font-weight="800"
    letter-spacing="2.4"
  >OYUNÇU</text>

  <text
    x="62"
    y="172"
    fill="#FFFFFF"
    fill-opacity="0.92"
    font-size="25"
    font-family="Inter, Arial, sans-serif"
    font-weight="750"
  >${name}</text>

  <text
    x="1138"
    y="137"
    text-anchor="end"
    fill="#FFFFFF"
    fill-opacity="0.30"
    font-size="13"
    font-family="Inter, Arial, sans-serif"
    font-weight="800"
    letter-spacing="2.4"
  >OYUN</text>

  <text
    x="1138"
    y="172"
    text-anchor="end"
    fill="#FFFFFF"
    fill-opacity="0.92"
    font-size="25"
    font-family="Inter, Arial, sans-serif"
    font-weight="750"
  >${game}</text>

  <!-- HERO -->
  <rect
    x="44"
    y="202"
    width="1112"
    height="245"
    rx="30"
    fill="url(#hero)"
    stroke="#FFFFFF"
    stroke-opacity="0.075"
    filter="url(#softShadow)"
  />

  <!-- left result rail -->
  <rect
    x="44"
    y="245"
    width="3"
    height="158"
    rx="1.5"
    fill="${accent}"
    opacity="0.88"
  />

  <!-- status -->
  <circle
    cx="88"
    cy="253"
    r="5"
    fill="${accent}"
  />

  <text
    x="105"
    y="260"
    fill="${accent}"
    font-size="14"
    font-family="Inter, Arial, sans-serif"
    font-weight="850"
    letter-spacing="3.5"
  >${state}</text>

  <!-- HERO NET -->
  <text
    x="82"
    y="353"
    fill="#FFFFFF"
    font-size="82"
    font-family="Inter, Arial, sans-serif"
    font-weight="850"
    letter-spacing="-3"
  >${signedNet}</text>

  <text
    x="86"
    y="389"
    fill="${accent}"
    fill-opacity="0.72"
    font-size="14"
    font-family="Inter, Arial, sans-serif"
    font-weight="850"
    letter-spacing="5"
  >AURA</text>

  <!-- outcome explanation -->
  <text
    x="1114"
    y="263"
    text-anchor="end"
    fill="#FFFFFF"
    fill-opacity="0.28"
    font-size="12"
    font-family="Inter, Arial, sans-serif"
    font-weight="800"
    letter-spacing="2.2"
  >NƏTİCƏ</text>

  <text
    x="1114"
    y="306"
    text-anchor="end"
    fill="#FFFFFF"
    fill-opacity="0.90"
    font-size="21"
    font-family="Inter, Arial, sans-serif"
    font-weight="700"
  >${result}</text>

  <line
    x1="760"
    y1="340"
    x2="1114"
    y2="340"
    stroke="#FFFFFF"
    stroke-opacity="0.07"
  />

  <text
    x="1114"
    y="379"
    text-anchor="end"
    fill="#FFFFFF"
    fill-opacity="0.30"
    font-size="12"
    font-family="Inter, Arial, sans-serif"
    font-weight="800"
    letter-spacing="2"
  >YEKUN BALANS</text>

  <text
    x="1114"
    y="413"
    text-anchor="end"
    fill="#FFFFFF"
    fill-opacity="0.88"
    font-size="22"
    font-family="Inter, Arial, sans-serif"
    font-weight="750"
  >${escapeSvgText(balance)}</text>

  <!-- METRICS -->
  ${[
    ["MƏRC", bet, 44],
    ["ƏMSAL", multiplier, 330],
    ["ÖDƏNİŞ", payout, 616],
    ["NET", `${signedNet} Aura`, 902],
  ].map(([label, value, x]) => `
    <rect
      x="${x}"
      y="471"
      width="254"
      height="98"
      rx="22"
      fill="url(#metric)"
      stroke="#FFFFFF"
      stroke-opacity="0.06"
    />

    <text
      x="${Number(x) + 24}"
      y="504"
      fill="#FFFFFF"
      fill-opacity="0.27"
      font-size="11"
      font-family="Inter, Arial, sans-serif"
      font-weight="850"
      letter-spacing="2.3"
    >${label}</text>

    <text
      x="${Number(x) + 24}"
      y="544"
      fill="${
        label === "NET"
          ? accent
          : "#FFFFFF"
      }"
      fill-opacity="${
        label === "NET"
          ? "0.95"
          : "0.88"
      }"
      font-size="21"
      font-family="Inter, Arial, sans-serif"
      font-weight="750"
    >${escapeSvgText(String(value))}</text>
  `).join("")}

  <!-- FOOTER -->
  <circle
    cx="62"
    cy="600"
    r="3"
    fill="#67E8F9"
    opacity="0.55"
  />

  <text
    x="75"
    y="605"
    fill="#FFFFFF"
    fill-opacity="0.27"
    font-size="12"
    font-family="Inter, Arial, sans-serif"
    font-weight="650"
  >Discord economy ilə canlı sinxron</text>

  <text
    x="1138"
    y="605"
    text-anchor="end"
    fill="#A5F3FC"
    fill-opacity="0.34"
    font-size="11"
    font-family="Inter, Arial, sans-serif"
    font-weight="850"
    letter-spacing="2.3"
  >OCTOSON.BAKHISHOV.COM</text>
</svg>
`;
}

async function renderCasinoCanvasPng(input: {
  displayName: string;
  gameName: string;
  gameEmoji: string;
  bet: number;
  payout: number;
  net: number;
  multiplier: number;
  balance?: number | null;
  result?: string;
}): Promise<Buffer> {
  const svg =
    buildCasinoCanvasSvg(input);

  /*
   * @resvg/resvg-js is a server-side SVG renderer.
   * No browser, Puppeteer or screenshot process is needed.
   */
  const { Resvg } =
    await import("@resvg/resvg-js");

  const renderer =
    new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: 1200,
      },
    });

  return Buffer.from(
    renderer.render().asPng()
  );
}

export async function sendOctosonCasinoActivity(
  activity: OctosonCasinoActivity
): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    console.error(
      "[OCTOSON CASINO ACTIVITY] DISCORD_BOT_TOKEN is missing"
    );
    return false;
  }

  try {
    const member =
      await resolvePublicMember(activity.userId);

    const displayName =
      member?.name ||
      member?.username ||
      `İstifadəçi ${activity.userId.slice(-4)}`;

    const siteBase =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(
        /\/+$/,
        ""
      ) || "https://octoson.bakhishov.com";

    const gameMeta =
      casinoGameMeta(activity.game);

    const gameUrl =
      `${siteBase}/dashboard/casino/${activity.game}`;

    const net =
      Number(activity.net ?? 0);

    const png =
      await renderCasinoCanvasPng({
        displayName,
        gameName: gameMeta.name,
        gameEmoji: gameMeta.emoji,
        bet: Number(activity.bet ?? 0),
        payout: Number(activity.payout ?? 0),
        net,
        multiplier: Number(
          activity.multiplier ?? 0
        ),
        balance:
          typeof activity.balance === "number"
            ? activity.balance
            : null,
        result: activity.result,
      });

    /*
     * Discord multipart upload:
     *
     * payload_json = message metadata
     * files[0]     = generated PNG
     *
     * attachment://casino-result.png tells Discord to
     * display the uploaded PNG inside the embed.
     */
    const payload = {
      allowed_mentions: {
        parse: [],
      },

      embeds: [
        {
          color:
            net > 0
              ? 0x22c55e
              : net < 0
                ? 0xef4444
                : 0x67e8f9,

          image: {
            url:
              "attachment://casino-result.png",
          },

          footer: {
            text:
              "Octoson • Web activity",
          },

          timestamp:
            new Date().toISOString(),
        },
      ],

      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "Casino-da aç",
              emoji: {
                name: "🎰",
              },
              url: gameUrl,
            },
          ],
        },
      ],

      attachments: [
        {
          id: 0,
          filename:
            "casino-result.png",
          description:
            `${displayName} • ${gameMeta.name} casino nəticəsi`,
        },
      ],
    };

    const form =
      new FormData();

    form.append(
      "payload_json",
      JSON.stringify(payload)
    );

    form.append(
      "files[0]",
      new Blob(
        [new Uint8Array(png)],
        {
          type: "image/png",
        }
      ),
      "casino-result.png"
    );

    const response = await fetch(
      `https://discord.com/api/v10/channels/${WORLD_ACTIVITY_CHANNEL_ID}/messages`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bot ${token}`,

          "User-Agent":
            "DiscordBot (OctosonWeb, 1.0.0)",
        },

        body: form,

        cache: "no-store",
      }
    );

    if (!response.ok) {
      const text =
        await response.text();

      console.error(
        "[OCTOSON CASINO CANVAS] Discord send failed:",
        response.status,
        text
      );

      return false;
    }

    const message =
      await response.json();

    console.log(
      `[OCTOSON CASINO CANVAS] Sent ${activity.game} → ${message.id}`
    );

    return true;
  } catch (error) {
    console.error(
      "[OCTOSON CASINO CANVAS] Unexpected error:",
      error
    );

    return false;
  }
}

