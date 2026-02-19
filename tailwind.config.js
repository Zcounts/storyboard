/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#1a1a1a',
          1: '#212121',
          2: '#2a2a2a',
          3: '#333333',
          4: '#3d3d3d',
        },
        accent: {
          DEFAULT: '#4f8ef7',
          hover: '#6ba3f9',
        },
        border: {
          DEFAULT: '#3a3a3a',
          subtle: '#2e2e2e',
        },
        text: {
          primary: '#f0f0f0',
          secondary: '#a0a0a0',
          muted: '#666666',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
