import assert from "node:assert/strict"
import test from "node:test"
import { Prisma } from "@prisma/client"
import { isSerializableTransactionConflict } from "../app/lib/prisma-errors.ts"

test("retry de transação ocorre somente para conflito serializável", () => {
    const serializationConflict = new Prisma.PrismaClientKnownRequestError("conflito", {
        code: "P2034",
        clientVersion: "test",
    })
    const uniqueConstraint = new Prisma.PrismaClientKnownRequestError("duplicado", {
        code: "P2002",
        clientVersion: "test",
    })

    assert.equal(isSerializableTransactionConflict(serializationConflict), true)
    assert.equal(isSerializableTransactionConflict(uniqueConstraint), false)
    assert.equal(isSerializableTransactionConflict(new Error("falha")), false)
})
