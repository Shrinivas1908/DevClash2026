import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0D0F14',
          surface: '#13161E',
          elevated: '#1C2030',
          hover: '#252A3A',
        },
        border: {
          DEFAULT: '#2A2F42',
          subtle: '#1E2235',
        },
        text: {
          primary: '#E8EAEF',
          secondary: '#8B91A8',
          muted: '#555C78',
        },
        accent: {
          blue: '#4D8EF7',
          'blue-dim': '#1E3A6E',
          green: '#3DD68C',
          amber: '#F5A623',
          red: '#E05C5C',
          purple: '#9B7FED',
        },
        graph: {
          'node-default': '#1C2030',
          'node-central': '#1E3A6E',
          'node-entry': '#1A3A2A',
          edge: '#2A2F42',
          'edge-highlight': '#4D8EF7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'slide-out-right': 'slideOutRight 0.3s ease-out forwards',
        'dash': 'dash 1s linear infinite',
        spin: 'spin 0.8s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(77, 142, 247, 0)' },
          '50%': { boxShadow: '0 0 0 4px rgba(77, 142, 247, 0.3)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        slideOutRight: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
        dash: {
          to: { strokeDashoffset: '-20' },
        },
      },
      boxShadow: {
        glow: '0 0 20px rgba(77, 142, 247, 0.15)',
        'glow-green': '0 0 20px rgba(61, 214, 140, 0.15)',
        panel: '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      borderRadius: {
        lg: '0.625rem',
      },
    },
  },
  plugins: [],
};

export default config;
