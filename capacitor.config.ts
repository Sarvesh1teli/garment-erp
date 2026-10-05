import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.teli.threadflow',
  appName: 'Teli ThreadFlow Garment',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
