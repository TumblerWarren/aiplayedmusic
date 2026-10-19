import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, FlatList, Image, Linking, Modal, PermissionsAndroid, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import Native from './src/native';
import { formatTime, groupsFor, selectSongs, sortSongs } from './src/music';

const h = React.createElement;
const initialState = { current: null, playing: false, loading: false, position: 0, duration: 0, queue: [], favorites: [], recent: [], playlists: {}, shuffle: false, repeat: 0, speed: 1, theme: 'System', sort: 'Title', pauseDisconnect: true, sleepRemaining: 0 };
const tabs = ['Songs', 'Playlists', 'Albums', 'Artists', 'Folders'];
const accent = '#FF642F';
const palette = dark => ({ bg: dark ? '#111113' : '#FAFAFA', card: dark ? '#202023' : '#FFFFFF', ink: dark ? '#F4F4F5' : '#1B1C1E', muted: dark ? '#A4A4AD' : '#7E8085', line: dark ? '#303034' : '#EDEDEF' });
const folderName = name => name.split('/').filter(Boolean).pop() || name;

function Artwork({ song, size = 52, round = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [song?.albumId]);
  const colors = ['#997453', '#718A96', '#78947E', '#93778F', '#A88B7D', '#6C7E9C'];
  return h(View, { style: { width: size, height: size, borderRadius: round ? size / 2 : size > 100 ? 28 : 12, backgroundColor: colors[Math.abs(Number(song?.albumId || 0)) % colors.length], overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, accessible: false },
    song && !failed ? h(Image, { source: { uri: `content://media/external/audio/albumart/${song.albumId}` }, style: StyleSheet.absoluteFillObject, onError: () => setFailed(true) }) : h(Feather, { name: 'disc', size: size * 0.48, color: '#FFFFFFB0' }));
}

function MusicApp() {
  const system = useColorScheme();
  const [state, setState] = useState(initialState);
  const [songs, setSongs] = useState([]);
  const [permission, setPermission] = useState(false);
  const [ready, setReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [page, setPage] = useState('library');
  const [tab, setTab] = useState('Songs');
  const [selection, setSelection] = useState(null);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(null);
  const [nameDialog, setNameDialog] = useState(null);
  const [name, setName] = useState('');
  const [dragPosition, setDragPosition] = useState(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const dark = state.theme === 'Dark' || (state.theme === 'System' && system === 'dark');
  const c = palette(dark);
  const styles = useMemo(() => makeStyles(c), [dark]);
  const report = useCallback(error => { if (alive.current) Alert.alert('Music', error?.message || 'Something went wrong. Please try again.'); }, []);
  const accept = useCallback(raw => { const value = typeof raw === 'string' ? JSON.parse(raw) : raw; if (alive.current) setState(value); return value; }, []);
  const command = useCallback(async (action, data = {}) => { try { if (!Native) return; return accept(await Native.command(action, JSON.stringify(data))); } catch (error) { report(error); } }, [accept, report]);
  const scan = useCallback(async () => {
    if (!Native || busy.current) return;
    busy.current = true; setScanning(true);
    try { const found = JSON.parse(await Native.scan()); if (alive.current) setSongs(found); }
    catch (error) { report(error); }
    finally { busy.current = false; if (alive.current) setScanning(false); }
  }, [report]);
  const audioPermission = Platform.Version >= 33 ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
  const checkPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return false;
    const has = await PermissionsAndroid.check(audioPermission);
    if (alive.current) setPermission(has);
    return has;
  }, [audioPermission]);
  const grant = async () => {
    try {
      const result = await PermissionsAndroid.request(audioPermission, { title: 'Find your music', message: 'Allow Music to find and play audio stored on your phone.', buttonPositive: 'Continue', buttonNegative: 'Not now' });
      const has = result === PermissionsAndroid.RESULTS.GRANTED; setPermission(has);
      if (has) {
        await scan();
        if (Platform.Version >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) Alert.alert('Allow music access', 'Enable music and audio access in app settings.', [{ text: 'Cancel' }, { text: 'Open settings', onPress: () => Linking.openSettings() }]);
    } catch (error) { report(error); }
  };
  useEffect(() => {
    alive.current = true;
    if (!Native || Platform.OS !== 'android') return () => { alive.current = false; };
    let change, error;
    Native.initialize().then(raw => {
      if (!alive.current) return;
      accept(raw); setReady(true);
      change = Native.addListener('onChange', event => accept(event.json));
      error = Native.addListener('onError', event => report(new Error(event.message)));
      checkPermission().then(has => { if (has && alive.current) scan(); }).catch(report);
    }).catch(report);
    return () => { alive.current = false; change?.remove(); error?.remove(); };
  }, [accept, checkPermission, report, scan]);
  useEffect(() => {
    if (!Native || !ready) return;
    let active = AppState.currentState === 'active', inFlight = false;
    const refresh = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try { accept(await Native.snapshot()); } catch (error) { /* Next foreground refresh can recover a detached bridge. */ }
      finally { inFlight = false; }
    };
    const timer = setInterval(refresh, 1000);
    const subscription = AppState.addEventListener('change', next => {
      const wasActive = active; active = next === 'active';
      if (active && !wasActive) { refresh(); checkPermission().then(has => { if (has) scan(); }).catch(report); }
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [ready, accept, checkPermission, scan, report]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheet) { setSheet(null); return true; }
      if (nameDialog) { setNameDialog(null); return true; }
      if (page !== 'library') { setPage('library'); setSelection(null); return true; }
      if (query) { setQuery(''); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [page, sheet, nameDialog, query]);

  const icon = (glyph, onPress, color = c.ink, size = 23, extra = {}) => h(Pressable, { onPress, accessibilityRole: 'button', accessibilityLabel: extra.label || glyph, hitSlop: 6, style: [styles.iconButton, extra.style], ...extra }, h(Feather, { name: glyph, size, color }));
  const text = (value, style, props = {}) => h(Text, { style: [styles.text, style], ...props }, value);
  const button = (value, onPress, style) => h(Pressable, { onPress, accessibilityRole: 'button', style: [styles.button, style] }, text(value, styles.buttonText));
  const go = (next, selected = null) => { setPage(next); setSelection(selected); setQuery(''); };
  const play = (items, index = 0, shuffle = false) => { if (items.length) command('play', { songs: items, index, shuffle }); };
  const openNative = async screen => { try { await Native.openNative(screen); } catch (error) { report(error); } };
  const createPlaylist = song => { setSheet(null); setName(''); setNameDialog({ kind: 'create', song }); };
  const playlistSheet = song => setSheet({ title: 'Add to playlist', items: [{ label: 'New playlist', icon: 'plus', action: () => createPlaylist(song) }, ...Object.keys(state.playlists).sort().map(title => ({ label: title, icon: 'list', action: () => command('addToPlaylist', { name: title, song }) }))] });
  const options = song => setSheet({ title: song.title, items: [
    { label: 'Play next', icon: 'skip-forward', action: () => command('enqueue', { song, next: true }) },
    { label: 'Add to queue', icon: 'list', action: () => command('enqueue', { song }) },
    { label: state.favorites.includes(String(song.id)) ? 'Remove from favourites' : 'Add to favourites', icon: 'heart', action: () => command('favorite', { song }) },
    { label: 'Add to playlist', icon: 'plus', action: () => playlistSheet(song), keep: true },
    ...(selection?.kind === 'playlist' ? [{ label: 'Remove from playlist', icon: 'minus-circle', action: () => command('removeFromPlaylist', { name: selection.name, song }) }] : []),
    { label: 'Song information', icon: 'info', action: () => Alert.alert(song.title, `${song.artist}\n${song.album}\n${formatTime(song.duration)} · ${(song.size / 1048576).toFixed(2)} MB\n\n${song.path}`) }
  ] });
  const timerSheet = () => setSheet({ title: 'Sleep timer', items: [0, 15, 30, 45, 60, 90, 120].map(minutes => ({ label: minutes ? `${minutes} minutes` : 'Off', icon: 'clock', action: () => command('sleep', { minutes }) })) });
  const speedSheet = () => setSheet({ title: 'Playback speed', items: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(value => ({ label: `${value}×`, icon: value === state.speed ? 'check' : 'play', action: () => command('speed', { value }) })) });
  const themeSheet = () => setSheet({ title: 'Theme', items: ['System', 'Light', 'Dark'].map(value => ({ label: value, icon: state.theme === value ? 'check' : 'circle', action: () => command('theme', { value }) })) });
  const sortSheet = () => setSheet({ title: 'Sort songs', items: ['Title', 'Artist', 'Date added', 'Duration'].map(value => ({ label: value, icon: value === state.sort ? 'check' : 'align-left', action: () => command('sort', { value }) })) });
  const playlistOptions = title => setSheet({ title, items: [
    { label: 'Rename playlist', icon: 'edit-2', action: () => { setName(title); setNameDialog({ kind: 'rename', oldName: title }); } },
    { label: 'Delete playlist', icon: 'trash-2', action: () => Alert.alert('Delete playlist?', 'Your music files will stay on your phone.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await command('deletePlaylist', { name: title }); go('library'); } }]) }
  ] });
  const saveName = async () => {
    const value = name.trim();
    if (!value || value.length > 100) return Alert.alert('Playlist name', 'Use a name between 1 and 100 characters.');
    if (Object.prototype.hasOwnProperty.call(state.playlists, value) && value !== nameDialog?.oldName) return Alert.alert('Playlist name', 'A playlist with that name already exists.');
    let result;
    if (nameDialog.kind === 'rename') result = await command('renamePlaylist', { name: nameDialog.oldName, newName: value });
    else { result = await command('createPlaylist', { name: value }); if (result && nameDialog.song) result = await command('addToPlaylist', { name: value, song: nameDialog.song }); }
    if (result) { if (nameDialog.kind === 'rename' && selection?.kind === 'playlist') setSelection({ kind: 'playlist', name: value }); setNameDialog(null); }
  };
  const selected = useMemo(() => {
    const filtered = selectSongs(songs, state, selection, query);
    return selection?.kind === 'recent' || selection?.kind === 'playlist' ? filtered : sortSongs(filtered, state.sort);
  }, [songs, state.favorites, state.playlists, state.recent, state.sort, selection, query]);

  const songRow = (song, index, items, queue = false) => h(Pressable, { key: `${song.id}-${index}`, style: styles.songRow, onPress: () => queue ? command('jump', { index }) : play(items, index), onLongPress: () => queue ? queueOptions(song, index) : options(song), accessibilityRole: 'button', accessibilityLabel: `${song.title}, ${song.artist}` },
    h(Artwork, { song }),
    h(View, { style: styles.songLabels }, text(song.title, [styles.songTitle, state.current?.id === song.id && { color: accent }], { numberOfLines: 1 }), text(`${song.artist} · ${formatTime(song.duration)}`, styles.subtitle, { numberOfLines: 1 })),
    icon('more-vertical', () => queue ? queueOptions(song, index) : options(song), c.muted));
  const queueOptions = (song, index) => setSheet({ title: song.title, items: [
    ...(index > 0 ? [{ label: 'Move up', icon: 'arrow-up', action: () => command('moveQueue', { from: index, to: index - 1 }) }] : []),
    ...(index < state.queue.length - 1 ? [{ label: 'Move down', icon: 'arrow-down', action: () => command('moveQueue', { from: index, to: index + 1 }) }] : []),
    { label: 'Remove from queue', icon: 'minus-circle', action: () => command('removeQueue', { index }) }
  ] });
  const groupRow = (title, detail, glyph, onPress, onLongPress) => h(Pressable, { style: styles.groupRow, onPress, onLongPress, accessibilityRole: 'button' },
    h(View, { style: styles.groupIcon }, h(Feather, { name: glyph, size: 24, color: accent })), h(View, { style: styles.songLabels }, text(title, styles.songTitle, { numberOfLines: 1 }), text(detail, styles.subtitle, { numberOfLines: 2 })), h(Feather, { name: 'chevron-right', color: c.muted, size: 20 }));
  const empty = () => h(View, { style: styles.empty }, h(Feather, { name: 'music', size: 42, color: c.muted }), text('Your library is quiet', styles.emptyTitle), text('Add music to your phone, then scan for songs.', styles.emptyDetail), button(scanning ? 'Scanning…' : 'Scan for songs', scan));
  const header = (title, extra) => h(View, { style: styles.pageHeader }, icon('chevron-left', () => go('library')), text(title, styles.pageTitle, { numberOfLines: 1 }), extra);
  const mini = h(Pressable, { onPress: () => go('player'), style: styles.mini, accessibilityRole: 'button', accessibilityLabel: 'Open now playing' },
    h(Artwork, { song: state.current, size: 46 }), h(View, { style: styles.songLabels }, text(state.current?.title || 'Choose a song', styles.miniTitle, { numberOfLines: 1 }), text(state.current?.artist || 'Your music, offline', styles.subtitle, { numberOfLines: 1 })),
    icon(state.playing ? 'pause' : 'play', () => state.current ? command('toggle') : play(songs)), icon('list', () => go('queue')));

  if (!Native || Platform.OS !== 'android') return h(SafeAreaView, { style: styles.root }, h(View, { style: styles.welcome }, h(Feather, { name: 'music', size: 64, color: accent }), text('Your music.\nYour moment.', styles.welcomeTitle), text('Install the full Android app to play music stored on your phone.', styles.welcomeDetail)));
  if (!ready) return h(SafeAreaView, { style: styles.root }, h(View, { style: styles.welcome }, h(ActivityIndicator, { color: accent, size: 'large' }), text('Opening your music…', styles.welcomeDetail)));
  if (!permission) return h(SafeAreaView, { style: styles.root }, h(StatusBar, { barStyle: dark ? 'light-content' : 'dark-content' }), h(View, { style: styles.welcome }, h(Feather, { name: 'music', size: 64, color: accent }), text('Your music.\nYour moment.', styles.welcomeTitle), text('All the songs on your phone, together in one place. Offline, uninterrupted.', styles.welcomeDetail), button('Find my music', grant), h(Pressable, { onPress: () => Linking.openSettings(), style: styles.settingsLink }, text('Open app permissions', { color: accent }))));

  let content;
  if (page === 'player') {
    const song = state.current;
    content = h(View, { style: styles.flex }, h(View, { style: styles.pageHeader }, icon('chevron-down', () => go('library')), text('NOW PLAYING', styles.overline), icon('more-vertical', () => song && options(song))),
      h(ScrollView, { contentContainerStyle: styles.playerBody }, h(Artwork, { song, size: 280 }),
        h(View, { style: styles.playerTitles }, h(View, { style: styles.flex }, text(song?.title || 'Choose a song', styles.playerTitle), text(state.loading ? 'Loading…' : song?.artist || 'Your music, offline', styles.playerArtist)), icon('heart', () => song && command('favorite', { song }), song && state.favorites.includes(String(song.id)) ? accent : c.muted, 26)),
        h(Slider, { style: styles.slider, minimumValue: 0, maximumValue: Math.max(1, state.duration), value: dragPosition ?? state.position, onSlidingStart: value => setDragPosition(value), onValueChange: setDragPosition, onSlidingComplete: async value => { await command('seek', { position: Math.round(value) }); setDragPosition(null); }, minimumTrackTintColor: accent, maximumTrackTintColor: c.line, thumbTintColor: accent, accessibilityLabel: 'Playback position' }),
        h(View, { style: styles.times }, text(formatTime(dragPosition ?? state.position), styles.subtitle), text(formatTime(state.duration), styles.subtitle)),
        h(View, { style: styles.transport }, icon('shuffle', () => command('shuffle'), state.shuffle ? accent : c.muted), icon('skip-back', () => command('previous'), c.ink, 30), icon(state.playing ? 'pause' : 'play', () => song ? command('toggle') : play(songs), '#FFF', 34, { style: styles.bigPlay }), icon('skip-forward', () => command('next'), c.ink, 30), h(View, null, icon('repeat', () => command('repeat'), state.repeat ? accent : c.muted), state.repeat === 2 && text('1', styles.repeatOne))),
        h(View, { style: styles.transport }, icon('sliders', () => openNative('settings'), c.muted), icon('clock', timerSheet, state.sleepRemaining ? accent : c.muted), h(Pressable, { onPress: () => openNative('player'), style: styles.iconButton }, text('Lyrics', { color: c.muted })), icon('list', () => go('queue'), c.muted)), state.sleepRemaining > 0 && text(`Sleep timer · ${formatTime(state.sleepRemaining)}`, styles.timer)));
  } else if (page === 'settings') {
    content = h(View, { style: styles.flex }, header('Settings'), h(ScrollView, { contentContainerStyle: styles.settingsBody },
      text('LIBRARY', styles.section), groupRow('Scan for songs', scanning ? 'Scanning…' : `${songs.length} songs on this phone`, 'music', scan), groupRow('Filter audio files', 'Hide short clips and small audio files', 'filter', () => openNative('settings')), groupRow('Excluded folders', `${state.excludedCount || 0} folders hidden`, 'folder', () => openNative('settings')),
      text('PLAYBACK', styles.section), groupRow('Equalizer', 'Fine-tune your sound', 'sliders', () => openNative('settings')), groupRow('Sleep timer', state.sleepRemaining ? `${formatTime(state.sleepRemaining)} remaining` : 'Off', 'clock', timerSheet), groupRow('Playback speed', `${state.speed}×`, 'play', speedSheet),
      h(View, { style: styles.groupRow }, h(View, { style: styles.flex }, text('Pause when disconnected', styles.songTitle), text('Headphones and Bluetooth', styles.subtitle)), h(Switch, { value: state.pauseDisconnect, onValueChange: value => command('pauseDisconnect', { value }), trackColor: { true: accent }, accessibilityLabel: 'Pause when disconnected' })),
      text('APPEARANCE', styles.section), groupRow('Theme', state.theme, 'sun', themeSheet), text('ABOUT', styles.section), groupRow('Music', 'Version 1.1 · Your music, offline', 'music', () => Alert.alert('Music', 'An independent local music player inspired by Mi Music. No ads, streaming or accounts. Not affiliated with Xiaomi.')), groupRow('App permissions', 'Audio access and notifications', 'shield', () => Linking.openSettings()), groupRow('Clear listening history', 'Keeps music files and playlists', 'clock', () => Alert.alert('Clear listening history?', 'Recently played songs will be removed.', [{ text: 'Cancel' }, { text: 'Clear', onPress: () => command('clearHistory') }]))));
  } else if (page === 'queue') {
    content = h(View, { style: styles.flex }, header('Playing queue'), text(`${state.queue.length} songs`, styles.count), h(FlatList, { data: state.queue, keyExtractor: (item, index) => `${item.id}-${index}`, renderItem: ({ item, index }) => songRow(item, index, state.queue, true), contentContainerStyle: styles.list, ListEmptyComponent: empty }));
  } else {
    const collection = page === 'collection';
    let groupData = [];
    if (!collection && tab === 'Playlists') groupData = Object.entries(state.playlists).filter(([title]) => title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(([title, ids]) => ({ name: title, count: ids.filter(id => songs.some(song => song.id === id)).length }));
    else if (!collection && tab !== 'Songs') groupData = groupsFor(songs, tab, query);
    content = h(View, { style: styles.flex },
      collection ? header(selection?.kind === 'Folders' ? folderName(selection.name) : selection?.name, selection?.kind === 'playlist' ? icon('more-vertical', () => playlistOptions(selection.name)) : null) : h(View, { style: styles.libraryHeader }, text('Music', styles.brand), icon('settings', () => go('settings'))),
      !collection && h(View, { style: styles.shortcuts }, ...[['Favourites', 'heart', 'favorites'], ['Recently played', 'clock', 'recent']].map(([title, glyph, kind]) => h(Pressable, { key: kind, onPress: () => go('collection', { kind, name: title }), style: styles.shortcut }, h(Feather, { name: glyph, color: accent, size: 25 }), text(title, styles.shortcutTitle)))),
      !collection && h(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: styles.tabs, contentContainerStyle: styles.tabContents }, ...tabs.map(title => h(Pressable, { key: title, onPress: () => { setTab(title); setQuery(''); }, style: styles.tab }, text(title, [styles.tabText, tab === title && { color: accent }])))),
      h(TextInput, { style: styles.search, value: query, onChangeText: setQuery, placeholder: 'Search your music', placeholderTextColor: c.muted, accessibilityLabel: 'Search your music', returnKeyType: 'search', autoCorrect: false }),
      h(View, { style: styles.listControls }, text(scanning ? 'Scanning…' : `${collection || tab === 'Songs' ? selected.length : groupData.length} ${!collection && tab !== 'Songs' ? tab.toLowerCase() : 'songs'}`, styles.subtitle), h(View, { style: styles.flex }),
        !collection && tab === 'Playlists' ? icon('plus', () => createPlaylist(), accent) : (!collection && tab !== 'Songs') ? null : h(React.Fragment, null, h(Pressable, { onPress: () => play(selected, Math.floor(Math.random() * selected.length), true), style: styles.shuffleAll }, text('Shuffle all', { color: accent, fontWeight: '600' })), icon('bar-chart-2', sortSheet, c.muted))),
      collection || tab === 'Songs' ? h(FlatList, { data: selected, keyExtractor: item => String(item.id), renderItem: ({ item, index }) => songRow(item, index, selected), contentContainerStyle: styles.list, refreshing: scanning, onRefresh: scan, ListEmptyComponent: empty, keyboardShouldPersistTaps: 'handled' }) : h(FlatList, { data: groupData, keyExtractor: item => item.name, contentContainerStyle: styles.list, keyboardShouldPersistTaps: 'handled', renderItem: ({ item }) => groupRow(tab === 'Folders' ? folderName(item.name) : item.name, `${item.count} songs`, tab === 'Playlists' ? 'list' : tab === 'Folders' ? 'folder' : tab === 'Artists' ? 'user' : 'disc', () => go('collection', { kind: tab === 'Playlists' ? 'playlist' : tab, name: item.name }), tab === 'Playlists' ? () => playlistOptions(item.name) : undefined), ListEmptyComponent: tab === 'Playlists' ? h(View, { style: styles.empty }, text('Make it a playlist', styles.emptyTitle), text('Your favourite combinations, ready whenever you are.', styles.emptyDetail), button('New playlist', () => createPlaylist())) : empty }));
  }
  return h(SafeAreaView, { style: styles.root }, h(StatusBar, { barStyle: dark ? 'light-content' : 'dark-content', backgroundColor: c.bg }), content, page !== 'player' && mini,
    h(Modal, { visible: !!sheet, transparent: true, animationType: 'slide', onRequestClose: () => setSheet(null) }, h(View, { style: styles.modalRoot }, h(Pressable, { style: styles.backdrop, onPress: () => setSheet(null), accessibilityLabel: 'Close menu' }), h(SafeAreaView, { edges: ['bottom'], style: styles.sheet }, text(sheet?.title, styles.sheetTitle), h(ScrollView, null, ...(sheet?.items || []).map((item, index) => h(Pressable, { key: index, style: styles.sheetItem, onPress: () => { if (!item.keep) setSheet(null); item.action(); } }, h(Feather, { name: item.icon || 'music', size: 21, color: accent }), text(item.label, styles.sheetItemText))))))),
    h(Modal, { visible: !!nameDialog, transparent: true, animationType: 'fade', onRequestClose: () => setNameDialog(null) }, h(View, { style: styles.dialogBackdrop }, h(View, { style: styles.dialog }, text(nameDialog?.kind === 'rename' ? 'Rename playlist' : 'New playlist', styles.sheetTitle), h(TextInput, { value: name, onChangeText: setName, autoFocus: true, maxLength: 100, placeholder: 'Playlist name', placeholderTextColor: c.muted, style: styles.nameInput, onSubmitEditing: saveName }), h(View, { style: styles.dialogButtons }, h(Pressable, { onPress: () => setNameDialog(null), style: styles.cancel }, text('Cancel', { color: c.muted })), button('Save', saveName))))));
}

function makeStyles(c) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg }, flex: { flex: 1 }, text: { color: c.ink, fontSize: 15 }, iconButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
    button: { backgroundColor: accent, borderRadius: 28, minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25, paddingVertical: 12 }, buttonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
    libraryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14 }, brand: { fontSize: 36, fontWeight: '700', letterSpacing: -1 },
    shortcuts: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, marginBottom: 20 }, shortcut: { flex: 1, backgroundColor: c.card, borderRadius: 18, padding: 16, gap: 13 }, shortcutTitle: { fontSize: 13, fontWeight: '600' },
    tabs: { flexGrow: 0, marginBottom: 6 }, tabContents: { paddingHorizontal: 14 }, tab: { paddingHorizontal: 10, paddingVertical: 12 }, tabText: { fontSize: 16, fontWeight: '600', color: c.muted },
    search: { marginHorizontal: 24, backgroundColor: c.line, color: c.ink, paddingHorizontal: 18, paddingVertical: 12, minHeight: 46, borderRadius: 16, fontSize: 15 }, listControls: { flexDirection: 'row', alignItems: 'center', paddingLeft: 24, paddingRight: 12, minHeight: 52 }, shuffleAll: { padding: 10 },
    list: { paddingHorizontal: 16, paddingBottom: 16 }, songRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 9 }, songLabels: { flex: 1, paddingHorizontal: 13, gap: 6 }, songTitle: { fontSize: 15, fontWeight: '500' }, subtitle: { fontSize: 12, color: c.muted },
    mini: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 6, marginBottom: 10, paddingLeft: 12, paddingRight: 6, paddingVertical: 10, backgroundColor: c.card, borderRadius: 22 }, miniTitle: { fontSize: 14, fontWeight: '600' },
    pageHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 68 }, pageTitle: { flex: 1, fontSize: 24, fontWeight: '600' }, overline: { flex: 1, textAlign: 'center', color: c.muted, fontSize: 11, letterSpacing: 2 },
    playerBody: { paddingHorizontal: 30, paddingTop: 18, paddingBottom: 26, alignItems: 'center' }, playerTitles: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: 28, marginBottom: 22 }, playerTitle: { fontSize: 25, fontWeight: '600' }, playerArtist: { color: c.muted, fontSize: 15, marginTop: 10 }, slider: { width: '100%', height: 36 }, times: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' }, transport: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }, bigPlay: { width: 76, height: 76, borderRadius: 38, backgroundColor: accent }, repeatOne: { position: 'absolute', right: 6, bottom: 3, fontSize: 10, color: accent }, timer: { color: accent, fontSize: 12, marginTop: 18 },
    groupRow: { flexDirection: 'row', alignItems: 'center', padding: 8, paddingVertical: 12 }, groupIcon: { width: 54, height: 54, borderRadius: 14, backgroundColor: c.line, alignItems: 'center', justifyContent: 'center' }, settingsBody: { paddingHorizontal: 24, paddingBottom: 28 }, section: { color: accent, fontSize: 11, letterSpacing: 1.4, fontWeight: '600', marginTop: 26, marginBottom: 12 }, count: { color: c.muted, fontSize: 13, paddingHorizontal: 24, marginVertical: 10 },
    empty: { padding: 32, paddingTop: 44, alignItems: 'center', gap: 20 }, emptyTitle: { fontSize: 21, fontWeight: '600', textAlign: 'center' }, emptyDetail: { fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 22 }, welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36, gap: 28 }, welcomeTitle: { fontSize: 38, fontWeight: '700', textAlign: 'center', letterSpacing: -1 }, welcomeDetail: { color: c.muted, fontSize: 16, lineHeight: 25, textAlign: 'center' }, settingsLink: { padding: 12 },
    modalRoot: { flex: 1, justifyContent: 'flex-end' }, backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0008' }, sheet: { backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '80%' }, sheetTitle: { fontSize: 21, fontWeight: '600', marginBottom: 16 }, sheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, gap: 18 }, sheetItemText: { fontSize: 16, flexShrink: 1 }, dialogBackdrop: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#0008' }, dialog: { padding: 24, backgroundColor: c.card, borderRadius: 24 }, nameInput: { color: c.ink, padding: 12, borderBottomWidth: 1, borderColor: c.line, fontSize: 16, marginBottom: 24 }, dialogButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 14 }, cancel: { padding: 12 }
  });
}

export default function App() { return h(SafeAreaProvider, null, h(MusicApp)); }
