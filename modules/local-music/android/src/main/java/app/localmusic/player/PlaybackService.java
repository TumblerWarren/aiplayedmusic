package app.localmusic.player;

import app.localmusic.engine.R;

import android.app.*;
import android.content.*;
import android.media.*;
import android.media.audiofx.Equalizer;
import android.media.session.*;
import android.os.*;
import java.util.*;

public class PlaybackService extends Service {
    public static final String CHANGED="app.localmusic.player.CHANGED";
    private final IBinder binder=new LocalBinder();
    public class LocalBinder extends Binder { public PlaybackService service(){return PlaybackService.this;} }
    public final ArrayList<Song> queue=new ArrayList<>();
    public int index=-1,repeat=0;
    public boolean shuffle=false;
    private MediaPlayer player;
    private Equalizer equalizer;
    private MediaSession session;
    private AudioManager audio;
    private AudioFocusRequest focus;
    private Library library;
    private boolean ready=false, resumeOnFocus=false, foreground=false, loading=false, playWhenReady=false;
    private float speed=1f;
    private long sleepAt=0;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Random random=new Random();
    private int pendingSeek=0, failures=0;
    private final ArrayDeque<Integer> history=new ArrayDeque<>();
    private final BroadcastReceiver noisy=new BroadcastReceiver(){public void onReceive(Context c,Intent i){if(library.prefs().getBoolean("pauseDisconnect",true))pause();}};
    private final Runnable tick=new Runnable(){public void run(){if(sleepAt>0&&SystemClock.elapsedRealtime()>=sleepAt){sleepAt=0;pause();} if(playing()) library.prefs().edit().putInt("position",position()).apply(); handler.postDelayed(this,1000);}};

