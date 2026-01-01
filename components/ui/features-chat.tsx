"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Database,
  Brain,
  SendIcon,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Feature {
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: <MessageSquare className="w-4 h-4" />,
    label: "Conversational Intelligence",
    title: "Conversational Intelligence",
    description:
      "Ask Delta Sports AI anything: odds, props, matchups, trends, stats - and get instant and accurate results.",
  },
  {
    icon: <Database className="w-4 h-4" />,
    label: "Unified Data",
    title: "Unified Data",
    description:
      "Delta Sports AI brings together live odds, statistics, media, and synchronizes it under one AI to give you what matters most.",
  },
  {
    icon: <Brain className="w-4 h-4" />,
    label: "Custom Models",
    title: "Custom Models",
    description:
      "Delta Sports AI helps you create custom models that can understand complex statistics and user preference to bring you the bets you want - within minutes.",
  },
];

function TypingDots() {
  return (
    <div className="flex items-center ml-1">
      {[1, 2, 3].map((dot) => (
        <motion.div
          key={dot}
          className="w-1.5 h-1.5 bg-white/90 rounded-full mx-0.5"
          initial={{ opacity: 0.3 }}
          animate={{
            opacity: [0.3, 0.9, 0.3],
            scale: [0.85, 1.1, 0.85],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: dot * 0.15,
            ease: "easeInOut",
          }}
          style={{
            boxShadow: "0 0 4px rgba(255, 255, 255, 0.3)",
          }}
        />
      ))}
    </div>
  );
}

interface ChatMessage {
  type: "user" | "assistant";
  content: string;
  isTyping?: boolean;
}

export function FeaturesChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      type: "assistant",
      content: "Hey! I'm Delta Sports AI. Click on any feature below to learn more about how I can help you bet smarter.",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [activeFeature, setActiveFeature] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);


  const typeText = useCallback((text: string, onComplete: () => void) => {
    let index = 0;
    setDisplayedText("");

    const typeNextChar = () => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
        setTimeout(typeNextChar, 18);
      } else {
        onComplete();
      }
    };

    typeNextChar();
  }, []);

  const handleFeatureClick = (index: number) => {
    if (isTyping) return;

    const feature = features[index];
    setActiveFeature(index);
    setIsExpanded(true);

    // Add user message
    setMessages((prev) => [
      ...prev,
      { type: "user", content: `Tell me about ${feature.label}` },
    ]);

    // Show typing indicator
    setIsTyping(true);

    // After a delay, start typing the response
    setTimeout(() => {
      const response = `**${feature.title}**\n\n${feature.description}`;

      typeText(response, () => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          { type: "assistant", content: response },
        ]);
        setDisplayedText("");
        setActiveFeature(null);
      });
    }, 800);
  };

  const renderMessageContent = (content: string) => {
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <span key={i} className="font-semibold text-white">
            {part.slice(2, -2)}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-4 text-center mb-12">
          <h2 className="max-w-2xl text-3xl font-semibold md:text-4xl text-white">
            Powerful Features
          </h2>
          <p className="text-white/70">
            Everything you need to gain an edge in sports betting
          </p>
        </div>

        <motion.div
          className="mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          animate={{
            width: isExpanded ? "90vw" : "100%",
            maxWidth: isExpanded ? "1200px" : "672px",
          }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.div
          className="relative backdrop-blur-2xl bg-[#4E4E4E] rounded-2xl border border-white/15 shadow-2xl overflow-hidden"
            animate={{
              boxShadow: isExpanded
                ? "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)"
                : "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-white/15 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shadow-lg shadow-black/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Delta Sports AI</p>
                <p className="text-xs text-white/70">Always online</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-xs text-white/70">Active</span>
              </div>
            </div>

            {/* Chat Messages */}
            <motion.div
              className="overflow-y-auto p-6 space-y-4"
              initial={{ height: 180 }}
              animate={{ height: isExpanded ? 500 : 180 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
              <AnimatePresence mode="popLayout">
                {messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "flex gap-3",
                      message.type === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.type === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 shadow-md shadow-black/20">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        message.type === "user"
                          ? "bg-white text-[#4E4E4E] rounded-br-md shadow-lg shadow-black/20"
                          : "bg-[#4E4E4E] text-white rounded-bl-md border border-white/15"
                      )}
                    >
                      {renderMessageContent(message.content)}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator / Live typing */}
              <AnimatePresence>
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex gap-3"
                  >
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 shadow-md shadow-black/20">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                    <div className="bg-[#4E4E4E] rounded-2xl rounded-bl-md px-4 py-3 text-sm text-white leading-relaxed max-w-[80%] border border-white/15">
                      {displayedText ? (
                        <>
                          {renderMessageContent(displayedText)}
                          <span className="inline-block w-0.5 h-4 bg-white/60 ml-0.5 animate-pulse" />
                        </>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-white/70">Thinking</span>
                          <TypingDots />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </motion.div>

            {/* Feature Buttons */}
            <div className="p-4 border-t border-white/15 bg-[#4E4E4E]">
              <p className="text-xs text-white/70 mb-3 text-center">
                Click a feature to learn more
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {features.map((feature, index) => (
                  <motion.button
                    key={feature.label}
                    onClick={() => handleFeatureClick(index)}
                    disabled={isTyping}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all",
                      activeFeature === index
                        ? "bg-[#34d399] text-[#0f1f15] border border-[#34d399]"
                        : "bg-[#34d399]/15 text-white hover:bg-[#34d399]/25 border border-[#34d399]/40",
                      isTyping && activeFeature !== index && "opacity-50 cursor-not-allowed"
                    )}
                    whileHover={!isTyping ? { scale: 1.02 } : {}}
                    whileTap={!isTyping ? { scale: 0.98 } : {}}
                  >
                    {feature.icon}
                    <span className="font-medium">{feature.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
