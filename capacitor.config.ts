import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ndvmoney.app',
  appName: 'NDV Money',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