    @Override public void onCreate(){
        super.onCreate(); library=new Library(this); audio=(AudioManager)getSystemService(AUDIO_SERVICE);
        repeat=library.prefs().getInt("repeat",0); shuffle=library.prefs().getBoolean("shuffle",false); speed=library.prefs().getFloat("speed",1f);
        queue.addAll(library.loadQueue()); index=queue.isEmpty()?-1:Math.min(Math.max(0,library.prefs().getInt("index",0)),queue.size()-1); pendingSeek=library.prefs().getInt("position",0);
        NotificationChannel ch=new NotificationChannel("playback","Music playback",NotificationManager.IMPORTANCE_LOW); ch.setShowBadge(false); getSystemService(NotificationManager.class).createNotificationChannel(ch);
        session=new MediaSession(this,"LocalMusic"); session.setCallback(new MediaSession.Callback(){
            @Override public void onPlay(){resume();} @Override public void onPause(){pause();} @Override public void onSkipToNext(){next(true);} @Override public void onSkipToPrevious(){previous();}
            @Override public void onSeekTo(long pos){seek((int)pos);} @Override public void onStop(){pause();stopSelf();}
        }); session.setActive(true);
        focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()).setOnAudioFocusChangeListener(change->{
            if(change==AudioManager.AUDIOFOCUS_LOSS){resumeOnFocus=false;pause();}
            else if(change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT){boolean was=playing()||playWhenReady;pauseInternal(false);resumeOnFocus=was;}
            else if(change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK){if(player!=null)player.setVolume(.2f,.2f);}
            else if(change==AudioManager.AUDIOFOCUS_GAIN){if(player!=null)player.setVolume(1,1);if(resumeOnFocus){resumeOnFocus=false;resume();}}
        }).build();
        if(Build.VERSION.SDK_INT>=33)registerReceiver(noisy,new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY),Context.RECEIVER_NOT_EXPORTED); else registerReceiver(noisy,new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
        handler.post(tick); publish();
    }
    @Override public IBinder onBind(Intent i){return binder;}
    @Override public int onStartCommand(Intent i,int flags,int id){
        if(i!=null){String a=i.getAction();if("pause".equals(a))pause();else if("next".equals(a))next(true);else if("previous".equals(a))previous();else if("play".equals(a))resume();else if("foreground".equals(a))ensureForeground();else if(Intent.ACTION_MEDIA_BUTTON.equals(a)){android.view.KeyEvent key=i.getParcelableExtra(Intent.EXTRA_KEY_EVENT);if(key!=null&&key.getAction()==0){if(key.getKeyCode()==android.view.KeyEvent.KEYCODE_MEDIA_NEXT)next(true);else if(key.getKeyCode()==android.view.KeyEvent.KEYCODE_MEDIA_PREVIOUS)previous();else toggle();}}}
        return START_NOT_STICKY;
    }
    public Song current(){return index>=0&&index<queue.size()?queue.get(index):null;}
    public boolean playing(){try{return ready&&player!=null&&player.isPlaying();}catch(Exception e){return false;}}
    public boolean loading(){return loading;}
    public int position(){try{return ready&&player!=null?player.getCurrentPosition():pendingSeek;}catch(Exception e){return 0;}}
    public int duration(){try{return ready&&player!=null?player.getDuration():(current()==null?0:(int)current().duration);}catch(Exception e){return 0;}}
    public void play(List<Song> songs,int at){if(songs.isEmpty())return;queue.clear();queue.addAll(songs);index=Math.max(0,Math.min(at,queue.size()-1));history.clear();pendingSeek=0;failures=0;load(true);}
    private void releasePlayer(){ready=false;loading=false;if(equalizer!=null){equalizer.release();equalizer=null;}if(player!=null){player.release();player=null;}}
    private void load(boolean autoplay){
        Song s=current(); if(s==null)return; releasePlayer();
        playWhenReady=autoplay;if(autoplay)ensureForeground(); loading=true;
        try{
            player=new MediaPlayer(); player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            player.setWakeMode(this,PowerManager.PARTIAL_WAKE_LOCK);player.setDataSource(this,s.uri());
            player.setOnPreparedListener(mp->{ready=true;loading=false;failures=0;if(pendingSeek>0){mp.seekTo(pendingSeek);pendingSeek=0;}applyEqualizer();applySpeed();if(playWhenReady&&audio.requestAudioFocus(focus)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED){mp.start();library.record(s);}save();publish();});
            player.setOnCompletionListener(mp->{if(repeat==2){seek(0);mp.start();publish();}else next(false);});
            player.setOnErrorListener((mp,what,extra)->{failed();return true;});player.prepareAsync();publish();
        }catch(Exception e){failed();}
    }
    private void failed(){releasePlayer();sendBroadcast(new Intent(CHANGED).setPackage(getPackageName()).putExtra("error","Couldn't play this file. It may be missing or unsupported."));if(++failures<Math.min(3,queue.size())){index=(index+1)%queue.size();pendingSeek=0;handler.post(()->load(true));}else {publish();if(foreground){stopForeground(STOP_FOREGROUND_REMOVE);foreground=false;}}}
    public void resume(){if(current()==null)return;playWhenReady=true;ensureForeground();if(!ready){if(!loading)load(true);return;}if(audio.requestAudioFocus(focus)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED){try{player.start();library.record(current());}catch(Exception e){load(true);}}publish();}
    public void pause(){pauseInternal(true);}
    private void pauseInternal(boolean abandon){resumeOnFocus=false;playWhenReady=false;if(playing())player.pause();save();if(abandon)audio.abandonAudioFocusRequest(focus);publish();if(foreground){stopForeground(STOP_FOREGROUND_DETACH);foreground=false;}}
    public void toggle(){if(playing()||(loading&&playWhenReady))pause();else resume();}
    public void seek(int ms){pendingSeek=Math.max(0,ms);if(ready){player.seekTo(Math.min(pendingSeek,duration()));pendingSeek=0;}save();publish();}
    public void next(boolean manual){
        if(queue.isEmpty())return;history.push(index);if(shuffle&&queue.size()>1){int n;do{n=random.nextInt(queue.size());}while(n==index);index=n;}
        else if(index+1<queue.size())index++;else if(repeat==1||manual)index=0;else{pause();seek(0);return;}
        pendingSeek=0;load(true);
    }
    public void previous(){if(position()>3000){seek(0);return;}if(!history.isEmpty())index=history.pop();else index=(index-1+queue.size())%Math.max(1,queue.size());pendingSeek=0;load(true);}
    public void jump(int at){if(at<0||at>=queue.size())return;index=at;pendingSeek=0;load(true);}
    public void enqueue(Song s,boolean next){if(next)queue.add(Math.max(0,index+1),s);else queue.add(s);if(index<0)index=0;save();publish();}
    public void removeQueue(int at){if(at<0||at>=queue.size())return;boolean active=at==index;queue.remove(at);if(queue.isEmpty()){playWhenReady=false;releasePlayer();index=-1;audio.abandonAudioFocusRequest(focus);if(foreground){stopForeground(STOP_FOREGROUND_REMOVE);foreground=false;}getSystemService(NotificationManager.class).cancel(7);}else{if(at<index)index--;else if(index>=queue.size())index=0;if(active){pendingSeek=0;load(true);}}history.clear();save();publish();}
    public void moveQueue(int from,int to){if(from<0||to<0||from>=queue.size()||to>=queue.size())return;Song active=current();Collections.swap(queue,from,to);index=queue.indexOf(active);history.clear();save();publish();}
    public void setShuffle(boolean v){shuffle=v;library.prefs().edit().putBoolean("shuffle",v).apply();publish();}
    public void setRepeat(int v){repeat=v;library.prefs().edit().putInt("repeat",v).apply();publish();}
    public float speed(){return speed;}
    public void setSpeed(float v){speed=v;library.prefs().edit().putFloat("speed",v).apply();applySpeed();publish();}
    private void applySpeed(){try{if(ready){boolean wasPlaying=playing();player.setPlaybackParams(new PlaybackParams().setSpeed(speed).setPitch(1f));if(!wasPlaying)player.pause();}}catch(Exception ignored){}}
    public void sleep(int minutes){sleepAt=minutes<=0?0:SystemClock.elapsedRealtime()+minutes*60000L;publish();}
    public long sleepRemaining(){return sleepAt==0?0:Math.max(0,sleepAt-SystemClock.elapsedRealtime());}
    public Equalizer equalizer(){return equalizer;}
    public void applyEqualizer(){if(!ready)return;try{if(equalizer==null)equalizer=new Equalizer(0,player.getAudioSessionId());equalizer.setEnabled(library.prefs().getBoolean("eqEnabled",false));short[] range=equalizer.getBandLevelRange();for(short b=0;b<equalizer.getNumberOfBands();b++){short level=(short)library.prefs().getInt("eq"+b,0);equalizer.setBandLevel(b,(short)Math.max(range[0],Math.min(range[1],level)));}}catch(Exception e){if(equalizer!=null){equalizer.release();equalizer=null;}}}
    private void save(){library.saveQueue(queue,index,position());}
    private PendingIntent action(String a){return PendingIntent.getService(this,a.hashCode(),new Intent(this,PlaybackService.class).setAction(a),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    private Notification notification(){
        Song s=current();Intent open=getPackageManager().getLaunchIntentForPackage(getPackageName());if(open==null)open=new Intent(this,NativeMusicActivity.class);PendingIntent pi=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this,"playback").setSmallIcon(R.drawable.ic_note).setContentTitle(s==null?"Music":s.title).setContentText(s==null?"Your music, offline":s.artist).setContentIntent(pi).setVisibility(Notification.VISIBILITY_PUBLIC).setOnlyAlertOnce(true).setOngoing(playing()).setCategory(Notification.CATEGORY_TRANSPORT)
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous,"Previous",action("previous")).build())
            .addAction(new Notification.Action.Builder(playing()?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play,playing()?"Pause":"Play",action(playing()?"pause":"play")).build())
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next,"Next",action("next")).build())
            .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0,1,2)).build();
    }
    private void ensureForeground(){if(!foreground){startForeground(7,notification());foreground=true;}}
    private void publish(){
        Song s=current();if(s!=null)session.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,s.title).putString(MediaMetadata.METADATA_KEY_ARTIST,s.artist).putString(MediaMetadata.METADATA_KEY_ALBUM,s.album).putLong(MediaMetadata.METADATA_KEY_DURATION,duration()).build());
        session.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_PLAY_PAUSE|PlaybackState.ACTION_SKIP_TO_NEXT|PlaybackState.ACTION_SKIP_TO_PREVIOUS|PlaybackState.ACTION_SEEK_TO|PlaybackState.ACTION_STOP).setState(loading?PlaybackState.STATE_BUFFERING:playing()?PlaybackState.STATE_PLAYING:PlaybackState.STATE_PAUSED,position(),playing()?speed:0).build());
        if(s!=null&&(foreground||ready))getSystemService(NotificationManager.class).notify(7,notification());
        sendBroadcast(new Intent(CHANGED).setPackage(getPackageName()));
    }
    @Override public void onDestroy(){save();handler.removeCallbacksAndMessages(null);unregisterReceiver(noisy);audio.abandonAudioFocusRequest(focus);releasePlayer();session.release();getSystemService(NotificationManager.class).cancel(7);super.onDestroy();}
}
