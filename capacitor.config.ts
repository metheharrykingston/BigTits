import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAPACITOR_DEV === '1';

const config: CapacitorConfig = {
  appId: 'com.harrykingston.bigtits',
  appName: 'BigTits',
  webDir: 'dist',
  server: isDev
    ? {
        // Android emulator: 10.0.2.2 | iOS simulator: 127.0.0.1 — override with CAPACITOR_SERVER_URL
        url: process.env.CAPACITOR_SERVER_URL ?? 'http://10.0.2.2:5173',
        cleartext: true,
        androidScheme: 'http',
        iosScheme: 'capacitor',
      }
    : {
        androidScheme: 'https',
        iosScheme: 'https',
      },
  android: {
    // false = laptop/hardware keyboard works in WebView; true breaks host typing on emulator/device
    captureInput: false,
    webContentsDebuggingEnabled: isDev,
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'BigTits',
    webContentsDebuggingEnabled: isDev,
  },
  plugins: {
    PortalWorkspace: {},
  },
};

export default config;