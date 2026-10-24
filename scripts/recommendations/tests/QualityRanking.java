import app.localmusic.player.recommendations.TasteRanker;
import java.nio.*;
import java.nio.file.*;
import java.util.*;
public final class QualityRanking {
 public static void main(String[] args)throws Exception{
  List<TasteRanker.Track> tracks=new ArrayList<>();
  for(String line:Files.readAllLines(Path.of(args[0]))){String[] row=line.split("\t");float[] vector=new float[960];ByteBuffer.wrap(Files.readAllBytes(Path.of(row[4]))).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(vector);
   tracks.add(new TasteRanker.Track(Long.parseLong(row[0]),row[1],row[2],"id:"+row[0],vector,Boolean.parseBoolean(row[3]),0,0,0));}
  StringBuilder json=new StringBuilder("[");int profile=0;
  for(TasteRanker.Mix mix:TasteRanker.mixes(tracks)){if(profile>0)json.append(',');json.append("{\"profile\":").append(++profile).append(",\"ids\":[");int count=0;
   for(TasteRanker.Track t:mix.tracks){if(count++>0)json.append(',');json.append(t.id);}json.append("]}");}
  System.out.println(json.append(']'));
 }
}
