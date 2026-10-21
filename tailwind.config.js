/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0f6f2',
          100: '#dbe9df',
          200: '#b8d4c1',
          300: '#8cba9c',
          400: '#5e9d76',
          500: '#3d8157',
          600: '#2e6744',
          700: '#265338',
          800: '#214e34', // Brand Main Color
          900: '#1c412c',
          950: '#0e2418',
        },
        brand: {
          primary: '#214E34',
          dark: '#173826',
        },
        surface: {
          bg: '#F5F7F4',
          card: '#FFFFFF',
          soft: '#F0F3EF',
        },
        accent: {
          blue: '#3B82F6',
          green: '#10B981',
          yellow: '#FBBF24',
          orange: '#FB923C',
          coral: '#F87171',
        },
        ink: {
          primary: '#1F2A24',
          secondary: '#6B7280',
        },
        glass: {
          surface: 'rgba(255, 255, 255, 0.90)',
          card: 'rgba(255, 255, 255, 0.82)',
          highlight: 'rgba(255, 255, 255, 0.98)',
          dark: 'rgba(33, 78, 52, 0.08)',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        'clay-sm': '14px',
        'clay-md': '20px',
        'clay-lg': '28px',
        'clay-xl': '34px',
        'card': '24px',
        'modal': '28px',
        'button': '16px',
      },
      boxShadow: {
        'soft': '0 8px 24px rgba(16, 24, 40, 0.08)',
        'raised': '0 12px 32px rgba(16, 24, 40, 0.12)',
        'float': '0 20px 45px -10px rgba(33, 78, 52, 0.2)',
        'clay-card': '0 12px 28px -4px rgba(160, 175, 200, 0.16), 0 4px 10px -2px rgba(160, 175, 200, 0.08), inset 0 2px 2px 0 rgba(255, 255, 255, 0.95), inset 0 -2px 4px 0 rgba(190, 200, 215, 0.12)',
        'clay-card-hover': '0 18px 36px -6px rgba(160, 175, 200, 0.22), 0 6px 14px -2px rgba(160, 175, 200, 0.1), inset 0 2px 2px 0 rgba(255, 255, 255, 1), inset 0 -2px 4px 0 rgba(190, 200, 215, 0.14)',
        'clay-btn': '0 8px 18px -3px rgba(160, 175, 200, 0.24), 0 3px 6px -1px rgba(160, 175, 200, 0.12), inset 0 2px 2px rgba(255, 255, 255, 0.9), inset 0 -2px 3px rgba(190, 200, 215, 0.2)',
        'clay-btn-active': '0 3px 8px -1px rgba(160, 175, 200, 0.18), inset 0 2px 4px rgba(160, 175, 200, 0.22)',
        'clay-inset': 'inset 0 3px 6px rgba(160, 175, 200, 0.18), inset 0 -2px 4px rgba(255, 255, 255, 0.9)',
        'disc-blue': '0 8px 18px -2px rgba(59, 130, 246, 0.45), inset 0 2px 3px rgba(255, 255, 255, 0.7), inset 0 -3px 4px rgba(29, 78, 216, 0.45)',
        'disc-green': '0 8px 18px -2px rgba(16, 185, 129, 0.45), inset 0 2px 3px rgba(255, 255, 255, 0.7), inset 0 -3px 4px rgba(5, 150, 105, 0.45)',
        'disc-coral': '0 8px 18px -2px rgba(248, 113, 113, 0.45), inset 0 2px 3px rgba(255, 255, 255, 0.7), inset 0 -3px 4px rgba(220, 38, 38, 0.45)',
        'disc-amber': '0 8px 18px -2px rgba(251, 191, 36, 0.45), inset 0 2px 3px rgba(255, 255, 255, 0.7), inset 0 -3px 4px rgba(217, 119, 6, 0.45)',
        'disc-forest': '0 8px 18px -2px rgba(33, 78, 52, 0.45), inset 0 2px 3px rgba(255, 255, 255, 0.5), inset 0 -3px 4px rgba(14, 36, 24, 0.55)',
      },
      transitionDuration: {
        'fast': '160ms',
        'smooth': '240ms',
      }
    },
  },
  plugins: [],
}
