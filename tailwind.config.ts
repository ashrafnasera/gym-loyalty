import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf3",
          100: "#d6fae2",
          200: "#b0f4c9",
          300: "#78e8a7",
          400: "#3fd47f",
          500: "#18b862",
          600: "#0e934d",
          700: "#0d7440",
          800: "#0e5c36",
          900: "#0d4c2f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
