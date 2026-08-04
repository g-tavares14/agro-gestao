import { Prisma } from "@prisma/client"

/**
 * Serializable transactions may be retried when PostgreSQL detects a
 * serialization conflict. A unique-constraint error is a business/data
 * error, not a transient transaction conflict.
 */
export function isSerializableTransactionConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
}
