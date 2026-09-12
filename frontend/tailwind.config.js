/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Manrope', 'sans-serif'],
      },
      colors: {
        carbon: '#1D1E18',
        olive: {
          DEFAULT: '#6B8F71',
          hover: '#597A5F',
          active: '#4E6B52',
          light: '#EEF4F0',
        },
        celadon: {
          DEFAULT: '#AAD2BA',
          light: '#EAF4EE',
          border: '#C6E3D2',
          dark: '#89B69B',
        },
        'soft-bg': '#F6F8F5',
        surface: '#FFFFFF',
        'border-ui': '#DDE5DE',
        'muted-ui': '#68736B',
        'success-ui': '#2F7D4A',
        'warning-ui': '#B7791F',
        'error-ui': '#C94A4A',
        brand: {
          50: '#EEF4F0',
          100: '#EAF4EE',
          500: '#6B8F71',
          600: '#597A5F',
          700: '#4E6B52',
          900: '#1D1E18',
        }
      },
      borderRadius: {
        btn: '10px',
        card: '16px',
        modal: '20px',
        pill: '9999px',
      }
    },
  },
  plugins: [],
}
