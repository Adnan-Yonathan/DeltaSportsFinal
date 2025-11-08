import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Bloomberg Terminal Theme
        'bg-primary': '#0A0E27',
        'bg-secondary': '#131729',
        'accent-orange': '#FF6B35',
        'accent-cyan': '#00D9FF',
        'text-primary': '#E8E8E8',
        'text-secondary': '#8B92A8',
        'success-green': '#00FF88',
        'warning-red': '#FF4757',
      },
    },
  },
  plugins: [],
}
export default config
