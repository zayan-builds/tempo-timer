import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zayan.tempo',
  appName: 'Tempo',
  webDir: 'out',
  android: {
    backgroundColor: '#000000'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#000000'
    },
    CapacitorUpdater: {
      autoUpdate: false
    }
  }
};

export default config;
