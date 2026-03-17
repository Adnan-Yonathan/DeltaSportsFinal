import { toPng } from 'html-to-image'

type ShareResult =
  | { ok: true; message?: string }
  | { ok: false; message: string }

export type ShareProfile = 'mobile-portrait' | 'legacy-og'

type ShareImageOptions = {
  profile?: ShareProfile
  pixelRatio?: number
}

const supportsClipboardImage = !!(typeof navigator !== 'undefined' && (navigator as any).clipboard?.write)

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

// 1x1 transparent PNG as fallback for broken images
const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xMkMEa+wAAAANSURBVBhXY2BgYGAAAAAFAAGKM+MAAAAAAElFTkSuQmCC'

/**
 * Preload all <img> elements inside a container.
 * Returns when all images have loaded or errored (max 3s timeout).
 */
async function preloadImages(container: HTMLElement): Promise<void> {
  const imgs = container.querySelectorAll('img')
  if (imgs.length === 0) return

  const promises = Array.from(imgs).map(
    (img) =>
      new Promise<void>((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
          resolve()
          return
        }
        const timeout = setTimeout(() => resolve(), 3000)
        img.onload = () => { clearTimeout(timeout); resolve() }
        img.onerror = () => {
          clearTimeout(timeout)
          // Replace broken src with transparent pixel so canvas doesn't fail
          img.src = TRANSPARENT_PIXEL
          resolve()
        }
        // Force re-fetch with cache bust
        if (img.src && !img.src.startsWith('data:')) {
          const sep = img.src.includes('?') ? '&' : '?'
          img.src = `${img.src}${sep}_cb=${Date.now()}`
        }
      })
  )

  await Promise.all(promises)
}

export const useShareImage = () => {
  const shareImage = async (
    element: HTMLElement,
    filename = 'delta-card.png',
    options: ShareImageOptions = {}
  ): Promise<ShareResult> => {
    const profile = options.profile ?? 'legacy-og'
    const pixelRatio =
      typeof options.pixelRatio === 'number' && Number.isFinite(options.pixelRatio)
        ? options.pixelRatio
        : profile === 'mobile-portrait'
          ? 2.5
          : 2

    const buildImage = async () => {
      // Preload all images first to avoid canvas taint / blank captures
      await preloadImages(element)

      // Use multiple attempts for reliability
      let lastError: Error | null = null

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // Wait a bit between attempts
          if (attempt > 0) {
            await wait(200)
          }

          const dataUrl = await toPng(element, {
            pixelRatio,
            cacheBust: true,
            skipAutoScale: true,
            backgroundColor: '#0a0a0a',
            imagePlaceholder: TRANSPARENT_PIXEL,
            style: {
              transform: 'none',
              opacity: '1',
            },
            filter: (node) => {
              // Skip any script tags or hidden elements
              if (node instanceof HTMLElement) {
                const tagName = node.tagName?.toLowerCase()
                if (tagName === 'script' || tagName === 'noscript') {
                  return false
                }
              }
              return true
            },
          })

          if (!dataUrl || dataUrl === 'data:,') {
            throw new Error('Empty image generated')
          }

          const response = await fetch(dataUrl)
          const blob = await response.blob()

          if (blob.size < 1000) {
            throw new Error('Image too small, likely failed to render')
          }

          return blob
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Unknown error')
          console.warn(`[shareImage] Attempt ${attempt + 1} failed:`, lastError.message)
        }
      }

      throw lastError || new Error('Failed to capture image after 3 attempts')
    }

    const tryShare = async (blob: Blob, filename: string) => {
      // Try clipboard image write (best UX when allowed)
      if (supportsClipboardImage) {
        try {
          const data = new ClipboardItem({ 'image/png': blob })
          await (navigator as any).clipboard.write([data])
          return { ok: true, message: 'Copied to clipboard' }
        } catch (err) {
          console.warn('[shareImage] Clipboard write failed, falling back to download', err)
        }
      }

      // Fallback: download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      await wait(50)
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      return { ok: true, message: 'Downloaded' }
    }

    try {
      const blob = await buildImage()
      return await tryShare(blob, filename)
    } catch (err) {
      console.error('[shareImage] Failed to share image', err)
      return { ok: false, message: err instanceof Error ? err.message : 'Share failed' }
    }
  }

  return { shareImage }
}
