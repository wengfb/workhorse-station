/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#101114",
        panel: "#17191f",
        muted: "#8c93a3"
      }
    }
  },
  plugins: []
};
