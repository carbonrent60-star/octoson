import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      authorization: {
        params: {
         scope: "identify",
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, profile }) {
      if (profile?.id) {
        token.discordId = profile.id;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.discordId) {
        session.user.discordId = token.discordId as string;
      }

      return session;
    },
  },
});