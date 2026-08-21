/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        navy: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        trust: {
          high: '#059669',
          good: '#10b981',
          medium: '#f59e0b',
          low: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'emerald': '0 4px 20px -2px rgba(5, 150, 105, 0.25)',
        'card': '0 2px 12px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
      },
      keyframes: {
        'red-green-blink': {
          '0%, 100%': { color: '#ef4444', backgroundColor: '#fee2e2' }, // text-rose-500, bg-rose-100
          '50%': { color: '#10b981', backgroundColor: '#d1fae5' }, // text-emerald-500, bg-emerald-100
        }
      },
      animation: {
        'red-green-blink': 'red-green-blink 2s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
