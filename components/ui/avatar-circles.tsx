"use client"

import React from "react"

import { cn } from "@/lib/utils"

interface AvatarCirclesProps {
  className?: string
  numPeople?: number
  avatarUrls: string[]
}

const AvatarCircles = ({
  numPeople,
  className,
  avatarUrls,
}: AvatarCirclesProps) => {
  return (
    <div className={cn("z-10 flex -space-x-4 rtl:space-x-reverse", className)}>
      {avatarUrls.map((url, index) => (
        <img
          key={url}
          className="h-10 w-10 rounded-full border-2 border-white object-cover dark:border-gray-800"
          src={url}
          width={40}
          height={40}
          alt={`Community member ${index + 1}`}
          loading="lazy"
        />
      ))}
      {typeof numPeople === "number" && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-black text-center text-xs font-medium uppercase tracking-wide text-white dark:border-gray-800 dark:bg-white dark:text-black">
          +{numPeople}
        </div>
      )}
    </div>
  )
}

export { AvatarCircles }
