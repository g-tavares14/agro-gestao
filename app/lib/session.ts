import "server-only"
import { auth } from "@/app/auth"

export async function getUserId(): Promise<string | null> {
    const session = await auth()
    return typeof session?.user?.id === "string" ? session.user.id : null
}
