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
    public RecommendationStore(Context context){super(context,"personal-mixes.db",null,1);setWriteAheadLoggingEnabled(true);}
    @Override public void onConfigure(SQLiteDatabase db){db.setForeignKeyConstraintsEnabled(true);}
    @Override public void onCreate(SQLiteDatabase db){
        db.execSQL("CREATE TABLE tracks(id INTEGER PRIMARY KEY,identity TEXT NOT NULL,fingerprint TEXT NOT NULL,title TEXT,artist TEXT,album TEXT,duration INTEGER,added INTEGER,eligible INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'pending',error TEXT,embedding BLOB)");
        db.execSQL("CREATE TABLE segments(track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,section INTEGER NOT NULL,start_ms INTEGER NOT NULL,embedding BLOB NOT NULL,PRIMARY KEY(track_id,section))");
        db.execSQL("CREATE TABLE sessions(id TEXT PRIMARY KEY,track_id INTEGER NOT NULL,started INTEGER NOT NULL,ended INTEGER,played INTEGER NOT NULL DEFAULT 0,covered INTEGER NOT NULL DEFAULT 0,maximum_position INTEGER NOT NULL DEFAULT 0,duration INTEGER NOT NULL,reason TEXT NOT NULL DEFAULT 'open',entry_reason TEXT NOT NULL DEFAULT 'play',early_next INTEGER NOT NULL DEFAULT 0)");
        db.execSQL("CREATE INDEX sessions_track_started ON sessions(track_id,started)");
        db.execSQL("CREATE TABLE profiles(id INTEGER PRIMARY KEY,embedding BLOB NOT NULL,updated INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE snapshots(id INTEGER PRIMARY KEY CHECK(id=1),cache_key TEXT NOT NULL,json TEXT NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db,int from,int to){throw new IllegalStateException("Unsupported recommendation database version");}
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
    /** Capped per-day signals prevent a repeated song from dominating a profile. */
    public synchronized Map<Long,double[]> affinity(long now){
        Map<Long,double[]> out=new HashMap<>();
        String query="SELECT track_id,started/86400000,MIN(3,SUM(CASE WHEN reason!='open' AND covered>=MIN(duration*0.7,120000) AND played>=10000 THEN 1 ELSE 0 END)),MIN(2,SUM(early_next)),MAX(ended) FROM sessions WHERE started>=? AND played>0 GROUP BY track_id,started/86400000";
        try(Cursor c=getReadableDatabase().rawQuery(query,new String[]{""+(now-180L*86400000)})){
            while(c.moveToNext()){
                double[] a=out.computeIfAbsent(c.getLong(0),key->new double[3]);
                double age=Math.max(0,now-c.getLong(4))/86400000d;
                a[0]+=c.getDouble(2)*Math.exp(-age/45);a[1]+=c.getDouble(3)*Math.exp(-age/30);
                a[2]=Math.max(a[2],Math.exp(-age/2));
            }
        }return out;
    }
    public synchronized void session(String id,long track,long started,long duration,ListeningClock clock,String reason,boolean early,String entryReason){
        ContentValues values=new ContentValues();values.put("id",id);values.put("track_id",track);values.put("started",started);values.put("duration",duration);
        values.put("played",clock.playedMs);values.put("covered",clock.coveredMs);values.put("maximum_position",clock.maximumPosition);values.put("reason",reason);values.put("entry_reason",entryReason);
        values.put("ended",System.currentTimeMillis());values.put("early_next",early?1:0);
        getWritableDatabase().insertWithOnConflict("sessions",null,values,SQLiteDatabase.CONFLICT_REPLACE);
        prune(System.currentTimeMillis());
    }
    public synchronized void recoverSessions(){getWritableDatabase().execSQL("UPDATE sessions SET reason='interruption' WHERE reason='open'");prune(System.currentTimeMillis());}
    private void prune(long now){
        SQLiteDatabase db=getWritableDatabase();db.delete("sessions","started<?",new String[]{""+(now-180L*86400000)});
        db.execSQL("DELETE FROM sessions WHERE id IN (SELECT id FROM sessions ORDER BY started DESC,id DESC LIMIT -1 OFFSET 20000)");
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
    public synchronized void clearHistory(){SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{db.delete("sessions",null,null);db.delete("profiles",null,null);db.delete("snapshots",null,null);db.setTransactionSuccessful();}finally{db.endTransaction();}}
    public synchronized void clearAnalysis(){SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{db.delete("tracks",null,null);db.delete("profiles",null,null);db.delete("snapshots",null,null);db.setTransactionSuccessful();}finally{db.endTransaction();}}
    public static byte[] blob(float[] vector){ByteBuffer buffer=ByteBuffer.allocate(vector.length*4).order(ByteOrder.LITTLE_ENDIAN);buffer.asFloatBuffer().put(vector);return buffer.array();}
    public static float[] vector(byte[] blob){if(blob==null||blob.length!=960*4)throw new IllegalArgumentException("Invalid FP32 embedding");float[] vector=new float[960];ByteBuffer.wrap(blob).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(vector);return vector;}
}
