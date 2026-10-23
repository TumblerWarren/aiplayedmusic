import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import Native from './native';
import { useMusicSlice } from './useMusic';
import { palette } from './design';
import { themeIsDark, themePreference } from './theme';
const h = React.createElement;
const ThemeContext = createContext(palette(false));

export function useTheme() { return useContext(ThemeContext); }
export default function ThemeProvider({ children }) {
  const { theme } = useMusicSlice('main'), system = useColorScheme();
  const preference = themePreference(theme), dark = themeIsDark(preference, system);
  const colors = useMemo(() => palette(dark), [dark]);
  useEffect(() => {
    // Native appearance follows the same preference; neither call touches playback.
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
    Native?.setWindowAppearance?.(dark).catch(() => {});
  }, [colors, dark]);
  return h(ThemeContext.Provider, { value: colors }, children);
}
