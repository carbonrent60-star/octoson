import { redirect } from "next/navigation";
import {
  Landmark,
  Wallet,
  ShieldCheck,
  ArrowRightLeft,
} from "lucide-react";

import { auth } from "@/auth";
import { getOctosonUser } from "@/lib/octoson";
import { BankControls } from "./bank-controls";

function formatAura(value: unknown) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) return "0";

  return Math.floor(amount).toLocaleString("en-US");
}

export default async function BankPage() {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const economy = await getOctosonUser(session.user.discordId);

  if (!economy) {
    redirect("/not-member");
  }

  const profile = economy.profile ?? {};

  const wallet = Number(profile.balance ?? 0);
  const bank = Number(profile.bank ?? 0);
  const total = wallet + bank;

  const bankPercentage =
    total > 0 ? Math.min(100, Math.max(0, (bank / total) * 100)) : 0;

  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/55">
              Octoson Bank
            </p>
          </div>

          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] text-white sm:text-[40px]">
            Bank
          </h1>

          <p className="mt-2 max-w-xl text-[13px] leading-6 text-white/25">
            Aura balansını idarə et və vəsaiti wallet ilə bank arasında köçür.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-white/25">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/60" />
          Discord economy ilə sinxron
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#0a0a0d]">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[420px] w-[420px] rounded-full bg-cyan-300/[0.045] blur-[100px]" />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-medium text-white/25">
                <Landmark className="h-3.5 w-3.5" />
                Ümumi sərvət
              </div>

              <div className="mt-3 flex items-baseline gap-2.5">
                <span className="text-[44px] font-semibold leading-none tracking-[-0.055em] text-white sm:text-[56px]">
                  {formatAura(total)}
                </span>

                <span className="text-[11px] font-semibold tracking-[0.12em] text-cyan-200/55">
                  AURA
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[10px] text-white/25">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Sistem aktivdir
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <BalanceCard
              icon={Wallet}
              label="Wallet"
              value={wallet}
              description="İstifadəyə hazır"
            />

            <BalanceCard
              icon={Landmark}
              label="Bank"
              value={bank}
              description="Bankda saxlanılır"
              accent
            />
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-[9px] font-medium uppercase tracking-[0.12em] text-white/15">
              <span>Wallet</span>
              <span>Bank {bankPercentage.toFixed(0)}%</span>
            </div>

            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className="h-full rounded-full bg-cyan-200/50 transition-all duration-700"
                style={{ width: `${bankPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <BankControls wallet={wallet} bank={bank} />
      </section>

      <div className="mt-5 flex items-start gap-3 rounded-[16px] border border-white/[0.05] bg-white/[0.015] px-5 py-4">
        <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200/40" />

        <div>
          <p className="text-[11px] font-medium text-white/45">
            Eyni economy, iki interfeys
          </p>

          <p className="mt-1 text-[10px] leading-5 text-white/20">
            Burada etdiyin bank əməliyyatları Discord botundakı Aura balansınla eyni sistemdə işləyir.
          </p>
        </div>
      </div>
    </div>
  );
}

function BalanceCard({
  icon: Icon,
  label,
  value,
  description,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  description: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`group rounded-[18px] border p-5 transition ${
        accent
          ? "border-cyan-200/[0.09] bg-cyan-200/[0.02]"
          : "border-white/[0.055] bg-black/20"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-white/[0.06] bg-white/[0.025]">
          <Icon
            className={`h-4 w-4 ${
              accent ? "text-cyan-200/65" : "text-white/35"
            }`}
          />
        </div>

        <span className="text-[9px] uppercase tracking-[0.14em] text-white/15">
          {description}
        </span>
      </div>

      <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/20">
        {label}
      </p>

      <div className="mt-1 flex items-baseline gap-1.5">
        <p className="text-[24px] font-semibold tracking-[-0.035em] text-white/85">
          {formatAura(value)}
        </p>

        <span className="text-[9px] font-semibold text-white/20">
          AURA
        </span>
      </div>
    </div>
  );
}
