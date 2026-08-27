/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--brand-50, #f0fdfa)',
          100: 'var(--brand-100, #ccfbf1)',
          500: 'var(--brand-500, #0f766e)',
          600: 'var(--brand-600, #0d9488)',
          700: 'var(--brand-700, #115e59)',
        },
        // Dynamic Theme Surface & Text Tokens
        'surface-app': 'var(--color-surface-app)',
        'surface-panel': 'var(--color-surface-panel)',
        'surface-card': 'var(--color-surface-card)',
        'surface-hover': 'var(--color-surface-hover)',
        'border-subtle': 'var(--color-border-subtle)',
        'border-focus': 'var(--color-border-focus)',
        'accent': 'var(--color-accent)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        // Semantic Accents
        'semantic-success': '#10b981',
        'semantic-danger': '#ef4444',
        'semantic-warning': '#f59e0b',
        'semantic-info': '#3b82f6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        outfit: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'desktop': '0 2px 4px 0 rgba(0, 0, 0, 0.15)',
        'desktop-lg': '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
        'elevation': '0 4px 12px 0 rgba(0, 0, 0, 0.15)',
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [],
}
