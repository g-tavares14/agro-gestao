import "server-only"

import { Prisma } from "@prisma/client"
import { prisma } from "./prisma"
export {
    dateOnlyToDate,
    decimalToNumber,
    decimalValue,
    formatDateOnlyUTC,
    formatDateTimeUTC,
} from "./prisma-values"

export type PrismaTransaction = Prisma.TransactionClient

export async function withSerializableTransaction<T>(
    fn: (tx: PrismaTransaction) => Promise<T>,
    maxAttempts = 3,
): Promise<T> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            return await prisma.$transaction(fn, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            })
        } catch (error) {
            const retryable = error instanceof Prisma.PrismaClientKnownRequestError &&
                (error.code === "P2034" || error.code === "P2002")

            if (!retryable || attempt === maxAttempts - 1) throw error
        }
    }

    throw new Error("Transação Prisma não concluída.")
}
