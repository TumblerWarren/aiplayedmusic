package app.localmusic.player;

import android.content.ContentUris;
import android.net.Uri;
import android.provider.MediaStore;
import org.json.JSONObject;

public final class Song {
    public long id, albumId, duration, size, added, modified;
    public String title, artist, album, folder, path;
    public Uri uri() { return ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id); }
    public Uri art() { return ContentUris.withAppendedId(Uri.parse("content://media/external/audio/albumart"), albumId); }
    public String subtitle() { return artist + " · " + album; }
    public static String time(long ms) { long s = Math.max(0, ms / 1000); return String.format(java.util.Locale.US, "%d:%02d", s / 60, s % 60); }
    public JSONObject json() {
        JSONObject j = new JSONObject();
        try { j.put("id",id).put("albumId",albumId).put("duration",duration).put("size",size).put("added",added).put("modified",modified).put("title",title).put("artist",artist).put("album",album).put("folder",folder).put("path",path); } catch(Exception ignored) {}
        return j;
    }
    public static Song from(JSONObject j) {
        Song s = new Song(); s.id=j.optLong("id"); s.albumId=j.optLong("albumId"); s.duration=j.optLong("duration"); s.size=j.optLong("size"); s.added=j.optLong("added"); s.modified=j.optLong("modified");
        s.title=j.optString("title"); s.artist=j.optString("artist"); s.album=j.optString("album"); s.folder=j.optString("folder"); s.path=j.optString("path"); return s;
    }
}
