import app.localmusic.player.recommendations.ListeningClock;
import app.localmusic.player.recommendations.TasteRanker;
import java.util.*;

/** Behavioral tests for real listening accounting and independent taste clusters. */
public final class EngineLogicTest {
    private static int checks;
    private static void check(boolean value,String message){checks++;if(!value)throw new AssertionError(message);}
    private static TasteRanker.Track track(long id,String artist,String album,float x,float y,boolean favorite,double recent,double skips){
        return new TasteRanker.Track(id,artist,album,"id:"+id,new float[]{x,y},favorite,favorite?1:0,recent,skips);
    }
    public static void main(String[] args){
        ListeningClock clock=new ListeningClock();
        clock.update(0,0,true,1);clock.update(1000,1000,false,1);
        clock.update(10000,1000,false,1);check(clock.playedMs==1000,"Pauses and buffering do not add heard duration");
        clock.update(11000,1000,true,1);clock.update(12000,2000,true,1);
        check(clock.playedMs==2000,"Resume continues actual listening");
        clock.discontinuity(12000,120000,true,1);clock.update(13000,121000,true,1);
        check(clock.playedMs==3000&&clock.coveredMs==3000,"Seek jumps are excluded");
        check(!clock.earlyNext(180000),"Skipping after seeking past the early threshold is not early dislike");
        clock.update(14000,0,true,1);check(clock.playedMs==3000,"Backward discontinuity adds no duration");
        ListeningClock fast=new ListeningClock();fast.update(0,0,true,2);fast.update(1000,2000,true,2);
        check(fast.playedMs==1000&&fast.coveredMs==2000,"Heard wall time and covered media time stay distinct");
        check(fast.earlyNext(180000),"Deliberate early next can be weak negative evidence");
        ListeningClock longTrack=new ListeningClock();longTrack.discontinuity(0,30000,true,1);
        check(!longTrack.earlyNext(3600000),"Long medleys use a thirty-second early-skip cap");
        check(TasteRanker.mixes(Collections.emptyList()).isEmpty(),"An empty library produces no mix");
        List<TasteRanker.Track> library=new ArrayList<>();
        library.add(track(1,"Devotional artist","Morning",1,0,true,0,0));
        library.add(track(2,"Electronic artist","Remix",0,1,true,0,0));
        library.add(track(3,"Related singer","Live",.99f,.05f,false,0,0));
        library.add(track(4,"Related producer","Dance",.05f,.99f,false,0,0));
        List<TasteRanker.Mix> mixes=TasteRanker.mixes(library);
        check(mixes.size()==2,"Distinct favourites retain separate taste profiles");
        check(mixes.get(0).tracks.get(0).id==1&&mixes.get(1).tracks.get(0).id==2,"Each profile starts from its own taste");
        check(mixes.get(0).tracks.get(1).id==3&&mixes.get(1).tracks.get(1).id==4,"Audio similarity retrieves the matching neighbour");
        check(mixes.get(0).tracks.size()==2&&mixes.get(1).tracks.size()==2,"Separate tastes do not become filler in each other’s mix");
        check(mixes.get(0).subtitle().contains("Devotional artist"),"Subtitles use actual artists");
        List<TasteRanker.Track> small=Arrays.asList(track(9,"Unknown artist","Unknown album",1,0,false,0,0),track(10,null,null,.99f,.01f,false,0,0));
        check(TasteRanker.mixes(small).get(0).tracks.size()==2,"Unknown metadata does not collapse a small library");
        List<TasteRanker.Track> many=new ArrayList<>();
        for(int i=0;i<70;i++)many.add(track(100+i,"Artist "+(i%7),"Album "+(i%10),1,.001f*i,false,0,0));
        List<TasteRanker.Track> chosen=TasteRanker.mixes(many).get(0).tracks;
        check(chosen.size()==30,"Snapshots stop at thirty songs");
        Set<Long> ids=new HashSet<>();for(int i=0;i<chosen.size();i++){
            check(ids.add(chosen.get(i).id),"No duplicate track IDs");
            for(int j=Math.max(0,i-2);j<i;j++)check(!chosen.get(i).artist.equals(chosen.get(j).artist),"Artists are spaced where possible");
        }
        List<TasteRanker.Track> duplicate=Arrays.asList(
            new TasteRanker.Track(20,"A","B","same-song",new float[]{1,0},false,0,0,0),
            new TasteRanker.Track(21,"A","B","same-song",new float[]{1,0},false,0,0,0));
        check(TasteRanker.mixes(duplicate).get(0).tracks.size()==1,"Duplicate identity is removed");
        List<TasteRanker.Track> penalized=Arrays.asList(track(30,"A","A",1,0,false,1,1),track(31,"B","B",1,0,false,0,0));
        check(TasteRanker.mixes(penalized).get(0).tracks.get(0).id==31,"Recent deliberate skips lower rank");
        List<TasteRanker.Track> oneArtist=Arrays.asList(track(40,"Same","Same",1,0,false,0,0),track(41,"Same","Same",1,.01f,false,0,0));
        check(TasteRanker.mixes(oneArtist).get(0).tracks.size()==2,"Small libraries relax spacing");
        System.out.println("Recommendation behavior: "+checks+" checks passed");
    }
}
