import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 5171,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': { target: 'http://localhost:5170', changeOrigin: true },
    },
  },
  plugins: [react()],
  define: { global: 'globalThis' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'ethers': path.resolve(__dirname, 'lib/stellar.ts'),
    },
    dedupe: ['react', 'react-dom', '@stellar/stellar-sdk', '@stellar/stellar-base'],
  },
  optimizeDeps: {
    include: ['@stellar/stellar-sdk', '@stellar/stellar-base'],
  },
  build: { target: 'esnext' },
});
