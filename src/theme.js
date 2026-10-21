export const themePreference = value => ['System', 'Light', 'Dark'].includes(value) ? value : 'System';
export const themeIsDark = (preference, system) => preference === 'Dark' || (themePreference(preference) === 'System' && system === 'dark');
export function initialTheme(native) {
  try { return themePreference(native?.getThemePreference?.()); }
  catch { return 'System'; }
}
