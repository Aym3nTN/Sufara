import type { ExpoConfig } from 'expo/config';

/**
 * Expo configuration.
 *
 * This is a dynamic config (rather than app.json) for one reason: the Android
 * Google Maps key must come from the environment. Committing a Maps key to a
 * repository is how they end up abused, and `react-native-maps` needs it baked
 * into the native manifest at prebuild time — so it cannot be an
 * `EXPO_PUBLIC_*` runtime value.
 *
 * Set it locally in your shell, or as an EAS secret:
 *   eas secret:create --name GOOGLE_MAPS_ANDROID_API_KEY --value <key>
 *
 * Without it the app still builds and runs; only the Android map renders blank.
 * iOS uses Apple Maps and needs no key.
 */
const googleMapsAndroidApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

/**
 * EAS project id, printed by `eas init`. Not a secret — you may paste it here
 * instead of setting the variable. The CLI resolves this locally when starting a
 * build, so the CI workflow passes it as EAS_PROJECT_ID.
 */
const easProjectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: 'Sufara',
  slug: 'sufara',
  scheme: 'sufara',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',

  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.sufara.mobile',
    infoPlist: {
      // Sufara only needs location while planning a visit.
      NSLocationWhenInUseUsageDescription:
        'Sufara uses your location to plan visits to nearby Islamic heritage sites.',
    },
  },

  android: {
    package: 'app.sufara.mobile',
    adaptiveIcon: {
      backgroundColor: '#0F3D2E',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    ...(googleMapsAndroidApiKey
      ? { config: { googleMaps: { apiKey: googleMapsAndroidApiKey } } }
      : {}),
  },

  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
    // Single-page output; mobile/public/_redirects gives deep links their
    // fallback on Cloudflare Pages.
    output: 'single',
  },

  plugins: [
    'expo-router',
    'expo-system-ui',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Sufara uses your location to plan visits to nearby Islamic heritage sites.',
      },
    ],
  ],

  ...(easProjectId ? { extra: { eas: { projectId: easProjectId } } } : {}),
};

export default config;
