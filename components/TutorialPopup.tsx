"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, BookOpen, ChevronRight } from "lucide-react"
import { TUTORIALS, type TutorialContent } from "@/lib/tutorials"

interface TutorialPopupProps {
  tutorialId: string
  /** If true, always show the popup when component mounts */
  forceShow?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export default function TutorialPopup({
  tutorialId,
  forceShow = true,
  open,
  onOpenChange,
}: TutorialPopupProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(0)
  const storageKey = `tutorial:${tutorialId}:seen`

  const tutorial = TUTORIALS[tutorialId]
  const isControlled = typeof open === "boolean"
  const isOpen = isControlled ? (open as boolean) : internalOpen

  useEffect(() => {
    if (isControlled) return
    if (forceShow && tutorial) {
      if (typeof window !== "undefined") {
        try {
          const seen = window.sessionStorage.getItem(storageKey) === "true"
          if (seen) return
        } catch {
          // ignore storage errors
        }
      }
      // Small delay to let the page render first
      const timer = setTimeout(() => setInternalOpen(true), 300)
      return () => clearTimeout(timer)
    }
  }, [forceShow, tutorial, storageKey, isControlled])

  if (!tutorial) return null

  const handleClose = () => {
    if (isControlled) {
      onOpenChange?.(false)
    } else {
      setInternalOpen(false)
    }
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(storageKey, "true")
      } catch {
        // ignore storage errors
      }
    }
  }

  const renderMarkdown = (content: string) => {
    // Simple markdown rendering for bold, tables, and lists
    const lines = content.split("\n")
    const elements: React.ReactNode[] = []
    let inTable = false
    let tableRows: string[][] = []

    lines.forEach((line, idx) => {
      // Table detection
      if (line.startsWith("|") && line.endsWith("|")) {
        if (!inTable) {
          inTable = true
          tableRows = []
        }
        // Skip separator row
        if (line.includes("---")) return
        const cells = line
          .split("|")
          .filter((cell) => cell.trim() !== "")
          .map((cell) => cell.trim())
        tableRows.push(cells)
        return
      } else if (inTable) {
        // End of table
        elements.push(
          <div key={`table-${idx}`} className="overflow-x-auto my-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {tableRows[0]?.map((cell, i) => (
                    <th
                      key={i}
                      className="text-left py-2 px-3 text-white/60 font-medium"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(1).map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-white/5">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="py-2 px-3 text-white/80">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        inTable = false
        tableRows = []
      }

      // Empty line
      if (line.trim() === "") {
        elements.push(<div key={idx} className="h-2" />)
        return
      }

      // Bullet points
      if (line.startsWith("•") || line.startsWith("-")) {
        const text = line.replace(/^[•-]\s*/, "")
        elements.push(
          <div key={idx} className="flex gap-2 my-1">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span
              className="text-white/70"
              dangerouslySetInnerHTML={{
                __html: text.replace(
                  /\*\*(.*?)\*\*/g,
                  '<strong class="text-white font-medium">$1</strong>'
                ),
              }}
            />
          </div>
        )
        return
      }

      // Numbered list
      if (/^\d+\./.test(line)) {
        const match = line.match(/^(\d+)\.\s*(.*)/)
        if (match) {
          elements.push(
            <div key={idx} className="flex gap-2 my-1">
              <span className="text-emerald-400 font-medium">{match[1]}.</span>
              <span
                className="text-white/70"
                dangerouslySetInnerHTML={{
                  __html: match[2].replace(
                    /\*\*(.*?)\*\*/g,
                    '<strong class="text-white font-medium">$1</strong>'
                  ),
                }}
              />
            </div>
          )
          return
        }
      }

      // Regular paragraph with bold support
      elements.push(
        <p
          key={idx}
          className="text-white/70 my-1"
          dangerouslySetInnerHTML={{
            __html: line.replace(
              /\*\*(.*?)\*\*/g,
              '<strong class="text-white font-medium">$1</strong>'
            ),
          }}
        />
      )
    })

    // Handle table at end of content
    if (inTable && tableRows.length > 0) {
      elements.push(
        <div key="table-end" className="overflow-x-auto my-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {tableRows[0]?.map((cell, i) => (
                  <th
                    key={i}
                    className="text-left py-2 px-3 text-white/60 font-medium"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(1).map((row, rowIdx) => (
                <tr key={rowIdx} className="border-b border-white/5">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="py-2 px-3 text-white/80">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    return elements
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            onClick={handleClose}
          />

          {/* Popup Container - Centers the popup */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-[680px] max-h-[85vh] bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
            >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0a0a]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                  <BookOpen className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {tutorial.title}
                  </h2>
                  <p className="text-xs text-white/50">{tutorial.subtitle}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors group"
                aria-label="Close tutorial"
              >
                <X className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* Section Tabs */}
            <div className="flex gap-1 px-4 py-3 border-b border-white/10 bg-black/40 overflow-x-auto">
              {tutorial.sections.map((section, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSection(idx)}
                  className={`
                    flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${
                      activeSection === idx
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "text-white/50 hover:text-white/70 hover:bg-white/5"
                    }
                  `}
                >
                  {section.title}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <h3 className="text-xl font-semibold text-white mb-4">
                    {tutorial.sections[activeSection].title}
                  </h3>
                  <div className="space-y-1">
                    {renderMarkdown(tutorial.sections[activeSection].content)}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer Navigation */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-black/40">
              <button
                onClick={() => setActiveSection(Math.max(0, activeSection - 1))}
                disabled={activeSection === 0}
                className="px-4 py-2 text-sm font-medium text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="flex gap-1.5">
                {tutorial.sections.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSection(idx)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      activeSection === idx ? "bg-emerald-400" : "bg-white/20"
                    }`}
                  />
                ))}
              </div>
              {activeSection < tutorial.sections.length - 1 ? (
                <button
                  onClick={() =>
                    setActiveSection(
                      Math.min(tutorial.sections.length - 1, activeSection + 1)
                    )
                  }
                  className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-400 transition-colors"
                >
                  Got it
                </button>
              )}
            </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
