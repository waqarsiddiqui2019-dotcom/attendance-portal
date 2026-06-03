export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F5A623',
          dark: '#D4891A',
          light: '#FEF3D9',
        },
        brand: {
          blue:        '#2272B9',
          'blue-dark': '#1A5C99',
          'blue-light':'#E8F2FC',
          navy:        '#1B3A6B',
          'navy-dark': '#163058',
        },
      }
    }
  },
  plugins: [],
}
