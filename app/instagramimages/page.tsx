import type { Metadata } from 'next'
import InstagramBuilderClient from './instagram-builder-client'

export const metadata: Metadata = {
  title: 'Instagram Image Builder | Delta Sports',
  robots: 'noindex',
}

export default function InstagramImagesPage() {
  return <InstagramBuilderClient />
}
