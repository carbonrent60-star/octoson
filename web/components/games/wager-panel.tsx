"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Check, Coins, Loader2, ShieldCheck, X } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

import {
  acceptWagerAction,
  declineWagerAction,
  proposeWagerAction,
  startAcceptedRoomAction,
} from "@/app/dashboard/games/actions";

type Player = {
  user_id: string;
  name: string;
  image?: string | null;
  balance: number;
};

type Acceptance = {
  user_id: string;
  accepted: boolean | null;
  can_afford: boolean;
};

type Proposal = {
  id: string;
  amount: number;
  status: string;
};

type Props = {
  roomId: string;
  code: string;
  game: string;
  isHost: boolean;
  everyoneReady: boolean;
  myUserId: string;
  players: Player[];
  initialProposal: Proposal | null;
  initialAcceptances: Acceptance[];
};

export default function WagerPanel({
  roomId,
  code,
  game,
  isHost,
  everyoneReady,
  myUserId,
  players,
  initialProposal,
  initialAcceptances,
}: Props) {
  const [proposal, setProposal] = useState<Proposal | null>(initialProposal);

  const [acceptances, setAcceptances] =
    useState<Acceptance[]>(initialAcceptances);

  const [bet, setBet] = useState(initialProposal?.amount ?? 0);

  const [message, setMessage] = useState("");

  const [pending, startTransition] = useTransition();

  /*
   * Prevent duplicate start requests while realtime refreshes
   * are arriving from both browsers.
   */
  const autoStartedProposalRef =
    useRef<string | null>(null);

  const playerCount = players.length;

  const pot = (proposal?.amount ?? bet) * playerCount;

  const activeStake = proposal?.amount ?? bet;

  const winnerProfit = Math.max(0, pot - activeStake);

  const everyoneAccepted =
    Boolean(proposal) &&
    proposal?.status === "pending" &&
    playerCount >= 2 &&
    players.every((player) =>
      acceptances.some(
        (acceptance) =>
          acceptance.user_id === player.user_id &&
          acceptance.accepted === true &&
          acceptance.can_afford,
      ),
    );

  const myAcceptance = acceptances.find((item) => item.user_id === myUserId);

  async function refreshProposal() {
    const supabase = getSupabaseBrowserClient();
    /*
     * These wager tables were added after the current
     * generated Supabase Database type.
     *
     * Runtime knows the tables already. Until the generated
     * types are refreshed, explicitly describe the rows
     * returned by these two realtime queries.
     */
    const proposalQuery = await supabase
      .from("game_wager_proposals")
      .select("id,amount,status")
      .eq("room_id", roomId)
      .in("status", ["pending", "declined"])
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    const nextProposal = proposalQuery.data as Proposal | null;

    setProposal(
      nextProposal
        ? {
            id: nextProposal.id,
            amount: Number(nextProposal.amount),
            status: nextProposal.status,
          }
        : null,
    );

    if (nextProposal?.id) {
      const acceptanceQuery = await supabase
        .from("game_wager_acceptances")
        .select("user_id,accepted,can_afford")
        .eq("proposal_id", nextProposal.id);

      const rows = (acceptanceQuery.data ?? []) as Acceptance[];

      setAcceptances(
        rows.map((item) => ({
          user_id: item.user_id,
          accepted: item.accepted,
          can_afford: Boolean(item.can_afford),
        })),
      );
    } else {
      setAcceptances([]);
    }
  }

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`wager-room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_wager_proposals",
          filter: `room_id=eq.${roomId}`,
        },
        refreshProposal,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_wager_acceptances",
          filter: `room_id=eq.${roomId}`,
        },
        refreshProposal,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  const sortedPlayers = useMemo(
    () =>
      [...players].sort((a, b) =>
        a.user_id === myUserId ? -1 : b.user_id === myUserId ? 1 : 0,
      ),
    [players, myUserId],
  );

  function submitProposal() {
    setMessage("");

    const fd = new FormData();

    fd.set("code", code);

    fd.set("amount", String(bet));

    startTransition(async () => {
      const result = await proposeWagerAction(fd);

      setMessage(result.message);

      if (result.ok) {
        await refreshProposal();
      }
    });
  }

  function respond(accept: boolean) {
    if (!proposal) {
      return;
    }

    const fd = new FormData();

    fd.set("proposalId", proposal.id);

    startTransition(async () => {
      const result = accept
        ? await acceptWagerAction(fd)
        : await declineWagerAction(fd);

      setMessage(result.message);

      if (result.ok) {
        await refreshProposal();
      }
    });
  }

  /*
   * READY-GATED MATCH START
   *
   * The wager can be accepted by everybody without starting.
   * Only after every room player has pressed Hazıram does the
   * host client ask the server to start the match.
   *
   * The server performs the same ready check again, so the
   * browser is never trusted for balance/match state.
   */
  useEffect(() => {
    const proposalId = proposal?.id ?? null;

    if (
      !isHost ||
      !everyoneAccepted ||
      !everyoneReady ||
      !proposalId ||
      autoStartedProposalRef.current === proposalId
    ) {
      return;
    }

    autoStartedProposalRef.current = proposalId;

    const fd = new FormData();

    fd.set("code", code);
    fd.set("proposalId", proposalId);

    startTransition(async () => {
      try {
        const result = await startAcceptedRoomAction(fd);

        if (!result.ok) {
          setMessage(result.message);

          /*
           * Allow another attempt only when the server says
           * the room is still not ready. This covers realtime
           * timing without creating an infinite loop.
           */
          if (
            result.message.includes("Hazıram") ||
            result.message.includes("hazır")
          ) {
            autoStartedProposalRef.current = null;
          }
        }
      } catch (error) {
        console.error("[READY-GATED MATCH START]", error);

        setMessage("Oyunu başlatmaq mümkün olmadı.");

        autoStartedProposalRef.current = null;
      }
    });
  }, [code, everyoneAccepted, everyoneReady, isHost, proposal?.id]);

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#0a0b0f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-cyan-300/[0.055] blur-[90px]" />

      <div className="relative flex items-start justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-100/35">
            <ShieldCheck className="h-3.5 w-3.5" />
            Match contract
          </div>

          <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.035em] text-white/90">
            {game === "reaction"
              ? "Reaction wager"
              : game === "blackjack"
                ? "Blackjack wager"
                : "Multiplayer wager"}
          </h3>

          <p className="mt-1 max-w-sm text-[10px] leading-5 text-white/25">
            Mərc yalnız bütün oyunçular qəbul etdikdən sonra balansdan tutulur.
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-cyan-100/[0.1] bg-cyan-100/[0.045] text-cyan-100/65">
          <Coins className="h-[18px] w-[18px]" />
        </div>
      </div>

      {isHost && (!proposal || proposal.status !== "pending") && (
        <div className="relative mt-5 rounded-[19px] border border-white/[0.055] bg-white/[0.018] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
              Stake / player
            </span>

            <span className="font-mono text-[11px] font-semibold text-cyan-100/65">
              {bet.toLocaleString("en-US")} AURA
            </span>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {[0, 500, 2500, 10000].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setBet(amount)}
                className={`h-9 rounded-[11px] border text-[9px] font-semibold transition ${
                  bet === amount
                    ? "border-cyan-100/[0.18] bg-cyan-100/[0.075] text-cyan-50"
                    : "border-white/[0.055] bg-black/25 text-white/30 hover:bg-white/[0.035]"
                }`}
              >
                {amount === 0 ? "FREE" : amount.toLocaleString("en-US")}
              </button>
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            <input
              type="number"
              min={0}
              max={1000000}
              value={bet}
              onChange={(event) =>
                setBet(
                  Math.max(
                    0,
                    Math.min(
                      1000000,
                      Math.floor(Number(event.target.value) || 0),
                    ),
                  ),
                )
              }
              className="h-11 min-w-0 flex-1 rounded-[12px] border border-white/[0.06] bg-black/30 px-4 font-mono text-[11px] text-white/70 outline-none focus:border-cyan-100/20"
            />

            <button
              type="button"
              disabled={pending || playerCount < 2}
              onClick={submitProposal}
              className="h-11 rounded-[12px] bg-cyan-100 px-5 text-[10px] font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Təklif et
            </button>
          </div>
        </div>
      )}

      {proposal && proposal.status === "pending" && (
        <>
          <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
            <div className="rounded-[16px] border border-white/[0.055] bg-black/25 p-4">
              <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-white/20">
                Stake
              </p>

              <p className="mt-1 font-mono text-[14px] font-semibold text-white/80">
                {proposal.amount.toLocaleString("en-US")} AURA
              </p>
            </div>

            <div className="rounded-[16px] border border-cyan-100/[0.08] bg-cyan-100/[0.025] p-4">
              <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-cyan-100/25">
                Prize pool
              </p>

              <p className="mt-1 font-mono text-[14px] font-semibold text-cyan-50/80">
                {pot.toLocaleString("en-US")} AURA
              </p>
            </div>

            <div className="rounded-[16px] border border-emerald-300/[0.08] bg-emerald-300/[0.025] p-4">
              <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-emerald-100/25">
                {game === "blackjack"
                  ? "Qalib ödənişi"
                  : "Qalibin xalis qazancı"}
              </p>

              <p className="mt-1 font-mono text-[14px] font-semibold text-emerald-100/70">
                {game === "blackjack"
                  ? `2× ${activeStake.toLocaleString("en-US")} AURA`
                  : `+${winnerProfit.toLocaleString("en-US")} AURA`}
              </p>
            </div>
          </div>

          <div className="relative mt-3 rounded-[14px] border border-white/[0.055] bg-white/[0.018] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[9px] text-white/30">Uduzsan</span>

              <span className="font-mono text-[10px] font-semibold text-red-200/60">
                -{activeStake.toLocaleString("en-US")} AURA
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[9px] text-white/30">
                {game === "blackjack" ? "Dealer-i udsan" : "Qalib gəlsən"}
              </span>

              <span className="font-mono text-[10px] font-semibold text-emerald-200/60">
                {game === "blackjack"
                  ? `${(activeStake * 2).toLocaleString("en-US")} AURA geri`
                  : `+${winnerProfit.toLocaleString("en-US")} AURA xalis`}
              </span>
            </div>
          </div>

          <div className="relative mt-3 space-y-2">
            {sortedPlayers.map((player) => {
              const response = acceptances.find(
                (acceptance) => acceptance.user_id === player.user_id,
              );

              const accepted = response?.accepted === true;

              const declined = response?.accepted === false;

              const cannotAfford =
                response?.can_afford === false && proposal.amount > 0;

              return (
                <div
                  key={player.user_id}
                  className="flex items-center gap-3 rounded-[14px] border border-white/[0.05] bg-black/20 px-3.5 py-3"
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-[11px] border border-white/[0.06] bg-white/[0.035]">
                    {player.image ? (
                      <img
                        src={player.image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white/40">
                        {player.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-white/70">
                      {player.name}
                      {player.user_id === myUserId ? " · Sən" : ""}
                    </p>

                    <p className="mt-0.5 font-mono text-[9px] font-semibold text-cyan-100/45">
                      {player.balance.toLocaleString("en-US")} AURA
                    </p>

                    <p
                      className={`mt-0.5 text-[8px] ${
                        accepted
                          ? "text-emerald-200/55"
                          : declined
                            ? "text-red-200/55"
                            : cannotAfford
                              ? "text-amber-200/55"
                              : "text-white/20"
                      }`}
                    >
                      {accepted
                        ? "Qəbul etdi"
                        : declined
                          ? "Rədd etdi"
                          : cannotAfford
                            ? "Kifayət qədər Aura yoxdur"
                            : "Cavab gözlənilir"}
                    </p>
                  </div>

                  <div
                    className={`flex h-7 min-w-7 items-center justify-center rounded-lg border ${
                      accepted
                        ? "border-emerald-300/10 bg-emerald-300/[0.055] text-emerald-200/70"
                        : declined
                          ? "border-red-300/10 bg-red-300/[0.04] text-red-200/60"
                          : "border-white/[0.05] bg-white/[0.02] text-white/20"
                    }`}
                  >
                    {accepted ? (
                      <Check className="h-3 w-3" />
                    ) : declined ? (
                      <X className="h-3 w-3" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!isHost && myAcceptance?.accepted !== true && (
            <div className="relative mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => respond(false)}
                className="flex h-11 items-center justify-center gap-2 rounded-[12px] border border-red-200/10 bg-red-200/[0.03] text-[10px] font-semibold text-red-100/60 transition hover:bg-red-200/[0.06]"
              >
                <X className="h-3.5 w-3.5" />
                Rədd et
              </button>

              <button
                type="button"
                disabled={pending || myAcceptance?.can_afford === false}
                onClick={() => respond(true)}
                className="flex h-11 items-center justify-center gap-2 rounded-[12px] bg-cyan-100 text-[10px] font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Qəbul et
              </button>
            </div>
          )}

          {isHost && (
            <div
              className={`relative mt-4 flex min-h-12 w-full items-center gap-3 rounded-[13px] border px-4 ${
                everyoneAccepted
                  ? "border-emerald-300/10 bg-emerald-300/[0.045]"
                  : "border-white/[0.055] bg-white/[0.022]"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  everyoneAccepted
                    ? "bg-emerald-300/[0.08] text-emerald-200/70"
                    : "bg-white/[0.035] text-white/25"
                }`}
              >
                {everyoneAccepted ? (
                  pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
              </div>

              <div className="min-w-0">
                <p
                  className={`text-[10px] font-semibold ${
                    everyoneAccepted ? "text-emerald-100/75" : "text-white/55"
                  }`}
                >
                  {everyoneAccepted
                    ? "Oyun başlayır..."
                    : "Rəqibin cavabı gözlənilir"}
                </p>

                <p className="mt-0.5 text-[8px] text-white/20">
                  {everyoneAccepted
                    ? "Bütün oyunçular qəbul etdi"
                    : "Qəbul edən kimi oyun avtomatik başlayacaq"}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {proposal?.status === "declined" && (
        <div className="relative mt-4 rounded-[14px] border border-red-200/10 bg-red-200/[0.025] px-4 py-3 text-[9px] leading-5 text-red-100/55">
          Mərc rədd edildi. Host yeni təklif göndərə bilər.
        </div>
      )}

      {message && (
        <p className="relative mt-3 text-[9px] leading-4 text-white/35">
          {message}
        </p>
      )}
    </section>
  );
}
