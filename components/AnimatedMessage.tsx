'use client'

import { useAnimatedText } from '@/components/ui/animated-text'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AnimatedMessageProps {
  content: string
  isAnimating?: boolean
}

export default function AnimatedMessage({ content, isAnimating = true }: AnimatedMessageProps) {
  // Use word-by-word animation for smoother reading experience
  const animatedContent = useAnimatedText(isAnimating ? content : content, " ")

  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-white/10">
              <table className="w-full" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-white/5" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="text-left px-4 py-3 text-indigo-300 font-semibold text-xs uppercase tracking-wider" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-4 py-3 border-t border-white/5 text-sm" {...props} />
          ),
          code: ({ node, inline, ...props }: any) =>
            inline ? (
              <code
                className="bg-white/10 px-1.5 py-0.5 rounded text-indigo-300 text-xs font-mono"
                {...props}
              />
            ) : (
              <code
                className="block bg-white/5 p-4 rounded-lg my-2 text-xs font-mono border border-white/10"
                {...props}
              />
            ),
          p: ({ node, ...props }) => (
            <p className="mb-2 last:mb-0 leading-relaxed" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="space-y-1 my-2" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="space-y-1 my-2" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="ml-4" {...props} />
          ),
          h1: ({ node, ...props }) => (
            <h1 className="text-xl font-bold mt-4 mb-2 text-white" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-lg font-bold mt-3 mb-2 text-white" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-base font-semibold mt-2 mb-1 text-white" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a
              className="text-indigo-300 underline hover:text-indigo-200"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
        }}
      >
        {animatedContent}
      </ReactMarkdown>
    </div>
  )
}
