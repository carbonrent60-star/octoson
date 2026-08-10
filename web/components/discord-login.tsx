import { signIn } from "@/auth";

export default function DiscordLogin() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("discord", { redirectTo: "/dashboard" });
      }}
    >
      <button
        type="submit"
        className="rounded-xl bg-white px-6 py-3 font-medium text-black transition hover:bg-white/90"
      >
        Discord ilə daxil ol
      </button>
    </form>
  );
}
