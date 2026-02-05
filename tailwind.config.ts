import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
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