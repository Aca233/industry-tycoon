/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom game colors
        'neon-cyan': '#00f5ff',
        'neon-blue': '#007bff',
        'dark-bg': '#0a0a1a',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'ticker': 'ticker 30s linear infinite',
      },
    },
  },
  plugins: [],
}