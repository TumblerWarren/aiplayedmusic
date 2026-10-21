package app.localmusic.player;

import android.app.Activity;
import android.app.UiModeManager;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.WindowInsetsController;
import androidx.appcompat.app.AppCompatDelegate;

/** One preference shared by the native launch window, platform dialogs and React. */
public final class ThemePreferences {
    public static String get(Context context) {
        String value = context.getSharedPreferences("music", Context.MODE_PRIVATE).getString("theme", "System");
        return "Light".equals(value) || "Dark".equals(value) ? value : "System";
    }
    public static void select(Context context, String value) {
        if (!"System".equals(value) && !"Light".equals(value) && !"Dark".equals(value))
            throw new IllegalArgumentException("Choose System, Light or Dark");
        context.getSharedPreferences("music", Context.MODE_PRIVATE).edit().putString("theme", value).apply();
        applyPreference(context, value);
    }
    public static void restoreBeforeCreate(Activity activity) {
        applyPreference(activity.getApplicationContext(), get(activity.getApplicationContext()));
    }
    private static void applyPreference(Context context, String value) {
        if (Build.VERSION.SDK_INT >= 31) {
            // AUTO clears the per-app night override (UI_MODE_NIGHT_UNDEFINED), following the OS.
            int mode = "Dark".equals(value) ? UiModeManager.MODE_NIGHT_YES
                : "Light".equals(value) ? UiModeManager.MODE_NIGHT_NO : UiModeManager.MODE_NIGHT_AUTO;
            context.getSystemService(UiModeManager.class).setApplicationNightMode(mode);
        }
        int mode = "Dark".equals(value) ? AppCompatDelegate.MODE_NIGHT_YES
            : "Light".equals(value) ? AppCompatDelegate.MODE_NIGHT_NO : AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM;
        AppCompatDelegate.setDefaultNightMode(mode);
    }
    public static void applyWindow(Activity activity) {
        String preference = get(activity.getApplicationContext());
        boolean dark = "Dark".equals(preference) || ("System".equals(preference)
            && (activity.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
        applyWindow(activity, dark);
    }
    @SuppressWarnings("deprecation")
    public static void applyWindow(Activity activity, boolean dark) {
        int background = Color.parseColor(dark ? "#17191E" : "#FFFBF6");
        activity.getWindow().getDecorView().setBackgroundColor(background);
        // Android 15+ draws edge-to-edge; the React/safe-area background provides the underlay.
        if (Build.VERSION.SDK_INT < 35) {
            activity.getWindow().setStatusBarColor(background);
            activity.getWindow().setNavigationBarColor(background);
        }
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = activity.getWindow().getInsetsController();
            int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            if (controller != null) controller.setSystemBarsAppearance(dark ? 0 : mask, mask);
        } else {
            View decor = activity.getWindow().getDecorView();
            int mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            decor.setSystemUiVisibility((decor.getSystemUiVisibility() & ~mask) | (dark ? 0 : mask));
        }
    }
}
