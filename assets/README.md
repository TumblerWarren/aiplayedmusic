# Aiplayed branding

The approved launcher is concept 3: three purple/coral play ribbons on warm ivory. `aiplayed-icon.svg` and the Android standard, adaptive and monochrome vectors share the paths in `scripts/render-launcher.cjs`. The inset artwork fits the 66dp adaptive safe zone. `aiplayed-icon.png` is a 1024px rendering of that SVG for Expo.

Run `node scripts/render-launcher.cjs` to regenerate the SVG and native vectors, then render the SVG at 1024×1024 to update the PNG. `scripts/render-branding.cjs` also calls this generator after regenerating the separate startup artwork.

The native and React startup screens use the separate `startup-turntable` artwork, with light and dark variants.

Android launchers use static icons. Initialization uses `src/Startup.js` and respects Reduce Motion. The earlier unused browser-only animation preview has been removed.
