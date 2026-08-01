import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { Pool } from "@neondatabase/serverless"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcrypt"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const { handlers, auth, signIn, signOut } = NextAuth({
    trustHost: true,
    session: { strategy: "jwt" },
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
        Credentials({
            authorize: async (credentials) => {
                const email = (credentials?.email as string | undefined)?.trim()
                const password = credentials?.password as string | undefined

                if (!email || !password) return null

                const user = await pool.query("SELECT * FROM users WHERE email = $1", [email])
                if ((user.rowCount ?? 0) === 0) return null

                const passwordMatch = await pool.query(
                    "SELECT * FROM senhas WHERE user_id = $1",
                    [user.rows[0].id]
                )
                if ((passwordMatch.rowCount ?? 0) === 0) return null

                if (await bcrypt.compare(password, passwordMatch.rows[0].password_hash))
                    return user.rows[0]
                return null
            }
        })
    ],
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === "google") {
                if (!user.email) return false
                try {
                    const existing = await pool.query(
                        "SELECT id FROM users WHERE email = $1",
                        [user.email]
                    )
                    if ((existing.rowCount ?? 0) === 0) {
                        await pool.query(
                            `INSERT INTO users (name, email, "emailVerified", image) VALUES ($1, $2, NOW(), $3)`,
                            [user.name, user.email, user.image]
                        )
                    }
                } catch (err) {
                    console.error("[auth] signIn Google DB error:", err)
                    return false
                }
            }
            return true
        },
        async jwt({ token, user, account }) {
            if (user) {
                if (account?.provider === "google") {
                    try {
                        const dbUser = await pool.query(
                            "SELECT id FROM users WHERE email = $1",
                            [user.email]
                        )
                        if ((dbUser.rowCount ?? 0) > 0) {
                            token.sub = String(dbUser.rows[0].id)
                        }
                    } catch (err) {
                        console.error("[auth] jwt Google DB error:", err)
                    }
                } else {
                    token.sub = String(user.id)
                }
            }
            return token
        },
        session({ session, token }) {
            if (token.sub) session.user.id = token.sub
            return session
        },
    },
})

