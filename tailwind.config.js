/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:            '#0F172A',
        surface:       '#1E293B',
        primary:       '#0EA5E9',
        danger:        '#EF4444',
        warning:       '#F59E0B',
        success:       '#10B981',
        textPrimary:   '#F1F5F9',
        textSecondary: '#94A3B8',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

