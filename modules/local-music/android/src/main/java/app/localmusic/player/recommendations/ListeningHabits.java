package app.localmusic.player.recommendations;

import java.time.*;
import java.util.*;

/** Bounded local engagement features and a regularised chronological pairwise learner. */
public final class ListeningHabits {
    private static final long DAY=86400000L;
    public static final class Session {
        public String id,reason="open",entry="play",origin="legacy";
        public long track,started,ended,played,covered,duration;
        public boolean selected,early;
        public final List<ListeningContext.Bucket> buckets=new ArrayList<>();
        public double engagement(){
            if(duration<=0||played<Math.min(10000,duration/2))return 0;
            double target=Math.max(1000,Math.min(duration*.7,600000));
            return Math.sqrt(Math.min(1,played/target)*Math.min(1,covered/target));
        }
        public double contribution(){
            if("open".equals(reason)&&(played<120000||engagement()<.7))return 0;
            double source=selected?1:"recommendation".equals(origin)?.25:"shuffle".equals(origin)?.5:.65;
            return engagement()*source*(selected&&"replay".equals(entry)?1.2:1);
        }
    }
    public static final class Signal {
        public double preference,recentTaste,routine,confidence,rediscovery,recentPenalty,skipPenalty,contextSkip;
        public double[] features(){return new double[]{preference,recentTaste,routine*confidence,rediscovery};}
        public String explanation(){
            if(confidence>=.5&&routine>=.3)return "Often played around this time";
            if(recentTaste>=.5)return "Based on your recent listening";
            if(rediscovery>=.5)return "Rediscover songs you enjoyed";
            return "";
        }
    }
    public static final class Snapshot {
        public final Map<Long,Signal> tracks=new HashMap<>();
        public double confidence;
        public Signal signal(long track){return tracks.getOrDefault(track,new Signal());}
    }
    private static final class DaySignal {
        double positive,negative,context,contextNegative;long ended;
    }
    public static Snapshot summarize(List<Session> sessions,long now,ListeningContext context){
        Map<Long,Map<String,DaySignal>> days=new HashMap<>();Set<String> learnedDays=new HashSet<>();int engaged=0;
        for(Session s:sessions){
            if(s.started<now-180*DAY||s.ended>now||s.ended<s.started||s.played<=0)continue;
            double positive=s.contribution();
            long heard=0;for(ListeningContext.Bucket b:s.buckets)heard+=b.heard;
            Map<String,double[]> portions=new HashMap<>();
            if(heard==0)portions.put("legacy:"+Math.floorDiv(s.started,DAY),new double[]{1,0});
            else for(ListeningContext.Bucket b:s.buckets){double share=b.heard/(double)heard;double[] part=portions.computeIfAbsent(b.day,k->new double[2]);part[0]+=share;part[1]+=share*context.match(b);}
            boolean engagedSession=false;
            for(Map.Entry<String,double[]> portion:portions.entrySet()){
                String day=portion.getKey();double share=portion.getValue()[0],matched=portion.getValue()[1];
                DaySignal d=days.computeIfAbsent(s.track,k->new HashMap<>()).computeIfAbsent(day,k->new DaySignal());
                double wanted=positive*share,allowed=Math.min(wanted,Math.max(0,3-d.positive));d.positive+=allowed;
                double negative=s.early&&"next".equals(s.reason)?Math.min(.5*share,Math.max(0,1-d.negative)):0;d.negative+=negative;
                d.context+=allowed*(share>0?matched/share:0);d.contextNegative+=negative*(share>0?matched/share:0);d.ended=Math.max(d.ended,s.ended);
                if(allowed>=.25){engagedSession=true;learnedDays.add(day);}
            }
            if(engagedSession)engaged++;

        }
        Snapshot snapshot=new Snapshot();
        snapshot.confidence=learnedDays.size()<2?0:Math.min(1,engaged/20d);
        for(Map.Entry<Long,Map<String,DaySignal>> entry:days.entrySet()){
            Signal a=new Signal();double positive=0,recent=0,contextPositive=0,skips=0,contextNegative=0;int routineDays=0;long latest=0;
            for(DaySignal d:entry.getValue().values()){
                double age=Math.max(0,now-d.ended)/(double)DAY;
                positive+=d.positive*Math.exp(-age/45);recent+=d.positive*Math.exp(-age/7);
                contextPositive+=d.context*Math.exp(-age/30);skips+=d.negative*Math.exp(-age/30);
                contextNegative+=d.contextNegative*Math.exp(-age/14);
                if(d.context>=.25)routineDays++;
                latest=Math.max(latest,d.ended);
            }
            double age=Math.max(0,now-latest)/(double)DAY;
            a.preference=Math.min(1,positive/6);a.recentTaste=Math.min(1,recent/3);
            a.routine=Math.min(1,contextPositive/3);
            a.confidence=routineDays<3?0:Math.min(1,routineDays/5d)*Math.min(1,contextPositive/2);
            a.rediscovery=Math.min(1,age/30)*a.preference;a.recentPenalty=Math.exp(-age/2);
            a.skipPenalty=Math.min(1,skips/4);a.contextSkip=Math.min(1,contextNegative/2);
            snapshot.tracks.put(entry.getKey(),a);
        }
        return snapshot;
    }
    public static final class Ranker {
        private static final double[] PRIOR={.23,.12,.16,.04};
        public final double[] weights=PRIOR.clone();
        public boolean learned;
        public double score(double audio,boolean favorite,Signal s,double confidence){
            double legacy=.88*audio+.12*s.preference-.12*s.recentPenalty-.16*s.skipPenalty;
            double personal=.42*audio+dot(weights,s.features())+(favorite?.05:0)-.12*s.recentPenalty-.08*s.skipPenalty-.15*s.contextSkip;
            return legacy*(1-confidence)+personal*confidence;
        }
    }
    private static final class Pair {
        final double[] difference;
        Pair(double[] positive,double[] negative){difference=new double[positive.length];for(int i=0;i<difference.length;i++)difference[i]=positive[i]-negative[i];}
    }
    /** Only observed explicit skips versus subsequent deliberate engagement are labels. */
    public static Ranker train(List<Session> input,long now){
        List<Session> sessions=new ArrayList<>();for(Session s:input)if(s.started>=now-180*DAY&&s.ended<=now&&s.ended>=s.started)sessions.add(s);sessions.sort(Comparator.comparingLong((Session s)->s.started).thenComparing(s->s.id));
        List<Pair> pairs=new ArrayList<>();Set<String> dates=new HashSet<>();
        int from=Math.max(0,sessions.size()-2000);
        for(int i=sessions.size()-1;i>=from&&pairs.size()<80;i--){
            Session skipped=sessions.get(i);if(!skipped.early||!"next".equals(skipped.reason)||skipped.buckets.isEmpty())continue;
            for(int j=i+1;j<sessions.size();j++){
                Session positive=sessions.get(j);
                if(positive.started-skipped.ended>1800000)break;
                if(positive.started<skipped.ended||positive.track==skipped.track||!positive.selected||"open".equals(positive.reason)||positive.engagement()<.7)continue;
                ListeningContext context=new ListeningContext(skipped.started,ZoneId.of(skipped.buckets.get(skipped.buckets.size()-1).zone));
                Snapshot before=summarize(sessions.subList(from,i),skipped.started,context);
                pairs.add(new Pair(before.signal(positive.track).features(),before.signal(skipped.track).features()));
                dates.add(context.day);break;
            }
        }
        Collections.reverse(pairs);
        Ranker result=new Ranker();if(pairs.size()<20||dates.size()<4)return result;
        int split=pairs.size()*4/5;
        for(int pass=0;pass<8;pass++)for(Pair pair:pairs.subList(0,split)){
            double probability=1/(1+Math.exp(-dot(result.weights,pair.difference)));
            for(int d=0;d<result.weights.length;d++)result.weights[d]=Math.max(.02,Math.min(.5,result.weights[d]+.08*((1-probability)*pair.difference[d]-.04*(result.weights[d]-Ranker.PRIOR[d]))));
        }
        // Hold out later decisions. A learner must beat its regularised defaults.
        double prior=0,learner=0;
        for(Pair pair:pairs.subList(split,pairs.size())){prior+=loss(dot(Ranker.PRIOR,pair.difference));learner+=loss(dot(result.weights,pair.difference));}
        if(learner+1e-6<prior)result.learned=true;else System.arraycopy(Ranker.PRIOR,0,result.weights,0,result.weights.length);
        return result;
    }
    private static double loss(double value){return Math.log1p(Math.exp(-value));}
    private static double dot(double[] a,double[] b){double result=0;for(int i=0;i<a.length;i++)result+=a[i]*b[i];return result;}
}
