import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.niyam.productivityapp',
  appName: 'Niyam',
  webDir: 'build',
  plugins: {
    StatusBar: {
      // Overlay the status bar so our safe-area CSS controls the layout
      overlaysWebView: true,
      style: 'DEFAULT',
      backgroundColor: '#00000000',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 0, // We handle our own splash screen in React
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#B78E79',
      sound: 'default',
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  server: {
    // For local dev: comment this out and use npx cap run android
    // androidScheme: 'https',
  },
};

export default config;
