import app.localmusic.player.recommendations.*;
import java.time.*;
import java.util.*;

/** Behavioural and chronological checks; synthetic habits are not a human relevance study. */
public final class ListeningHabitsTest {
    static int checks;
    static void check(boolean value,String message){checks++;if(!value)throw new AssertionError(message);}
    static long at(String value){return Instant.parse(value).toEpochMilli();}
    static ListeningHabits.Session listen(String id,long track,long start,String zone,boolean selected,String origin){
        ListeningHabits.Session s=new ListeningHabits.Session();s.id=id;s.track=track;s.started=start;s.ended=start+240000;s.duration=240000;s.played=240000;s.covered=240000;s.reason="completion";s.origin=origin;s.selected=selected;
        ListeningContext c=new ListeningContext(start,ZoneId.of(zone));s.buckets.add(new ListeningContext.Bucket(c.day,c.weekday,c.hour,c.zone,s.played));return s;
    }
    public static void main(String[] args){
        ZoneId india=ZoneId.of("Asia/Kolkata"),utc=ZoneId.of("UTC");
        ListeningContext.Accumulator counter=new ListeningContext.Accumulator();
        long midnight=at("2026-11-04T18:30:00Z");
        counter.update(midnight-1000,0,0,india);counter.update(midnight+1000,2000,2000,india);
        check(counter.snapshot().size()==2,"midnight divides active listening across local dates");
        check(counter.snapshot().get(0).heard==1000&&counter.snapshot().get(1).heard==1000,"both sides retain only their heard duration");
        counter.update(midnight+3601000,3000,1000,india);
        check(counter.snapshot().stream().mapToLong(b->b.heard).sum()==2000,"wall-clock jumps cannot create time-of-day evidence");
        ListeningContext.Accumulator dst=new ListeningContext.Accumulator();long fold=at("2026-11-01T06:00:00Z");
        dst.update(fold-1000,0,0,ZoneId.of("America/New_York"));dst.update(fold+1000,2000,2000,ZoneId.of("America/New_York"));
        check(dst.snapshot().stream().mapToLong(b->b.heard).sum()==2000,"DST fallback preserves actual heard time");
        check(new ListeningContext(midnight,india).day.equals("2026-11-05"),"local date is independent of UTC date");
        check(!new ListeningContext(midnight,india).key().equals(new ListeningContext(midnight,utc).key()),"travel changes context and cache identity");
        ListeningClock coverage=new ListeningClock();coverage.update(0,0,true,1);coverage.update(1000,1000,true,1);coverage.discontinuity(1000,0,true,1);coverage.update(2000,1000,true,1);
        check(coverage.playedMs==2000&&coverage.coveredMs==2000&&coverage.uniqueCoveredMs==1000,"replaying the same second does not fabricate completion coverage");
        ListeningHabits.Session medley=listen("medley",1,midnight,"UTC",true,"library");medley.duration=3600000;medley.played=medley.covered=900000;
        check(medley.engagement()==1,"fifteen minutes of a long medley is strong engagement");
        medley.covered=1000;check(medley.engagement()<.1,"looping a tiny section is not full engagement");
        long now=at("2026-11-05T03:00:00Z");List<ListeningHabits.Session> history=new ArrayList<>();
        for(int day=1;day<=12;day++){
            history.add(listen("morning-"+day,1,now-day*86400000L,"Asia/Kolkata",true,"search"));
            history.add(listen("evening-"+day,2,now-day*86400000L+12*3600000,"Asia/Kolkata",true,"playlist"));
        }
        ListeningHabits.Snapshot morning=ListeningHabits.summarize(history,now,new ListeningContext(now,india));
        ListeningHabits.Snapshot evening=ListeningHabits.summarize(history,now+12*3600000,new ListeningContext(now+12*3600000,india));
        check(morning.signal(1).routine>morning.signal(2).routine,"observed morning choices have context support");
        check(evening.signal(2).routine>evening.signal(1).routine,"the same history changes relevance in the evening");
        check(morning.signal(1).confidence>.5&&morning.signal(2).confidence==0,"routine explanations require repeated matching days");
        check(morning.signal(1).explanation().contains("around this time"),"the explanation reflects observed behaviour");
        ListeningHabits.Session automatic=listen("auto",7,now-3600000,"UTC",false,"recommendation");
        ListeningHabits.Session chosen=listen("chosen",8,now-3600000,"UTC",true,"search");
        check(automatic.contribution()<chosen.contribution(),"recommendation autoplay cannot reinforce itself like a deliberate choice");
        List<ListeningHabits.Session> loop=new ArrayList<>();for(int i=0;i<500;i++)loop.add(listen("repeat"+i,9,now-10000000,"UTC",true,"library"));
        ListeningHabits.Signal repeated=ListeningHabits.summarize(loop,now,new ListeningContext(now,utc)).signal(9);
        check(repeated.preference<=.5&&repeated.confidence==0,"one repeat-heavy day cannot dominate long-term taste or invent a routine");
        check(!ListeningHabits.train(history,now).learned,"unheard songs and completions alone are not negative training labels");
        List<ListeningHabits.Session> decisions=new ArrayList<>(history);
        for(int day=36;day>=1;day--){
            long time=now-day*86400000L;
            decisions.add(listen("prior-good-"+day,11,time-3600000,"UTC",true,"search"));
            ListeningHabits.Session skip=listen("skip-"+day,12,time,"UTC",true,"library");skip.early=true;skip.reason="next";skip.played=skip.covered=2000;skip.ended=time+2000;
            decisions.add(skip);decisions.add(listen("choice-"+day,11,time+3000,"UTC",true,"search"));
        }
        ListeningHabits.Ranker learned=ListeningHabits.train(decisions,now);
        check(learned.learned,"sufficient explicit chronological choices can improve held-out pairwise loss");
        for(double weight:learned.weights)check(Double.isFinite(weight)&&weight>=.02&&weight<=.5,"learned weights stay bounded and regularised");
        ListeningHabits.Session failure=listen("error",3,now-3600000,"UTC",true,"library");failure.reason="error";failure.early=false;failure.played=failure.covered=0;
        check(ListeningHabits.summarize(Arrays.asList(failure),now,new ListeningContext(now,utc)).tracks.isEmpty(),"unheard playback failures are neutral");
        ListeningHabits.Session future=listen("future",4,now+86400000,"UTC",true,"library");
        check(ListeningHabits.summarize(Arrays.asList(future),now,new ListeningContext(now,utc)).tracks.isEmpty(),"chronological evaluation cannot see future outcomes");
        List<TasteRanker.Track> candidates=Arrays.asList(
            new TasteRanker.Track(1,"Morning artist","A","1",new float[]{1,0},false,morning.signal(1).preference,morning.signal(1).recentPenalty,0,morning.signal(1)),
            new TasteRanker.Track(2,"Evening artist","B","2",new float[]{.98f,.02f},false,morning.signal(2).preference,morning.signal(2).recentPenalty,0,morning.signal(2)));
        check(TasteRanker.mixes(candidates,new ListeningHabits.Ranker(),morning.confidence).get(0).tracks.get(0).id==1,"habits can distinguish almost-identical audio candidates");
        List<TasteRanker.Track> eveningCandidates=new ArrayList<>();
        for(TasteRanker.Track t:candidates){ListeningHabits.Signal signal=evening.signal(t.id);eveningCandidates.add(new TasteRanker.Track(t.id,t.artist,t.album,t.duplicateKey,t.vector,false,signal.preference,signal.recentPenalty,signal.skipPenalty,signal));}
        check(TasteRanker.mixes(eveningCandidates,new ListeningHabits.Ranker(),evening.confidence).get(0).tracks.get(0).id==2,"evening listening habits can beat a marginally closer audio match");
        List<TasteRanker.Track> distinct=Arrays.asList(new TasteRanker.Track(1,"A","A","1",new float[]{1,0},true,1,0,0,morning.signal(1)),new TasteRanker.Track(2,"B","B","2",new float[]{0,1},true,1,0,0,morning.signal(2)));
        List<TasteRanker.Mix> separate=TasteRanker.mixes(distinct,new ListeningHabits.Ranker(),morning.confidence);
        check(separate.size()==2&&separate.get(0).tracks.size()==1&&separate.get(0).tracks.get(0).id==1,"context prioritises the matching taste without merging distinct preferences");
        ListeningContext weekday=new ListeningContext(at("2026-11-02T08:00:00Z"),utc);
        check(weekday.match(new ListeningContext.Bucket("",1,8,"UTC",1))>weekday.match(new ListeningContext.Bucket("",7,8,"UTC",1)),"weekday evidence is stronger than a different weekend routine");
        check(new ListeningContext(at("2026-11-05T00:00:00Z"),utc).match(new ListeningContext.Bucket("",4,23,"UTC",1))>0,"adjacent hours overlap across midnight");
        System.out.println("Listening habits: "+checks+" checks passed");
    }
}
