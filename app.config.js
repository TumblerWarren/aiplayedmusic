module.exports = {
  expo: {
    name: 'Music',
    slug: 'aiplayedmusic',
    version: '1.1.0',
    platforms: ['android'],
    orientation: 'default',
    userInterfaceStyle: 'automatic',
    android: {
      package: 'app.localmusic.player',
      versionCode: 2,
      permissions: ['android.permission.READ_MEDIA_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.POST_NOTIFICATIONS', 'android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK', 'android.permission.WAKE_LOCK', 'android.permission.MODIFY_AUDIO_SETTINGS'],
      blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', ...(process.env.MUSIC_OFFLINE_BUILD === '1' ? ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'] : [])]
    },
    plugins: [['expo-build-properties', { android: { minSdkVersion: 26 } }], './plugins/withMusic'],
    updates: { enabled: false }
  }
};
