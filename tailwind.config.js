/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#121212',
          card: '#1E1E1E',
          soft: '#262626',
          border: '#303030',
        },
        gold: {
          DEFAULT: '#D9822B',
          light: '#F2A65A',
          soft: 'rgba(217, 130, 43, 0.14)',
          line: 'rgba(217, 130, 43, 0.35)',
        },
        danger: {
          DEFAULT: '#E5484D',
          soft: 'rgba(229, 72, 77, 0.12)',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
