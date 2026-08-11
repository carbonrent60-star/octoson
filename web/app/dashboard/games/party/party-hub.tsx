"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  Gamepad2,
  LoaderCircle,
  Users,
} from "lucide-react";

import {
  PARTY_GAMES,
} from "@/lib/octoson-party-games";

import {
  createPartyRoomAction,
  joinPartyRoomAction,
} from "./actions";

export default function PartyHub() {
  const router = useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [joinCode, setJoinCode] =
    useState("");

  const [message, setMessage] =
    useState<string | null>(
      null
    );

  function create(
    game: string
  ) {
    setMessage(null);

    startTransition(
      async () => {
        const result =
          await createPartyRoomAction(
            game
          );

        if (
          !result.ok ||
          !result.room
        ) {
          setMessage(
            result.message ??
              "Room yaradıla bilmədi."
          );

          return;
        }

        router.push(
          `/dashboard/games/party/${result.room.game}/${result.room.code}`
        );
      }
    );
  }

  function join() {
    const code =
      joinCode
        .trim()
        .toUpperCase();

    if (!code) {
      setMessage(
        "Room kodunu daxil et."
      );
      return;
    }

    startTransition(
      async () => {
        const result =
          await joinPartyRoomAction(
            code
          );

        if (
          !result.ok ||
          !result.room
        ) {
          setMessage(
            result.message ??
              "Room-a qoşulmaq mümkün olmadı."
          );
          return;
        }

        router.push(
          `/dashboard/games/party/${result.room.game}/${result.room.code}`
        );
      }
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] pb-20">
      <button
        onClick={() =>
          router.push(
            "/dashboard/games"
          )
        }
        className="mb-7 flex items-center gap-2 text-[10px] text-white/35 transition hover:text-white/70"
      >
        <ArrowLeft className="h-4 w-4" />
        Oyunlar
      </button>

      <div className="mb-8">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/50">
          OCTOSON PARTY
        </p>

        <h1 className="mt-2 text-[38px] font-semibold tracking-[-0.045em] text-white">
          Multiplayer
        </h1>

        <p className="mt-2 max-w-[620px] text-[12px] leading-5 text-white/36">
          Room yarat, dostlarını kodla dəvət et və real vaxtda birlikdə oyna.
        </p>
      </div>

      <section className="mb-7 rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.12em] text-white/30">
              Room kodu
            </p>

            <input
              value={joinCode}
              maxLength={6}
              onChange={(event) =>
                setJoinCode(
                  event.target.value
                    .replace(
                      /[^a-zA-Z0-9]/g,
                      ""
                    )
                    .toUpperCase()
                )
              }
              placeholder="ABC123"
              className="h-12 w-full rounded-[13px] border border-white/[0.09] bg-black/25 px-4 font-mono text-[16px] font-semibold tracking-[0.15em] text-white outline-none transition focus:border-cyan-100/25"
            />
          </div>

          <button
            disabled={
              pending ||
              joinCode.length < 4
            }
            onClick={join}
            className="mt-auto flex h-12 items-center justify-center gap-2 rounded-[13px] bg-cyan-100 px-7 text-[11px] font-semibold text-[#061014] transition hover:bg-white disabled:opacity-30"
          >
            {pending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}

            Qoşul
          </button>
        </div>

        {message && (
          <p className="mt-3 text-[10px] text-rose-100/70">
            {message}
          </p>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Object.values(
          PARTY_GAMES
        ).map((game) => (
          <article
            key={game.key}
            className="group rounded-[22px] border border-white/[0.075] bg-[#0b0c10] p-5 transition hover:-translate-y-0.5 hover:border-cyan-100/[0.16]"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="text-[31px]">
                {game.icon}
              </span>

              <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[8px] text-white/32">
                {game.minPlayers}–
                {game.maxPlayers}
              </span>
            </div>

            <h2 className="mt-5 text-[19px] font-semibold text-white/90">
              {game.title}
            </h2>

            <p className="mt-2 min-h-[40px] text-[10px] leading-5 text-white/34">
              {game.description}
            </p>

            <button
              disabled={pending}
              onClick={() =>
                create(game.key)
              }
              className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-[11px] border border-white/[0.08] bg-white/[0.04] text-[10px] font-semibold text-white/65 transition group-hover:border-cyan-100/15 group-hover:bg-cyan-100/[0.07] group-hover:text-white"
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              Room yarat
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
