// Compile the production preference/window helper against recording Android test doubles.
// This exercises SDK branches locally; it does not replace device/Lint/native build checks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fixtures = {
  'android/content/Context.java': `package android.content;
public class Context {
 public static final int MODE_PRIVATE=0;
 public final SharedPreferences prefs=new SharedPreferences();
 public final android.app.UiModeManager manager=new android.app.UiModeManager();
 public final android.content.res.Resources resources=new android.content.res.Resources();
 public SharedPreferences getSharedPreferences(String name,int mode){if(!name.equals("music"))throw new AssertionError(name);return prefs;}
 public <T>T getSystemService(Class<T> type){return type.cast(manager);}
 public android.content.res.Resources getResources(){return resources;}
 public Context getApplicationContext(){return this;}
}`,
  'android/content/SharedPreferences.java': `package android.content;
public class SharedPreferences {
 public String value=null;
 public String getString(String key,String fallback){return value==null?fallback:value;}
 public Editor edit(){return new Editor();}
 public class Editor {public Editor putString(String key,String next){value=next;return this;} public void apply(){}}
}`,
  'android/content/res/Configuration.java': 'package android.content.res; public class Configuration {public static final int UI_MODE_NIGHT_MASK=48,UI_MODE_NIGHT_YES=32,UI_MODE_NIGHT_NO=16;public int uiMode=16;}',
  'android/content/res/Resources.java': 'package android.content.res; public class Resources {public final Configuration config=new Configuration();public Configuration getConfiguration(){return config;}}',
  'android/app/Activity.java': 'package android.app; public class Activity extends android.content.Context {public final android.view.Window window=new android.view.Window();public android.view.Window getWindow(){return window;}}',
  'android/app/UiModeManager.java': 'package android.app; public class UiModeManager {public static final int MODE_NIGHT_AUTO=0,MODE_NIGHT_NO=1,MODE_NIGHT_YES=2;public int selected=-100,calls=0;public void setApplicationNightMode(int mode){selected=mode;calls++;}}',
  'android/os/Build.java': 'package android.os; public class Build {public static class VERSION {public static int SDK_INT=26;}}',
  'android/graphics/Color.java': 'package android.graphics; public class Color {public static int parseColor(String value){return (int)(0xff000000L|Long.parseLong(value.substring(1),16));}}',
  'android/view/View.java': 'package android.view; public class View {public static final int SYSTEM_UI_FLAG_LIGHT_STATUS_BAR=8192,SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR=16;public int background,flags=256;public void setBackgroundColor(int color){background=color;}public int getSystemUiVisibility(){return flags;}public void setSystemUiVisibility(int value){flags=value;}}',
  'android/view/WindowInsetsController.java': 'package android.view; public class WindowInsetsController {public static final int APPEARANCE_LIGHT_STATUS_BARS=8,APPEARANCE_LIGHT_NAVIGATION_BARS=16;public int appearance=128;public void setSystemBarsAppearance(int flags,int mask){appearance=(appearance&~mask)|(flags&mask);}}',
  'android/view/Window.java': 'package android.view; public class Window {public final View decor=new View();public final WindowInsetsController controller=new WindowInsetsController();public int status,navigation,statusCalls=0;public View getDecorView(){return decor;}public WindowInsetsController getInsetsController(){return controller;}public void setStatusBarColor(int value){status=value;statusCalls++;}public void setNavigationBarColor(int value){navigation=value;}}',
  'androidx/appcompat/app/AppCompatDelegate.java': 'package androidx.appcompat.app; public class AppCompatDelegate {public static final int MODE_NIGHT_NO=1,MODE_NIGHT_YES=2,MODE_NIGHT_FOLLOW_SYSTEM=-1;public static int selected;public static void setDefaultNightMode(int mode){selected=mode;}}',
  'app/localmusic/player/ThemePreferencesTest.java': `package app.localmusic.player;
import android.app.Activity;import android.os.Build;import android.graphics.Color;
public class ThemePreferencesTest {
 static void expect(boolean yes,String message){if(!yes)throw new AssertionError(message);}
 public static void main(String[] args){
  for(int sdk:new int[]{26,31,35})for(boolean phoneDark:new boolean[]{false,true}){
   Build.VERSION.SDK_INT=sdk;Activity activity=new Activity();activity.resources.config.uiMode=phoneDark?32:16;
   expect(ThemePreferences.get(activity).equals("System"),"new installs follow phone");
   for(String preference:new String[]{"Dark","Light","System"}){
    ThemePreferences.select(activity,preference);
    expect(ThemePreferences.get(activity).equals(preference),"selection persists");
    int expected=preference.equals("Dark")?2:preference.equals("Light")?1:-1;
    expect(androidx.appcompat.app.AppCompatDelegate.selected==expected,"AppCompat mode");
    expect(sdk>=31?activity.manager.selected==(expected==-1?0:expected):activity.manager.calls==0,"per-app native mode/API gate");
    ThemePreferences.restoreBeforeCreate(activity);
    expect(ThemePreferences.get(activity).equals(preference),"cold launch retains preference");
    ThemePreferences.applyWindow(activity);
    boolean dark=preference.equals("Dark")||(preference.equals("System")&&phoneDark);
    int background=Color.parseColor(dark?"#17191E":"#FFFBF6");
    expect(activity.window.decor.background==background,"window matches chosen palette");
    if(sdk<35)expect(activity.window.status==background&&activity.window.navigation==background,"system bar underlay");
    else expect(activity.window.statusCalls==0,"API35 uses edge-to-edge underlay");
    if(sdk<30){int flags=activity.window.decor.flags;expect((flags&256)!=0,"preserve unrelated UI flags");expect((flags&(8192|16))==(dark?0:(8192|16)),"API26 icons");}
    else {int flags=activity.window.controller.appearance;expect((flags&128)!=0,"preserve unrelated appearance");expect((flags&24)==(dark?0:24),"modern system bar icons");}
   }
   activity.prefs.value="obsolete";expect(ThemePreferences.get(activity).equals("System"),"invalid saved value follows phone");
   try{ThemePreferences.select(activity,"obsolete");throw new AssertionError("invalid selection accepted");}catch(IllegalArgumentException expected){}
   expect(activity.prefs.value.equals("obsolete"),"invalid selection does not overwrite storage");
  }
  System.out.println("API26/31/35 preference and window helper checks passed");
 }
}`,
};
test('production Android appearance helper preserves preferences and handles API26/31/35 system bars', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiplayed-theme-'));
  try {
    const sources = Object.entries(fixtures).map(([name, source]) => {
      const file = path.join(dir, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, source); return file;
    });
    sources.push('modules/local-music/android/src/main/java/app/localmusic/player/ThemePreferences.java');
    const compile = spawnSync('java', ['com.sun.tools.javac.Main', '-d', dir, ...sources], { encoding: 'utf8' });
    assert.equal(compile.status, 0, compile.stderr);
    const run = spawnSync('java', ['-cp', dir, 'app.localmusic.player.ThemePreferencesTest'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
