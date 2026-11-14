/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // ✅ CRITICAL: Must include src folder
  ],
  theme: {
    extend: {
      colors: {
        navy: '#202B28',
        teal: '#245B4A',
        slateBg: '#F6F5F0',
        cardBg: '#FFFFFF',
        textMuted: '#5E6B65',
        brass: '#B77936',
        line: '#D8DED8',
      }
    },
  },
  plugins: [],
}