import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import DiscordProvider from "next-auth/providers/discord";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "identify",
        },
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, profile }) {
      if (profile && "id" in profile && profile.id) {
        token.discordId = String(profile.id);
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.discordId) {
        (
          session.user as typeof session.user & {
            discordId?: string;
          }
        ).discordId = String(token.discordId);
      }

      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}

export async function signOut(options?: { redirectTo?: string }) {
  "use server";

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  cookieStore.delete("next-auth.session-token");
  cookieStore.delete("__Secure-next-auth.session-token");
  cookieStore.delete("next-auth.callback-url");
  cookieStore.delete("__Secure-next-auth.callback-url");
  cookieStore.delete("next-auth.csrf-token");
  cookieStore.delete("__Host-next-auth.csrf-token");

  redirect(options?.redirectTo ?? "/");
}
