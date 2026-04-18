import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('react-router')) return 'react-vendor';
          if (id.includes('@xyflow') || id.includes('dagre')) return 'graph-vendor';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('@tanstack')) return 'query';
        },
      },
    },
    target: 'es2020',
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/hooks/**', 'src/lib/**'],
    },
  },
});
