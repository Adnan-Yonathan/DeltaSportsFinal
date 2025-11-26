import { toPng } from 'html-to-image'

type ShareResult =
  | { ok: true; message?: string }
  | { ok: false; message: string }

const supportsClipboardImage = !!(typeof navigator !== 'undefined' && (navigator as any).clipboard?.write)

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

export const useShareImage = () => {
  const shareImage = async (element: HTMLElement, filename = 'delta-card.png'): Promise<ShareResult> => {
    const inlineImages = async () => {
      const imgs = Array.from(element.querySelectorAll('img'))
      const originals: Array<{ node: HTMLImageElement; src: string }> = []
      for (const img of imgs) {
        if (!img.src || img.src.startsWith('data:')) continue
        originals.push({ node: img, src: img.src })
        img.setAttribute('crossorigin', 'anonymous')
        img.setAttribute('referrerpolicy', 'no-referrer')
        try {
          const res = await fetch(img.src, { cache: 'no-store' })
          if (!res.ok) continue
          const blob = await res.blob()
          const reader = new FileReader()
          const dataUrl: string = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(String(reader.result || ''))
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          if (dataUrl) {
            img.src = dataUrl
          }
        } catch (err) {
          console.warn('[shareImage] Unable to inline image', img.src, err)
        }
      }
      return () => {
        for (const entry of originals) {
          entry.node.src = entry.src
        }
      }
    }

    const buildImage = async () => {
      const restore = await inlineImages()
      try {
        const dataUrl = await toPng(element, {
          pixelRatio: 2,
          cacheBust: true,
          imagePlaceholder: '#0e131f',
          style: {
            transform: 'none',
          },
          onClone: (doc) => {
            doc.querySelectorAll('img').forEach((img) => {
              img.setAttribute('crossorigin', 'anonymous')
              img.setAttribute('referrerpolicy', 'no-referrer')
            })
          },
        })
        if (!dataUrl) throw new Error('Unable to capture card')
        const response = await fetch(dataUrl)
        return await response.blob()
      } finally {
        restore()
      }
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
