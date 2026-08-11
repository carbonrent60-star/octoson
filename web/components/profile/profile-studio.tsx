"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Pencil,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";

import VerifiedBadge from "@/components/profile/verified-badge";

type Props = {
  displayName: string;
  username: string;
  image?: string | null;
  netWorth: number;
  level: number;
  xpProgress: number;

  initialGradient: string;
  initialPrimaryColor: string;
  initialSecondaryColor: string;
  initialBannerAnimation: string;
  initialGlowIntensity: number;

  action: (formData: FormData) => void | Promise<void>;
};

const themes = [
  {
    value: "cyan",
    first: "#67e8f9",
    second: "#3b82f6",
    label: "Cyan",
  },
  {
    value: "ocean",
    first: "#38bdf8",
    second: "#6366f1",
    label: "Ocean",
  },
  {
    value: "violet",
    first: "#c4b5fd",
    second: "#8b5cf6",
    label: "Violet",
  },
  {
    value: "rose",
    first: "#fb7185",
    second: "#f472b6",
    label: "Rose",
  },
  {
    value: "emerald",
    first: "#6ee7b7",
    second: "#22d3ee",
    label: "Emerald",
  },
  {
    value: "mono",
    first: "#e5e7eb",
    second: "#64748b",
    label: "Mono",
  },
];

const animations = [
  ["aurora", "Aurora", "Yavaş atmosfer"],
  ["glow", "Pulse", "Canlı glow"],
  ["float", "Ambient", "Yumşaq hərəkət"],
  ["none", "Static", "Effektsiz"],
] as const;

function number(value: number) {
  return Math.floor(value).toLocaleString("en-US");
}

