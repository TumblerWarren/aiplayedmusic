package app.localmusic.player;

/** Taste presets, not measured headphone/speaker calibration. Arrays are copied at the boundary. */
public final class TonePresets {
    private TonePresets(){}
    private static final String[] NAMES={"Flat","Warm","Bass","Vocal","Acoustic","Bright","Rock","Jazz","Classical","Speech"};
    private static final double[][] BANDS={
        {0,0,0,0,0,0,0,0,0,0}, {2,2,1,0,0,0,-1,-1,-2,-2}, {5,4,3,1,0,0,0,0,0,0},
        {-2,-2,-1,0,1,3,3,1,0,-1}, {0,1,1,0,-1,0,1,2,1,0}, {-1,-1,0,0,0,1,2,3,3,2},
        {2,3,2,0,-1,-1,1,2,2,1}, {1,1,0,-1,0,1,1,1,0,0},
        {1,1,0,0,0,0,0,1,1,1}, {-6,-4,-2,-1,0,1,3,2,0,-1}
    };
    private static final String[] DETAILS={
        "Leaves all ten EQ bands at 0 dB.", "Adds low-end weight and softens the highs.",
        "Emphasizes sub-bass and bass.", "Brings the vocal range forward.",
        "Gently lifts presence and upper mids.", "Adds presence and high-frequency sparkle.",
        "Adds bass and presence with a gentle midrange dip.", "A light bass and presence lift.",
        "Subtle low and high lift with little midrange change.", "Cuts low rumble and adds speech presence."
    };
    public static String[] names(){return NAMES.clone();}
    private static int index(String name){for(int i=0;i<NAMES.length;i++)if(NAMES[i].equals(name))return i;throw new IllegalArgumentException("Unknown equalizer preset");}
    public static double[] bands(String name){return BANDS[index(name)].clone();}
    public static String detail(String name){return DETAILS[index(name)];}
}
