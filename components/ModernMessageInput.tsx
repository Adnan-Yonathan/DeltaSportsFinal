'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Send, Loader2, Paperclip, X } from 'lucide-react'
import { uploadAttachment, registerAttachment } from '@/lib/storage/attachments'

interface MessageInputProps {
  conversationId: string
  userId: string
}

export default function ModernMessageInput({ conversationId, userId }: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const syncTextareaHeight = () => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
  }

  const sendMessage = useCallback(async (override?: string) => {
    const payload = (override ?? message).trim()
    if ((!payload && !attachmentFile) || sending) return

    setSending(true)
    setMessage('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    try {
      if (attachmentFile) {
        if (!userId) {
          throw new Error('Authentication required for attachments')
        }
        setAttachmentUploading(true)
        const storagePath = await uploadAttachment(attachmentFile, userId)
        await registerAttachment({
          conversationId,
          storagePath,
          file: attachmentFile,
          type: attachmentFile.type.startsWith('image/') ? 'image' : 'document',
        })
        setAttachmentFile(null)
        setAttachmentPreview(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }

      if (!payload && !attachmentFile) {
        return
      }

      const outgoingMessage = payload || '[Attachment Uploaded]'

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: outgoingMessage,
          conversationId,
          userId,
          timezone: userTimezone,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
      setAttachmentUploading(false)
    }
  }, [attachmentFile, conversationId, message, sending, userId])

  const latestSendMessage = useRef(sendMessage)
  useEffect(() => {
    latestSendMessage.current = sendMessage
  }, [sendMessage])

  useEffect(() => {
    if (typeof window === 'undefined') return

    type PromptDetail =
      | string
      | {
          text: string
          autoSend?: boolean
          conversationId?: string
        }

    const handler = (event: Event) => {
      const custom = event as CustomEvent<PromptDetail>
      const detail = custom.detail

      const incomingText =
        typeof detail === 'string'
          ? detail
          : typeof detail === 'object'
            ? detail.text
            : undefined
      const autoSend =
        typeof detail === 'object' && detail?.autoSend ? true : false
      const targetConversationId =
        typeof detail === 'object' && detail?.conversationId
          ? detail.conversationId
          : undefined

      if (!incomingText) return
      if (targetConversationId && targetConversationId !== conversationId) {
        return
      }

      setMessage(incomingText)
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
          textareaRef.current.focus()
        }
        if (autoSend) {
          requestAnimationFrame(() => {
            void latestSendMessage.current(incomingText)
          })
        }
      })
    }

    window.addEventListener('delta-quick-prompt', handler as EventListener)
    return () => {
      window.removeEventListener('delta-quick-prompt', handler as EventListener)
    }
  }, [conversationId])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    syncTextareaHeight()
  }

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setAttachmentPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
    setAttachmentFile(file)
  }

  const removeAttachment = () => {
    setAttachmentFile(null)
    setAttachmentPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="border-t border-white/5 bg-black/60 backdrop-blur-xl p-2 sm:p-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          animate={{
            boxShadow: isFocused
              ? '0 0 0 2px rgba(99, 102, 241, 0.3)'
              : '0 0 0 0px rgba(99, 102, 241, 0)',
          }}
          className="relative flex items-end gap-2 sm:gap-3 rounded-2xl bg-white/5 border border-white/10 p-2 sm:p-3 transition-all"
        >
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask about odds, arbitrage, or log a bet..."
              className="w-full bg-transparent text-white text-sm placeholder:text-white/40 focus:outline-none resize-none"
              rows={1}
              disabled={sending}
              style={{ minHeight: '24px', maxHeight: '200px' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleAttachmentChange}
              className="hidden"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || attachmentUploading}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all border border-white/10"
            >
              <Paperclip className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => void sendMessage()}
              disabled={(!message.trim() && !attachmentFile) || sending || attachmentUploading}
              className={`p-2.5 sm:p-2 rounded-lg transition-all ${
                (message.trim() || attachmentFile) && !sending && !attachmentUploading
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
            >
              {sending ? (
                <Loader2 className="w-5 h-5 sm:w-4 sm:h-4 animate-spin" />
              ) : (
                <Send className="w-5 h-5 sm:w-4 sm:h-4" />
              )}
            </motion.button>
          </div>
        </motion.div>

        {attachmentPreview && (
          <div className="flex items-center gap-3 mt-3 bg-white/5 border border-white/10 rounded-xl p-2">
            <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-white/10">
              <Image
                src={attachmentPreview}
                alt="Attachment preview"
                fill
                unoptimized
                className="object-cover"
              />
            </div>
            <div className="flex-1 text-sm text-white/80">
              <p className="font-medium truncate">{attachmentFile?.name || 'Attachment'}</p>
              <p className="text-xs text-white/50">
                {attachmentFile ? `${Math.round(attachmentFile.size / 1024)} KB` : ''}
                {attachmentUploading ? ' • Uploading…' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={removeAttachment}
              className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="hidden sm:block text-xs text-white/40 mt-2 text-center">
          Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60">Enter</kbd> to send 🎯{' '}
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60">Shift + Enter</kbd> for new line
        </div>
      </div>
    </div>
  )
}
