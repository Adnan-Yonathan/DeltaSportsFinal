"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";

interface TextScrambleProps {
  text: string;
  className?: string;
  textClassName?: string;
  autoStart?: boolean;
  autoStartDelayMs?: number;
  disableHover?: boolean;
  showUnderline?: boolean;
  showGlow?: boolean;
}

export function TextScramble({
  text,
  className = "",
  textClassName = "",
  autoStart = false,
  autoStartDelayMs = 0,
  disableHover = false,
  showUnderline = true,
  showGlow = true,
}: TextScrambleProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isHovering, setIsHovering] = useState(false);
  const [isScrambling, setIsScrambling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scramble = useCallback(() => {
    setIsScrambling(true);
    frameRef.current = 0;
    const duration = Math.max(10, text.length * 3);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      frameRef.current += 1;
      const progress = frameRef.current / duration;
      const revealedLength = Math.floor(progress * text.length);

      const newText = text
        .split("")
        .map((char, i) => {
          if (char === " ") return " ";
          if (i < revealedLength) return text[i];
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        })
        .join("");

      setDisplayText(newText);

      if (frameRef.current >= duration) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayText(text);
        setIsScrambling(false);
      }
    }, 30);
  }, [text]);

  const handleMouseEnter = () => {
    if (disableHover) return;
    setIsHovering(true);
    scramble();
  };

  const handleMouseLeave = () => {
    if (disableHover) return;
    setIsHovering(false);
  };

  useEffect(() => {
    setDisplayText(text);
  }, [text]);

  useEffect(() => {
    if (!autoStart) return;
    timeoutRef.current = setTimeout(() => {
      scramble();
    }, autoStartDelayMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [autoStart, autoStartDelayMs, scramble]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className={cn("group relative inline-flex flex-col select-none", disableHover ? "" : "cursor-pointer", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className={cn("relative font-mono tracking-widest uppercase", textClassName)}>
        {displayText.split("").map((char, i) => (
          <span
            key={`${char}-${i}`}
            className={cn(
              "inline-block transition-all duration-150",
              isScrambling && char !== text[i] ? "text-primary scale-110" : "text-inherit"
            )}
            style={{
              transitionDelay: `${i * 10}ms`,
            }}
          >
            {char}
          </span>
        ))}
      </span>

      {showUnderline ? (
        <span className="relative mt-2 h-px w-full overflow-hidden">
          <span
            className={cn(
              "absolute inset-0 origin-left bg-foreground transition-transform duration-500 ease-out",
              isHovering || isScrambling ? "scale-x-100" : "scale-x-0"
            )}
          />
          <span className="absolute inset-0 bg-border" />
        </span>
      ) : null}

      {showGlow ? (
        <span
          className={cn(
            "absolute -inset-4 -z-10 rounded-lg bg-primary/5 transition-opacity duration-300",
            isHovering || isScrambling ? "opacity-100" : "opacity-0"
          )}
        />
      ) : null}
    </div>
  );
}

