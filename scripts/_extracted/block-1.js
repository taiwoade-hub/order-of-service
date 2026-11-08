
tailwind.config = {
  theme: {
    extend: {
      colors: {
        paper: '#F8F9FA',
        ink: '#0F172A',
        muted: '#64748B',
        line: '#E2E8F0',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Lora', 'Georgia', 'serif'],
        lora: ['Lora', 'Georgia', 'serif'],
      },
    }
  }
}
