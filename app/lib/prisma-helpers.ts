import "server-only"

import { Prisma } from "@prisma/client"
import { prisma } from "./prisma"
import { isSerializableTransactionConflict } from "./prisma-errors"
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
            if (!isSerializableTransactionConflict(error) || attempt === maxAttempts - 1) throw error
        }
    }

    throw new Error("Transação Prisma não concluída.")
}
