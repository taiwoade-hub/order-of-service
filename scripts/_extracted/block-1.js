
tailwind.config = {
  theme: {
    extend: {
      colors: {
        paper: '#F7F7F5',
        ink: '#171717',
        muted: '#737373',
        line: '#E5E5E5',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Lora', 'Georgia', 'serif'],
        lora: ['Lora', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(23,23,23,0.04), 0 4px 12px rgba(23,23,23,0.04)',
      },
    }
  }
}
