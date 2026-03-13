/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Disable worker threads until Next's incremental-cache IPC env is stable on local builds.
    workerThreads: false,
  },
  images: {
    unoptimized: true,
    domains: ['a.espncdn.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Fix: server runtime was trying to load chunks from `.next/server/<id>.js`
      // while Next emits them under `.next/server/chunks/<id>.js`.
      const current = String(config.output?.chunkFilename ?? '')
      if (!current.includes('chunks/')) {
        config.output.chunkFilename = 'chunks/[id].js'
      }
    }
    return config
  },
}

module.exports = nextConfig
// Force rebuild 1762100710
