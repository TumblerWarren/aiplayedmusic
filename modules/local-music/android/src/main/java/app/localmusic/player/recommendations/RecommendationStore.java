package app.localmusic.player.recommendations;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.*;

/** Private local FP32 index and bounded listening history. Call on background executors. */
public final class RecommendationStore extends SQLiteOpenHelper {
    public static final class FileEntry {
        public long id, duration, added;
        public String identity, fingerprint, title, artist, album;
    }
    public static final class Indexed {
        public final FileEntry file;
        public final float[] vector;
        Indexed(FileEntry file,float[] vector){this.file=file;this.vector=vector;}
    }
    public RecommendationStore(Context context){super(context,"personal-mixes.db",null,2);setWriteAheadLoggingEnabled(true);}
    @Override public void onConfigure(SQLiteDatabase db){db.setForeignKeyConstraintsEnabled(true);}
    @Override public void onCreate(SQLiteDatabase db){
        db.execSQL("CREATE TABLE tracks(id INTEGER PRIMARY KEY,identity TEXT NOT NULL,fingerprint TEXT NOT NULL,title TEXT,artist TEXT,album TEXT,duration INTEGER,added INTEGER,eligible INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'pending',error TEXT,embedding BLOB)");
        db.execSQL("CREATE TABLE segments(track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,section INTEGER NOT NULL,start_ms INTEGER NOT NULL,embedding BLOB NOT NULL,PRIMARY KEY(track_id,section))");
        db.execSQL("CREATE TABLE sessions(id TEXT PRIMARY KEY,track_id INTEGER NOT NULL,started INTEGER NOT NULL,ended INTEGER,played INTEGER NOT NULL DEFAULT 0,covered INTEGER NOT NULL DEFAULT 0,maximum_position INTEGER NOT NULL DEFAULT 0,duration INTEGER NOT NULL,reason TEXT NOT NULL DEFAULT 'open',entry_reason TEXT NOT NULL DEFAULT 'play',early_next INTEGER NOT NULL DEFAULT 0)");
        db.execSQL("CREATE INDEX sessions_track_started ON sessions(track_id,started)");
        db.execSQL("CREATE TABLE profiles(id INTEGER PRIMARY KEY,embedding BLOB NOT NULL,updated INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE snapshots(id INTEGER PRIMARY KEY CHECK(id=1),cache_key TEXT NOT NULL,json TEXT NOT NULL)");
        migrateHabits(db);
    }
    private static void migrateHabits(SQLiteDatabase db){
        db.execSQL("ALTER TABLE sessions ADD COLUMN unique_covered INTEGER");
        db.execSQL("ALTER TABLE sessions ADD COLUMN file_fingerprint TEXT");
        db.execSQL("ALTER TABLE sessions ADD COLUMN origin TEXT NOT NULL DEFAULT 'legacy'");
        db.execSQL("ALTER TABLE sessions ADD COLUMN selected INTEGER NOT NULL DEFAULT 0");
        db.execSQL("CREATE TABLE listening_context(session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,local_day TEXT NOT NULL,weekday INTEGER NOT NULL,hour INTEGER NOT NULL,zone TEXT NOT NULL,heard INTEGER NOT NULL,PRIMARY KEY(session_id,local_day,hour,zone))");
        db.execSQL("CREATE INDEX listening_context_day ON listening_context(local_day)");
        db.execSQL("CREATE TABLE habit_revision(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL)");
        db.execSQL("INSERT INTO habit_revision VALUES(1,0)");
        db.execSQL("CREATE TABLE habit_ranker(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,weights TEXT NOT NULL,learned INTEGER NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db,int from,int to){
        if(from==1&&to==2)migrateHabits(db);
        else throw new IllegalStateException("Unsupported recommendation database version");
    }
    public synchronized void synchronize(List<FileEntry> files){
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try{
            db.execSQL("UPDATE tracks SET eligible=0");
            for(FileEntry file:files){
                String old=null;
                try(Cursor cursor=db.rawQuery("SELECT fingerprint FROM tracks WHERE id=?",new String[]{""+file.id})){if(cursor.moveToFirst())old=cursor.getString(0);}
                ContentValues values=new ContentValues();values.put("identity",file.identity);values.put("fingerprint",file.fingerprint);
                values.put("title",file.title);values.put("artist",file.artist);values.put("album",file.album);
                values.put("duration",file.duration);values.put("added",file.added);values.put("eligible",1);
                if(old==null){values.put("id",file.id);db.insertOrThrow("tracks",null,values);}
                else{
                    if(!old.equals(file.fingerprint)){values.put("status","pending");values.putNull("error");values.putNull("embedding");db.delete("segments","track_id=?",new String[]{""+file.id});}
                    db.update("tracks",values,"id=?",new String[]{""+file.id});
                }
            }
            db.setTransactionSuccessful();
        }finally{db.endTransaction();}
    }
    public synchronized Set<Long> pending(){
        Set<Long> ids=new HashSet<>();
        try(Cursor cursor=getReadableDatabase().rawQuery("SELECT id FROM tracks WHERE eligible=1 AND status='pending'",null)){while(cursor.moveToNext())ids.add(cursor.getLong(0));}
        return ids;
    }
    public synchronized int[] counts(){
        int[] result=new int[3];
        try(Cursor cursor=getReadableDatabase().rawQuery("SELECT status,COUNT(*) FROM tracks WHERE eligible=1 GROUP BY status",null)){
            while(cursor.moveToNext()){int count=cursor.getInt(1);result[0]+=count;if("ready".equals(cursor.getString(0)))result[1]=count;if("failed".equals(cursor.getString(0)))result[2]=count;}
        }return result;
    }
    public synchronized void retryFailed(){getWritableDatabase().execSQL("UPDATE tracks SET status='pending',error=NULL WHERE eligible=1 AND status='failed'");}
    public synchronized void failed(long id,String fingerprint,String error){
        ContentValues values=new ContentValues();values.put("status","failed");values.put("error",error);
        getWritableDatabase().update("tracks",values,"id=? AND fingerprint=?",new String[]{""+id,fingerprint});
    }
    public synchronized void analysed(long id,String fingerprint,long[] starts,List<float[]> segments,float[] pooled){
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try{
            ContentValues values=new ContentValues();values.put("status","ready");values.putNull("error");values.put("embedding",blob(pooled));
            int changed=db.update("tracks",values,"id=? AND fingerprint=? AND eligible=1",new String[]{""+id,fingerprint});
            if(changed>0){db.delete("segments","track_id=?",new String[]{""+id});for(int i=0;i<segments.size();i++){
                ContentValues section=new ContentValues();section.put("track_id",id);section.put("section",i);section.put("start_ms",starts[i]);section.put("embedding",blob(segments.get(i)));db.insertOrThrow("segments",null,section);
            }}db.setTransactionSuccessful();
        }finally{db.endTransaction();}
    }
    public synchronized List<Indexed> indexed(){
        List<Indexed> out=new ArrayList<>();
        try(Cursor c=getReadableDatabase().rawQuery("SELECT id,identity,fingerprint,title,artist,album,duration,added,embedding FROM tracks WHERE eligible=1 AND status='ready'",null)){
            while(c.moveToNext()){FileEntry f=new FileEntry();f.id=c.getLong(0);f.identity=c.getString(1);f.fingerprint=c.getString(2);f.title=c.getString(3);f.artist=c.getString(4);f.album=c.getString(5);f.duration=c.getLong(6);f.added=c.getLong(7);out.add(new Indexed(f,vector(c.getBlob(8))));}
        }return out;
    }
    public synchronized void session(String id,long track,long started,long duration,ListeningClock clock,String reason,boolean early,String entryReason){
        session(id,track,started,System.currentTimeMillis(),duration,clock,reason,early,entryReason,"legacy",false,Collections.emptyList());
    }
    public synchronized boolean session(String id,long track,long started,long ended,long duration,ListeningClock clock,String reason,boolean early,String entryReason,String origin,boolean selected,List<ListeningContext.Bucket> buckets){
        return session(id,track,started,ended,duration,clock,reason,early,entryReason,origin,selected,buckets,null);
    }
    public synchronized boolean session(String id,long track,long started,long ended,long duration,ListeningClock clock,String reason,boolean early,String entryReason,String origin,boolean selected,List<ListeningContext.Bucket> buckets,String observedFingerprint){
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();boolean changed=false;
        try{
            long oldMinute=-1;String oldReason="open",fileFingerprint=null;boolean exists=false;
            try(Cursor c=db.rawQuery("SELECT played/60000,reason,file_fingerprint FROM sessions WHERE id=?",new String[]{id})){if(c.moveToFirst()){oldMinute=c.getLong(0);oldReason=c.getString(1);fileFingerprint=c.getString(2);exists=true;}}
            ContentValues values=new ContentValues();values.put("id",id);values.put("track_id",track);values.put("started",started);values.put("duration",duration);
            values.put("played",clock.playedMs);values.put("covered",clock.coveredMs);values.put("maximum_position",clock.maximumPosition);values.put("reason",reason);values.put("entry_reason",entryReason);
            values.put("ended",ended);values.put("early_next",early?1:0);values.put("origin",ListeningContext.origin(origin));values.put("selected",selected?1:0);
            if(!"legacy".equals(origin)){
                values.put("unique_covered",clock.uniqueCoveredMs);
                if(!exists){fileFingerprint=observedFingerprint;if(fileFingerprint==null){fileFingerprint="unknown";try(Cursor c=db.rawQuery("SELECT fingerprint FROM tracks WHERE id=?",new String[]{""+track})){if(c.moveToFirst())fileFingerprint=c.getString(0);}}}
                if(fileFingerprint!=null)values.put("file_fingerprint",fileFingerprint);
            }
            // UPDATE preserves child context rows; REPLACE would cascade-delete them.
            if(db.update("sessions",values,"id=?",new String[]{id})==0)db.insertOrThrow("sessions",null,values);
            for(ListeningContext.Bucket b:buckets){ContentValues v=new ContentValues();v.put("session_id",id);v.put("local_day",b.day);v.put("weekday",b.weekday);v.put("hour",b.hour);v.put("zone",b.zone);v.put("heard",b.heard);db.insertWithOnConflict("listening_context",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
            changed=clock.playedMs>0&&((!"open".equals(reason)&&"open".equals(oldReason))||(clock.playedMs>=120000&&clock.playedMs/60000!=oldMinute));
            if(changed)db.execSQL("UPDATE habit_revision SET revision=revision+1 WHERE id=1");
            changed=prune(ended)||changed;db.setTransactionSuccessful();
        }finally{db.endTransaction();}
        return changed;
    }
    public synchronized long revision(){try(Cursor c=getReadableDatabase().rawQuery("SELECT revision FROM habit_revision WHERE id=1",null)){return c.moveToFirst()?c.getLong(0):0;}}
    public synchronized List<ListeningHabits.Session> listeningSessions(){
        List<ListeningHabits.Session> result=new ArrayList<>();Map<String,ListeningHabits.Session> ids=new HashMap<>();
        try(Cursor c=getReadableDatabase().rawQuery("SELECT s.id,s.track_id,s.started,s.ended,s.played,COALESCE(s.unique_covered,s.covered),s.duration,s.reason,s.entry_reason,s.origin,s.selected,s.early_next FROM sessions s LEFT JOIN tracks t ON t.id=s.track_id WHERE s.file_fingerprint IS NULL OR s.file_fingerprint=t.fingerprint ORDER BY s.started,s.id",null)){
            while(c.moveToNext()){ListeningHabits.Session s=new ListeningHabits.Session();s.id=c.getString(0);s.track=c.getLong(1);s.started=c.getLong(2);s.ended=c.getLong(3);s.played=c.getLong(4);s.covered=c.getLong(5);s.duration=c.getLong(6);s.reason=c.getString(7);s.entry=c.getString(8);s.origin=c.getString(9);s.selected=c.getInt(10)!=0;s.early=c.getInt(11)!=0;result.add(s);ids.put(s.id,s);}
        }
        try(Cursor c=getReadableDatabase().rawQuery("SELECT session_id,local_day,weekday,hour,zone,heard FROM listening_context ORDER BY local_day,hour",null)){
            while(c.moveToNext()){ListeningHabits.Session s=ids.get(c.getString(0));if(s!=null)s.buckets.add(new ListeningContext.Bucket(c.getString(1),c.getInt(2),c.getInt(3),c.getString(4),c.getLong(5)));}
        }return result;
    }
    public synchronized ListeningHabits.Ranker ranker(long revision,List<ListeningHabits.Session> sessions,long now){
        try(Cursor c=getReadableDatabase().rawQuery("SELECT weights,learned FROM habit_ranker WHERE id=1 AND revision=?",new String[]{""+revision})){
            if(c.moveToFirst())try{org.json.JSONArray values=new org.json.JSONArray(c.getString(0));ListeningHabits.Ranker ranker=new ListeningHabits.Ranker();if(values.length()!=ranker.weights.length)throw new IllegalArgumentException();for(int i=0;i<ranker.weights.length;i++){double w=values.getDouble(i);if(!Double.isFinite(w)||w<.02||w>.5)throw new IllegalArgumentException();ranker.weights[i]=w;}ranker.learned=c.getInt(1)!=0;return ranker;}catch(Exception corrupt){/* rebuild from bounded local history */}
        }
        ListeningHabits.Ranker ranker=ListeningHabits.train(sessions,now);org.json.JSONArray weights=new org.json.JSONArray();for(double weight:ranker.weights)weights.put((Object)weight);
        ContentValues v=new ContentValues();v.put("id",1);v.put("revision",revision);v.put("weights",weights.toString());v.put("learned",ranker.learned?1:0);getWritableDatabase().insertWithOnConflict("habit_ranker",null,v,SQLiteDatabase.CONFLICT_REPLACE);return ranker;
    }
    public synchronized void recoverSessions(){SQLiteDatabase db=getWritableDatabase();db.execSQL("UPDATE sessions SET reason='interruption' WHERE reason='open'");db.execSQL("UPDATE habit_revision SET revision=revision+1 WHERE id=1");prune(System.currentTimeMillis());}
    public synchronized void pruneHistory(long now){prune(now);}
    private boolean prune(long now){
        SQLiteDatabase db=getWritableDatabase();int removed=db.delete("sessions","started<?",new String[]{""+(now-180L*86400000)});
        try(Cursor c=db.rawQuery("SELECT COUNT(*) FROM sessions",null)){if(c.moveToFirst()&&c.getInt(0)>20000)removed++;}
        db.execSQL("DELETE FROM sessions WHERE id IN (SELECT id FROM sessions ORDER BY started DESC,id DESC LIMIT -1 OFFSET 20000)");
        try(Cursor c=db.rawQuery("SELECT COUNT(*) FROM listening_context",null)){if(c.moveToFirst()&&c.getInt(0)>80000){db.execSQL("DELETE FROM listening_context WHERE rowid IN (SELECT rowid FROM listening_context ORDER BY local_day DESC LIMIT -1 OFFSET 80000)");removed++;}}
        if(removed>0)db.execSQL("UPDATE habit_revision SET revision=revision+1 WHERE id=1");
        return removed>0;
    }
    public synchronized String latestSnapshot(){
        try(Cursor c=getReadableDatabase().rawQuery("SELECT json FROM snapshots WHERE id=1",null)){return c.moveToFirst()?c.getString(0):null;}
    }
    public synchronized String cached(String key){
        try(Cursor cursor=getReadableDatabase().rawQuery("SELECT json FROM snapshots WHERE id=1 AND cache_key=?",new String[]{key})){return cursor.moveToFirst()?cursor.getString(0):null;}
    }
    public synchronized void cache(String key,String json,List<TasteRanker.Mix> mixes){
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try{
            ContentValues values=new ContentValues();values.put("id",1);values.put("cache_key",key);values.put("json",json);db.insertWithOnConflict("snapshots",null,values,SQLiteDatabase.CONFLICT_REPLACE);
            db.delete("profiles",null,null);for(int i=0;i<mixes.size();i++){ContentValues p=new ContentValues();p.put("id",i);p.put("embedding",blob(mixes.get(i).profile));p.put("updated",System.currentTimeMillis());db.insertOrThrow("profiles",null,p);}
            db.setTransactionSuccessful();
        }finally{db.endTransaction();}
    }
    public synchronized void clearHistory(){SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{db.delete("sessions",null,null);db.delete("profiles",null,null);db.delete("snapshots",null,null);db.delete("habit_ranker",null,null);db.execSQL("UPDATE habit_revision SET revision=revision+1 WHERE id=1");db.setTransactionSuccessful();}finally{db.endTransaction();}}
    public synchronized void clearAnalysis(){SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{db.delete("tracks",null,null);db.delete("profiles",null,null);db.delete("snapshots",null,null);db.delete("habit_ranker",null,null);db.execSQL("UPDATE habit_revision SET revision=revision+1 WHERE id=1");db.setTransactionSuccessful();}finally{db.endTransaction();}}
    public static byte[] blob(float[] vector){ByteBuffer buffer=ByteBuffer.allocate(vector.length*4).order(ByteOrder.LITTLE_ENDIAN);buffer.asFloatBuffer().put(vector);return buffer.array();}
    public static float[] vector(byte[] blob){if(blob==null||blob.length!=960*4)throw new IllegalArgumentException("Invalid FP32 embedding");float[] vector=new float[960];ByteBuffer.wrap(blob).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(vector);return vector;}
}
