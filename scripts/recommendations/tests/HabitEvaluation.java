import app.localmusic.player.recommendations.*;
import java.time.*;
import java.nio.file.*;
import java.util.*;

/** Reproducible synthetic chronological study and host cost measurement, not user relevance evidence. */
public final class HabitEvaluation {
    static ListeningHabits.Session session(String id,long track,long time){
        ListeningHabits.Session s=new ListeningHabits.Session();s.id=id;s.track=track;s.started=time;s.ended=time+240000;s.played=s.covered=s.duration=240000;s.reason="completion";s.origin="search";s.selected=true;
        ListeningContext c=new ListeningContext(time,ZoneId.of("Asia/Kolkata"));s.buckets.add(new ListeningContext.Bucket(c.day,c.weekday,c.hour,c.zone,240000));return s;
    }
    static List<TasteRanker.Track> tracks(ListeningHabits.Snapshot habits){
        List<TasteRanker.Track> result=new ArrayList<>();for(int id=1;id<=2;id++){ListeningHabits.Signal a=habits==null?null:habits.signal(id);result.add(new TasteRanker.Track(id,"Artist "+id,"Album "+id,""+id,id==1?new float[]{1,0}:new float[]{0,1},true,a==null?1:a.preference,a==null?0:a.recentPenalty,a==null?0:a.skipPenalty,a));}return result;
    }
    public static void main(String[] args)throws Exception{
        ZoneId zone=ZoneId.of("Asia/Kolkata");long origin=Instant.parse("2026-10-01T03:00:00Z").toEpochMilli();
        List<ListeningHabits.Session> history=new ArrayList<>();
        for(int day=0;day<12;day++)for(int period=0;period<2;period++)history.add(session("warm-"+day+"-"+period,period+1,origin+day*86400000L+period*43200000L));
        int baseline=0,contextual=0,total=0;
        for(int day=12;day<20;day++)for(int period=0;period<2;period++){
            long now=origin+day*86400000L+period*43200000L;
            ListeningHabits.Snapshot habits=ListeningHabits.summarize(history,now,new ListeningContext(now,zone));
            long before=TasteRanker.mixes(tracks(null)).get(0).tracks.get(0).id;
            long after=TasteRanker.mixes(tracks(habits),ListeningHabits.train(history,now),habits.confidence).get(0).tracks.get(0).id;
            if(before==period+1)baseline++;if(after==period+1)contextual++;total++;
            // Reveal this outcome only after predicting it.
            history.add(session("held-out-"+day+"-"+period,period+1,now));
        }
        if(contextual<=baseline)throw new AssertionError("context must improve the known synthetic routine");
        long now=origin+40*86400000L;List<ListeningHabits.Session> large=new ArrayList<>();
        for(int i=0;i<20000;i++)large.add(session("large-"+i,i%100+1,now-(20000L-i)*300000));
        long began=System.nanoTime();ListeningHabits.Snapshot habits=ListeningHabits.summarize(large,now,new ListeningContext(now,zone));double aggregateMs=(System.nanoTime()-began)/1e6;
        List<TasteRanker.Track> library=new ArrayList<>();
        for(int i=0;i<10000;i++){float[] vector=new float[960];vector[i%3]=1;vector[10+i%100]=.05f;ListeningHabits.Signal a=habits.signal(i);library.add(new TasteRanker.Track(i,"Artist "+i%80,"Album "+i%150,"track "+i,vector,i<3,a.preference,a.recentPenalty,a.skipPenalty,a));}
        began=System.nanoTime();List<TasteRanker.Mix> mixes=TasteRanker.mixes(library,new ListeningHabits.Ranker(),habits.confidence);double rankingMs=(System.nanoTime()-began)/1e6;
        if(mixes.isEmpty()||mixes.get(0).tracks.size()!=30)throw new AssertionError("large library still returns fixed thirty-track mixes");
        String report=String.format(Locale.ROOT,"{\n  \"environment\": \"Java host; not emulator or physical phone\",\n  \"data\": \"synthetic habits and embeddings; not a human relevance study\",\n  \"chronological_holdout_decisions\": %d,\n  \"baseline_top_mix_hits\": %d,\n  \"contextual_top_mix_hits\": %d,\n  \"sessions\": 20000,\n  \"library_tracks\": 10000,\n  \"embedding_dimensions\": 960,\n  \"aggregation_ms\": %.2f,\n  \"ranking_ms\": %.2f\n}\n",total,baseline,contextual,aggregateMs,rankingMs);
        if(args.length>0){Path path=Paths.get(args[0]);Files.createDirectories(path.getParent());Files.writeString(path,report);}System.out.print(report);
    }
}
