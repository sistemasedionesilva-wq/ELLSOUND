import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ellmusic.app',
  appName: 'ELL MUSIC',
  webDir: '.output/public',
  server: {
    androidScheme: 'https',
  },
  ios: {
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: false,
    allowsPictureInPictureMediaPlayback: true,
    preferredContentMode: 'mobile',
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    overrideUserAgent: 'ELL MUSIC App',
    backgroundColor: '#14121a',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#14121a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#14121a',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    App: {
      launchUrl: '/',
    },
  },
};

export default config;