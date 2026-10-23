package app.localmusic.player.recommendations;

/** Tracks heard time without counting pauses, buffering or discontinuous seek jumps. */
public final class ListeningClock {
    public long playedMs, coveredMs, maximumPosition;
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
            }
        }
        previousTime = now; previousPosition = position;
        previousPlaying = playing; previousSpeed = speed;
        maximumPosition = Math.max(maximumPosition, position);
        initialized = true;
    }

    public void discontinuity(long now, long newPosition, boolean playing, float speed) {
        previousTime = now; previousPosition = Math.max(0, newPosition);
        previousPlaying = playing; previousSpeed = speed; initialized = true;
        maximumPosition = Math.max(maximumPosition, previousPosition);
    }

    public boolean earlyNext(long duration) {
        long threshold = Math.min(30000, Math.max(0, duration) / 5);
        return threshold > 0 && playedMs < threshold && coveredMs < threshold && maximumPosition < threshold;
    }
}
