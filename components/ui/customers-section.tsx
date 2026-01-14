"use client"

import React from "react"
import { ChevronRight } from "lucide-react"
import { AnimatedGroup } from "@/components/ui/animated-group"
import { cn } from "@/lib/utils"

const transitionVariants = {
  item: {
    hidden: {
      opacity: 0,
      filter: "blur(12px)",
      y: 12,
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        type: "spring" as const,
        bounce: 0.3,
        duration: 1.5,
      },
    },
  },
}

export interface CustomerLogo {
  src: string
  alt: string
  height?: number
}

interface CustomersSectionProps {
  customers: CustomerLogo[]
  className?: string
  containerClassName?: string
  gridClassName?: string
  imageClassName?: string
}

export function CustomersSection({
  customers = [],
  className,
  containerClassName,
  gridClassName,
  imageClassName,
}: CustomersSectionProps) {
  return (
    <section className={`bg-background pb-16 pt-16 md:pb-32 ${className ?? ""}`}>
      <div className={cn("group relative m-auto max-w-5xl px-6", containerClassName)}>
        <div className="absolute inset-0 z-10 flex scale-95 items-center justify-center opacity-0 duration-500 group-hover:scale-100 group-hover:opacity-100">
          <span className="block text-sm text-muted-foreground">
            Meet Our Customers
            <ChevronRight className="ml-1 inline-block size-3" />
          </span>
        </div>
        <AnimatedGroup
          variants={{
            container: {
              visible: {
                transition: {
                  staggerChildren: 0.05,
                  delayChildren: 0.75,
                },
              },
            },
            ...transitionVariants,
          }}
          className={cn(
            "group-hover:blur-xs mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-x-8 gap-y-8 transition-all duration-500 group-hover:opacity-50 sm:grid-cols-3 sm:gap-x-12 sm:gap-y-10",
            gridClassName,
          )}
        >
          {customers.map((logo, index) => (
            <div key={index} className="flex">
              <img
                className={cn("mx-auto w-auto max-w-full object-contain dark:invert", imageClassName)}
                src={logo.src}
                alt={logo.alt}
                style={logo.height ? { height: logo.height } : undefined}
                width="auto"
              />
            </div>
          ))}
        </AnimatedGroup>
      </div>
    </section>
  )
}
