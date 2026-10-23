# Aiplayed branding

`aiplayed-icon.png` is the generated multicolour vinyl/music-note artwork, prepared at 512px for the Expo app icon. The Android module includes matching mask-safe vector foreground, standard launcher, and Android 13 monochrome assets, all using a beamed music note in place of the previous play symbol. The central artwork fits inside the 66dp adaptive safe zone. `scripts/render-branding.cjs` regenerates the native vectors from one shared note silhouette.

The native and React startup screens use the separate `startup-turntable` artwork, with light and dark variants.

Android launchers use static icons. Initialization uses `src/Startup.js` and respects Reduce Motion. The earlier unused browser-only animation preview has been removed.
