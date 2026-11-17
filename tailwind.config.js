/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B0D13',
          card: '#131622',
          soft: '#1B1F30',
          border: '#23293D',
        },
        gold: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          soft: 'rgba(245, 158, 11, 0.12)',
          line: 'rgba(245, 158, 11, 0.28)',
        },
        accent: {
          blue: '#38BDF8',
          cyan: '#2DD4BF',
          glow: 'rgba(56, 189, 248, 0.12)',
        },
        danger: {
          DEFAULT: '#F43F5E',
          soft: 'rgba(244, 63, 94, 0.12)',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
