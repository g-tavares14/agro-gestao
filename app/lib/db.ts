import "server-only"
import { Pool, type PoolClient } from "@neondatabase/serverless"

// Pool único por instância do runtime: criar um Pool novo a cada chamada vazava
// conexões WebSocket, já que nada chamava pool.end().
let pool: Pool | undefined

export const db = () => (pool ??= new Pool({ connectionString: process.env.DATABASE_URL }))

export async function withTransaction<T>(
    fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
    const client = await db().connect()
    try {
        await client.query("BEGIN")
        const result = await fn(client)
        await client.query("COMMIT")
        return result
    } catch (err) {
        try {
            await client.query("ROLLBACK")
        } catch {
            // swallow rollback failures so the original error surfaces
        }
        throw err
    } finally {
        client.release()
    }
}
