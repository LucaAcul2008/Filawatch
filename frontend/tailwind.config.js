/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Mono"', 'monospace'],
        body: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: '#0a0e1a',
        blueprint: '#0d1b2a',
        line: '#1e3a5f',
        accent: '#ffb800',
        accent2: '#00d9ff',
        success: '#00ff88',
        danger: '#ff3860',
      },
    },
  },
  plugins: [],
};
