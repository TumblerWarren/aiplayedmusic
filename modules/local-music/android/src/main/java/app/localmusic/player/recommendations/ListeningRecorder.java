package app.localmusic.player.recommendations;

import android.os.SystemClock;
import app.localmusic.player.Song;
import java.util.UUID;

/** Main-thread event accounting; SQLite writes are serialised off the playback thread. */
public final class ListeningRecorder {
    private final RecommendationEngine engine;
    private ListeningClock clock;
    private Song song;
    private String id,entry="play",nextEntry="play";
    private long started,lastSave,lastSavedDuration;
    private int epoch=-1;
    public ListeningRecorder(RecommendationEngine engine){this.engine=engine;}
    public void update(Song current,long position,boolean playing,float speed){
        if(!engine.enabled()){reset();return;}
        if(epoch!=engine.historyGeneration.get()){reset();epoch=engine.historyGeneration.get();}
        if(current==null)return;
        if(song==null){begin(current,position,playing,speed);return;}
        // Explicit transition callbacks own terminal reasons, never infer a skip from this change.
        if(song.id!=current.id)return;
        clock.update(SystemClock.elapsedRealtime(),position,playing,speed);
        long now=SystemClock.elapsedRealtime();
        if(now-lastSave>=5000&&clock.playedMs!=lastSavedDuration){persist("open",false);lastSave=now;lastSavedDuration=clock.playedMs;}
    }
    private void begin(Song current,long position,boolean playing,float speed){
        if(!engine.enabled())return;
        song=current;clock=new ListeningClock();id=UUID.randomUUID().toString();started=System.currentTimeMillis();
        epoch=engine.historyGeneration.get();entry=nextEntry;nextEntry="play";
        clock.discontinuity(SystemClock.elapsedRealtime(),position,playing,speed);lastSave=SystemClock.elapsedRealtime();lastSavedDuration=0;
    }
    public void finish(String reason,long position,boolean playing,float speed){
        if(song!=null&&clock!=null&&epoch==engine.historyGeneration.get()&&engine.enabled()){
            clock.update(SystemClock.elapsedRealtime(),position,playing,speed);
            persist(reason,"next".equals(reason)&&clock.earlyNext(song.duration));
        }
        reset();if("replay".equals(reason))nextEntry="replay";
    }
    public void discontinuity(Song next,long oldId,long oldPosition,long newPosition,boolean automatic,boolean playing,float speed){
        if(automatic){
            boolean replay=next!=null&&next.id==oldId;
            if(song!=null&&song.id==oldId)finish("completion",oldPosition,playing,speed);
            if(replay)nextEntry="replay";
            if(song==null&&next!=null)begin(next,newPosition,playing,speed);
        }else{
            if(song!=null&&next!=null&&song.id!=next.id)finish("queue_replacement",oldPosition,playing,speed);
            if(song==null){if(next!=null)begin(next,newPosition,playing,speed);}
            else clock.discontinuity(SystemClock.elapsedRealtime(),newPosition,playing,speed);
        }
    }
    private void persist(String reason,boolean early){
        final String session=id,entryReason=entry;final long track=song.id,duration=song.duration,start=started;final int capturedEpoch=epoch;
        final ListeningClock snapshot=new ListeningClock();snapshot.playedMs=clock.playedMs;snapshot.coveredMs=clock.coveredMs;snapshot.maximumPosition=clock.maximumPosition;
        engine.events.execute(()->{if(capturedEpoch==engine.historyGeneration.get())engine.store.session(session,track,start,duration,snapshot,reason,early,entryReason);});
    }
    private void reset(){song=null;clock=null;id=null;}
}
