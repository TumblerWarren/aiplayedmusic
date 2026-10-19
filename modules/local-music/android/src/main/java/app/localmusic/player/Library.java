package app.localmusic.player;

import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.provider.MediaStore;
import org.json.*;
import java.util.*;

public final class Library {
    private final SharedPreferences p;
    public Library(Context c) { p=c.getSharedPreferences("music",Context.MODE_PRIVATE); }
    public SharedPreferences prefs() { return p; }
    public List<Song> scan(Context c) {
        List<Song> out = new ArrayList<>();
        String[] cols={"_id","title","artist","album","album_id","duration","_size","date_added","_data"};
        Set<String> excluded=p.getStringSet("excluded",Collections.emptySet());
        Set<String> roots=p.getStringSet("musicRoots",Collections.emptySet());
        try(Cursor cur=c.getContentResolver().query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,cols,null,null,"title COLLATE NOCASE ASC")) {
            while(cur!=null && cur.moveToNext()) {
                Song s=new Song(); s.id=cur.getLong(0); s.title=clean(cur.getString(1),"Untitled"); s.artist=clean(cur.getString(2),"Unknown artist"); s.album=clean(cur.getString(3),"Unknown album");
                s.albumId=cur.getLong(4); s.duration=cur.getLong(5); s.size=cur.getLong(6); s.added=cur.getLong(7); s.path=clean(cur.getString(8),"");
                int slash=s.path.lastIndexOf('/'); s.folder=slash>0?s.path.substring(0,slash):"Other";
                if(s.duration < p.getInt("minDuration",0)*1000L || s.size < p.getInt("minSize",0)*1024L || withinAny(s.folder,excluded) || (!roots.isEmpty()&&!withinAny(s.folder,roots))) continue;
                out.add(s);
            }
        }
        return out;
    }
    private boolean withinAny(String path,Set<String> roots){for(String root:roots)if(path.equals(root)||path.startsWith(root+"/"))return true;return false;}
    private String clean(String s,String fallback) { return s==null || s.isEmpty() || s.equals("<unknown>")?fallback:s; }
    public Set<String> favorites() { return new HashSet<>(p.getStringSet("favorites",Collections.emptySet())); }
    public boolean favorite(Song s) { return favorites().contains(""+s.id); }
    public void toggleFavorite(Song s) { Set<String> set=favorites(); if(!set.add(""+s.id))set.remove(""+s.id); p.edit().putStringSet("favorites",set).apply(); }
    public JSONObject playlists() { try { return new JSONObject(p.getString("playlists","{}")); } catch(Exception e) { return new JSONObject(); } }
    public List<String> playlistNames() { List<String> n=new ArrayList<>(); playlists().keys().forEachRemaining(n::add); Collections.sort(n,String.CASE_INSENSITIVE_ORDER); return n; }
    public void createPlaylist(String name) { JSONObject j=playlists(); try { if(!j.has(name))j.put(name,new JSONArray()); }catch(Exception ignored){} p.edit().putString("playlists",j.toString()).apply(); }
    public void deletePlaylist(String name) { JSONObject j=playlists(); j.remove(name); p.edit().putString("playlists",j.toString()).apply(); }
    public void renamePlaylist(String old,String name) { JSONObject j=playlists(); try { if(!j.has(name)){ j.put(name,j.optJSONArray(old)); j.remove(old); } }catch(Exception ignored){} p.edit().putString("playlists",j.toString()).apply(); }
    public List<Long> playlistIds(String name) { JSONArray a=playlists().optJSONArray(name); List<Long> ids=new ArrayList<>(); if(a!=null)for(int i=0;i<a.length();i++)ids.add(a.optLong(i)); return ids; }
    public void addToPlaylist(String name,Song s) { JSONObject j=playlists(); JSONArray a=j.optJSONArray(name); if(a==null)a=new JSONArray(); for(int i=0;i<a.length();i++)if(a.optLong(i)==s.id)return; a.put(s.id); try{j.put(name,a);}catch(Exception ignored){} p.edit().putString("playlists",j.toString()).apply(); }
    public void removeFromPlaylist(String name,Song s) { JSONObject j=playlists(); JSONArray a=j.optJSONArray(name), b=new JSONArray(); if(a!=null)for(int i=0;i<a.length();i++)if(a.optLong(i)!=s.id)b.put(a.optLong(i)); try{j.put(name,b);}catch(Exception ignored){} p.edit().putString("playlists",j.toString()).apply(); }
    public void record(Song s) { List<Long> ids=recentIds(); ids.remove(s.id); ids.add(0,s.id); JSONArray a=new JSONArray(); for(int i=0;i<Math.min(ids.size(),100);i++)a.put(ids.get(i)); p.edit().putString("recent",a.toString()).apply(); }
    public List<Long> recentIds() { List<Long> l=new ArrayList<>(); try{JSONArray a=new JSONArray(p.getString("recent","[]")); for(int i=0;i<a.length();i++)l.add(a.getLong(i));}catch(Exception ignored){} return l; }
    public static List<Song> byIds(List<Song> all,List<Long> ids) { Map<Long,Song> map=new HashMap<>(); for(Song s:all)map.put(s.id,s); List<Song> out=new ArrayList<>(); for(Long id:ids)if(map.containsKey(id))out.add(map.get(id)); return out; }
    public void saveQueue(List<Song> queue,int index,int position) { JSONArray a=new JSONArray(); for(Song s:queue)a.put(s.json()); p.edit().putString("queue",a.toString()).putInt("index",index).putInt("position",position).apply(); }
    public List<Song> loadQueue() { List<Song> l=new ArrayList<>(); try{JSONArray a=new JSONArray(p.getString("queue","[]"));for(int i=0;i<a.length();i++)l.add(Song.from(a.getJSONObject(i)));}catch(Exception ignored){} return l; }
}
