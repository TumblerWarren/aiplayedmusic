package app.localmusic.player.recommendations;

import android.content.*;
import android.os.*;
import androidx.work.*;
import app.localmusic.player.Library;
import app.localmusic.player.Song;
import org.json.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.BooleanSupplier;

/** Owns local analysis and snapshots, independently of the playback decoder and DSP. */
public final class RecommendationEngine {
    public static final String CHANGED="app.localmusic.player.RECOMMENDATIONS_CHANGED";
    private static final String AUTO_WORK="personal-mix-analysis";
    private static RecommendationEngine instance;
    public static synchronized RecommendationEngine get(Context context){if(instance==null)instance=new RecommendationEngine(context.getApplicationContext());return instance;}
    private final Context context;
    private final Library library;
    private final SharedPreferences prefs;
    public final RecommendationStore store;
    public final ExecutorService events=Executors.newSingleThreadExecutor();
    private final ExecutorService manual=Executors.newSingleThreadExecutor();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ReentrantLock analysis=new ReentrantLock();
    private final AtomicInteger generation=new AtomicInteger();
    private final LinkedHashMap<String,JSONObject> snapshots=new LinkedHashMap<>();
    private volatile boolean foreground,manualRequested,running,activeManual;
    public final AtomicInteger historyGeneration=new AtomicInteger();
    private final Object eventLock=new Object();
    private volatile int[] counts=new int[]{0,0,0};
    private volatile String error="";
    private boolean eventPending, coolingCheckPending;
    private volatile long habitRevision;
    private String lastContext="";
    private final Runnable contextTick=new Runnable(){public void run(){if(!foreground)return;String current=listeningContext().key();if(!current.equals(lastContext)){lastContext=current;emit();}handler.postDelayed(this,60000);}};
    private static ListeningContext listeningContext(){return new ListeningContext(System.currentTimeMillis(),java.time.ZoneId.systemDefault());}
    public void habitsChanged(){habitRevision=store.revision();emit();}
    private RecommendationEngine(Context context){
        this.context=context;library=new Library(context);prefs=context.getSharedPreferences("personal-mixes",0);store=new RecommendationStore(context);
        if(ModelRuntime.MODEL_SHA.equals(prefs.getString("modelFailure","")))error="Audio analysis couldn’t start. Try Analyse now again.";else prefs.edit().remove("modelFailure").apply();
        events.execute(()->{store.recoverSessions();habitRevision=store.revision();counts=store.counts();if(enabled())schedule();emit();});
        if(Build.VERSION.SDK_INT>=29){PowerManager power=(PowerManager)context.getSystemService(Context.POWER_SERVICE);power.addThermalStatusListener(status->{emit();if(status<PowerManager.THERMAL_STATUS_MODERATE)resumeManual();});}
    }
    public boolean enabled(){return prefs.getBoolean("enabled",AnalysisPolicy.DEFAULT_ENABLED);}
    public void setEnabled(boolean value){
        prefs.edit().putBoolean("enabled",value).putBoolean("paused",false).apply();generation.incrementAndGet();error="";
        if(value){events.execute(()->{synchronize();schedule();emit();});}
        else{manualRequested=false;events.execute(store::recoverSessions);cancelScheduled();emit();}
    }
    public void foreground(boolean value){foreground=value;handler.removeCallbacks(contextTick);if(value)handler.post(contextTick);if(!value&&activeManual)generation.incrementAndGet();else if(value){resumeManual();schedule();}emit();}
    public void libraryChanged(){if(!enabled())return;events.execute(()->{synchronize();error="";if(enabled())schedule();emit();});}
    public void analyse(boolean retryFailed){
        if(!foreground)throw new IllegalStateException("Open the app to analyse now");
        if(!enabled())throw new IllegalStateException("Enable personal mixes first");
        prefs.edit().putBoolean("paused",false).remove("modelFailure").apply();error="";manualRequested=true;generation.incrementAndGet();
        cancelScheduled();
        manual.execute(()->{if(retryFailed)store.retryFailed();run(true,()->false);});emit();
    }
    public void pause(){manualRequested=false;prefs.edit().putBoolean("paused",true).apply();generation.incrementAndGet();cancelScheduled();emit();}
    private void resumeManual(){
        if(!manualRequested||!foreground||running||!enabled())return;
        if(hot()){
            // Battery-temperature fallback has no PowerManager thermal callback, especially on API 26.
            synchronized(eventLock){if(coolingCheckPending)return;coolingCheckPending=true;}
            handler.postDelayed(()->{synchronized(eventLock){coolingCheckPending=false;}resumeManual();emit();},10000);
        }else manual.execute(()->run(true,()->false));
    }
    private void cancelScheduled(){
        WorkManager work=WorkManager.getInstance(context);
        work.cancelUniqueWork(AUTO_WORK);
        work.cancelUniqueWork(AUTO_WORK+"-now");
    }
    private void schedule(){
        if(!enabled()||prefs.getBoolean("paused",false)||prefs.contains("modelFailure"))return;
        Constraints constraints=new Constraints.Builder().setRequiresBatteryNotLow(true).build();
        WorkManager work=WorkManager.getInstance(context);
        // UPDATE migrates installed charging-only jobs as well as fresh installs.
        PeriodicWorkRequest sweep=new PeriodicWorkRequest.Builder(AnalysisWorker.class,6,TimeUnit.HOURS).setConstraints(constraints).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,10,TimeUnit.MINUTES).build();
        work.enqueueUniquePeriodicWork(AUTO_WORK,ExistingPeriodicWorkPolicy.UPDATE,sweep);
        OneTimeWorkRequest immediate=new OneTimeWorkRequest.Builder(AnalysisWorker.class).setConstraints(constraints).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,10,TimeUnit.MINUTES).build();
        work.enqueueUniqueWork(AUTO_WORK+"-now",ExistingWorkPolicy.KEEP,immediate);
    }
    public boolean run(boolean isManual,BooleanSupplier stopped){
        int token=generation.get();boolean acquired=false;int priority=android.os.Process.getThreadPriority(android.os.Process.myTid());
        android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_BACKGROUND);
        try{
            analysis.lockInterruptibly();acquired=true;
            if(!isManual&&prefs.contains("modelFailure"))return true;
            if(!allowed(isManual,token,stopped))return false;
            running=true;activeManual=isManual;List<Song> songs=synchronize();emit();
            Set<Long> pending=store.pending();
            Set<String> favorites=library.favorites();List<Long> recent=library.recentIds();
            songs.sort(Comparator.<Song>comparingInt(s->favorites.contains(""+s.id)?0:recent.contains(s.id)?1:2).thenComparing(Comparator.comparingLong((Song s)->s.added).reversed()));
            if(pending.isEmpty()){manualRequested=false;return true;}
            try(ModelRuntime runtime=new ModelRuntime(context)){
                for(Song song:songs){
                    if(!pending.contains(song.id))continue;
                    if(!allowed(isManual,token,stopped))return false;
                    String fingerprint=fingerprint(song);long[] starts=sections(song.duration);
                    try{
                        List<float[]> segments=new ArrayList<>();float[] pooled=new float[960];
                        for(long start:starts){
                            if(!allowed(isManual,token,stopped))throw new CancellationException();
                            AudioDecoder.Decoded decoded=AudioDecoder.section(context,song.uri(),start,()->allowed(isManual,token,stopped));
                            float[] vector;try{vector=runtime.embed(decoded.mono,decoded.sampleRate);}catch(java.io.IOException invalidAudio){throw invalidAudio;}catch(RuntimeException inference){throw new InferenceFailure(inference);}segments.add(vector);
                            for(int i=0;i<960;i++)pooled[i]+=vector[i]/starts.length;
                        }
                        if(!allowed(isManual,token,stopped))return false;
                        // Revalidate the file identity after decode, before committing any embedding.
                        Song current=findEligible(song.id);
                        if(current!=null&&fingerprint.equals(fingerprint(current)))store.analysed(song.id,fingerprint,starts,segments,pooled);
                    }catch(InferenceFailure inference){throw inference;}
                    catch(CancellationException cancelled){return false;}
                    catch(Exception unreadable){store.failed(song.id,fingerprint,"Unreadable or unsupported audio");}
                    counts=store.counts();emit();
                }
            }catch(Exception|LinkageError unavailable){
                manualRequested=false;prefs.edit().putString("modelFailure",ModelRuntime.MODEL_SHA).apply();error="Audio analysis couldn't start. Try Analyse now again.";return true;
            }
            manualRequested=false;return true;
        }catch(InterruptedException interrupted){Thread.currentThread().interrupt();return false;}
        catch(Exception unavailable){manualRequested=false;error="Couldn't access your music. Check audio access and try again.";return true;}
        finally{android.os.Process.setThreadPriority(priority);if(acquired){running=false;activeManual=false;counts=store.counts();analysis.unlock();}if(isManual&&enabled())schedule();resumeManual();emit();}
    }
    private boolean allowed(boolean manualMode,int token,BooleanSupplier stopped){
        if(stopped.getAsBoolean()||Thread.currentThread().isInterrupted()||token!=generation.get())return false;
        if(!enabled()||prefs.getBoolean("paused",false))return false;
        return AnalysisPolicy.allowed(manualMode,foreground,batteryLow(),hot());
    }
    private boolean batteryLow(){Intent battery=context.registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));return battery!=null&&battery.getIntExtra(BatteryManager.EXTRA_LEVEL,100)*100/Math.max(1,battery.getIntExtra(BatteryManager.EXTRA_SCALE,100))<=15;}
    private boolean hot(){if(Build.VERSION.SDK_INT>=29&&((PowerManager)context.getSystemService(Context.POWER_SERVICE)).getCurrentThermalStatus()>=PowerManager.THERMAL_STATUS_MODERATE)return true;
        Intent battery=context.registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));return battery!=null&&battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE,0)>=400;
    }
    private synchronized List<Song> synchronize(){
        List<Song> songs=library.scan(context);List<RecommendationStore.FileEntry> files=new ArrayList<>();
        for(Song song:songs){RecommendationStore.FileEntry f=new RecommendationStore.FileEntry();f.id=song.id;f.duration=song.duration;f.added=song.added;f.identity=song.uri()+"|"+song.path;f.fingerprint=fingerprint(song);f.title=song.title;f.artist=song.artist;f.album=song.album;files.add(f);}
        store.synchronize(files);counts=store.counts();return songs;
    }
    public static String fingerprint(Song song){return digest(song.uri()+"|"+song.path+"|"+song.size+"|"+song.modified+"|"+song.duration+"|"+ModelRuntime.MODEL_SHA+"|"+ModelRuntime.PREPROCESS_VERSION);}
    private Song findEligible(long id){return library.eligible(context,id);}
    public static long[] sections(long duration){if(duration<20000)return new long[]{0};if(duration<30000)return new long[]{0,duration-10000};long last=Math.max(0,duration-10000);TreeSet<Long> values=new TreeSet<>(Arrays.asList(0L,last/2,last));return values.stream().mapToLong(Long::longValue).toArray();}
    public JSONObject status(){
        JSONObject out=new JSONObject();int[] c=counts;
        String reason=!enabled()?"disabled":prefs.getBoolean("paused",false)?"paused_user":!error.isEmpty()?"error":c[0]==0?"empty":c[0]==c[1]+c[2]?"ready":hot()?"paused_thermal":running?"analysing":manualRequested&&!foreground?"waiting_foreground":!manualRequested&&batteryLow()?"waiting_battery":"waiting";
        try{out.put("enabled",enabled()).put("state",reason).put("eligible",c[0]).put("analysed",c[1]).put("failed",c[2]).put("running",running).put("error",error).put("historyVersion",historyGeneration.get()).put("mixVersion",listeningContext().key()+"|"+habitRevision)
            .put("mixesAvailable",c[1]>0&&(c[1]>=10||(c[0]<10&&c[0]==c[1]+c[2])));}catch(JSONException impossible){throw new IllegalStateException(impossible);}return out;
    }
    public void emit(){synchronized(eventLock){if(eventPending)return;eventPending=true;}handler.postDelayed(()->{
        synchronized(eventLock){eventPending=false;}context.sendBroadcast(new Intent(CHANGED).setPackage(context.getPackageName()).putExtra("json",status().toString()));
    },600);}
    public synchronized String mixes(boolean refresh)throws Exception{
        if(!enabled())return "[]";
        List<Song> eligible=synchronize();if(!status().getBoolean("mixesAvailable"))return "[]";
        Set<String> favorites=library.favorites();List<RecommendationStore.Indexed> indexed=store.indexed();
        StringBuilder identities=new StringBuilder();indexed.sort(Comparator.comparingLong(t->t.file.id));for(RecommendationStore.Indexed item:indexed)identities.append(item.file.id).append(':').append(item.file.fingerprint).append(';');
        List<String> sortedFavorites=new ArrayList<>(favorites);Collections.sort(sortedFavorites);
        long now=System.currentTimeMillis();store.pruneHistory(now);long revision=store.revision();habitRevision=revision;ListeningContext currentContext=listeningContext();String key=digest("habits-v2|"+currentContext.key()+"|"+revision+"|"+identities+sortedFavorites);
        String cached=refresh?null:store.cached(key);JSONArray result;
        if(cached!=null)result=new JSONArray(cached);
        else{
            Set<Long> available=new HashSet<>();for(RecommendationStore.Indexed item:indexed)available.add(item.file.id);List<ListeningHabits.Session> sessions=store.listeningSessions();sessions.removeIf(s->!available.contains(s.track));ListeningHabits.Snapshot habits=ListeningHabits.summarize(sessions,now,currentContext);ListeningHabits.Ranker ranker=store.ranker(revision,sessions,now);List<TasteRanker.Track> tracks=new ArrayList<>();Map<Long,String> fingerprints=new HashMap<>();
            for(RecommendationStore.Indexed item:indexed){RecommendationStore.FileEntry f=item.file;ListeningHabits.Signal a=habits.signal(f.id);
                String duplicate=(f.title==null||f.title.equals("Untitled")||f.artist==null||f.artist.equals("Unknown artist"))?f.identity:f.title.toLowerCase(Locale.ROOT).trim()+"|"+f.artist.toLowerCase(Locale.ROOT).trim()+"|"+(f.duration/2000);
                tracks.add(new TasteRanker.Track(f.id,f.artist,f.album,duplicate,item.vector,favorites.contains(""+f.id),a.preference,a.recentPenalty,a.skipPenalty,a));fingerprints.put(f.id,f.fingerprint);
            }
            List<TasteRanker.Mix> mixes=TasteRanker.mixes(tracks,ranker,habits.confidence);result=new JSONArray();
            for(int i=0;i<mixes.size();i++){TasteRanker.Mix mix=mixes.get(i);JSONArray ids=new JSONArray();JSONObject files=new JSONObject();for(TasteRanker.Track t:mix.tracks){ids.put(t.id);files.put(""+t.id,fingerprints.get(t.id));}
                result.put(new JSONObject().put("id",UUID.randomUUID().toString()).put("title","Your mix "+(i+1)).put("subtitle",mix.subtitle()).put("reason",mix.explanation()).put("created",System.currentTimeMillis()).put("ids",ids).put("files",files));
            }store.cache(key,result.toString(),mixes);
        }
        remember(result);Map<Long,Song> songs=new HashMap<>();for(Song song:eligible)songs.put(song.id,song);JSONArray publicMixes=new JSONArray();
        for(int i=0;i<result.length();i++){JSONObject mix=result.getJSONObject(i);JSONArray songsJson=new JSONArray();JSONArray ids=mix.getJSONArray("ids");for(int j=0;j<ids.length();j++){Song song=songs.get(ids.getLong(j));if(song!=null)songsJson.put(song.json());}
            publicMixes.put(new JSONObject().put("id",mix.getString("id")).put("title",mix.getString("title")).put("subtitle",mix.getString("subtitle")).put("reason",mix.optString("reason","")).put("created",mix.getLong("created")).put("tracks",songsJson));
        }return publicMixes.toString();
    }
    private void remember(JSONArray mixes)throws JSONException{for(int i=0;i<mixes.length();i++){JSONObject mix=mixes.getJSONObject(i);snapshots.put(mix.getString("id"),mix);}while(snapshots.size()>32)snapshots.remove(snapshots.keySet().iterator().next());}
    public synchronized List<Song> songsForMix(String id)throws Exception{
        if(!enabled())throw new IllegalStateException("Enable personal mixes first");
        if(!snapshots.containsKey(id)){String cached=store.latestSnapshot();if(cached!=null)remember(new JSONArray(cached));}
        JSONObject mix=snapshots.get(id);if(mix==null)throw new IllegalArgumentException("Refresh the mix and try again");
        Map<Long,Song> eligible=new HashMap<>();for(Song song:synchronize())eligible.put(song.id,song);List<Song> songs=new ArrayList<>();JSONArray ids=mix.getJSONArray("ids");JSONObject files=mix.getJSONObject("files");
        for(int i=0;i<ids.length()&&songs.size()<30;i++){Song song=eligible.get(ids.getLong(i));if(song==null||!fingerprint(song).equals(files.optString(""+song.id)))continue;
            try(android.os.ParcelFileDescriptor readable=context.getContentResolver().openFileDescriptor(song.uri(),"r")){if(readable!=null)songs.add(song);}catch(Exception unreadable){}
        }if(songs.isEmpty())throw new IllegalArgumentException("These songs are no longer available. Refresh the mix.");return songs;
    }
    public void saveMix(String id,String name)throws Exception{String chosen=name.trim();if(chosen.isEmpty()||chosen.length()>100)throw new IllegalArgumentException("Use a playlist name between 1 and 100 characters");if(library.playlists().has(chosen))throw new IllegalArgumentException("Choose a new playlist name");List<Song> songs=songsForMix(id);library.createPlaylist(chosen);for(Song song:songs)library.addToPlaylist(chosen,song);}
    public Future<?> clearHistory(){historyGeneration.incrementAndGet();return events.submit(()->{synchronized(this){store.clearHistory();habitRevision=store.revision();snapshots.clear();}emit();});}
    public Future<?> clearAnalysis(){setEnabled(false);return events.submit(()->{analysis.lock();try{synchronized(this){store.clearAnalysis();habitRevision=store.revision();snapshots.clear();counts=store.counts();}}finally{analysis.unlock();}emit();});}
    private static final class InferenceFailure extends Exception { InferenceFailure(Throwable cause){super(cause);} }
    private static String digest(String input){try{MessageDigest hash=MessageDigest.getInstance("SHA-256");StringBuilder value=new StringBuilder();for(byte b:hash.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8)))value.append(String.format(Locale.ROOT,"%02x",b&255));return value.toString();}catch(Exception impossible){throw new IllegalStateException(impossible);}}
}
