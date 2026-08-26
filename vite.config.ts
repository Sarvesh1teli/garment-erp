import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const httpsDir = path.join(__dirname, '.https');
const keyPath = path.join(httpsDir, 'key.pem');
const certPath = path.join(httpsDir, 'cert.pem');
const useHttps = process.env.VITE_HTTPS === 'true' && fs.existsSync(keyPath) && fs.existsSync(certPath);

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    ...(useHttps && {
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      },
    }),
  },
});
