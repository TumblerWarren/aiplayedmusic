module.exports = {
  expo: {
    name: 'Aiplayed',
    slug: 'aiplayedmusic',
    icon: './assets/aiplayed-icon.png',
    version: '1.2.6',
    platforms: ['android'],
    orientation: 'default',
    userInterfaceStyle: 'automatic',
    android: {
      package: 'app.localmusic.player',
      versionCode: 9,
      permissions: ['android.permission.READ_MEDIA_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.POST_NOTIFICATIONS', 'android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK', 'android.permission.WAKE_LOCK', 'android.permission.MODIFY_AUDIO_SETTINGS'],
      blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', ...(process.env.MUSIC_OFFLINE_BUILD === '1' ? ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'] : [])]
    },
    plugins: ['./plugins/withSplashCompatibility', ['expo-splash-screen', { image: './assets/startup-turntable.png', imageWidth: 180, backgroundColor: '#FFFBF6', dark: { image: './assets/startup-turntable-dark.png', backgroundColor: '#17191E' } }], ['expo-build-properties', { android: { minSdkVersion: 26 } }], './plugins/withMusic', './plugins/withThemeBootstrap'],
    updates: { enabled: false }
  }
};

