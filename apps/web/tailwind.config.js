/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#071317',
        surface: '#0D1E24',
        'surface-elevated': '#122931',
        'surface-border': '#1A3A44',
        brand: {
          DEFAULT: '#02A0A0',
          50: '#E6F9F9',
          100: '#C2F2F2',
          200: '#8FE7E7',
          300: '#52D4D4',
          400: '#22BDBD',
          500: '#02A0A0',
          600: '#028383',
          700: '#036868',
          800: '#055353',
          900: '#074646',
        },
        gold: {
          DEFAULT: '#FFBD65',
          50: '#FFF9EF',
          100: '#FFF0D6',
          200: '#FFDFAD',
          300: '#FFCC7E',
          400: '#FFBD65',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
      },
    },
  },
  plugins: [],
};
