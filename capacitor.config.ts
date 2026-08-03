import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zayan.tempo',
  appName: 'Tempo',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'api.github.com',
      'objects.githubusercontent.com',
      'github.com',
    ],
  },
  android: {
    backgroundColor: '#000000',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#000000'
    },
    CapacitorUpdater: {
      autoUpdate: false,
      resetWhenUpdate: true,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      version: '0.1.21'
    }
  }
};

export default config;
