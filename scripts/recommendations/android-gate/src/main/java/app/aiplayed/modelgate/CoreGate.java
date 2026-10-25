package app.aiplayed.modelgate;

import android.app.Instrumentation;
import android.os.Bundle;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.net.Uri;
import app.localmusic.player.*;
import app.localmusic.player.recommendations.*;
import org.json.*;
import java.io.*;
import java.util.*;

public final class CoreGate extends Instrumentation {
 private int checks;
 public void onCreate(Bundle arguments){super.onCreate(arguments);start();}
 public void onStart(){Bundle result=new Bundle();try{
  Context context=getTargetContext();context.deleteDatabase("personal-mixes.db");
  check(Arrays.equals(RecommendationEngine.sections(3000),new long[]{0}),"Short songs get one padded section");
  check(Arrays.equals(RecommendationEngine.sections(15000),new long[]{0}),"Mostly overlapping short sections are not analysed repeatedly");
  check(Arrays.equals(RecommendationEngine.sections(25000),new long[]{0,15000}),"Medium tracks use two distinct sections");
  check(Arrays.equals(RecommendationEngine.sections(3600000),new long[]{0,1795000,3590000}),"Long medleys get three bounded sections");
  RecommendationStore store=new RecommendationStore(context);
  List<RecommendationStore.FileEntry> files=new ArrayList<>();float[] vector=new float[960];vector[0]=1;vector[1]=.12345679f;
  for(int i=0;i<12;i++){RecommendationStore.FileEntry f=new RecommendationStore.FileEntry();f.id=i;f.identity="file"+i;f.fingerprint="v1-"+i;f.title="Song "+i;f.artist="Artist "+i;f.album="Album "+i;f.duration=180000;files.add(f);}
  store.synchronize(files);check(Arrays.equals(store.counts(),new int[]{12,0,0}),"Cold index has twelve pending tracks");
  for(int i=0;i<10;i++)store.analysed(i,"v1-"+i,new long[]{0},Collections.singletonList(vector),vector);
  check(Arrays.equals(store.counts(),new int[]{12,10,0}),"Partial index becomes available at ten tracks");
  check(store.indexed().size()==10,"FP32 embeddings round trip from private SQLite");
  check(Arrays.equals(store.indexed().get(0).vector,vector),"FP32 precision survives SQLite without rounding to FP16");
  check(store.indexed().get(0).vector.length==960,"Track dimensions stay native");
  files.get(0).fingerprint="v2-0";store.synchronize(files);check(store.counts()[1]==9,"Changed files invalidate their embeddings");
  files.remove(1);store.synchronize(files);check(store.counts()[0]==11&&store.counts()[1]==8,"Deleted or excluded tracks become ineligible");
  store.failed(10,"v1-10","unreadable");check(store.counts()[2]==1&&!store.pending().contains(10L),"Unreadable files do not retry indefinitely");
  store.retryFailed();check(store.pending().contains(10L),"Explicit retry can revisit failed files");
  long now=System.currentTimeMillis();ListeningClock clock=new ListeningClock();clock.playedMs=100000;clock.coveredMs=100000;
  store.session("open",5,now,120000,clock,"open",false,"play");store.recoverSessions();
  check("interruption".equals(scalar(store.getReadableDatabase(),"SELECT reason FROM sessions WHERE id='open'")),"Process restart recovers an unfinished session without dislike");
  SQLiteDatabase db=store.getWritableDatabase();db.beginTransaction();
  try{for(int i=0;i<20005;i++)db.execSQL("INSERT INTO sessions(id,track_id,started,duration,reason) VALUES(?,?,?,?,?)",new Object[]{"session-"+i,5,now-i,120000,"interruption"});
   db.execSQL("INSERT INTO sessions(id,track_id,started,duration,reason) VALUES(?,?,?,?,?)",new Object[]{"expired",5,now-181L*86400000,120000,"interruption"});db.setTransactionSuccessful();}finally{db.endTransaction();}
  store.recoverSessions();check("20000".equals(scalar(db,"SELECT COUNT(*) FROM sessions")),"Session count is capped at twenty thousand");
  check("0".equals(scalar(db,"SELECT COUNT(*) FROM sessions WHERE id='expired'")),"Sessions older than 180 days are removed");
  Library library=new Library(context);library.createPlaylist("Keep me");Song favorite=new Song();favorite.id=555;library.toggleFavorite(favorite);
  store.cache("day","[]",TasteRanker.mixes(Collections.singletonList(new TasteRanker.Track(5,"Artist","Album","same",vector,true,1,0,0))));
  check("1".equals(scalar(db,"SELECT COUNT(*) FROM profiles")),"Weighted taste profile is persisted");
  store.clearHistory();check("0".equals(scalar(db,"SELECT COUNT(*) FROM profiles"))&&"0".equals(scalar(db,"SELECT COUNT(*) FROM snapshots")),"Clear history also removes profiles and daily snapshots");
  check(store.indexed().size()==8,"Clear history retains audio embeddings");
  check("0".equals(scalar(db,"SELECT COUNT(*) FROM sessions")),"Clear history removes listening sessions");
  check(library.favorites().contains("555")&&library.playlists().has("Keep me"),"History reset retains favourites and playlists");
  store.clearAnalysis();check(store.indexed().isEmpty()&&"0".equals(scalar(db,"SELECT COUNT(*) FROM segments")),"Deleting analysis cascades to segment embeddings");store.close();
  float[] pcm=wave(context);AudioDecoder.Decoded decoded=AudioDecoder.section(context,Uri.parse("content://app.aiplayed.modelgate.audio/fixture.wav"),0,()->true);
  check(decoded.sampleRate==44100&&Math.abs(decoded.mono.length-pcm.length)<=1,"Original content URI decoding preserves source rate and duration");
  double maximum=0;for(int i=0;i<Math.min(pcm.length,decoded.mono.length);i++)maximum=Math.max(maximum,Math.abs(pcm[i]-decoded.mono[i]));
  check(maximum<.001,"Decoded PCM agrees with the original source, without playback DSP");
  try(ModelRuntime runtime=new ModelRuntime(context)){
   float[] actual=runtime.embed(decoded.mono,decoded.sampleRate),expected=runtime.embed(pcm,44100);
   check(TasteRanker.cosine(TasteRanker.normalize(actual),TasteRanker.normalize(expected))>=.999,"Content URI decode through native preprocessing and FP32 runtime preserves embeddings");
  }
  playbackSessions(context);
  analysisLifecycle(context);
  concurrentResets(context);
  JSONObject report=new JSONObject().put("passed",true).put("checks",checks).put("sdk",android.os.Build.VERSION.SDK_INT).put("device",android.os.Build.MODEL).put("model_sha256",ModelRuntime.MODEL_SHA);
  try(FileOutputStream out=context.openFileOutput("core-gate.json",0)){out.write(report.toString(2).getBytes(java.nio.charset.StandardCharsets.UTF_8));}
  result.putString("stream",report.toString());finish(-1,result);
 }catch(Throwable error){result.putString("stream",android.util.Log.getStackTraceString(error));finish(1,result);}}
 private void playbackSessions(Context context)throws Exception{
  startActivitySync(new Intent(context,GateActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));waitForIdleSync();
  // Exercise the actual Media3 service and its callbacks, rather than fabricated session rows.
  wave(context,30);java.util.List<Song> songs=new java.util.ArrayList<>();
  for(int i=0;i<2;i++){
   ContentValues values=new ContentValues();values.put(android.provider.MediaStore.Audio.Media.DISPLAY_NAME,"AiplayedCore"+i+".wav");values.put(android.provider.MediaStore.Audio.Media.MIME_TYPE,"audio/wav");values.put(android.provider.MediaStore.Audio.Media.RELATIVE_PATH,"Music/AiplayedCore");
   Uri uri=context.getContentResolver().insert(android.provider.MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,values);
   try(InputStream input=new FileInputStream(new File(context.getFilesDir(),"fixture.wav"));OutputStream output=context.getContentResolver().openOutputStream(uri)){
    byte[] bytes=new byte[16384];int n;while((n=input.read(bytes))!=-1)output.write(bytes,0,n);
   }
   Song song=new Song();song.id=ContentUris.parseId(uri);song.title="Core "+i;song.artist="Core artist";song.album="Core album";song.path="core"+i;song.folder="Core";song.duration=30000;songs.add(song);
  }
  java.util.concurrent.CountDownLatch bound=new java.util.concurrent.CountDownLatch(1);final PlaybackService[] holder=new PlaybackService[1];
  ServiceConnection connection=new ServiceConnection(){public void onServiceConnected(ComponentName name,android.os.IBinder binder){holder[0]=((PlaybackService.LocalBinder)binder).service();bound.countDown();}public void onServiceDisconnected(ComponentName name){}};
  onMain(()->{context.startForegroundService(new Intent(context,PlaybackService.class).setAction("foreground"));context.bindService(new Intent(context,PlaybackService.class),connection,Context.BIND_AUTO_CREATE);});
  check(bound.await(10,java.util.concurrent.TimeUnit.SECONDS),"Native playback service binds");
  PlaybackService service=holder[0];RecommendationEngine engine=RecommendationEngine.get(context);engine.setEnabled(true);engine.pause();engine.clearHistory().get();
  try{
   onMain(()->service.play(songs,0));playing(service);Thread.sleep(1000);
   onMain(()->service.seek(15000));Thread.sleep(600);onMain(()->service.next(true));drain(engine);
   check("0".equals(scalar(engine.store.getReadableDatabase(),"SELECT early_next FROM sessions WHERE reason='next' ORDER BY ended DESC LIMIT 1")),"Seeking into a track before Next is not early dislike");
   check(Long.parseLong(scalar(engine.store.getReadableDatabase(),"SELECT played FROM sessions WHERE reason='next' ORDER BY ended DESC LIMIT 1"))<5000,"Seeking jumps never become heard duration");
   onMain(()->service.play(songs,0));playing(service);Thread.sleep(1000);onMain(()->service.next(true));drain(engine);
   check("1".equals(scalar(engine.store.getReadableDatabase(),"SELECT early_next FROM sessions WHERE reason='next' ORDER BY ended DESC LIMIT 1")),"An actual deliberately skipped early listen is weak negative evidence");
   onMain(()->service.play(songs,0));playing(service);Thread.sleep(700);onMain(service::pause);Thread.sleep(1600);onMain(service::resume);playing(service);Thread.sleep(700);onMain(()->service.play(songs,1));drain(engine);
   long heard=Long.parseLong(scalar(engine.store.getReadableDatabase(),"SELECT played FROM sessions WHERE reason='queue_replacement' AND track_id="+songs.get(0).id+" ORDER BY ended DESC LIMIT 1"));
   check(heard>=900&&heard<2600,"Pause and resume account for heard time, excluding the pause");
   onMain(()->{service.play(songs,0);service.seek(5000);service.previous();});Thread.sleep(300);onMain(()->service.next(true));drain(engine);
   check(Long.parseLong(scalar(engine.store.getReadableDatabase(),"SELECT COUNT(*) FROM sessions WHERE reason='replay'"))>0,"Explicit previous/replay is recorded independently");
   onMain(()->{service.setRepeat(0);service.play(Collections.singletonList(songs.get(0)),0);});playing(service);onMain(()->service.seek(29500));Thread.sleep(1200);drain(engine);
   check(Long.parseLong(scalar(engine.store.getReadableDatabase(),"SELECT COUNT(*) FROM sessions WHERE reason='completion'"))>0,"Natural completion has its own terminal reason");
   onMain(()->{service.setRepeat(2);service.play(Collections.singletonList(songs.get(0)),0);});playing(service);onMain(()->service.seek(29700));Thread.sleep(900);onMain(()->service.next(true));drain(engine);
   check(Long.parseLong(scalar(engine.store.getReadableDatabase(),"SELECT COUNT(*) FROM sessions WHERE entry_reason='replay'"))>0,"Repeat starts a fresh replay session");
   onMain(()->{service.setRepeat(0);service.play(songs,0);service.pause();});Thread.sleep(300);onMain(()->service.next(true));drain(engine);
   check("0".equals(scalar(engine.store.getReadableDatabase(),"SELECT COUNT(*) FROM sessions WHERE reason='next' AND played=0 AND early_next=1")),"An unheard paused selection is not interpreted as dislike");
   Song missing=new Song();missing.id=Long.MAX_VALUE/2;missing.duration=30000;missing.title="Missing";missing.artist="Unknown artist";missing.album="Unknown album";
   onMain(()->service.play(Collections.singletonList(missing),0));Thread.sleep(1500);drain(engine);
   check(Long.parseLong(scalar(engine.store.getReadableDatabase(),"SELECT COUNT(*) FROM sessions WHERE reason='error' AND early_next=0"))>0,"Playback failure is recorded without dislike");
  }finally{onMain(service::pause);engine.setEnabled(false);context.unbindService(connection);context.stopService(new Intent(context,PlaybackService.class));}
 }
 private void analysisLifecycle(Context context)throws Exception{
  RecommendationEngine engine=RecommendationEngine.get(context);
  PlaybackService[] holder=new PlaybackService[1];java.util.concurrent.CountDownLatch bound=new java.util.concurrent.CountDownLatch(1);
  ServiceConnection connection=new ServiceConnection(){public void onServiceConnected(ComponentName name,android.os.IBinder binder){holder[0]=((PlaybackService.LocalBinder)binder).service();bound.countDown();}public void onServiceDisconnected(ComponentName name){}};
  boolean connected=false;
  try{
   command("dumpsys battery unplug");command("dumpsys battery set level 80");setTemperature(context,450);
   engine.clearAnalysis().get();
   context.getSharedPreferences("personal-mixes",0).edit().remove("enabled").apply();
   check(engine.enabled(),"Missing preference defaults personal mixes to enabled");
   engine.setEnabled(true);engine.foreground(true);drain(engine);
   check(engine.status().getInt("eligible")>=2,"Resumable analysis sees the MediaStore library");
   check(!engine.run(false,()->false),"Automatic analysis retains the temperature guard");
   engine.analyse(false);Thread.sleep(300);
   check(engine.status().getInt("analysed")==0&&"paused_thermal".equals(engine.status().getString("state")),"Battery temperature pauses manual analysis");
   setTemperature(context,250);
   long deadline=android.os.SystemClock.elapsedRealtime()+40000;
   while(engine.status().getInt("analysed")<2&&android.os.SystemClock.elapsedRealtime()<deadline)Thread.sleep(200);
   check(engine.status().getInt("analysed")>=2,"Manual analysis resumes after cooling without a charging or playback transition");
   setTemperature(context,450);engine.clearAnalysis().get();engine.setEnabled(true);drain(engine);
   check(!engine.run(false,()->true),"Work cancellation leaves audio pending for recovery");
   onMain(()->{context.startForegroundService(new Intent(context,PlaybackService.class).setAction("foreground"));context.bindService(new Intent(context,PlaybackService.class),connection,Context.BIND_AUTO_CREATE);});connected=true;
   check(bound.await(10,java.util.concurrent.TimeUnit.SECONDS),"Concurrent-analysis playback service binds");
   java.util.List<Song> songs=new Library(context).scan(context);
   onMain(()->{holder[0].setRepeat(2);holder[0].play(songs,0);});playing(holder[0]);
   setTemperature(context,250);
   boolean completed=engine.run(false,()->false);
   check(completed&&engine.status().getInt("analysed")>=2,"Automatic analysis completes while unplugged and music plays: "+engine.status()+"; "+thermalState(context));
   playing(holder[0]);check(true,"Music remains playing after automatic analysis");
  }finally{if(holder[0]!=null)onMain(holder[0]::pause);if(connected)context.unbindService(connection);context.stopService(new Intent(context,PlaybackService.class));engine.pause();engine.setEnabled(false);command("dumpsys battery reset");}
 }
 private String thermalState(Context context){
  Intent battery=context.registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
  int temperature=battery==null?Integer.MIN_VALUE:battery.getIntExtra(android.os.BatteryManager.EXTRA_TEMPERATURE,Integer.MIN_VALUE);
  int status=android.os.Build.VERSION.SDK_INT>=29?((android.os.PowerManager)context.getSystemService(Context.POWER_SERVICE)).getCurrentThermalStatus():0;
  return "batteryTemperature="+temperature+", thermalStatus="+status;
 }
 private void setTemperature(Context context,int expected)throws Exception{
  command("dumpsys battery set temp "+expected);
  // Shell completion is not delivery of ACTION_BATTERY_CHANGED. Establish the
  // same app-visible precondition used by the real engine before running it.
  long deadline=android.os.SystemClock.elapsedRealtime()+10000;
  do{
   Intent battery=context.registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
   int actual=battery==null?Integer.MIN_VALUE:battery.getIntExtra(android.os.BatteryManager.EXTRA_TEMPERATURE,Integer.MIN_VALUE);
   int status=android.os.Build.VERSION.SDK_INT>=29?((android.os.PowerManager)context.getSystemService(Context.POWER_SERVICE)).getCurrentThermalStatus():0;
   if(actual==expected&&(expected>=400||status<android.os.PowerManager.THERMAL_STATUS_MODERATE)){
    android.util.Log.i("CoreGate","Temperature fixture ready: "+thermalState(context));return;
   }
   Thread.sleep(25);
  }while(android.os.SystemClock.elapsedRealtime()<deadline);
  throw new AssertionError("Temperature fixture did not reach "+expected+": "+thermalState(context));
 }
 private void command(String value)throws Exception{
  try(android.os.ParcelFileDescriptor descriptor=getUiAutomation().executeShellCommand(value);InputStream input=new android.os.ParcelFileDescriptor.AutoCloseInputStream(descriptor)){byte[] bytes=new byte[1024];while(input.read(bytes)!=-1){}}
 }
 private void concurrentResets(Context context)throws Exception{
  RecommendationEngine engine=RecommendationEngine.get(context);float[] vector=new float[960];vector[0]=1;
  java.util.List<TasteRanker.Mix> oldProfile=TasteRanker.mixes(Collections.singletonList(new TasteRanker.Track(1,"Old taste","Album","old",vector,true,1,0,0)));
  java.util.concurrent.Future<?> reset;
  // An already-running mix generation owns this monitor until it commits its snapshot.
  // Request each public reset during that generation, then let the older cache write finish.
  synchronized(engine){
   reset=engine.clearHistory();Thread.sleep(200);engine.store.cache("old-history","[]",oldProfile);
  }
  reset.get(10,java.util.concurrent.TimeUnit.SECONDS);
  check("0".equals(scalar(engine.store.getReadableDatabase(),"SELECT COUNT(*) FROM profiles"))&&"0".equals(scalar(engine.store.getReadableDatabase(),"SELECT COUNT(*) FROM snapshots")),"History reset wins over an older in-flight profile cache write");
  synchronized(engine){
   reset=engine.clearAnalysis();Thread.sleep(200);engine.store.cache("old-analysis","[]",oldProfile);
  }
  reset.get(10,java.util.concurrent.TimeUnit.SECONDS);
  check("0".equals(scalar(engine.store.getReadableDatabase(),"SELECT COUNT(*) FROM profiles"))&&"0".equals(scalar(engine.store.getReadableDatabase(),"SELECT COUNT(*) FROM snapshots")),"Analysis deletion wins over an older in-flight profile cache write");
 }
 private void onMain(Runnable action){
  java.util.concurrent.atomic.AtomicReference<Throwable> failure=new java.util.concurrent.atomic.AtomicReference<>();
  runOnMainSync(()->{try{action.run();}catch(Throwable error){failure.set(error);}});
  if(failure.get()!=null)throw new AssertionError("Native service main-thread action failed",failure.get());
 }
 private void drain(RecommendationEngine engine)throws Exception{Thread.sleep(100);engine.events.submit(()->{}).get();}
 private void playing(PlaybackService service)throws Exception{
  long end=android.os.SystemClock.elapsedRealtime()+10000;java.util.concurrent.atomic.AtomicBoolean active=new java.util.concurrent.atomic.AtomicBoolean();
  while(android.os.SystemClock.elapsedRealtime()<end){onMain(()->active.set(service.playing()));if(active.get())return;Thread.sleep(50);}throw new AssertionError("Media3 fixture did not start");
 }
 private void check(boolean value,String message){checks++;if(!value)throw new AssertionError(message);}
 private String scalar(SQLiteDatabase db,String query){try(Cursor cursor=db.rawQuery(query,null)){if(!cursor.moveToFirst())return "";return cursor.getString(0);}}
 private float[] wave(Context context)throws Exception{return wave(context,1);}
 private float[] wave(Context context,int seconds)throws Exception{
  float[] pcm=new float[44100*seconds];ByteArrayOutputStream data=new ByteArrayOutputStream();DataOutputStream bytes=new DataOutputStream(data);
  bytes.writeBytes("RIFF");le32(bytes,36+pcm.length*2);bytes.writeBytes("WAVEfmt ");le32(bytes,16);le16(bytes,1);le16(bytes,1);le32(bytes,44100);le32(bytes,88200);le16(bytes,2);le16(bytes,16);bytes.writeBytes("data");le32(bytes,pcm.length*2);
  for(int i=0;i<pcm.length;i++){short sample=(short)(Math.sin(i*2*Math.PI*440/44100)*12000);pcm[i]=sample/32768f;le16(bytes,sample);}
  try(FileOutputStream out=new FileOutputStream(new File(context.getFilesDir(),"fixture.wav"))){out.write(data.toByteArray());}return pcm;
 }
 private void le16(DataOutputStream out,int value)throws Exception{out.writeByte(value);out.writeByte(value>>8);}
 private void le32(DataOutputStream out,int value)throws Exception{le16(out,value);le16(out,value>>16);}
}
