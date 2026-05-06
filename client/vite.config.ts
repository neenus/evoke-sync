import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'your-server-ip',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://your-server-ip:5000',
        changeOrigin: true,
      },
    },
  },
});
