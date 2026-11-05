package app.localmusic.player.recommendations;

import java.time.*;
import java.util.*;

/** Active heard time in local calendar hours. No audio, location or Android dependency. */
public final class ListeningContext {
    public static final class Bucket {
        public final String day, zone;
        public final int weekday, hour;
        public long heard;
        public Bucket(String day,int weekday,int hour,String zone,long heard){
            this.day=day;this.weekday=weekday;this.hour=hour;this.zone=zone;this.heard=heard;
        }
    }
    public final String day, zone;
    public final int weekday, hour;
    public ListeningContext(long now,ZoneId zone){
        ZonedDateTime local=Instant.ofEpochMilli(now).atZone(zone);
        day=local.toLocalDate().toString();weekday=local.getDayOfWeek().getValue();hour=local.getHour();this.zone=zone.getId();
    }
    public String key(){return day+"|"+hour+"|"+zone;}
    public double match(Bucket bucket){
        int distance=Math.abs(hour-bucket.hour);distance=Math.min(distance,24-distance);
        double time=Math.max(0,1-distance/4d);
        double week=weekday==bucket.weekday?1:(weekday<=5)==(bucket.weekday<=5)?.65:.25;
        return time*week;
    }
    public static String origin(String value){
        return Arrays.asList("library","search","playlist","folder","shuffle","recommendation","queue","restored").contains(value)?value:"legacy";
    }
    public static final class Accumulator {
        private final Map<String,Bucket> buckets=new LinkedHashMap<>();
        private long previousWall,previousElapsed;
        private boolean initialized;
        public void update(long wall,long elapsed,long heard,ZoneId zone){
            boolean stable=!initialized||Math.abs((wall-previousWall)-(elapsed-previousElapsed))<=2000;
            previousWall=wall;previousElapsed=elapsed;initialized=true;
            if(!stable||heard<=0||heard>5000)return; // clock corrections never fabricate routines
            long cursor=wall-heard;
            while(cursor<wall){
                ZonedDateTime local=Instant.ofEpochMilli(cursor).atZone(zone);
                long boundary=local.withMinute(0).withSecond(0).withNano(0).plusHours(1).toInstant().toEpochMilli();
                long end=Math.min(wall,Math.max(cursor+1,boundary));
                String day=local.toLocalDate().toString(),key=day+"|"+local.getHour()+"|"+zone.getId();
                Bucket b=buckets.get(key);
                if(b==null){b=new Bucket(day,local.getDayOfWeek().getValue(),local.getHour(),zone.getId(),0);buckets.put(key,b);if(buckets.size()>512)buckets.remove(buckets.keySet().iterator().next());}
                b.heard+=end-cursor;cursor=end;
            }
        }
        public List<Bucket> snapshot(){
            List<Bucket> result=new ArrayList<>();for(Bucket b:buckets.values())result.add(new Bucket(b.day,b.weekday,b.hour,b.zone,b.heard));return result;
        }
    }
}
