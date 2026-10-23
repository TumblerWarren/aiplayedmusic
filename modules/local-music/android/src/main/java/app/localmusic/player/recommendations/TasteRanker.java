package app.localmusic.player.recommendations;

import java.util.*;

/** Spherical taste clustering and deterministic, diverse thirty-song snapshots. No Android APIs. */
public final class TasteRanker {
    public static final class Track {
        public final long id;
        public final String artist, album, duplicateKey;
        public final float[] vector;
        public final double preference, recentPenalty, skipPenalty;
        public final boolean favorite;
        public Track(long id, String artist, String album, String duplicateKey, float[] vector,
                     boolean favorite, double preference, double recentPenalty, double skipPenalty) {
            this.id=id; this.artist=known(artist,"unknown artist"); this.album=known(album,"unknown album");
            this.duplicateKey=duplicateKey==null?"":duplicateKey; this.vector=normalize(vector); this.favorite=favorite;
            this.preference=clamp(preference,0,1); this.recentPenalty=clamp(recentPenalty,0,1); this.skipPenalty=clamp(skipPenalty,0,1);
        }
    }
    public static final class Mix {
        public final float[] profile;
        public final List<Track> tracks;
        Mix(float[] profile,List<Track> tracks){this.profile=profile;this.tracks=Collections.unmodifiableList(tracks);}
        public String subtitle(){
            LinkedHashSet<String> artists=new LinkedHashSet<>();
            for(Track track:tracks)if(!track.artist.isEmpty()){artists.add(track.artist);if(artists.size()==3)break;}
            return artists.isEmpty()?"From your library":String.join(" · ",artists);
        }
    }
    private TasteRanker(){}
    public static List<Mix> mixes(List<Track> input) {
        List<Track> library=new ArrayList<>(input);
        library.sort(Comparator.comparingLong(t->t.id));
        if(library.isEmpty())return Collections.emptyList();
        List<Track> seeds=new ArrayList<>();
        for(Track t:library)if(t.favorite||t.preference>.15)seeds.add(t);
        if(seeds.isEmpty())seeds.addAll(library);
        seeds.sort(Comparator.<Track>comparingDouble(t->t.favorite?3+t.preference:t.preference).reversed().thenComparingLong(t->t.id));
        List<float[]> centers=new ArrayList<>(); centers.add(seeds.get(0).vector.clone());
        while(centers.size()<3&&centers.size()<seeds.size()){
            Track farthest=null;double distance=.15;
            for(Track t:seeds){double d=1;for(float[] center:centers)d=Math.min(d,1-cosine(t.vector,center));
                if(d>distance){distance=d;farthest=t;}}
            if(farthest==null)break;
            centers.add(farthest.vector.clone());
        }
        for(int iteration=0;iteration<12;iteration++){
            double[][] sums=new double[centers.size()][centers.get(0).length];double[] weights=new double[centers.size()];
            for(Track t:seeds){int nearest=0;double best=-Double.MAX_VALUE;
                for(int i=0;i<centers.size();i++){double score=cosine(t.vector,centers.get(i));if(score>best){best=score;nearest=i;}}
                double weight=1+(t.favorite?3:0)+t.preference*2;
                for(int d=0;d<t.vector.length;d++)sums[nearest][d]+=t.vector[d]*weight;
                weights[nearest]+=weight;
            }
            for(int i=0;i<centers.size();i++)if(weights[i]>0){float[] v=new float[sums[i].length];for(int d=0;d<v.length;d++)v[d]=(float)sums[i][d];centers.set(i,normalize(v));}
        }
        List<Mix> result=new ArrayList<>();
        for(float[] center:centers){
            List<Track> ranked=new ArrayList<>();
            for(Track track:library){
                double own=cosine(track.vector,center),best=own;
                for(float[] other:centers)best=Math.max(best,cosine(track.vector,other));
                // A mix may be shorter than thirty; do not fill it with a separate taste.
                if(own>=best-.04)ranked.add(track);
            }
            ranked.sort(Comparator.<Track>comparingDouble(t->score(t,center)).reversed().thenComparingLong(t->t.id));
            List<Track> chosen=new ArrayList<>();Set<Long> ids=new HashSet<>();Set<String> duplicates=new HashSet<>();
            while(chosen.size()<30){Track next=null;
                for(int relaxation=0;relaxation<3&&next==null;relaxation++)for(Track t:ranked){
                    if(ids.contains(t.id)||(!t.duplicateKey.isEmpty()&&duplicates.contains(t.duplicateKey)))continue;
                    if(relaxation==0&&recentAlbum(chosen,t))continue;
                    if(relaxation<2&&recentArtist(chosen,t))continue;
                    next=t;break;
                }
                if(next==null)break;
                chosen.add(next);ids.add(next.id);if(!next.duplicateKey.isEmpty())duplicates.add(next.duplicateKey);
            }
            result.add(new Mix(center,chosen));
        }
        return result;
    }
    private static double score(Track t,float[] center){return .88*cosine(t.vector,center)+.12*t.preference-.12*t.recentPenalty-.16*t.skipPenalty;}
    private static boolean recentArtist(List<Track> chosen,Track t){
        if(t.artist.isEmpty())return false;
        for(int i=Math.max(0,chosen.size()-2);i<chosen.size();i++)if(t.artist.equalsIgnoreCase(chosen.get(i).artist))return true;
        return false;
    }
    private static boolean recentAlbum(List<Track> chosen,Track t){
        if(t.album.isEmpty())return false;
        for(int i=Math.max(0,chosen.size()-2);i<chosen.size();i++)if(t.album.equalsIgnoreCase(chosen.get(i).album))return true;
        return false;
    }
    private static String known(String value,String unknown){return value==null||value.trim().isEmpty()||value.equalsIgnoreCase(unknown)||value.equals("<unknown>")?"":value.trim();}
    public static float[] normalize(float[] vector){
        double norm=0;for(float value:vector){if(!Float.isFinite(value))throw new IllegalArgumentException("Non-finite embedding");norm+=(double)value*value;}
        if(norm<1e-20)throw new IllegalArgumentException("Zero embedding");
        float[] normalized=vector.clone();norm=Math.sqrt(norm);for(int i=0;i<normalized.length;i++)normalized[i]/=norm;return normalized;
    }
    public static double cosine(float[] a,float[] b){if(a.length!=b.length)throw new IllegalArgumentException("Embedding dimension mismatch");double result=0;for(int i=0;i<a.length;i++)result+=(double)a[i]*b[i];return result;}
    private static double clamp(double value,double min,double max){return Math.max(min,Math.min(max,Double.isFinite(value)?value:0));}
}
