import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/auth/',
        '/api/',
        '/onboarding/',
      ],
    },
    host: 'https://deltasports.app',
    sitemap: 'https://deltasports.app/sitemap.xml',
  }
}
