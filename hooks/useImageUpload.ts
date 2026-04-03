'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export function useImageUpload() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const prevUrl = useRef<string | null>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > MAX_SIZE) return
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current)
    const url = URL.createObjectURL(file)
    prevUrl.current = url
    setImageUrl(url)
  }, [])

  const clearImage = useCallback(() => {
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current)
    prevUrl.current = null
    setImageUrl(null)
  }, [])

  useEffect(() => {
    return () => {
      if (prevUrl.current) URL.revokeObjectURL(prevUrl.current)
    }
  }, [])

  return { imageUrl, handleFile, clearImage, setImageUrl }
}
