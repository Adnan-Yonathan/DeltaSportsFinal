'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Paperclip, X } from 'lucide-react'
import { PromptBox } from '@/components/ui/chatgpt-prompt-input'
import { uploadAttachment, registerAttachment } from '@/lib/storage/attachments'

interface ChatIntroProps {
  conversationId: string
  userId: string
  onMessageSent: () => void
}

export default function ChatIntro({ conversationId, userId, onMessageSent }: ChatIntroProps) {
  const [sending, setSending] = useState(false)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const textarea = event.currentTarget.querySelector('textarea')
    const message = textarea?.value?.trim()

    if ((!message || message.length === 0) && !attachmentFile) return
    if (sending) return

    setSending(true)

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

      const outgoingMessage = message && message.length > 0 ? message : '[Attachment Uploaded]'

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: outgoingMessage,
          conversationId,
          userId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // Clear the textarea
      if (textarea) {
        textarea.value = ''
      }

      // Read the response stream first
      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }

      // Wait a bit for the database to update, then trigger the callback
      await new Promise(resolve => setTimeout(resolve, 300))

      // Trigger the callback to indicate message was sent
      onMessageSent()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
      setAttachmentUploading(false)
    }
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
    <div className="flex items-center justify-center min-h-full bg-black px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-2xl w-full -mt-20"
      >
        <h2 className="text-3xl font-bold text-white mb-4">
          How can I help you today?
        </h2>
        <p className="text-white/60 mb-8">
          Ask me about odds, line movements, arbitrage opportunities, or bankroll
          management. I&apos;m here to help!
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-3">
          <PromptBox name="message" disabled={sending || attachmentUploading} />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleAttachmentChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || attachmentUploading}
                className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 text-white/70 hover:text-white hover:border-white/40 transition-colors"
              >
                <Paperclip className="w-4 h-4" />
                <span className="text-sm">Attach image</span>
              </button>
            </div>
            <button
              type="submit"
              disabled={sending || attachmentUploading}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>

          {attachmentPreview && (
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                <Image
                  src={attachmentPreview}
                  alt="Attachment preview"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm text-white/80 font-medium truncate">
                  {attachmentFile?.name || 'Attachment'}
                </p>
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
        </form>
      </motion.div>
    </div>
  )
}
