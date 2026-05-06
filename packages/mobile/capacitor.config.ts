import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.tilelayout.app',
  appName: '排砖宝',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1890ff',
      showSpinner: false,
    },
    Camera: {
      permissions: ['camera', 'photos'],
    },
  },
};

export default config;
