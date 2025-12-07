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
        // Graphite + Green Theme
        'bg-primary': '#4E4E4E',
        'bg-secondary': '#3f3f3f',
        'accent-green': '#34d399',
        'accent-emerald': '#16a34a',
        'text-primary': '#f5f5f5',
        'text-secondary': '#b3bac6',
        'success-green': '#22c55e',
        'warning-red': '#f87171',
      },
      maskImage: {
        'radial-gradient': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
export default config
