"""Compile and exercise the production recorder with controllable Android/service clocks."""
from pathlib import Path
import subprocess
import tempfile

fixtures = {
    'android/os/SystemClock.java': 'package android.os; public class SystemClock {public static long now;public static long elapsedRealtime(){return now;}}',
    'app/localmusic/player/Song.java': 'package app.localmusic.player;public class Song {public long id,duration=180000;public Song(long id){this.id=id;}}',
    'app/localmusic/player/recommendations/RecommendationEngine.java': '''package app.localmusic.player.recommendations;
public class RecommendationEngine {
 public static String fingerprint(app.localmusic.player.Song song){return "file:"+song.id;}
 public boolean active=true;public final java.util.concurrent.atomic.AtomicInteger historyGeneration=new java.util.concurrent.atomic.AtomicInteger();
 public final java.util.List<Runnable> pending=new java.util.ArrayList<>();public final java.util.concurrent.Executor events=pending::add;
 public final Store store=new Store();public boolean enabled(){return active;}public void habitsChanged(){}
 public void drain(){for(Runnable r:new java.util.ArrayList<>(pending))r.run();pending.clear();}
 public static class Record {public String reason,origin,entry;public boolean selected,early;public long played,unique,context;}
 public static class Store {
  public final java.util.List<Record> rows=new java.util.ArrayList<>();
  public boolean session(String id,long track,long start,long ended,long duration,ListeningClock clock,String reason,boolean early,String entry,String origin,boolean selected,java.util.List<ListeningContext.Bucket> buckets,String fingerprint){
   Record r=new Record();r.reason=reason;r.origin=origin;r.entry=entry;r.selected=selected;r.early=early;r.played=clock.playedMs;r.unique=clock.uniqueCoveredMs;
   for(ListeningContext.Bucket b:buckets)r.context+=b.heard;rows.add(r);return true;
  }
 }
}''',
    'RecorderTest.java': '''import app.localmusic.player.recommendations.*;import app.localmusic.player.Song;
public class RecorderTest {
 static int checks;static void check(boolean ok,String why){checks++;if(!ok)throw new AssertionError(why);}
 static void heard(ListeningRecorder r,Song song,long time,long position){android.os.SystemClock.now=time;r.update(song,position,true,1);}
 public static void main(String[] args){
  RecommendationEngine engine=new RecommendationEngine();ListeningRecorder recorder=new ListeningRecorder(engine);Song one=new Song(1),two=new Song(2);
  recorder.selectOrigin("search");heard(recorder,one,0,0);heard(recorder,one,1000,1000);recorder.finish("next",1000,true,1);engine.drain();
  RecommendationEngine.Record r=engine.store.rows.get(0);
  check(r.origin.equals("search")&&r.selected,"explicit search selection is retained");check(r.played==1000&&r.unique==1000&&r.context==1000,"only active heard time reaches both context and coverage");check(r.early,"explicit early next is weak negative evidence");
  recorder.selectOrigin("recommendation");heard(recorder,two,1000,0);heard(recorder,two,2000,1000);recorder.finish("completion",1000,true,1);engine.drain();r=engine.store.rows.get(1);
  check(r.origin.equals("recommendation")&&!r.selected&&!r.early,"starting a suggested queue is not deliberate song selection");
  recorder.selectTrack();heard(recorder,one,2000,0);heard(recorder,one,3000,1000);recorder.finish("interruption",1000,true,1);engine.drain();r=engine.store.rows.get(2);
  check(r.selected&&!r.early,"a queue-row selection is explicit while focus loss is neutral");
  heard(recorder,two,3000,0);heard(recorder,two,4000,1000);recorder.finish("replay",1000,true,1);engine.drain();
  heard(recorder,two,4000,0);heard(recorder,two,5000,1000);recorder.finish("completion",1000,true,1);engine.drain();r=engine.store.rows.get(engine.store.rows.size()-1);
  check(r.entry.equals("replay")&&r.selected,"manual replay is distinguished from autoplay");
  heard(recorder,one,5000,0);heard(recorder,one,6000,1000);recorder.discontinuity(one,1,1000,0,true,true,1);heard(recorder,one,7000,1000);recorder.finish("completion",1000,true,1);engine.drain();r=engine.store.rows.get(engine.store.rows.size()-1);
  check(r.entry.equals("replay")&&!r.selected,"repeat-one does not become a deliberate replay");
  recorder.selectOrigin("library");heard(recorder,one,7000,0);heard(recorder,one,8000,1000);recorder.discontinuity(one,1,1000,60000,false,true,1);heard(recorder,one,9000,61000);recorder.finish("next",61000,true,1);engine.drain();r=engine.store.rows.get(engine.store.rows.size()-1);
  check(!r.early&&r.played==2000&&r.unique==2000,"seek jumps add neither listening time nor early dislike");
  heard(recorder,two,9000,0);heard(recorder,two,10000,1000);recorder.update(two,1000,false,1);heard(recorder,two,1900000,1000);engine.drain();r=engine.store.rows.get(engine.store.rows.size()-1);
  check(r.reason.equals("interruption")&&!r.early&&r.played==1000,"a long paused visit closes neutrally without counting the gap");
  heard(recorder,two,1901000,2000);recorder.finish("completion",2000,true,1);engine.drain();r=engine.store.rows.get(engine.store.rows.size()-1);
  check(r.played==1000,"resuming after a long gap starts a separate listening visit");
  heard(recorder,two,1901000,0);heard(recorder,two,1902000,1000);recorder.finish("error",1000,true,1);int before=engine.store.rows.size();engine.historyGeneration.incrementAndGet();engine.drain();
  check(engine.store.rows.size()==before,"a queued old session cannot repopulate cleared history");
  engine.active=false;heard(recorder,one,1902000,0);heard(recorder,one,1903000,1000);recorder.finish("next",1000,true,1);engine.drain();check(engine.store.rows.size()==before,"disabled recommendations stop recording");
  System.out.println("Production listening recorder: "+checks+" checks passed");
 }
}''',
}
with tempfile.TemporaryDirectory(prefix='aiplayed-recorder-') as folder:
    root = Path(folder)
    sources = []
    for name, text in fixtures.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        sources.append(str(path))
    native = Path('modules/local-music/android/src/main/java/app/localmusic/player/recommendations')
    sources += [str(native / name) for name in ['ListeningClock.java', 'ListeningContext.java', 'ListeningRecorder.java']]
    subprocess.run(['java', 'com.sun.tools.javac.Main', '-d', folder, *sources], check=True, timeout=30)
    subprocess.run(['java', '-cp', folder, 'RecorderTest'], check=True, timeout=30)
