/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#faf8f3',
        'cream-dark': '#f0ede4',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
