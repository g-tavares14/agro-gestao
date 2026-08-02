import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"

import { prisma } from "@/app/lib/prisma"
import {
    getCandidateEmail,
    getCandidatePassword,
    loginSchema,
} from "@/app/lib/auth-schemas"
import {
    DUMMY_PASSWORD_HASH,
    verifyPassword,
} from "@/app/lib/password"
import {
    getClientIp,
    isLoginAllowed,
    recordAuthEvent,
    recordLoginFailure,
    recordLoginSuccess,
} from "@/app/lib/auth-rate-limit"

const authSecret = process.env.AUTH_SECRET

if (!authSecret) {
    throw new Error("AUTH_SECRET is required")
}

const trustHost = process.env.NODE_ENV !== "production" ||
    process.env.VERCEL === "1" ||
    process.env.AUTH_TRUST_HOST === "true"

function isVerifiedGoogleProfile(profile: unknown): boolean {
    if (!profile || typeof profile !== "object") return false

    return "email_verified" in profile && profile.email_verified === true
}

async function safeRecordAuthEvent(input: Parameters<typeof recordAuthEvent>[0]): Promise<void> {
    try {
        await recordAuthEvent(input)
    } catch (error) {
        console.error(
            "[auth] could not write auth event",
            error instanceof Error ? error.message : "unknown error",
        )
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    secret: authSecret,
    trustHost,
    adapter: PrismaAdapter(prisma),
    pages: {
        signIn: "/login",
        error: "/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 12 * 60 * 60,
    },
    useSecureCookies: process.env.NODE_ENV === "production",
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: false,
            profile(profile) {
                return {
                    id: profile.sub,
                    name: profile.name,
                    email: profile.email?.trim().toLowerCase(),
                    image: profile.picture,
                }
            },
        }),
        Credentials({
            credentials: {
                email: {
                    label: "Email",
                    type: "email",
                    autocomplete: "email",
                },
                password: {
                    label: "Senha",
                    type: "password",
                    autocomplete: "current-password",
                },
            },
            async authorize(credentials, request) {
                const rawEmail = credentials.email
                const rawPassword = credentials.password
                const candidateEmail = getCandidateEmail(rawEmail)
                const candidatePassword = getCandidatePassword(rawPassword)
                const clientIp = getClientIp(request)

                if (!await isLoginAllowed(candidateEmail, request)) {
                    await verifyPassword(DUMMY_PASSWORD_HASH, candidatePassword)
                    await safeRecordAuthEvent({
                        event: "login_blocked",
                        success: false,
                        email: candidateEmail,
                        ip: clientIp,
                    })
                    return null
                }

                const parsed = loginSchema.safeParse({
                    email: rawEmail,
                    password: rawPassword,
                })

                if (!parsed.success) {
                    await verifyPassword(DUMMY_PASSWORD_HASH, candidatePassword)
                    await recordLoginFailure(candidateEmail, request)
                    await safeRecordAuthEvent({
                        event: "login_invalid_input",
                        success: false,
                        email: candidateEmail,
                        ip: clientIp,
                    })
                    return null
                }

                const { email, password } = parsed.data
                const user = await prisma.user.findUnique({
                    where: { email },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        passwordCredential: {
                            select: { passwordHash: true },
                        },
                    },
                })

                const passwordHash = user?.passwordCredential?.passwordHash ?? DUMMY_PASSWORD_HASH
                const passwordMatch = await verifyPassword(passwordHash, password)

                if (!user || !passwordMatch) {
                    await recordLoginFailure(email, request)
                    await safeRecordAuthEvent({
                        event: "login_failed",
                        success: false,
                        email,
                        ip: clientIp,
                        userId: user?.id,
                    })
                    return null
                }

                await recordLoginSuccess(email, request)
                await safeRecordAuthEvent({
                    event: "login_succeeded",
                    success: true,
                    email,
                    ip: clientIp,
                    userId: user.id,
                })

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    emailVerified: null,
                }
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (account?.provider !== "google") return true

            // Auth.js keeps account linking disabled by default. When a password
            // account already owns this email, the adapter flow raises AccountNotLinked.
            return Boolean(user.email) && isVerifiedGoogleProfile(profile)
        },
        async jwt({ token, user }) {
            if (user?.id) token.sub = String(user.id)
            return token
        },
        session({ session, token }) {
            if (!token.sub || !session.user) return session

            session.user.id = token.sub
            return session
        },
        async redirect({ url, baseUrl }) {
            if (url.startsWith("/") && !url.startsWith("//")) return `${baseUrl}${url}`

            try {
                return new URL(url).origin === new URL(baseUrl).origin ? url : baseUrl
            } catch {
                return baseUrl
            }
        },
    },
})
