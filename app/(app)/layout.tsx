import React from "react"
import Link from "next/link"
import { getCulturas, getCulturaItemCounts } from "./actions/culturas"
import Sidebar from "@/app/components/sidebar"
import { ConfirmDeleteProvider } from "@/app/components/confirm-delete-context"
import { signOut } from "@/app/auth"

function LeafIcon() {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M21 3C21 3 9 5 8.5 15.5C8.5 15.5 12 13 17 8C17 8 15 13.5 12 16C12 16 17 15 19 10.5C19 10.5 20 7 21 3Z"
                fill="#4A7C2F"/>
            <path d="M17 8C8 10 5.9 16.17 3.82 19.34L5.71 21L6 20.5C6.5 19.5 7.5 17.5 9.5 15.5C11.5 13.5 13.5 12 17 8Z"
                  fill="#2D5016"/>
        </svg>
    )
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const [culturas, counts] = await Promise.all([
        getCulturas(),
        getCulturaItemCounts(),
    ])

    return (
        <div className="min-h-screen flex flex-col bg-[#EDE8D8]">
            <header className="bg-white border-b border-[#E5DFD0] px-6 py-3 flex items-center justify-between flex-shrink-0 z-10">
                <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <LeafIcon/>
                    <span className="text-lg font-bold text-[#2D5016] tracking-tight">Agro Gestão</span>
                </Link>
                <form action={async () => {
                    "use server"
                    await signOut({ redirectTo: "/" })
                }}>
                    <button type="submit"
                            className="flex items-center gap-1.5 text-sm text-[#7A7260] hover:text-[#2D5016] transition-colors">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd"
                                  d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h7a1 1 0 100-2H4V5h6a1 1 0 100-2H3zm11.293 4.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L15.586 12H9a1 1 0 110-2h6.586l-1.293-1.293a1 1 0 010-1.414z"
                                  clipRule="evenodd"/>
                        </svg>
                        Sair
                    </button>
                </form>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <Sidebar culturas={culturas} counts={counts}/>
                <main className="flex-1 overflow-y-auto">
                    <ConfirmDeleteProvider>
                        {children}
                    </ConfirmDeleteProvider>
                </main>
            </div>
        </div>
    )
}
