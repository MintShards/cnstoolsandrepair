/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#1152d4",
        "accent-orange": "#FF2400",
        "background-light": "#f6f6f8",
        "background-dark": "#0f172a",
        "slate-gray": "#334155",
      },
      fontFamily: {
        "display": ["Montserrat", "sans-serif"],
        "logo": ["Russo One", "Montserrat", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
