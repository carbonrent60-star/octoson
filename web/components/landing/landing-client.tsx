"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

type Props = {
  loggedIn: boolean;
  userName: string | null;
  userImage: string | null;
};

const features = [
  {
    number: "01",
    title: "Casino",
    text: "Slots, Coinflip, Blackjack, Mines və digər oyunlarda Aura-nı sına.",
    href: "/dashboard/casino",
  },
  {
    number: "02",
    title: "World",
    text: "İş seç, missiyalar tamamla, biznes və əmlak alaraq öz dünyanı qur.",
    href: "/dashboard/world",
  },
  {
    number: "03",
    title: "Bank",
    text: "Aura balansını və economy resurslarını bir yerdən idarə et.",
    href: "/dashboard/bank",
  },
  {
    number: "04",
    title: "Market",
    text: "Economy daxilində əşyaları və xüsusi imkanları kəşf et.",
    href: "/dashboard/market",
  },
  {
    number: "05",
    title: "Inventory",
    text: "Topladığın əşyaları, mükafatları və profil aktivlərini idarə et.",
    href: "/dashboard/inventory",
  },
  {
    number: "06",
    title: "Leaderboard",
    text: "Server economy-sində kimin zirvədə olduğunu canlı izlə.",
    href: "/dashboard/leaderboard",
  },
];

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path
        d="M4 10h12M11 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M19.5 5.34A17.1 17.1 0 0 0 15.27 4l-.52 1.06a15.6 15.6 0 0 0-5.5 0L8.73 4A17.2 17.2 0 0 0 4.5 5.35C1.82 9.3 1.1 13.16 1.46 16.97a17.4 17.4 0 0 0 5.2 2.63l1.28-1.76a10.6 10.6 0 0 1-2.02-.97l.5-.38c3.9 1.8 8.13 1.8 11.98 0l.5.38c-.65.38-1.33.7-2.02.97l1.28 1.76a17.3 17.3 0 0 0 5.2-2.63c.43-4.42-.73-8.24-3.86-11.63ZM8.75 14.65c-1.17 0-2.13-1.08-2.13-2.4s.94-2.4 2.13-2.4c1.2 0 2.15 1.1 2.13 2.4 0 1.32-.94 2.4-2.13 2.4Zm6.5 0c-1.17 0-2.13-1.08-2.13-2.4s.94-2.4 2.13-2.4c1.2 0 2.15 1.1 2.13 2.4 0 1.32-.93 2.4-2.13 2.4Z" />
    </svg>
  );
}

