package app.localmusic.player.recommendations;

/** Tracks heard time without counting pauses, buffering or discontinuous seek jumps. */
public final class ListeningClock {
    public long playedMs, coveredMs, uniqueCoveredMs, maximumPosition;
    private final java.util.TreeMap<Long,Long> heardRanges=new java.util.TreeMap<>();
    private long previousTime, previousPosition;
    private boolean previousPlaying, initialized;
    private float previousSpeed = 1;

    public void update(long now, long position, boolean playing, float speed) {
        position = Math.max(0, position);
        if (initialized && previousPlaying) {
            long elapsed = Math.max(0, now - previousTime);
            long advanced = position - previousPosition;
            // A discontinuity callback normally handles seeks. This bound also protects recovery.
            long expected = (long)(elapsed * previousSpeed);
            if (elapsed <= 5000 && advanced >= 0 && advanced <= expected + 1000) {
                long heard = Math.min(elapsed, Math.round(advanced / Math.max(.5f, previousSpeed)));
                playedMs += heard;
                coveredMs += Math.min(advanced, expected + 100);
                cover(previousPosition,previousPosition+Math.min(advanced,expected+100));
            }
        }
        previousTime = now; previousPosition = position;
        previousPlaying = playing; previousSpeed = speed;
        maximumPosition = Math.max(maximumPosition, position);
        initialized = true;
    }

    private void cover(long start,long end){
        if(end<=start)return;
        java.util.Map.Entry<Long,Long> left=heardRanges.floorEntry(start);
        if(left!=null&&left.getValue()>=start){start=left.getKey();end=Math.max(end,left.getValue());uniqueCoveredMs-=left.getValue()-left.getKey();heardRanges.remove(left.getKey());}
        java.util.Map.Entry<Long,Long> next=heardRanges.ceilingEntry(start);
        while(next!=null&&next.getKey()<=end){end=Math.max(end,next.getValue());uniqueCoveredMs-=next.getValue()-next.getKey();heardRanges.remove(next.getKey());next=heardRanges.ceilingEntry(start);}
        // Pathological seeking is bounded; missing coverage is safer than inventing it.
        if(heardRanges.size()<256){heardRanges.put(start,end);uniqueCoveredMs+=end-start;}
    }

    public void discontinuity(long now, long newPosition, boolean playing, float speed) {
        previousTime = now; previousPosition = Math.max(0, newPosition);
        previousPlaying = playing; previousSpeed = speed; initialized = true;
        maximumPosition = Math.max(maximumPosition, previousPosition);
    }

    public boolean earlyNext(long duration) {
        long threshold = Math.min(30000, Math.max(0, duration) / 5);
        return threshold > 0 && playedMs > 0 && playedMs < threshold && coveredMs < threshold && maximumPosition < threshold;
    }
}
