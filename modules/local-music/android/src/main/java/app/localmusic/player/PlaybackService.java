package app.localmusic.player;

import app.localmusic.engine.R;
import android.app.*;
import android.content.*;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.*;
import androidx.media3.common.*;
import androidx.media3.exoplayer.*;
import androidx.media3.exoplayer.audio.*;
import org.json.*;
import java.util.*;

/** Main-thread playlist/session owner. Media3 owns decoding, gapless sequencing and audio focus. */
@androidx.annotation.OptIn(markerClass=androidx.media3.common.util.UnstableApi.class)
public class PlaybackService extends Service {
    public static final String CHANGED="app.localmusic.player.CHANGED";
    private final IBinder binder=new LocalBinder();
    public class LocalBinder extends Binder { public PlaybackService service(){return PlaybackService.this;} }
    public final ArrayList<Song> queue=new ArrayList<>();
    public int index=-1,repeat=0;
    public boolean shuffle=false;
    private ExoPlayer player;
    private MediaSession session;
    private Library library;
    private SoundSettings sound;
    private final MusicAudioProcessor processor=new MusicAudioProcessor();
    private boolean foreground=false,closing=false;
    private float speed=1,pitch=0;
    private long sleepAt=0,lastSave=0;
    private int failures=0;
    private String error="";
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable tick=new Runnable(){public void run(){
        if(sleepAt>0){long remaining=sleepRemaining();if(remaining==0){sleepAt=0;pause();}else player.setVolume(library.prefs().getBoolean("sleepFade",true)?Math.min(1,remaining/15000f):1);}
        if(playing()&&SystemClock.elapsedRealtime()-lastSave>5000){save();lastSave=SystemClock.elapsedRealtime();}
        handler.postDelayed(this,500);
    }};
    @Override public void onCreate(){
        super.onCreate();library=new Library(this);
        try{sound=new SoundSettings(new JSONObject(library.prefs().getString("soundV2","{}")));}catch(JSONException e){sound=new SoundSettings();}
        processor.update(sound.parameters());
        DefaultRenderersFactory renderers=new DefaultRenderersFactory(this){
            @Override protected AudioSink buildAudioSink(Context c,boolean floats,boolean params){
                AudioSink sink=new DefaultAudioSink.Builder(c).setEnableFloatOutput(false).setAudioProcessorChain(processor.chain()).build();
                return new ForwardingAudioSink(sink){
                    @Override public boolean supportsFormat(Format format){return MimeTypes.AUDIO_RAW.equals(format.sampleMimeType)&&super.supportsFormat(format);}
                    @Override public int getFormatSupport(Format format){return MimeTypes.AUDIO_RAW.equals(format.sampleMimeType)?super.getFormatSupport(format):AudioSink.SINK_FORMAT_UNSUPPORTED;}
                };
            }
        };
        player=new ExoPlayer.Builder(this,renderers).setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),true)
            .setHandleAudioBecomingNoisy(library.prefs().getBoolean("pauseDisconnect",true)).setWakeMode(C.WAKE_MODE_LOCAL).build();
        player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon().setAudioOffloadPreferences(new TrackSelectionParameters.AudioOffloadPreferences.Builder().setAudioOffloadMode(TrackSelectionParameters.AudioOffloadPreferences.AUDIO_OFFLOAD_MODE_DISABLED).build()).build());
        repeat=library.prefs().getInt("repeat",0);shuffle=library.prefs().getBoolean("shuffle",false);
        speed=library.prefs().getFloat("speed",1);pitch=library.prefs().getFloat("pitch",0);
        applyPlayback();player.setShuffleModeEnabled(shuffle);applyRepeat();
        player.setSkipSilenceEnabled(library.prefs().getBoolean("skipSilence",false));
        NotificationChannel ch=new NotificationChannel("playback","Music playback",NotificationManager.IMPORTANCE_LOW);ch.setShowBadge(false);getSystemService(NotificationManager.class).createNotificationChannel(ch);
        session=new MediaSession(this,"Aiplayed");session.setCallback(new MediaSession.Callback(){
            @Override public void onPlay(){resume();} @Override public void onPause(){pause();}
            @Override public void onSkipToNext(){next(true);} @Override public void onSkipToPrevious(){previous();}
            @Override public void onSeekTo(long pos){seek((int)Math.min(Integer.MAX_VALUE,pos));} @Override public void onStop(){pause();stopSelf();}
        });session.setActive(true);
        player.addListener(new Player.Listener(){
            @Override public void onMediaItemTransition(MediaItem item,int reason){index=queue.isEmpty()?-1:player.getCurrentMediaItemIndex();if(player.getPlayWhenReady()&&current()!=null)library.record(current());save();publish();}
            @Override public void onPlaybackStateChanged(int state){if(state==Player.STATE_READY){failures=0;error="";}if(state==Player.STATE_ENDED)pause();else publish();}
            @Override public void onIsPlayingChanged(boolean playing){if(playing){ensureForeground();if(current()!=null)library.record(current());}publish();}
            @Override public void onPlayWhenReadyChanged(boolean value,int reason){if(!value&&foreground&&!loading()){stopForeground(STOP_FOREGROUND_DETACH);foreground=false;}publish();}
            @Override public void onPlayerError(PlaybackException e){
                error="Couldn't play this file. It may be missing or unsupported.";
                sendBroadcast(new Intent(CHANGED).setPackage(getPackageName()).putExtra("error",error));
                if(++failures<Math.min(3,queue.size()))handler.post(()->{if(!closing&&!queue.isEmpty()){player.seekToDefaultPosition((index+1)%queue.size());player.prepare();player.play();}});
                else {player.pause();if(foreground){stopForeground(STOP_FOREGROUND_REMOVE);foreground=false;}publish();}
            }
        });
        queue.addAll(library.loadQueue());
        if(!queue.isEmpty()){index=Math.min(Math.max(0,library.prefs().getInt("index",0)),queue.size()-1);player.setMediaItems(items(queue),index,Math.max(0,library.prefs().getInt("position",0)));player.prepare();}
        handler.post(tick);publish();
    }
    private MediaItem item(Song s){return new MediaItem.Builder().setUri(s.uri()).setMediaId(Long.toString(s.id)).setMediaMetadata(new androidx.media3.common.MediaMetadata.Builder().setTitle(s.title).setArtist(s.artist).setAlbumTitle(s.album).setArtworkUri(s.art()).build()).build();}
    private List<MediaItem> items(List<Song> songs){ArrayList<MediaItem> result=new ArrayList<>();for(Song s:songs)result.add(item(s));return result;}
    @Override public IBinder onBind(Intent i){return binder;}
    @Override public int onStartCommand(Intent i,int flags,int id){
        if(i!=null){String a=i.getAction();if("pause".equals(a))pause();else if("next".equals(a))next(true);else if("previous".equals(a))previous();else if("play".equals(a))resume();else if("foreground".equals(a))ensureForeground();else if(Intent.ACTION_MEDIA_BUTTON.equals(a)){android.view.KeyEvent key=i.getParcelableExtra(Intent.EXTRA_KEY_EVENT);if(key!=null)session.getController().dispatchMediaButtonEvent(key);}}
        return START_NOT_STICKY;
    }
    public Song current(){return index>=0&&index<queue.size()?queue.get(index):null;}
    public boolean playing(){return player!=null&&player.isPlaying();}
    public boolean loading(){return player!=null&&player.getPlaybackState()==Player.STATE_BUFFERING;}
    public int position(){return player==null?0:(int)Math.min(Integer.MAX_VALUE,Math.max(0,player.getCurrentPosition()));}
    public int duration(){long d=player==null?C.TIME_UNSET:player.getDuration();return (int)Math.min(Integer.MAX_VALUE,d==C.TIME_UNSET?current()==null?0:current().duration:Math.max(0,d));}
    public void play(List<Song> songs,int at){if(songs.isEmpty())return;ensureForeground();queue.clear();queue.addAll(songs);index=Math.max(0,Math.min(at,queue.size()-1));failures=0;player.setMediaItems(items(queue),index,0);player.prepare();player.play();save();publish();}
    public void resume(){if(current()==null)return;ensureForeground();if(player.getPlaybackState()==Player.STATE_ENDED)player.seekTo(0);if(player.getPlaybackState()==Player.STATE_IDLE)player.prepare();player.play();publish();}
    public void pause(){player.pause();player.setVolume(1);save();if(foreground){stopForeground(STOP_FOREGROUND_DETACH);foreground=false;}publish();}
    public void toggle(){if(playing()||(loading()&&player.getPlayWhenReady()))pause();else resume();}
    public void seek(int ms){player.seekTo(Math.max(0,Math.min(ms,duration())));save();publish();}
    public void next(boolean manual){if(queue.isEmpty())return;ensureForeground();if(player.hasNextMediaItem())player.seekToNextMediaItem();else player.seekToDefaultPosition(0);player.play();publish();}
    public void previous(){if(queue.isEmpty())return;if(position()>3000)seek(0);else if(player.hasPreviousMediaItem())player.seekToPreviousMediaItem();else player.seekToDefaultPosition(queue.size()-1);resume();}
    public void jump(int at){if(at<0||at>=queue.size())return;ensureForeground();player.seekToDefaultPosition(at);player.play();publish();}
    public void enqueue(Song s,boolean next){int at=next?Math.max(0,index+1):queue.size();queue.add(at,s);player.addMediaItem(at,item(s));if(index<0){index=0;player.prepare();}save();publish();}
    public void removeQueue(int at){if(at<0||at>=queue.size())return;queue.remove(at);player.removeMediaItem(at);index=queue.isEmpty()?-1:player.getCurrentMediaItemIndex();if(queue.isEmpty()){pause();getSystemService(NotificationManager.class).cancel(7);}save();publish();}
    public void moveQueue(int from,int to){if(from<0||to<0||from>=queue.size()||to>=queue.size())return;Song song=queue.remove(from);queue.add(to,song);player.moveMediaItem(from,to);index=player.getCurrentMediaItemIndex();save();publish();}
    public void setShuffle(boolean v){shuffle=v;player.setShuffleModeEnabled(v);library.prefs().edit().putBoolean("shuffle",v).apply();publish();}
    private void applyRepeat(){player.setRepeatMode(repeat==1?Player.REPEAT_MODE_ALL:repeat==2?Player.REPEAT_MODE_ONE:Player.REPEAT_MODE_OFF);}
    public void setRepeat(int v){repeat=Math.max(0,Math.min(2,v));applyRepeat();library.prefs().edit().putInt("repeat",repeat).apply();publish();}
    public float speed(){return speed;}
    public float pitch(){return pitch;}
    public void setSpeed(float v){speed=(float)DspCore.clamp(v,.5,2);library.prefs().edit().putFloat("speed",speed).apply();applyPlayback();publish();}
    public void setPitch(float v){pitch=(float)DspCore.clamp(v,-12,12);library.prefs().edit().putFloat("pitch",pitch).apply();applyPlayback();publish();}
    private void applyPlayback(){player.setPlaybackParameters(new PlaybackParameters(speed,(float)Math.pow(2,pitch/12)));}
    public void setSkipSilence(boolean value){player.setSkipSilenceEnabled(value);library.prefs().edit().putBoolean("skipSilence",value).apply();publish();}
    public void setPauseDisconnect(boolean value){player.setHandleAudioBecomingNoisy(value);library.prefs().edit().putBoolean("pauseDisconnect",value).apply();publish();}
    public void sleep(int minutes){sleepAt=minutes<=0?0:SystemClock.elapsedRealtime()+minutes*60000L;player.setVolume(1);publish();}
    public long sleepRemaining(){return sleepAt==0?0:Math.max(0,sleepAt-SystemClock.elapsedRealtime());}
    public JSONObject sound(){return sound.json();}
    public void updateSound(JSONObject patch)throws JSONException{sound.patch(patch);commitSound();}
    public void resetSound(){sound=new SoundSettings();commitSound();}
    private void commitSound(){library.prefs().edit().putString("soundV2",sound.json().toString()).apply();processor.update(sound.parameters());publish();}
    public JSONObject savedProfiles(){try{return new JSONObject(library.prefs().getString("soundProfiles","{}"));}catch(JSONException e){return new JSONObject();}}
    public void saveProfile(String name)throws JSONException{validateProfile(name);for(String builtin:SoundSettings.PRESET_NAMES)if(builtin.equals(name))throw new JSONException("Choose a different preset name");JSONObject profiles=savedProfiles();if(profiles.length()>=20&&!profiles.has(name))throw new JSONException("Remove a preset before adding another");profiles.put(name,sound.json());library.prefs().edit().putString("soundProfiles",profiles.toString()).apply();publish();}
    private void validateProfile(String name)throws JSONException{if(name.trim().isEmpty()||name.length()>40)throw new JSONException("Use a preset name between 1 and 40 characters");}
    public void applyProfile(String name)throws JSONException{JSONObject profiles=savedProfiles();if(profiles.has(name))updateSound(profiles.getJSONObject(name));else updateSound(SoundSettings.preset(name));}
    public void deleteProfile(String name){JSONObject profiles=savedProfiles();profiles.remove(name);library.prefs().edit().putString("soundProfiles",profiles.toString()).apply();publish();}
    public JSONObject soundStatus(){JSONObject result=new JSONObject();try{DspCore core=processor.metrics();Format format=player.getAudioFormat();result.put("active",core!=null).put("sampleRate",processor.sampleRate).put("channels",processor.channels).put("outputBits",16)
        .put("headroomDb",core==null?0:core.headroomDb).put("limiterReductionDb",core==null?0:core.limiterReductionDb).put("compressionReductionDb",core==null?0:core.compressionReductionDb).put("peakDb",core==null?-160:DspCore.gainToDb(core.outputPeak))
        .put("codec",format==null?"":format.sampleMimeType).put("bitrate",format==null?0:format.bitrate).put("sourceChannels",format==null?0:format.channelCount); }catch(JSONException ignored){}return result;}
    private void save(){if(library!=null)library.saveQueue(queue,index,position());}
    private PendingIntent action(String a){return PendingIntent.getService(this,a.hashCode(),new Intent(this,PlaybackService.class).setAction(a),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    private Notification notification(){Song s=current();Intent open=getPackageManager().getLaunchIntentForPackage(getPackageName());PendingIntent pi=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this,"playback").setSmallIcon(R.drawable.ic_note).setContentTitle(s==null?"Aiplayed":s.title).setContentText(s==null?"Your music, offline":s.artist).setContentIntent(pi).setVisibility(Notification.VISIBILITY_PUBLIC).setOnlyAlertOnce(true).setOngoing(playing()).setCategory(Notification.CATEGORY_TRANSPORT)
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous,"Previous",action("previous")).build())
            .addAction(new Notification.Action.Builder(playing()?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play,playing()?"Pause":"Play",action(playing()?"pause":"play")).build())
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next,"Next",action("next")).build()).setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0,1,2)).build();}
    private void ensureForeground(){if(!foreground){startForeground(7,notification());foreground=true;}}
    private void publish(){if(closing||session==null)return;Song s=current();if(s!=null)session.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,s.title).putString(MediaMetadata.METADATA_KEY_ARTIST,s.artist).putString(MediaMetadata.METADATA_KEY_ALBUM,s.album).putLong(MediaMetadata.METADATA_KEY_DURATION,duration()).build());
        int state=loading()?PlaybackState.STATE_BUFFERING:playing()?PlaybackState.STATE_PLAYING:PlaybackState.STATE_PAUSED;
        session.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_PLAY_PAUSE|PlaybackState.ACTION_SKIP_TO_NEXT|PlaybackState.ACTION_SKIP_TO_PREVIOUS|PlaybackState.ACTION_SEEK_TO|PlaybackState.ACTION_STOP).setState(state,position(),playing()?speed:0).build());
        if(s!=null&&(foreground||player.getPlaybackState()!=Player.STATE_IDLE))getSystemService(NotificationManager.class).notify(7,notification());sendBroadcast(new Intent(CHANGED).setPackage(getPackageName()));}
    @Override public void onDestroy(){closing=true;save();handler.removeCallbacksAndMessages(null);player.release();session.release();getSystemService(NotificationManager.class).cancel(7);super.onDestroy();}
}
