package app.localmusic.player;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Versioned, validated persistent controls. The audio thread receives immutable snapshots. */
public final class SoundSettings {
    private final JSONObject data;
    public SoundSettings(){this(null);}
    public SoundSettings(JSONObject saved){
        data=new JSONObject();
        try {
            data.put("eqEnabled",false).put("bypass",false).put("limiter",true).put("autoHeadroom",true)
                .put("preamp",0).put("volume",100).put("bass",0).put("treble",0).put("balance",0).put("width",100).put("mono",false).put("dynamics",0)
                .put("bands",new JSONArray(new double[10]));
            if(saved!=null)patch(saved);
        }catch(JSONException ignored){}
    }
    public void patch(JSONObject patch) throws JSONException {
        // Validate the complete patch before changing any state.
        JSONObject next=new JSONObject(data.toString());
        java.util.Iterator<String> keys=patch.keys();while(keys.hasNext()){
            String key=keys.next();
            switch(key){
                case "eqEnabled":case "bypass":case "limiter":case "autoHeadroom":case "mono":next.put(key,patch.getBoolean(key));break;
                case "bands":
                    JSONArray values=patch.getJSONArray(key);if(values.length()!=10)throw new JSONException("Use ten equalizer bands");
                    JSONArray safe=new JSONArray();for(int i=0;i<10;i++)safe.put(number(values.getDouble(i),-12,12));next.put(key,safe);break;
                case "preamp":next.put(key,number(patch.getDouble(key),-24,0));break;
                case "volume":next.put(key,number(patch.getDouble(key),100,300));break;
                case "bass":case "treble":next.put(key,number(patch.getDouble(key),-12,12));break;
                case "balance":next.put(key,number(patch.getDouble(key),-100,100));break;
                case "width":next.put(key,number(patch.getDouble(key),0,150));break;
                case "dynamics":next.put(key,(int)number(patch.getDouble(key),0,2));break;
                default:throw new JSONException("Unknown sound control: "+key);
            }
        }
        keys=next.keys();while(keys.hasNext()){String key=keys.next();data.put(key,next.get(key));}
    }
    private static double number(double value,double min,double max)throws JSONException{
        if(!Double.isFinite(value))throw new JSONException("Sound values must be finite");return Math.max(min,Math.min(max,value));
    }
    public JSONObject json(){try{return new JSONObject(data.toString());}catch(JSONException e){return new JSONObject();}}
    public DspCore.Settings parameters(){
        double[] bands=new double[10];JSONArray values=data.optJSONArray("bands");for(int i=0;i<10;i++)bands[i]=values.optDouble(i,0);
        return new DspCore.Settings(bands,data.optBoolean("eqEnabled"),data.optBoolean("bypass"),data.optBoolean("limiter"),data.optBoolean("autoHeadroom"),
            data.optDouble("preamp"),data.optDouble("volume"),data.optDouble("bass"),data.optDouble("treble"),data.optDouble("balance")/100,data.optDouble("width")/100,data.optBoolean("mono"),data.optInt("dynamics"));
    }
    public static final String[] PRESET_NAMES=TonePresets.names();
    public static JSONObject preset(String name)throws JSONException{
        try{return new JSONObject().put("bands",new JSONArray(TonePresets.bands(name))).put("eqEnabled",true).put("bass",0).put("treble",0);}
        catch(IllegalArgumentException e){throw new JSONException(e.getMessage());}
    }
}
