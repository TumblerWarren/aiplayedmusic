package app.localmusic.player

import android.content.*
import android.os.*
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

/** Expo bridge; all player/service operations stay on Android's main thread. */
class LocalMusicModule : Module() {
  private var playback: PlaybackService? = null
  private var bound = false
  private var registered = false
  private var sequence = 0L
  private var previewAllowed = true
  private val handler = Handler(Looper.getMainLooper())
  private val pending = mutableListOf<Promise>()
  private val context: Context get() = requireNotNull(appContext.reactContext) { "React context unavailable" }
  private val library: Library get() = Library(context)
  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName, binder: IBinder) {
      playback = (binder as PlaybackService.LocalBinder).service()
      val waiting = pending.toList(); pending.clear()
      waiting.forEach { it.resolve(snapshot()) }
    }
    override fun onServiceDisconnected(name: ComponentName) { playback = null }
  }
  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
      intent.getStringExtra("error")?.let { sendEvent("onError", mapOf("message" to it)) }
      if (playback != null) sendEvent("onChange", mapOf("json" to snapshot()))
    }
  }

  override fun definition() = ModuleDefinition {
    Name("LocalMusic")
    Events("onChange", "onError")
    AsyncFunction("initialize") { promise: Promise ->
      if (!registered) {
        val filter = IntentFilter(PlaybackService.CHANGED)
        if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        else context.registerReceiver(receiver, filter)
        registered = true
      }
      if (playback != null) promise.resolve(snapshot())
      else {
        pending.add(promise)
        if (!bound) bound = context.bindService(Intent(context, PlaybackService::class.java), connection, Context.BIND_AUTO_CREATE)
        if (!bound) { pending.remove(promise); promise.reject("E_BIND", "Couldn't start music playback", null) }
        else handler.postDelayed({
          if (pending.remove(promise)) promise.reject("E_BIND_TIMEOUT", "Music playback didn't start. Reopen the app.", null)
        }, 10000)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("scan") {
      JSONArray().also { result -> library.scan(context).forEach { result.put(it.json()) } }.toString()
    }
    AsyncFunction("musicFolders") { library.musicFolders(context).toString() }
    AsyncFunction("snapshot") { snapshot() }.runOnQueue(Queues.MAIN)
    AsyncFunction("playbackStatus") { includeSound: Boolean ->
      val s = playback
      JSONObject().apply {
        put("sequence", ++sequence)
        put("currentId", s?.current()?.id ?: JSONObject.NULL)
        put("position", s?.position() ?: 0)
        put("duration", s?.duration() ?: 0)
        put("sleepRemaining", s?.sleepRemaining() ?: 0)
        if (includeSound) put("soundStatus", s?.soundStatus() ?: JSONObject())
      }.toString()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("previewSound") { raw: String ->
      check(previewAllowed) { "Sound preview requires the foreground app" }
      requireNotNull(playback) { "Initialize music playback first" }.previewSound(JSONObject(raw))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("cancelSoundPreview") { playback?.cancelSoundPreview(); Unit }.runOnQueue(Queues.MAIN)
    OnActivityEntersBackground { handler.post { previewAllowed = false; playback?.cancelSoundPreview() } }
    OnActivityEntersForeground { handler.post { previewAllowed = true } }
    AsyncFunction("command") { action: String, raw: String ->
      val data = JSONObject(raw)
      val service = requireNotNull(playback) { "Initialize music playback first" }
      val lib = library
      when (action) {
        "play" -> {
          val array = data.getJSONArray("songs")
          val songs = (0 until array.length()).map { Song.from(array.getJSONObject(it)) }
          if (songs.isNotEmpty()) {
            context.startForegroundService(Intent(context, PlaybackService::class.java).setAction("foreground"))
            service.setShuffle(data.optBoolean("shuffle", false))
            service.play(songs, data.optInt("index", 0))
          }
        }
        "toggle" -> service.toggle()
        "pause" -> service.pause()
        "next" -> service.next(true)
        "previous" -> service.previous()
        "seek" -> service.seek(data.getInt("position"))
        "shuffle" -> service.setShuffle(!service.shuffle)
        "repeat" -> service.setRepeat((service.repeat + 1) % 3)
        "speed" -> service.setSpeed(data.getDouble("value").toFloat().coerceIn(0.5f, 2f))
        "pitch" -> service.setPitch(data.getDouble("value").toFloat().coerceIn(-12f, 12f))
        "sound" -> service.updateSound(data)
        "soundReset" -> service.resetSound()
        "profileApply" -> service.applyProfile(data.getString("name"))
        "equalizerPreset" -> service.applyEqualizerPreset(data.getString("name"))
        "profileSave" -> service.saveProfile(data.getString("name").trim())
        "profileDelete" -> service.deleteProfile(data.getString("name"))
        "skipSilence" -> service.setSkipSilence(data.getBoolean("value"))
        "sleepFade" -> lib.prefs().edit().putBoolean("sleepFade", data.getBoolean("value")).apply()
        "includeSubfolders" -> lib.prefs().edit().putBoolean("includeSubfolders", data.getBoolean("value")).apply()
        "addRoot" -> {
          val rawPath = data.getString("path")
          val chosen = java.io.File(rawPath).canonicalPath
          require(chosen == rawPath && chosen.startsWith("/storage/")) { "Choose a music folder on this device" }
          val roots = lib.prefs().getStringSet("musicRoots", emptySet())!!.toMutableSet()
          require(roots.size < 10 || roots.contains(chosen)) { "You can select up to ten music folders" }
          roots.add(chosen)
          lib.prefs().edit().putStringSet("musicRoots", roots).apply()
        }
        "removeRoot" -> {
          val roots = lib.prefs().getStringSet("musicRoots", emptySet())!!.toMutableSet()
          roots.remove(data.getString("path")); lib.prefs().edit().putStringSet("musicRoots", roots).apply()
        }
        "filters" -> lib.prefs().edit().putInt("minDuration", data.optInt("minDuration", lib.prefs().getInt("minDuration",0)).coerceIn(0,120))
          .putInt("minSize", data.optInt("minSize", lib.prefs().getInt("minSize",0)).coerceIn(0,2048)).apply()
        "excludeFolder" -> {
          val excluded = lib.prefs().getStringSet("excluded", emptySet())!!.toMutableSet()
          if (data.getBoolean("value")) excluded.add(data.getString("path")) else excluded.remove(data.getString("path"))
          lib.prefs().edit().putStringSet("excluded", excluded).apply()
        }
        "sleep" -> service.sleep(data.getInt("minutes").coerceIn(0, 1440))
        "favorite" -> lib.toggleFavorite(Song.from(data.getJSONObject("song")))
        "enqueue" -> service.enqueue(Song.from(data.getJSONObject("song")), data.optBoolean("next", false))
        "jump" -> service.jump(data.getInt("index"))
        "removeQueue" -> service.removeQueue(data.getInt("index"))
        "moveQueue" -> service.moveQueue(data.getInt("from"), data.getInt("to"))
        "createPlaylist" -> lib.createPlaylist(validName(data.getString("name")))
        "deletePlaylist" -> lib.deletePlaylist(data.getString("name"))
        "renamePlaylist" -> lib.renamePlaylist(data.getString("name"), validName(data.getString("newName")))
        "addToPlaylist" -> lib.addToPlaylist(data.getString("name"), Song.from(data.getJSONObject("song")))
        "removeFromPlaylist" -> lib.removeFromPlaylist(data.getString("name"), Song.from(data.getJSONObject("song")))
        "theme" -> lib.prefs().edit().putString("theme", data.getString("value")).apply()
        "sort" -> lib.prefs().edit().putString("sort", data.getString("value")).apply()
        "clearHistory" -> lib.prefs().edit().remove("recent").apply()
        "pauseDisconnect" -> service.setPauseDisconnect(data.getBoolean("value"))
        else -> throw IllegalArgumentException("Unknown music action: $action")
      }
      snapshot()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("openNative") { screen: String ->
      val activity = requireNotNull(appContext.currentActivity) { "Open the app before adjusting settings" }
      activity.startActivity(Intent(activity, NativeMusicActivity::class.java).putExtra("screen", if (screen == "player") "player" else "settings"))
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      val ctx = appContext.reactContext
      handler.post {
        playback?.cancelSoundPreview()
        if (ctx != null) {
          if (bound) ctx.unbindService(connection)
          if (registered) ctx.unregisterReceiver(receiver)
        }
        pending.forEach { it.reject("E_DESTROYED", "Music module closed", null) }; pending.clear()
        bound = false; registered = false; playback = null
        handler.removeCallbacksAndMessages(null)
      }
    }
  }

  private fun validName(value: String): String {
    val name = value.trim()
    require(name.isNotEmpty() && name.length <= 100) { "Use a playlist name between 1 and 100 characters" }
    return name
  }

  private fun snapshot(): String {
    val lib = library
    val prefs = lib.prefs()
    val s = playback
    return JSONObject().apply {
      put("sequence", ++sequence)
      put("current", s?.current()?.json() ?: JSONObject.NULL)
      put("playing", s?.playing() ?: false)
      put("loading", s?.loading() ?: false)
      put("position", s?.position() ?: 0)
      put("duration", s?.duration() ?: 0)
      put("index", s?.index ?: -1)
      put("shuffle", s?.shuffle ?: prefs.getBoolean("shuffle", false))
      put("repeat", s?.repeat ?: prefs.getInt("repeat", 0))
      put("speed", s?.speed() ?: prefs.getFloat("speed", 1f))
      put("pitch", s?.pitch() ?: prefs.getFloat("pitch", 0f))
      put("skipSilence", prefs.getBoolean("skipSilence", false))
      put("sleepFade", prefs.getBoolean("sleepFade", true))
      put("sound", s?.sound() ?: SoundSettings().json())
      put("soundStatus", s?.soundStatus() ?: JSONObject())
      put("soundPresets", JSONArray(SoundSettings.PRESET_NAMES.toList()))
      put("soundProfiles", s?.savedProfiles() ?: JSONObject())
      put("equalizerPresets", JSONObject().also { presets -> SoundSettings.PRESET_NAMES.forEach { presets.put(it, SoundSettings.preset(it)) } })
      put("equalizerPresetDetails", JSONObject().also { details -> SoundSettings.PRESET_NAMES.forEach { details.put(it, TonePresets.detail(it)) } })
      put("musicRoots", JSONArray(prefs.getStringSet("musicRoots", emptySet())!!.sorted()))
      put("excluded", JSONArray(prefs.getStringSet("excluded", emptySet())!!.sorted()))
      put("minDuration", prefs.getInt("minDuration",0))
      put("minSize", prefs.getInt("minSize",0))
      put("includeSubfolders", prefs.getBoolean("includeSubfolders",true))
      put("sleepRemaining", s?.sleepRemaining() ?: 0)
      put("queue", JSONArray().also { a -> s?.queue?.forEach { a.put(it.json()) } })
      put("favorites", JSONArray(lib.favorites().toList()))
      put("recent", JSONArray(lib.recentIds()))
      put("playlists", lib.playlists())
      put("theme", prefs.getString("theme", "Light"))
      put("sort", prefs.getString("sort", "Title"))
      put("pauseDisconnect", prefs.getBoolean("pauseDisconnect", true))
      put("excludedCount", prefs.getStringSet("excluded", emptySet())?.size ?: 0)
    }.toString()
  }
}


