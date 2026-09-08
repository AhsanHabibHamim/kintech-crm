/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
          800: '#3730a3', 900: '#312e81',
        },
        ink: {
          700: '#101735', 800: '#0a0f26', 900: '#060a1a',
        },
        neon: '#22d3ee',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Space Grotesk"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(99,102,241,.12), 0 10px 40px -12px rgba(99,102,241,.45)',
        'glow-lg': '0 0 0 1px rgba(99,102,241,.16), 0 24px 70px -20px rgba(79,70,229,.55)',
        card: '0 1px 2px rgba(16,24,40,.04), 0 8px 24px -12px rgba(16,24,40,.12)',
      },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 55%,#22d3ee 130%)',
        'mesh': 'radial-gradient(60rem 40rem at 80% -10%, rgba(99,102,241,.16), transparent 60%), radial-gradient(50rem 35rem at 5% 110%, rgba(34,211,238,.14), transparent 60%)',
      },
      keyframes: {
        aurora: {
          '0%,100%': { opacity: '.55', transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { opacity: '.85', transform: 'translate3d(2%,-3%,0) scale(1.06)' },
        },
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      animation: {
        aurora: 'aurora 14s ease-in-out infinite',
        floaty: 'floaty 5s ease-in-out infinite',
        shimmer: 'shimmer 6s linear infinite',
      },
    },
  },
  plugins: [],
};