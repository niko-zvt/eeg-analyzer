/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#1e1e1e",
          raised: "#2b2b2b",
          overlay: "#333333",
        },
        accent: {
          DEFAULT: "#4fc3f7",
          muted: "#3a6fa5",
        },
        border: "#444444",
        muted: "#b0b0b0",
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
