/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Charcoal text on light surfaces — kept separate from the green scale
        // so text color never gets tinted by a surface-color remap.
        ink: {
          DEFAULT: '#1F2937',
          muted: '#5B6B63',
          faint: '#8A988F',
        },

        // Primary action color: a confident, desaturated sage-teal, distinct
        // in saturation from the muted "slate" surface scale and from the
        // vivid semantic "success" green so the three never get confused.
        brand: {
          50: '#EEF5F1',
          100: '#D7E9DD',
          200: '#B2D3BE',
          300: '#8CBBA0',
          400: '#649D80',
          500: '#3F7D61',
          600: '#2F6B51',
          700: '#245641',
          800: '#1C4433',
          900: '#153428',
        },

        // Surface scale (backgrounds, borders, dividers, hover/input fills) —
        // the uploaded 5-tier green palette. Named "slate" so it's a drop-in
        // replacement everywhere the app already used Tailwind's neutral gray.
        slate: {
          50: '#F2F8F3', // lightest green — page background, forms, empty states
          100: '#E4F0E5', // subtle hover fill
          200: '#CFE3D2', // fourth green — borders, dividers, chips, badges
          300: '#AFCEB4', // third green — input backgrounds, dropdowns, accordions
          400: '#8CB893',
          500: '#6E9E76',
          600: '#517C5C', // second green (darker) — secondary panels on dark shell
          700: '#3E6249',
          800: '#2E4A38',
          900: '#4F7566', // darkest green — shell/sidebar/topnav (kept as "900" for bg-slate-900 call sites)
        },

        // Dedicated app-shell tones (sidebar/topnav) — deliberately separate
        // from the "slate" surface scale used for cards/panels, since the
        // shell is always dark regardless of light/dark content areas.
        shell: {
          DEFAULT: '#33544A',
          hover: '#3E6357',
          active: '#4C7A6B',
          border: '#2A463D',
        },

        // "Second green" — cards, tables, modals, panels. A hair more
        // saturated than the page canvas (slate-50) so surfaces read as
        // gently raised, without needing a drop shadow to do all the work.
        panel: {
          DEFAULT: '#E1EFE2',
          hover: '#D5E9D7',
        },
      },
      borderRadius: {
        DEFAULT: '10px',
        md: '10px',
        lg: '14px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(31 41 55 / 0.04)',
        DEFAULT: '0 1px 3px 0 rgb(31 41 55 / 0.06), 0 1px 2px -1px rgb(31 41 55 / 0.06)',
        md: '0 4px 8px -2px rgb(31 41 55 / 0.08), 0 2px 4px -2px rgb(31 41 55 / 0.06)',
        lg: '0 12px 24px -6px rgb(31 41 55 / 0.10), 0 4px 8px -4px rgb(31 41 55 / 0.06)',
        soft: '0 2px 12px 0 rgb(51 84 74 / 0.08)',
      },
      spacing: {
        18: '4.5rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
