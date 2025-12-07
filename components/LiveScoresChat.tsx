"use client"

import { useState } from "react"
import { Send, MessageCircle, Sparkles, AlertCircle, X } from "lucide-react"
import type { LeagueId } from "@/lib/live-scores"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

interface LiveScoresChatProps {
  leagues: LeagueId[]
  date: string
}

export function LiveScoresChat({ leagues, date }: LiveScoresChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Sports-only chat. Ask me about scores, schedules, or team status (ESPN data only)." },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMessage = input.trim()
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setInput("")
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/live-scores/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, leagues, date }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to fetch answer")
      }
      const reply = payload?.reply || "No data available for that query."
      setMessages((prev) => [...prev, { role: "assistant", content: reply }])
    } catch (err: any) {
      setError(err?.message ?? "Unable to answer right now.")
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't fetch ESPN data for that question." },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="w-[320px] sm:w-[380px] rounded-2xl border border-[#6b6b6b] bg-[#3f3f3f] p-4 shadow-2xl shadow-black/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              Live Scores Chat
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/50">
              <Sparkles className="w-3 h-3" />
              ESPN data only ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· No betting
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMessages([{ role: "assistant", content: "Sports-only chat. Ask me about scores, schedules, or team status (ESPN data only)." }])}
                className="text-[11px] text-white/60 hover:text-white transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[220px] max-h-[360px] overflow-y-auto space-y-2 rounded-xl bg-[#4a4a4a] border border-[#6b6b6b] p-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-emerald-500/10 text-emerald-100 border border-emerald-500/30"
                    : "bg-[#3f3f3f] text-white border border-[#6b6b6b]"
                }`}
              >
                {msg.content}
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Ask about today's scores, a team, or a game..."
              className="flex-1 rounded-lg bg-[#3f3f3f] border border-[#6b6b6b] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-[#34d399] text-[#0f1f15] text-sm font-semibold hover:bg-[#16a34a] transition-colors disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-[#34d399] text-[#0f1f15] px-4 py-2 shadow-lg shadow-[#34d399]/30 hover:bg-[#16a34a] transition-colors"
          aria-label="Open live scores chat"
        >
          <MessageCircle className="w-4 h-4" />
          Ask about scores
        </button>
      )}
    </div>
  )
}
