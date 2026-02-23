import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '400px',
      }
    }
  },
  plugins: []
};
export default config;