export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-white">
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/50">
        Octoson
      </p>

      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
        Impressum
      </h1>

      <div className="mt-10 rounded-2xl border border-amber-200/15 bg-amber-200/[0.03] p-6 text-sm leading-7 text-white/60">
        <p className="font-semibold text-amber-100/80">
          BU HİSSƏNİ REAL MƏLUMATLARINLA DOLDUR.
        </p>

        <p className="mt-4">
          Betreiber / Diensteanbieter:<br />
          [TAM ADIN VƏ YA HÜQUQİ ŞƏXS]
        </p>

        <p className="mt-4">
          Anschrift:<br />
          [KÜÇƏ VƏ EV NÖMRƏSİ]<br />
          [POST KODU, ŞƏHƏR]<br />
          Deutschland
        </p>

        <p className="mt-4">
          Kontakt:<br />
          E-Mail: [ƏLAQƏ EMAILİ]
        </p>

        <p className="mt-6 text-xs text-white/30">
          Məlumatları doldurmadan bu səhifəni ictimai deployment üçün
          hazır hesab etmə.
        </p>
      </div>
    </main>
  );
}
