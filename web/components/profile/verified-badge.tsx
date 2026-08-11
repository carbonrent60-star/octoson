import { BadgeCheck } from "lucide-react";

export default function VerifiedBadge({
  size = "md",
  className = "",
}: {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "h-3 w-3",
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-[18px] w-[18px]",
  };

  return (
    <span
      title="Octoson Verified"
      aria-label="Octoson Verified"
      className={`group/verified relative inline-flex shrink-0 items-center justify-center ${className}`}
    >
      <span className="pointer-events-none absolute inset-[-4px] rounded-full bg-cyan-300/0 blur-md transition duration-300 group-hover/verified:bg-cyan-300/15" />

      <BadgeCheck
        strokeWidth={2.25}
        className={`relative ${sizes[size]} fill-cyan-300/10 text-cyan-200 drop-shadow-[0_0_7px_rgba(165,243,252,.24)]`}
      />
    </span>
  );
}
