import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy SeaweedFS image requests to avoid CORS issues
      '/media': {
        target: 'http://localhost:8333',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/media/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@assets': resolve(__dirname, 'src/assets'),
      '@components': resolve(__dirname, 'src/components'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@routers': resolve(__dirname, 'src/routers'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
      '@_mocks': resolve(__dirname, 'src/_mocks'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@layouts': resolve(__dirname, 'src/layouts'),
      '@styles': resolve(__dirname, 'src/styles'),
      '@interfaces': resolve(__dirname, 'src/interfaces'),
      '@services': resolve(__dirname, 'src/services'),
      '@features': resolve(__dirname, 'src/features'),
      '@': resolve(__dirname, 'src'),
    },
  },
});

