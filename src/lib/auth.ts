import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          hd: "epicems.com", // restrict to epicems.com domain
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // Double-check domain restriction
      if (!profile?.email?.endsWith("@epicems.com")) {
        return false;
      }
      // Upsert user in database
      await prisma.user.upsert({
        where: { email: profile.email },
        update: { name: profile.name, image: (profile as any).picture },
        create: {
          email: profile.email,
          name: profile.name,
          image: (profile as any).picture,
          role: ["emoore@epicems.com", "nregister@epicems.com", "mschroeder@epicems.com"].includes(profile.email)
            ? "ADMIN"
            : "USER",
        },
      });
      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, role: true },
        });
        if (dbUser) {
          (session.user as any).id = dbUser.id;
          (session.user as any).role = dbUser.role;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
