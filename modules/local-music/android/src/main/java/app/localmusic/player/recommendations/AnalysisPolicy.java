package app.localmusic.player.recommendations;

/** Charging and playback deliberately do not gate analysis. */
public final class AnalysisPolicy {
    public static final boolean DEFAULT_ENABLED=true;
    private AnalysisPolicy() {}
    public static boolean allowed(boolean manual,boolean foreground,boolean batteryLow,boolean hot){
        return !hot && (manual ? foreground : !batteryLow);
    }
}