export default function LandingClient({
  loggedIn,
  userName,
  userImage,
}: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setReady(true));
  }, []);

  const [loginLoading, setLoginLoading] = useState(false);

  async function loginWithDiscord() {
    if (loginLoading) return;

    setLoginLoading(true);

    try {
      await signIn("discord", {
        callbackUrl: "/dashboard",
      });
    } catch (error) {
      console.error("Discord login failed:", error);
      setLoginLoading(false);
    }
  }

  function discover() {
    document.getElementById("platform")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050607] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[8%] top-[-260px] h-[600px] w-[600px] rounded-full bg-cyan-300/[0.055] blur-[140px]" />
        <div className="absolute right-[-150px] top-[450px] h-[500px] w-[500px] rounded-full bg-blue-500/[0.025] blur-[150px]" />
      </div>

      <header className="relative z-20 mx-auto max-w-[1240px] px-6 lg:px-8">
        <nav className="flex h-24 items-center justify-between border-b border-white/[0.07]">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-200/15 bg-cyan-200/[0.055] text-sm font-semibold text-cyan-100">
              O
            </div>

            <div>
              <div className="text-[15px] font-semibold">
                Octoson
              </div>
              <div className="text-[8px] uppercase tracking-[0.28em] text-white/25">
                Aura Economy
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={discover}
              className="hidden px-4 py-2 text-sm text-white/40 transition hover:text-white md:block"
            >
              Platforma
            </button>

            {loggedIn ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 transition hover:bg-white/[0.09]"
              >
                {userImage ? (
                  <img
                    src={userImage}
                    alt=""
                    className="h-7 w-7 rounded-lg"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-lg bg-white/10" />
                )}

                <div className="hidden text-left sm:block">
                  <div className="max-w-[120px] truncate text-[10px] text-white/35">
                    {userName ?? "Discord"}
                  </div>
                  <div className="text-xs font-medium">
                    Dashboard
                  </div>
                </div>

                <Arrow />
              </Link>
            ) : (
              <button
                type="button"
                onClick={loginWithDiscord}
                disabled={loginLoading}
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
              >
                <DiscordIcon />
                {loginLoading ? "Discord açılır..." : "Discord ilə daxil ol"}
              </button>
            )}
          </div>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-[1240px] px-6 pb-28 pt-24 lg:px-8 lg:pb-36 lg:pt-32">
        <div
          className={`mx-auto flex max-w-5xl flex-col items-center text-center transition-all duration-1000 ${
            ready
              ? "translate-y-0 opacity-100"
              : "translate-y-5 opacity-0"
          }`}
        >
          <div className="mb-8 flex items-center gap-2 rounded-full border border-cyan-200/10 bg-cyan-200/[0.04] px-3.5 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.7)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              Discord Economy · Live Sync
            </span>
          </div>

          <h1 className="text-[3.5rem] font-semibold leading-[0.96] tracking-[-0.065em] sm:text-[5.3rem] lg:text-[6.6rem]">
            Server economy-n
            <span className="block bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent">
              artıq bir dünyadır.
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-base leading-7 text-white/38 sm:text-lg">
            Discord-da qazandığın Aura, bankın, inventarın,
            profilin və bütün progress-in Octoson Web ilə eyni
            economy-də yaşayır.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            {loggedIn ? (
              <Link
                href="/dashboard"
                className="flex min-w-[190px] items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-cyan-100"
              >
                Dashboard-a keç
                <Arrow />
              </Link>
            ) : (
              <button
                type="button"
                onClick={loginWithDiscord}
                disabled={loginLoading}
                className="flex min-w-[205px] items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
              >
                <DiscordIcon />
                {loginLoading ? "Discord açılır..." : "Discord ilə daxil ol"}
              </button>
            )}

            <button
              onClick={discover}
              className="min-w-[180px] rounded-xl border border-white/[0.09] bg-white/[0.035] px-6 py-3.5 text-sm text-white/70 transition hover:bg-white/[0.07] hover:text-white"
            >
              Platformanı kəşf et
            </button>
          </div>
        </div>

        <div
          className={`relative mx-auto mt-24 max-w-5xl transition-all delay-200 duration-1000 ${
            ready
              ? "translate-y-0 opacity-100"
              : "translate-y-8 opacity-0"
          }`}
        >
          <div className="absolute -inset-14 -z-10 bg-cyan-300/[0.025] blur-[100px]" />

          <div className="rounded-[28px] border border-white/[0.09] bg-[#090b0d]/90 p-2 shadow-[0_40px_120px_rgba(0,0,0,.55)]">
            <div className="overflow-hidden rounded-[22px] border border-white/[0.055] bg-[#080a0c]">
              <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-6">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-200/70" />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-white/28">
                    Live Economy
                  </span>
                </div>

                <span className="text-[9px] uppercase tracking-[0.2em] text-emerald-300/60">
                  Synced
                </span>
              </div>

              <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_.8fr] lg:p-11">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/25">
                    Platform
                  </p>

                  <h2 className="mt-4 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                    Discord-dan web-ə.
                    <span className="block text-white/30">
                      Heç nə sıfırlanmır.
                    </span>
                  </h2>

                  <div className="mt-8 grid grid-cols-3 gap-3">
                    <PreviewStat label="Aura" value="Live" />
                    <PreviewStat label="Profile" value="Sync" />
                    <PreviewStat label="World" value="Online" />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
                  <p className="text-[9px] uppercase tracking-[0.22em] text-white/25">
                    Activity
                  </p>

                  <div className="mt-5 space-y-4">
                    <Activity
                      title="Casino"
                      text="Nəticə Discord-a göndərildi"
                    />
                    <Activity
                      title="World"
                      text="Economy profili yeniləndi"
                    />
                    <Activity
                      title="Bank"
                      text="Aura canlı sinxronlaşdırıldı"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="platform"
        className="relative z-10 mx-auto max-w-[1240px] scroll-mt-12 px-6 py-28 lg:px-8 lg:py-36"
      >
        <div className="grid gap-14 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-200/60">
              Platforma
            </p>

            <h2 className="mt-5 max-w-sm text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-5xl">
              Botdan daha böyük economy.
            </h2>

            <p className="mt-6 max-w-sm text-sm leading-7 text-white/35">
              Octoson Web botu əvəz etmir. Onu genişləndirir.
              Eyni Discord hesabı, eyni Aura və eyni progress.
            </p>
          </div>

          <div className="grid sm:grid-cols-2">
            {features.map((feature) => (
              <Link
                key={feature.title}
                href={loggedIn ? feature.href : "#"}
                onClick={(event) => {
                  if (!loggedIn) {
                    event.preventDefault();
                    void loginWithDiscord();
                  }
                }}
                className="group min-h-[220px] border-b border-white/[0.06] p-7 transition duration-300 hover:bg-white/[0.025] sm:border-l"
              >
                <div className="flex justify-between">
                  <span className="font-mono text-[10px] text-white/18">
                    {feature.number}
                  </span>

                  <span className="text-white/15 transition group-hover:translate-x-1 group-hover:text-cyan-200">
                    <Arrow />
                  </span>
                </div>

                <h3 className="mt-10 text-xl font-medium">
                  {feature.title}
                </h3>

                <p className="mt-3 max-w-xs text-sm leading-6 text-white/30">
                  {feature.text}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-[1240px] px-6 pb-32 lg:px-8">
        <div className="overflow-hidden rounded-[30px] border border-white/[0.07] bg-white/[0.025] px-8 py-16 lg:px-16 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/55">
                Discord ↔ Web
              </p>

              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                İki platforma.
                <span className="block text-white/30">
                  Bir economy.
                </span>
              </h2>
            </div>

            <div>
              <p className="max-w-lg text-base leading-7 text-white/38">
                Web-də etdiyin əməliyyatlar Discord profilinə,
                Discord-da qazandıqların isə web profilinə
                tətbiq olunur.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {[
                  "Aura",
                  "Casino",
                  "World",
                  "Bank",
                  "Inventory",
                  "Profile",
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-lg border border-white/[0.07] px-3 py-2 text-[11px] text-white/35"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.055]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-6 py-8 text-xs text-white/22 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>
            © {new Date().getFullYear()} Octoson
          </span>

          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white/60">
              Privacy
            </Link>
            <Link href="/legal" className="hover:text-white/60">
              Legal
            </Link>
            <Link href="/impressum" className="hover:text-white/60">
              Impressum
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function PreviewStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-4">
      <p className="text-[8px] uppercase tracking-[0.18em] text-white/22">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-white/70">
        {value}
      </p>
    </div>
  );
}

function Activity({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.055] pb-4 last:border-0 last:pb-0">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200/60" />
      <div>
        <p className="text-xs font-medium text-white/65">
          {title}
        </p>
        <p className="mt-1 text-[10px] text-white/25">
          {text}
        </p>
      </div>
    </div>
  );
}
