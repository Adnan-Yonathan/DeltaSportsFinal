'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

type SlideSize = "default" | "large" | "wide"

const slides: Array<{ name: string; logo: string; size: SlideSize; kind?: "screenshot" }> = [
  { name: "FanDuel", logo: "https://logos-world.net/wp-content/uploads/2024/10/FanDuel-Logo-500x281.png", size: "default" },
  { name: "DraftKings", logo: "https://companieslogo.com/img/orig/DKNG_BIG-9bcdf411.png?t=1720244491", size: "default" },
  { name: "BetMGM", logo: "https://www.pngall.com/wp-content/uploads/17/BETMGM-Logo-Distinct-Design-PNG-thumb.png", size: "default" },
  { name: "Pinnacle", logo: "https://th.bing.com/th/id/R.38eec8450d7dc257896f7893d0a0fa68?rik=A1vhXbQI8R%2fzwA&riu=http%3a%2f%2fgruenzeug-graz.at%2fwp-content%2fuploads%2fpinnacle-sports-logo.png&ehk=Y%2bxlVb%2b6i9Seu4nSU2dXaouFXVbtFSztDndLfOB00zA%3d&risl=&pid=ImgRaw&r=0", size: "default" },
  { name: "Polymarket", logo: "/672aa23f57274202571467fe__BackpackPreview (7)-p-500.png", size: "large" },
  { name: "Kalshi", logo: "/kalshi-logo.png", size: "default" },
  { name: "Delta Screenshot 1-14-2026 1", logo: "/Screenshot 2026-01-14 001059.png", size: "wide", kind: "screenshot" },
  { name: "Delta Screenshot 1-14-2026 2", logo: "/Screenshot 2026-01-14 001149.png", size: "wide", kind: "screenshot" },
  { name: "Delta Screenshot 1-14-2026 3", logo: "/Screenshot 2026-01-14 001207.png", size: "wide", kind: "screenshot" },
  { name: "Delta Screenshot 1-14-2026 4", logo: "/Screenshot 2026-01-14 001251.png", size: "wide", kind: "screenshot" },
  { name: "Delta Screenshot 1-14-2026 5", logo: "/Screenshot 2026-01-14 001328.png", size: "wide", kind: "screenshot" },
  { name: "Delta Screenshot 1-14-2026 6", logo: "/Screenshot 2026-01-14 001403.png", size: "wide", kind: "screenshot" },
]

const sizeClasses: Record<SlideSize, string> = {
  default: "h-16 w-40",
  large: "h-28 w-56",
  wide: "h-24 w-64",
}

export function SportsbookTicker() {
  // Duplicate the array for seamless loop
  const duplicatedBooks = [...slides, ...slides]

  return (
    <div className="w-full">
      <div className="text-center mb-4">
        <p className="text-sm text-white uppercase tracking-wider font-semibold">Compatible with All Sportsbooks/Markets</p>
      </div>
      <div className="relative overflow-hidden bg-transparent py-8">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black z-10 pointer-events-none" />
        <motion.div
          className="flex gap-12 items-center"
          animate={{
            x: [0, -50 * slides.length],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 15,
              ease: "linear",
            },
          }}
        >
          {duplicatedBooks.map((book, index) => (
            <div key={index} className="flex-shrink-0 flex items-center gap-2 text-white font-semibold text-lg whitespace-nowrap">
              {book.logo ? (
                <div
                  className={`relative flex items-center justify-center ${sizeClasses[book.size]} ${
                    book.kind === "screenshot" ? "rounded-xl border border-white/10 bg-black/40 p-2" : ""
                  }`}
                >
                  <Image
                    src={book.logo}
                    alt={`${book.name} logo`}
                    fill
                    className={book.kind === "screenshot" ? "object-cover rounded-lg" : "object-contain"}
                    sizes={
                      book.size === "large"
                        ? "224px"
                        : book.size === "wide"
                          ? "256px"
                          : "160px"
                    }
                  />
                </div>
              ) : (
                book.name
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
