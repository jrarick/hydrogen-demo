import formsPlugin from '@tailwindcss/forms';
import typographyPlugin from '@tailwindcss/typography';
import aspectRatioPlugin from '@tailwindcss/aspect-ratio';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  plugins: [formsPlugin, typographyPlugin, aspectRatioPlugin],
  theme: {
    fontFamily: {
      display: ["ivypresto-display", "serif"],
      serif: ["lemonde-journal", "serif"],
    }
  }
};
