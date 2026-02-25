'use client'

import { cn } from '@/lib/utils'
import { animate, motion, useMotionValue } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import useMeasure from 'react-use-measure'

type InfiniteSliderProps = {
  children: React.ReactNode
  gap?: number
  speed?: number
  speedOnHover?: number
  duration?: number
  durationOnHover?: number
  direction?: 'horizontal' | 'vertical'
  reverse?: boolean
  className?: string
}

export function InfiniteSlider({
  children,
  gap = 16,
  speed = 25,
  speedOnHover,
  duration,
  durationOnHover,
  direction = 'horizontal',
  reverse = false,
  className,
}: InfiniteSliderProps) {
  const baseDuration = useMemo(() => duration ?? speed, [duration, speed])
  const hoverDuration = useMemo(
    () => durationOnHover ?? speedOnHover,
    [durationOnHover, speedOnHover]
  )

  const [currentDuration, setCurrentDuration] = useState(baseDuration)
  const [ref, { width, height }] = useMeasure()
  const translation = useMotionValue(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [key, setKey] = useState(0)

  useEffect(() => {
    setCurrentDuration(baseDuration)
  }, [baseDuration])

  useEffect(() => {
    const size = direction === 'horizontal' ? width : height
    if (!size || currentDuration <= 0) return

    const contentSize = size + gap
    const from = reverse ? -contentSize / 2 : 0
    const to = reverse ? 0 : -contentSize / 2

    const controls = isTransitioning
      ? animate(translation, [translation.get(), to], {
          ease: 'linear',
          duration:
            currentDuration *
            Math.abs((translation.get() - to) / Math.max(contentSize, 1)),
          onComplete: () => {
            setIsTransitioning(false)
            setKey((prev) => prev + 1)
          },
        })
      : animate(translation, [from, to], {
          ease: 'linear',
          duration: currentDuration,
          repeat: Infinity,
          repeatType: 'loop',
          repeatDelay: 0,
          onRepeat: () => {
            translation.set(from)
          },
        })

    return () => controls.stop()
  }, [
    key,
    translation,
    currentDuration,
    width,
    height,
    gap,
    isTransitioning,
    direction,
    reverse,
  ])

  const hoverProps = hoverDuration
    ? {
        onHoverStart: () => {
          setIsTransitioning(true)
          setCurrentDuration(hoverDuration)
        },
        onHoverEnd: () => {
          setIsTransitioning(true)
          setCurrentDuration(baseDuration)
        },
      }
    : {}

  return (
    <div className={cn('overflow-hidden', className)}>
      <motion.div
        ref={ref}
        className="flex w-max"
        style={{
          ...(direction === 'horizontal' ? { x: translation } : { y: translation }),
          gap: `${gap}px`,
          flexDirection: direction === 'horizontal' ? 'row' : 'column',
        }}
        {...hoverProps}
      >
        {children}
        {children}
      </motion.div>
    </div>
  )
}
