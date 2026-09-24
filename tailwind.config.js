/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: {
          50:  '#FFFDEB',
          100: '#FFFACC',
          200: '#FFF399',
          300: '#FFE666',
          400: '#FFD733',
          500: '#FFC800',
          600: '#E6B400',
          700: '#CC9F00',
          800: '#997800',
          900: '#665000',
        }
      }
    }
  },
  plugins: []
}
