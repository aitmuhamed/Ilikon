import type { Config } from 'tailwindcss'

/**
 * Иликон design system.
 * Pharmacy green primary, soft blue accent, near-white surfaces.
 * All colour tokens are exposed as CSS variables in globals.css so the
 * palette can be re-themed from admin settings later without a rebuild.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf3',
          100: '#d6f5e3',
          200: '#b0eacb',
          300: '#7dd8ab',
          400: '#48bf87',
          500: '#22a06b',
          600: '#158055',
          700: '#116646',
          800: '#105139',
          900: '#0e4330',
          950: '#04261b',
        },
        accent: {
          50: '#eff8ff',
          100: '#dbeefe',
          200: '#bfe2fe',
          300: '#93cffd',
          400: '#60b3fa',
          500: '#3b95f6',
          600: '#2577eb',
          700: '#1d61d8',
          800: '#1e50af',
          900: '#1e468a',
        },
        ink: {
          50: '#f7f8f9',
          100: '#eef0f2',
          200: '#dde1e6',
          300: '#c2c9d1',
          400: '#8f9aa6',
          500: '#697585',
          600: '#4d586a',
          700: '#3b4453',
          800: '#252b36',
          900: '#151920',
        },
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
        info: '#2577eb',
        surface: '#ffffff',
        canvas: '#f6f8f9',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '1rem',
        xl2: '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(21 25 32 / 0.04), 0 4px 16px -4px rgb(21 25 32 / 0.08)',
        'card-hover': '0 2px 6px 0 rgb(21 25 32 / 0.06), 0 12px 28px -8px rgb(21 25 32 / 0.14)',
        pop: '0 12px 40px -12px rgb(21 25 32 / 0.28)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'bounce-dot': {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.5' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 220ms cubic-bezier(0.16,1,0.3,1)',
        'slide-in-right': 'slide-in-right 260ms cubic-bezier(0.16,1,0.3,1)',
        shimmer: 'shimmer 1.6s infinite',
        'bounce-dot': 'bounce-dot 1.2s infinite ease-in-out',
      },
    },
  },
  plugins: [],
}

export default config