export default function ProfileStudio({
  displayName,
  username,
  image,
  netWorth,
  level,
  xpProgress,
  initialGradient,
  initialPrimaryColor,
  initialSecondaryColor,
  initialBannerAnimation,
  initialGlowIntensity,
  action,
}: Props) {
  const [editing, setEditing] = useState(false);

  const [gradient, setGradient] =
    useState(initialGradient);

  const [primaryColor, setPrimaryColor] =
    useState(initialPrimaryColor);

  const [secondaryColor, setSecondaryColor] =
    useState(initialSecondaryColor);

  const [bannerAnimation, setBannerAnimation] =
    useState(initialBannerAnimation);

  const [glowIntensity, setGlowIntensity] =
    useState(initialGlowIntensity);

  function reset() {
    setGradient(initialGradient);
    setPrimaryColor(initialPrimaryColor);
    setSecondaryColor(initialSecondaryColor);
    setBannerAnimation(initialBannerAnimation);
    setGlowIntensity(initialGlowIntensity);
  }

  function cancel() {
    reset();
    setEditing(false);
  }

  function selectTheme(value: string) {
    const theme = themes.find(
      (item) => item.value === value,
    );

    if (!theme) return;

    setGradient(theme.value);
    setPrimaryColor(theme.first);
    setSecondaryColor(theme.second);
  }

  const glow =
    Math.max(0, Math.min(100, glowIntensity)) / 100;

  return (
    <section
      className="relative mt-4 overflow-hidden rounded-[26px] border border-white/[0.075] bg-[#090a0d] transition-all duration-500"
      style={{
        boxShadow: `0 30px 100px color-mix(in srgb, ${primaryColor} ${
          4 + glowIntensity * 0.08
        }%, transparent)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{
          background: `
            radial-gradient(
              circle at 5% 0%,
              color-mix(in srgb, ${primaryColor} ${
                5 + glowIntensity * 0.1
              }%, transparent),
              transparent 34%
            ),
            radial-gradient(
              circle at 96% 100%,
              color-mix(in srgb, ${secondaryColor} ${
                4 + glowIntensity * 0.08
              }%, transparent),
              transparent 36%
            )
          `,
        }}
      />

      <div className="relative flex items-center justify-between gap-5 border-b border-white/[0.055] px-5 py-5 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <VerifiedBadge size="sm" />

            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/60">
              Verified Profile Studio
            </p>
          </div>

          <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.025em] text-white/85">
            Profil görünüşü
          </h3>

          <p className="mt-1 max-w-xl text-[11px] leading-5 text-white/25">
            Public profilinin rənglərini və atmosferini
            fərdiləşdir.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (editing) {
              cancel();
            } else {
              setEditing(true);
            }
          }}
          className={`group inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-[9px] font-semibold transition-all duration-300 ${
            editing
              ? "border-white/[0.1] bg-white/[0.04] text-white/50 hover:bg-white/[0.07]"
              : "border-cyan-100/[0.13] bg-cyan-100/[0.055] text-cyan-50/70 hover:border-cyan-100/[0.22] hover:bg-cyan-100/[0.09]"
          }`}
        >
          {editing ? (
            <>
              <X className="h-3.5 w-3.5" />
              Bağla
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5 transition-transform group-hover:-rotate-6" />
              Edit
            </>
          )}
        </button>
      </div>

      {/* Always-visible compact preview */}
      {!editing && (
        <div className="relative p-5 sm:p-6">
          <Preview
            displayName={displayName}
            username={username}
            image={image}
            netWorth={netWorth}
            level={level}
            xpProgress={xpProgress}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            bannerAnimation={bannerAnimation}
            glow={glow}
          />

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: primaryColor,
                  boxShadow: `0 0 14px ${primaryColor}88`,
                }}
              />

              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: secondaryColor,
                }}
              />

              <span className="ml-1 text-[9px] text-white/22">
                {
                  themes.find(
                    (theme) =>
                      theme.value === gradient,
                  )?.label
                }{" "}
                ·{" "}
                {
                  animations.find(
                    ([value]) =>
                      value === bannerAnimation,
                  )?.[1]
                }
              </span>
            </div>

            <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-white/15">
              OCTOSON VERIFIED
            </span>
          </div>
        </div>
      )}

      <div
        className={`relative grid transition-all duration-500 ease-out ${
          editing
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <form
            action={action}
            className="grid gap-5 p-5 lg:grid-cols-[1fr_0.9fr] sm:p-6"
          >
            <input
              type="hidden"
              name="gradient"
              value={gradient}
            />

            <input
              type="hidden"
              name="bannerAnimation"
              value={bannerAnimation}
            />

            <input
              type="hidden"
              name="primaryColor"
              value={primaryColor}
            />

            <input
              type="hidden"
              name="secondaryColor"
              value={secondaryColor}
            />

            <input
              type="hidden"
              name="glowIntensity"
              value={glowIntensity}
            />

            <div className="space-y-5">
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/25">
                  Theme preset
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {themes.map((theme) => {
                    const active =
                      gradient === theme.value;

                    return (
                      <button
                        key={theme.value}
                        type="button"
                        onClick={() =>
                          selectTheme(theme.value)
                        }
                        className={`group rounded-[14px] border p-2 transition-all duration-300 ${
                          active
                            ? "scale-[1.025] border-white/[0.24] bg-white/[0.065] shadow-[0_10px_35px_rgba(0,0,0,.22)]"
                            : "border-white/[0.065] bg-white/[0.018] hover:border-white/[0.13] hover:bg-white/[0.035]"
                        }`}
                      >
                        <span
                          className="relative block h-8 overflow-hidden rounded-[9px] border border-white/[0.08]"
                          style={{
                            background: `linear-gradient(135deg, ${theme.first}, ${theme.second})`,
                            boxShadow: active
                              ? `0 8px 28px ${theme.first}28`
                              : undefined,
                          }}
                        >
                          {active && (
                            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/40 backdrop-blur">
                              <Check className="h-2.5 w-2.5 text-white" />
                            </span>
                          )}
                        </span>

                        <span
                          className={`mt-2 block text-center text-[8px] font-medium transition ${
                            active
                              ? "text-white/80"
                              : "text-white/35 group-hover:text-white/55"
                          }`}
                        >
                          {theme.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ColorControl
                  label="Primary color"
                  description="Əsas işıq və accent"
                  value={primaryColor}
                  onChange={setPrimaryColor}
                />

                <ColorControl
                  label="Secondary color"
                  description="İkinci glow və dərinlik"
                  value={secondaryColor}
                  onChange={setSecondaryColor}
                />
              </div>

              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/25">
                  Banner animation
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {animations.map(
                    ([value, label, description]) => {
                      const active =
                        bannerAnimation === value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setBannerAnimation(value)
                          }
                          className={`rounded-[14px] border px-3 py-3 text-left transition-all duration-300 ${
                            active
                              ? "border-cyan-100/[0.2] bg-cyan-100/[0.055] shadow-[inset_0_0_25px_rgba(103,232,249,.025)]"
                              : "border-white/[0.06] bg-white/[0.018] hover:border-white/[0.12]"
                          }`}
                        >
                          <span
                            className={`block text-[10px] font-semibold ${
                              active
                                ? "text-white/85"
                                : "text-white/50"
                            }`}
                          >
                            {label}
                          </span>

                          <span className="mt-1 block text-[8px] text-white/18">
                            {description}
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              <div className="rounded-[16px] border border-white/[0.06] bg-white/[0.018] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-white/22">
                      Glow intensity
                    </p>

                    <p className="mt-1 text-[9px] text-white/18">
                      Profil ətrafındakı işığın gücü.
                    </p>
                  </div>

                  <span className="font-mono text-[10px] text-white/45">
                    {glowIntensity}%
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={glowIntensity}
                  onChange={(event) =>
                    setGlowIntensity(
                      Number(event.target.value),
                    )
                  }
                  className="mt-4 w-full accent-cyan-200"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-5">
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-100/[0.16] bg-cyan-100/[0.08] px-4 text-[9px] font-semibold text-cyan-50/80 transition hover:bg-cyan-100/[0.13]"
                >
                  <Check className="h-3.5 w-3.5" />
                  Görünüşü saxla
                </button>

                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 text-[9px] font-medium text-white/40 transition hover:bg-white/[0.05] hover:text-white/60"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Sıfırla
                </button>

                <button
                  type="button"
                  onClick={cancel}
                  className="ml-auto h-10 px-3 text-[9px] font-medium text-white/25 transition hover:text-white/55"
                >
                  Ləğv et
                </button>
              </div>
            </div>

            <div className="lg:sticky lg:top-5 lg:self-start">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/25">
                  Live preview
                </p>

                <div className="flex items-center gap-1.5 text-[8px] text-emerald-200/45">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300/60" />
                  LIVE
                </div>
              </div>

              <Preview
                displayName={displayName}
                username={username}
                image={image}
                netWorth={netWorth}
                level={level}
                xpProgress={xpProgress}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                bannerAnimation={bannerAnimation}
                glow={glow}
              />

              <p className="mt-3 text-center text-[8px] text-white/15">
                Dəyişikliklər save etmədən burada görünür.
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function ColorControl({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-[16px] border border-white/[0.06] bg-white/[0.018] p-4 transition hover:border-white/[0.1]">
      <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-white/22">
        {label}
      </span>

      <div className="mt-3 flex items-center gap-3">
        <div className="relative h-10 w-12 overflow-hidden rounded-[9px] border border-white/[0.1]">
          <input
            type="color"
            value={value}
            onChange={(event) =>
              onChange(event.target.value)
            }
            className="absolute -inset-2 h-14 w-16 cursor-pointer border-0 bg-transparent p-0"
          />
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase text-white/65">
            {value}
          </p>

          <p className="mt-0.5 text-[8px] text-white/18">
            {description}
          </p>
        </div>
      </div>
    </label>
  );
}

function Preview({
  displayName,
  username,
  image,
  netWorth,
  level,
  xpProgress,
  primaryColor,
  secondaryColor,
  bannerAnimation,
  glow,
}: {
  displayName: string;
  username: string;
  image?: string | null;
  netWorth: number;
  level: number;
  xpProgress: number;
  primaryColor: string;
  secondaryColor: string;
  bannerAnimation: string;
  glow: number;
}) {
  const animation =
    bannerAnimation === "glow"
      ? "animate-pulse"
      : bannerAnimation === "float"
        ? "animate-[pulse_5s_ease-in-out_infinite]"
        : bannerAnimation === "aurora"
          ? "animate-[pulse_8s_ease-in-out_infinite]"
          : "";

  return (
    <div
      className="relative min-h-[270px] overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#08090c] p-5 transition-all duration-500"
      style={{
        boxShadow: `inset 0 0 ${
          45 + glow * 50
        }px color-mix(in srgb, ${primaryColor} ${
          2 + glow * 6
        }%, transparent)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-500"
        style={{
          background: `
            radial-gradient(circle at 95% 5%, ${primaryColor}${
              glow > 0.65 ? "38" : "26"
            }, transparent 38%),
            radial-gradient(circle at 8% 95%, ${secondaryColor}${
              glow > 0.65 ? "26" : "18"
            }, transparent 40%)
          `,
        }}
      />

      {bannerAnimation !== "none" && (
        <div
          className={`pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-[75px] ${animation}`}
          style={{
            background: primaryColor,
            opacity: 0.06 + glow * 0.1,
          }}
        />
      )}

      <div className="relative">
        <div className="flex items-center gap-3">
          {image ? (
            <img
              src={image}
              alt=""
              className="h-14 w-14 rounded-[16px] border border-white/[0.1] object-cover shadow-2xl"
            />
          ) : (
            <div className="h-14 w-14 rounded-[16px] border border-white/[0.08] bg-white/[0.035]" />
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-[15px] font-semibold text-white/85">
                {displayName}
              </p>

              <VerifiedBadge size="sm" />
            </div>

            <p className="mt-0.5 text-[8px] text-white/25">
              @{username}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <PreviewMetric
            label="Net Worth"
            value={number(netWorth)}
          />

          <PreviewMetric
            label="Level"
            value={String(level)}
          />
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-[8px] text-white/20">
            <span>Əfsanə</span>
            <span>{xpProgress.toFixed(0)}%</span>
          </div>

          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${xpProgress}%`,
                background: `linear-gradient(90deg, ${secondaryColor}, ${primaryColor})`,
                boxShadow: `0 0 ${
                  8 + glow * 12
                }px ${primaryColor}`,
              }}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 text-[8px] text-white/16">
          <Sparkles
            className="h-3 w-3"
            style={{
              color: primaryColor,
            }}
          />
          Public profile preview
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[13px] border border-white/[0.07] bg-black/20 p-3 backdrop-blur-sm">
      <p className="text-[7px] font-semibold uppercase tracking-[0.13em] text-white/18">
        {label}
      </p>

      <p className="mt-2 text-[12px] font-semibold text-white/70">
        {value}
      </p>
    </div>
  );
}
