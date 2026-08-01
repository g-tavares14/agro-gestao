"use client"

import React, { createContext, useCallback, useContext, useRef, useState } from "react"

type AskConfirmFn = (onConfirm: () => void) => void

const ConfirmDeleteContext = createContext<AskConfirmFn>(() => {})

export function useConfirmDelete() {
    return useContext(ConfirmDeleteContext)
}

export function ConfirmDeleteProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    const callbackRef = useRef<(() => void) | null>(null)

    const askConfirm = useCallback((onConfirm: () => void) => {
        callbackRef.current = onConfirm
        setOpen(true)
    }, [])

    function handleConfirm() {
        callbackRef.current?.()
        setOpen(false)
    }

    function handleCancel() {
        setOpen(false)
    }

    return (
        <ConfirmDeleteContext.Provider value={askConfirm}>
            {children}
            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                    onClick={handleCancel}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl border border-[#E5DFD0] p-6 w-80 max-w-[90vw]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100 flex-shrink-0">
                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-600">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd"/>
                                </svg>
                            </div>
                            <h2 className="text-sm font-semibold text-[#2D5016]">Confirmar exclusão</h2>
                        </div>
                        <p className="text-sm text-[#7A7260] mb-5">
                            Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm text-[#7A7260] hover:text-[#2D5016] transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                            >
                                Apagar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmDeleteContext.Provider>
    )
}
