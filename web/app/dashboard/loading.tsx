export default function DashboardLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1240px]"
      role="status"
      aria-label="Səhifə yüklənir"
    >
      <div className="animate-pulse">
        <div className="h-2 w-24 rounded-full bg-cyan-100/[0.08]" />

        <div className="mt-4 h-9 w-48 rounded-[10px] bg-white/[0.055]" />

        <div className="mt-3 h-3 w-72 max-w-[70vw] rounded-full bg-white/[0.035]" />

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[86px] rounded-[17px] border border-white/[0.045] bg-white/[0.018]"
            />
          ))}
        </div>

        <div className="mt-5 h-[118px] rounded-[20px] border border-cyan-100/[0.045] bg-cyan-100/[0.012]" />

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-[230px] rounded-[20px] border border-white/[0.045] bg-white/[0.015]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
