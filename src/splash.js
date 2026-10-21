import { AccessibilityInfo } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
// Hold only until the first branded React layout; initialization adds no timer.
SplashScreen.preventAutoHideAsync().catch(() => {});
let hidden = false;
export async function hideNativeSplash() {
  if (hidden) return;
  hidden = true;
  let reduced = true;
  try { reduced = await AccessibilityInfo.isReduceMotionEnabled(); } catch {}
  SplashScreen.setOptions({ fade: !reduced, duration: reduced ? 0 : 180 });
  await SplashScreen.hideAsync().catch(() => {});
}
