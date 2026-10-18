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
        glass: {
          surface: 'rgba(255, 255, 255, 0.85)',
          card: 'rgba(255, 255, 255, 0.72)',
          highlight: 'rgba(255, 255, 255, 0.95)',
          dark: 'rgba(33, 78, 52, 0.08)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'card': '18px',
        'modal': '22px',
        'button': '14px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(33, 78, 52, 0.08)',
        'glass-sm': '0 4px 16px 0 rgba(33, 78, 52, 0.05)',
        'glass-hover': '0 12px 40px 0 rgba(33, 78, 52, 0.14)',
        'float': '0 20px 45px -10px rgba(33, 78, 52, 0.2)',
      },
      transitionDuration: {
        'fast': '180ms',
        'smooth': '240ms',
      }
    },
  },
  plugins: [],
}
