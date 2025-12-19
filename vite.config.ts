import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
const devBackendPort = Number(process.env.VITE_DEV_BACKEND_PORT ?? process.env.PORT ?? 3000);
const devBackendTarget = `http://localhost:${devBackendPort}`;

export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      'автосиликон.рф',
      'www.автосиликон.рф',
      'xn--80aesakeqdezj.xn--p1ai',
      'www.xn--80aesakeqdezj.xn--p1ai',
    ],
    proxy: {
      '/api': {
        target: devBackendTarget,
        changeOrigin: true,
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@/styles/tokens.scss";\n',
      },
    },
  },
});
