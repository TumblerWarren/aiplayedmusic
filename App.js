import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, FlatList, KeyboardAvoidingView, Linking, Modal, PermissionsAndroid, Platform, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Feather from './src/Icons';
import { PlayingBars, PlayingArtwork, PlaybackRipple, MotionProvider, useAppActive } from './src/PlaybackMotion';
import IndexedSongList from './src/IndexedSongList';
import Artwork from './src/Artwork';
import SongRow from './src/SongRow';
import PlayerProgress, { SleepRemaining } from './src/PlayerProgress';
import { musicStore, soundPreview, useMusicSlice, useStableCallback, useStatusPolling } from './src/useMusic';
import { createLibraryIndex } from './src/libraryIndex';
import { activeDestination, canOpenSound, routeKey } from './src/navigation';
import ScrollSurface from './src/ScrollSurface';
import FolderPicker from './src/FolderPicker';
import Native from './src/native';
import SwipeSurface from './src/SwipeSurface';
import Startup from './src/Startup';
import { hideNativeSplash } from './src/splash';
import Sheet, { restoreFocus } from './src/Sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { browseDestination, browseRoute, compareNames, destinations, displayFolder } from './src/browse';
import SoundStudio from './src/SoundStudio';
import LibrarySettings from './src/LibrarySettings';
import ForYou, { PersonalMixesSettings } from './src/ForYou';
import Lyrics from './src/Lyrics';
import SleepTimer from './src/SleepTimer';
import { tones } from './src/design';
import { Pattern, TabHighlight } from './src/Pastel';
import { formatTime } from './src/music';

import Pressable from './src/RoundedPressable';
import ThemeProvider, { useTheme } from './src/ThemeProvider';
const h = React.createElement;
const folderName = name => name.split('/').filter(Boolean).pop() || name;

function MusicApp() {
  const window = useWindowDimensions();
  const landscape = window.width > window.height;
  const compactPlayer = landscape || window.height < 640;
  const [artBounds, setArtBounds] = useState({ width: 0, height: 0 });
  const artSize = Math.max(0, Math.min(370, artBounds.width, artBounds.height));
  const state = useMusicSlice('main');
  const artworkVariant = useMemo(() => ['Pulse', 'Wave', 'Orbit'][Math.floor(Math.random() * 3)], [state.current?.id]);
  const active = useAppActive();
  const [soundTab, setSoundTab] = useState('Tone');
  const soundOffsets = useRef({});
  const browsing = useRef({});
  const browseRoutes = useRef({});
  const browseTrigger = useRef(null);
  const overlayReturn = useRef(null);
  const [songs, setSongs] = useState([]);
  const [permission, setPermission] = useState(false);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState('');
  const [initAttempt, setInitAttempt] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [page, setPage] = useState('library');
  const [soundBack, setSoundBack] = useState({ page: 'library', tab: 'Songs', selection: null, query: '' });
  const [tab, setTab] = useState('Songs');
  const [selection, setSelection] = useState(null);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  useEffect(() => setSearchFocused(false), [page, tab, selection?.name]);
  const deferredQuery = useDeferredValue(query);
  const [browseOrders, setBrowseOrders] = useState({});
  const viewName = browseDestination(tab, selection);
  const browseOrder = browseOrders[viewName] || 'asc';
  const direction = browseOrder === 'asc' ? 1 : -1;
  const sessionKey = routeKey(page, tab, selection, deferredQuery) + ':' + browseOrder;
  const [folderPicker, setFolderPicker] = useState(false);
  const [sheet, updateSheet] = useState(null);
  const [nameDialog, setNameDialog] = useState(null);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const nameSaveLock = useRef(false);
  const closeName = () => { if (!nameSaveLock.current) { setNameDialog(null); restoreFocus(overlayReturn.current); } };
  const setSheet = value => { if (value) { setFolderPicker(false); setNameDialog(null); } updateSheet(value); };
  const currentBrowse = browseDestination(tab, selection);
  const busy = useRef(false);
  const alive = useRef(true);
  const c = useTheme(), dark = c.dark;
  const accent = c.accent;
  const colors = useMemo(() => tones(c), [c]);
  const styles = useMemo(() => makeStyles(c, compactPlayer, window.fontScale), [c, compactPlayer, window.fontScale]);
  const report = useCallback(error => { if (alive.current) Alert.alert('Music', error?.message || 'Something went wrong. Please try again.'); }, []);
  const accept = useCallback(raw => alive.current ? musicStore.accept(raw) : undefined, []);
  const command = useCallback(async (action, data = {}) => { try { if (!Native) return; const run = async () => { if (action === 'clearHistory' && Native.clearListeningHistory) { await Native.clearListeningHistory(); return Native.snapshot(); } return Native.command(action, JSON.stringify(data)); }; return accept(await (['sound', 'soundReset', 'equalizerPreset', 'profileApply', 'profileSave', 'profileDelete', 'speed', 'pitch'].includes(action) ? soundPreview.perform(run) : run())); } catch (error) { report(error); } }, [accept, report]);
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
    let change, error, cancelled = false;
    setInitError('');
    Native.initialize().then(async raw => {
      if (cancelled || !alive.current) return;
      accept(raw);
      change = Native.addListener('onChange', event => accept(event.json));
      error = Native.addListener('onError', event => report(new Error(event.message)));
      const has = await checkPermission();
      if (!cancelled && alive.current) { if (has) await scan(); if (!cancelled && alive.current) setReady(true); }
    }).catch(error => { if (!cancelled && alive.current) setInitError(error?.message || 'Your music could not open. Try again.'); });
    return () => { cancelled = true; alive.current = false; change?.remove(); error?.remove(); };
  }, [accept, checkPermission, report, scan, initAttempt]);
  useEffect(() => {
    if (!Native || !ready) return;
    let active = AppState.currentState === 'active', inFlight = false;
    const refresh = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try { accept(await Native.snapshot()); } catch (error) { /* Next foreground refresh can recover a detached bridge. */ }
      finally { inFlight = false; }
    };
    const subscription = AppState.addEventListener('change', next => {
      const wasActive = active; active = next === 'active';
      if (active && !wasActive) { refresh(); checkPermission().then(has => { if (has) scan(); }).catch(report); }
    });
    return () => subscription.remove();
  }, [ready, accept, checkPermission, scan, report]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheet) { setSheet(null); return true; }
      if (nameDialog) { closeName(); return true; }
      if (page === 'sound') { returnFromSound(); return true; }
      if (page === 'collection' && selection?.kind === 'Folders' && selection.name !== selection.root) { setSelection({ ...selection, name: selection.name.slice(0, selection.name.lastIndexOf('/')) || '/' }); return true; }
      if (page !== 'library') { setPage('library'); setSelection(null); return true; }
      if (query) { setQuery(''); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [page, sheet, nameDialog, query, soundBack, selection]);

  useStatusPolling({ ready, active, page, soundTab, timerActive: !!state.sleepRemaining });

  const icon = (glyph, onPress, color = c.ink, size = 23, extra = {}) => h(Pressable, { onPress: e => { overlayReturn.current = e?.nativeEvent?.target; onPress?.(); }, accessibilityRole: 'button', accessibilityLabel: extra.label || glyph, hitSlop: 6, ...extra, style: [styles.iconButton, extra.style] }, h(Feather, { name: glyph, size, color, filled: extra.filled }));
  const text = (value, style, props = {}) => h(Text, { style: [styles.text, style], ...props }, value);
  const button = (value, onPress, style, disabled = false) => h(Pressable, { onPress, disabled, accessibilityState: { disabled }, accessibilityRole: 'button', style: ({ pressed }) => [styles.button, style, { opacity: disabled ? 0.45 : pressed && !c.dark ? 0.8 : 1 }] }, h(TabHighlight, { tone: { bg: c.peach, ink: c.peachInk, detail: c.mintInk, pattern: 'waves' } }), text(value, styles.buttonText));
  const captureRoute = () => ({ page, tab, selection, query });
  const restoreRoute = route => { setPage(route.page); setTab(route.tab); setSelection(route.selection); setQuery(route.query); };
  const rememberBrowsing = () => { if (['library', 'collection'].includes(page)) { browsing.current[activeDestination(page, tab, selection)] = captureRoute(); browseRoutes.current[currentBrowse] = captureRoute(); } };
  const go = useStableCallback((next, selected = null) => { rememberBrowsing(); setPage(next); setSelection(selected); setQuery(''); });
  const selectBrowse = title => {
    setSheet(null);
    if (title === currentBrowse && ['library', 'collection'].includes(page)) return;
    rememberBrowsing();
    restoreRoute(browseRoutes.current[title] || browseRoute(title));
  };
  const openBrowse = () => { overlayReturn.current = browseTrigger.current; setSheet({ title: 'Browse', browse: true }); };
  const browseHeader = (title, onBack, extra) => h(View, { style: styles.libraryHeader }, onBack && icon('chevron-left', onBack, c.ink, 23, { label: 'Back' }), text(title, [styles.brand, { flex: 1, minWidth: 0 }], { numberOfLines: 2, accessibilityRole: 'header' }), extra, h(Pressable, { ref: browseTrigger, onPress: openBrowse, accessibilityRole: 'button', accessibilityLabel: '+ Browse', accessibilityState: { expanded: !!sheet?.browse }, style: ({ pressed }) => [styles.browseButton, { opacity: pressed && !c.dark ? 0.8 : 1 }] }, h(TabHighlight, { tone: { bg: c.lavender, ink: c.purpleInk, detail: c.mintInk, pattern: 'arcs' } }), text('+ Browse', { color: c.purpleInk, fontWeight: '700', fontSize: 15 })));
  const navigateRoot = title => {
    if (activeDestination(page, tab, selection) === title && page !== 'player') return;
    if (title === 'Sound') return openSound();
    if (title === 'Playlists') return selectBrowse('Playlists');
    rememberBrowsing();
    if (title === 'Settings') return go('settings');
    restoreRoute(browsing.current[title] || { page: 'library', tab: title === 'Playlists' ? 'Playlists' : 'Songs', selection: null, query: '' });
  };
  const returnFromSound = () => restoreRoute(soundBack);

  const chooseFolder = () => { setSheet(null); setNameDialog(null); setFolderPicker(true); };
  const selectFolder = async path => { const result = await command('addRoot', { path }); if (!result) return false; await scan(); return true; };
  const backFolder = () => { if (selection.name === selection.root) { setTab('Folders'); go('library'); } else { setSelection({ ...selection, name: selection.name.slice(0, selection.name.lastIndexOf('/')) || '/' }); setQuery(''); } };
  const folderOptions = path => setSheet({ title: folderName(path), items: [{ label: 'Exclude folder and subfolders', icon: 'folder-minus', action: async () => { await command('excludeFolder', { path, value: true }); await scan(); setTab('Folders'); go('library'); } }] });
  const play = (items, index = 0, shuffle = false) => { if (items.length) command('play', { songs: items, index, shuffle }); };
  const openSound = () => { if (!canOpenSound(page)) return; rememberBrowsing(); setSoundBack(captureRoute()); setPage('sound'); };
  const openLyrics = e => { overlayReturn.current = e?.nativeEvent?.target; setSheet({ title: 'Lyrics', lyrics: true }); };
  const shareSong = async song => { try { await Native.shareSong(JSON.stringify(song)); } catch { report(new Error('Couldn’t share this audio file. Check that it is still on your phone and a sharing app is available.')); } };
  const createPlaylist = song => { setSheet(null); setName(''); setNameDialog({ kind: 'create', song }); };
  const playlistSheet = song => setSheet({ title: 'Add to playlist', items: [{ label: 'New playlist', icon: 'plus', action: () => createPlaylist(song) }, ...Object.keys(state.playlists).sort().map(title => ({ label: title, icon: 'list', action: () => command('addToPlaylist', { name: title, song }) }))] });
  const options = song => setSheet({ title: song.title, items: [
    { label: 'Play next', icon: 'skip-forward', action: () => command('enqueue', { song, next: true }) },
    { label: 'Add to queue', icon: 'list', action: () => command('enqueue', { song }) },
    { label: state.favorites.includes(String(song.id)) ? 'Remove from favourites' : 'Add to favourites', icon: 'heart', action: () => command('favorite', { song }) },
    { label: 'Add to playlist', icon: 'plus', action: () => playlistSheet(song), keep: true },
    { label: 'Share audio file', icon: 'share-2', action: () => shareSong(song) },
    ...(selection?.kind === 'playlist' ? [{ label: 'Remove from playlist', icon: 'minus-circle', action: () => command('removeFromPlaylist', { name: selection.name, song }) }] : []),
    { label: 'Song information', icon: 'info', action: () => Alert.alert(song.title, `${song.artist}\n${song.album}\n${formatTime(song.duration)} · ${(song.size / 1048576).toFixed(2)} MB\n\n${song.path}`) }
  ] });
  const timerSheet = () => setSheet({ title: 'Sleep timer', items: [...[0, 15, 30, 45, 60, 90, 120].map(minutes => ({ label: minutes ? `${minutes} minutes` : 'Off', icon: 'clock', action: () => command('sleep', { minutes }) })), { label: 'Custom minutes', icon: 'edit-2', action: () => setSheet({ title: 'Custom sleep timer', timer: true }), keep: true }] });
  const speedSheet = () => setSheet({ title: 'Playback speed', items: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(value => ({ label: `${value}×`, icon: value === state.speed ? 'check' : 'play', action: () => command('speed', { value }) })) });
  const mainMenu = () => setSheet({ title: 'Make it yours', items: [
    { label: 'Sound studio', detail: 'Fine-tune your listening', icon: 'sliders', action: openSound },
    { label: 'Manage folders', detail: 'Choose and organise local music', icon: 'folder', action: () => go('filters') },
    { label: 'Themes', detail: 'Light, dark or follow your phone', icon: 'sun', action: () => themeSheet(), keep: true },
    { label: 'Sleep timer', detail: 'Pause your music automatically', icon: 'moon', action: () => timerSheet(), keep: true },
    { label: 'Settings', detail: 'Your library and playback preferences', icon: 'settings', action: () => go('settings') }
  ] });
  const themeSheet = () => setSheet({ title: 'Theme', items: ['System', 'Light', 'Dark'].map(value => ({ label: value, selected: state.theme === value, icon: state.theme === value ? 'check' : 'circle', action: () => command('theme', { value }) })) });
  const sortBrowse = () => setSheet({ title: 'Sort by name', items: [['Name A–Z', 'asc'], ['Name Z–A', 'desc']].map(([label, value]) => ({ label, icon: browseOrder === value ? 'check' : 'align-left', action: () => setBrowseOrders(previous => ({ ...previous, [viewName]: value })) })) });
  const sortControl = () => icon('bar-chart-2', sortBrowse, c.muted, 23, { label: 'Sort by name' });
  const playlistOptions = title => setSheet({ title, items: [
    { label: 'Rename playlist', icon: 'edit-2', action: () => { setName(title); setNameDialog({ kind: 'rename', oldName: title }); } },
    { label: 'Delete playlist', icon: 'trash-2', action: () => Alert.alert('Delete playlist?', 'Your music files will stay on your phone.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await command('deletePlaylist', { name: title }); go('library'); } }]) }
  ] });
  const saveName = async () => {
    if (nameSaveLock.current || !nameDialog) return;
    const value = name.trim();
    if (!value || value.length > 100) return Alert.alert('Playlist name', 'Use a name between 1 and 100 characters.');
    if (Object.prototype.hasOwnProperty.call(state.playlists, value) && value !== nameDialog?.oldName) return Alert.alert('Playlist name', 'A playlist with that name already exists.');
    nameSaveLock.current = true; setSavingName(true);
    try {
    let result;
    if (nameDialog.kind === 'rename') result = await command('renamePlaylist', { name: nameDialog.oldName, newName: value });
    else { result = await command('createPlaylist', { name: value }); if (result && nameDialog.song) result = await command('addToPlaylist', { name: value, song: nameDialog.song }); }
    if (result) { if (nameDialog.kind === 'rename' && selection?.kind === 'playlist') setSelection({ kind: 'playlist', name: value }); setNameDialog(null); restoreFocus(overlayReturn.current); }
    } finally { nameSaveLock.current = false; setSavingName(false); }
  };
  const library = useMemo(() => createLibraryIndex(songs), [songs]);
  const selected = useMemo(() => { const items = library.select(state, selection, deferredQuery); return ['playlist', 'recent'].includes(selection?.kind) ? items : [...items].sort((a, b) => direction * compareNames(a.title, b.title)); }, [library, state.favorites, state.playlists, state.recent, state.sort, selection, deferredQuery, direction]);
  const selectedIndices = useMemo(() => new Map(selected.map((song, index) => [song.id, index])), [selected]);
  const groupData = useMemo(() => tab === 'Playlists' ? Object.entries(state.playlists).filter(([title]) => title.toLocaleLowerCase().includes(deferredQuery.toLocaleLowerCase())).map(([name, ids]) => ({ name, count: ids.filter(id => library.ids.has(id)).length })).sort((a, b) => direction * compareNames(a.name, b.name)) : library.groups(tab, deferredQuery).sort((a, b) => direction * compareNames(a.name, b.name)), [library, tab, state.playlists, deferredQuery, direction]);
  const folderPath = page === 'collection' && selection?.kind === 'Folders' ? selection.name : null;
  const directories = useMemo(() => folderPath ? library.folders(folderPath, deferredQuery) : library.roots(state.musicRoots || []), [library, folderPath, deferredQuery, state.musicRoots]);
  const folderSongs = useMemo(() => folderPath ? library.select(state, { kind: 'Folders', name: folderPath, recursive: state.includeSubfolders }, deferredQuery) : [], [library, folderPath, state.includeSubfolders, state.sort, deferredQuery]);
  const folderRows = useMemo(() => [...directories.map(item => ({ ...item, displayName: displayFolder(item.name), directory: true })), ...(folderPath ? selected.map(item => ({ ...item, displayName: item.title })) : [])].filter(item => !deferredQuery || item.displayName.toLocaleLowerCase().includes(deferredQuery.toLocaleLowerCase())).sort((a, b) => direction * compareNames(a.displayName, b.displayName)), [directories, folderPath, selected, deferredQuery, direction]);
  const onRowPlay = useStableCallback((song, index, queue) => queue ? command('jump', { index }) : play(selected, index));
  const onRowOptions = useStableCallback((song, index, queue) => queue ? queueOptions(song, index) : options(song));
  const songRow = (song, index, items, queue = false) => h(SongRow, { song, index, queue, current: state.current?.id === song.id, playing: state.playing && state.current?.id === song.id, c, styles, onPlay: onRowPlay, onOptions: onRowOptions });
  const queueOptions = (song, index) => setSheet({ title: song.title, items: [
    ...(index > 0 ? [{ label: 'Move up', icon: 'arrow-up', action: () => command('moveQueue', { from: index, to: index - 1 }) }] : []),
    ...(index < state.queue.length - 1 ? [{ label: 'Move down', icon: 'arrow-down', action: () => command('moveQueue', { from: index, to: index + 1 }) }] : []),
    { label: 'Remove from queue', icon: 'minus-circle', action: () => command('removeQueue', { index }) }
  ] });
  const groupRow = (title, detail, glyph, onPress, onLongPress, accessibilityLabel) => {
    const tone = colors[({ sliders: 0, folder: 1, sun: 2, clock: 3, music: 4, list: 1, user: 5, disc: 0, filter: 4, shield: 1 })[glyph] ?? 0];
    return h(Pressable, { style: styles.groupRow, onPress, onLongPress, accessibilityRole: 'button', accessibilityLabel },
      h(View, { style: [styles.groupIcon, { backgroundColor: tone.bg }] }, h(Pattern, { kind: tone.pattern, color: tone.ink, size: 54 }), h(Feather, { name: glyph, size: 24, color: tone.ink })),
      h(View, { style: styles.songLabels }, text(title, styles.songTitle, { numberOfLines: 1 }), text(detail, styles.subtitle, { numberOfLines: 2 })), h(Feather, { name: 'chevron-right', color: c.muted, size: 20 }));
  };
  const empty = () => h(View, { style: styles.empty }, h(Feather, { name: 'music', size: 42, color: c.muted }), text('Your library is quiet', styles.emptyTitle), text('Add music to your phone, then scan for songs.', styles.emptyDetail), button(scanning ? 'Scanning…' : 'Scan for songs', scan));
  const header = (title, extra, onBack = () => go('library')) => h(View, { style: styles.pageHeader }, icon('chevron-left', onBack), text(title, styles.pageTitle, { numberOfLines: 1 }), extra);
  const mini = h(View, { style: styles.mini },
    h(SwipeSurface, { enabled: !!state.current && !sheet && !nameDialog, onAction: command, style: { flex: 1 } }, h(Pressable, { onPress: () => go('player'), style: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 48, borderRadius: 24, overflow: 'hidden' }, accessibilityRole: 'button', accessibilityLabel: 'Open now playing' },
      h(Artwork, { song: state.current, size: 46 }), h(View, { style: styles.songLabels }, text(state.current?.title || 'Choose a song', styles.miniTitle, { numberOfLines: 1 }), text(state.current?.artist || 'Your music, offline', styles.subtitle, { numberOfLines: 1 })))),
    state.playing && h(View, { style: { marginRight: 12 } }, h(PlayingBars, { playing: true, color: accent, size: 20 })),
    h(PlaybackRipple, { playing: state.playing, color: accent, maxScale: 1.25 }, icon(state.playing ? 'pause' : 'play', () => state.current ? command('toggle') : play(songs), accent, 23, { label: state.playing ? 'Pause' : 'Play', style: { backgroundColor: c.card, borderRadius: 24 } })), icon('skip-forward', () => command('next'), c.ink, 22, { label: 'Next song' }));

  if (!Native || Platform.OS !== 'android') return h(SafeAreaView, { style: styles.root, onLayout: hideNativeSplash }, h(View, { style: styles.welcome }, h(Feather, { name: 'music', size: 64, color: accent }), text('Your music.\nYour moment.', styles.welcomeTitle), text('Install the full Android app to play music stored on your phone.', styles.welcomeDetail)));
  if (!ready) return h(Startup, { c, dark, error: initError, onRetry: () => setInitAttempt(value => value + 1), onLayout: hideNativeSplash });
  if (!permission) return h(SafeAreaView, { style: styles.root, onLayout: hideNativeSplash }, h(StatusBar, { barStyle: dark ? 'light-content' : 'dark-content' }), h(View, { style: styles.welcome }, h(Feather, { name: 'music', size: 64, color: accent }), text('Your music.\nYour moment.', styles.welcomeTitle), text('All the songs on your phone, together in one place. Offline, uninterrupted.', styles.welcomeDetail), button('Find my music', grant), h(Pressable, { onPress: () => Linking.openSettings(), style: styles.settingsLink }, text('Open app permissions', { color: accent }))));

  let content;
  if (page === 'sound') {
    content = h(SoundStudio, { state, command, c, onBack: returnFromSound, onTimer: timerSheet, tab: soundTab, onTab: setSoundTab, offsets: soundOffsets.current, report });
  } else if (page === 'player') {
    const song = state.current;
    content = h(View, { style: styles.flex }, h(View, { style: [styles.pageHeader, styles.playerHeader] }, icon('chevron-down', () => navigateRoot('Library')), text('NOW PLAYING', styles.overline), icon('more-vertical', () => song && options(song))),
      h(View, { style: [styles.playerBody, landscape && { flexDirection: 'row', gap: 20 }] },
        h(View, { testID: 'player-artwork-space', style: styles.playerArtSpace, onLayout: ({ nativeEvent: { layout } }) => setArtBounds(previous => previous.width === layout.width && previous.height === layout.height ? previous : { width: layout.width, height: layout.height }) }, artSize > 0 && h(SwipeSurface, { testID: 'player-artwork-swipe', collapsable: false, accessible: true, accessibilityRole: 'image', accessibilityLabel: 'Album artwork', enabled: !!song && !sheet && !nameDialog, onAction: command }, h(PlayingArtwork, { variant: artworkVariant, playing: state.playing, color: c.accent, size: artSize }, h(Artwork, { song, size: artSize * 0.62 })))),
        h(View, { style: [styles.playerControls, landscape && { flex: 1, justifyContent: 'center' }] },
        h(View, { style: [styles.playerTitles, landscape && { marginTop: 0, marginBottom: 0 }] }, h(View, { style: { flex: 1, minWidth: 0 } }, text(song?.title || 'Choose a song', [styles.playerTitle, landscape && { fontSize: 16 }], { numberOfLines: 1, maxFontSizeMultiplier: 1.3 }), text(state.loading ? 'Loading…' : song?.artist || 'Your music, offline', [styles.playerArtist, landscape && { fontSize: 12, marginTop: 2 }], { numberOfLines: 1, maxFontSizeMultiplier: 1.3 })), icon('heart', () => song && command('favorite', { song }), song && state.favorites.includes(String(song.id)) ? accent : c.muted, 26, { label: song && state.favorites.includes(String(song.id)) ? 'Remove from favourites' : 'Add to favourites', filled: !!song && state.favorites.includes(String(song.id)) })),
        h(PlayerProgress, { key: song?.id, c, styles, landscape, command }),
        h(View, { style: [styles.transport, landscape && { marginTop: 4 }] }, icon('shuffle', () => command('shuffle'), state.shuffle ? accent : c.muted), icon('skip-back', () => command('previous'), c.ink, 30, { label: 'Previous song' }), h(PlaybackRipple, { playing: state.playing, color: accent }, icon(state.playing ? 'pause' : 'play', () => song ? command('toggle') : play(songs), c.onAccent, 34, { label: state.playing ? 'Pause' : 'Play', style: [styles.bigPlay, landscape && { width: 48, height: 48 }] })), icon('skip-forward', () => command('next'), c.ink, 30, { label: 'Next song' }), h(View, null, icon('repeat', () => command('repeat'), state.repeat ? accent : c.muted), state.repeat === 2 && text('1', styles.repeatOne))),
        !landscape && h(View, { style: styles.playerActions }, h(Pressable, { onPress: openSound, accessibilityRole: 'button', style: [styles.playerPill, { backgroundColor: c.lavender }] }, h(Feather, { name: 'sliders', size: 20, color: accent }), text('Sound', { color: accent, fontWeight: '600' }, { numberOfLines: 1, maxFontSizeMultiplier: 1.3 })), h(Pressable, { onPress: () => go('queue'), accessibilityRole: 'button', style: styles.playerPill }, h(Feather, { name: 'list', size: 20, color: c.ink }), text('Queue', { fontWeight: '600' }, { numberOfLines: 1, maxFontSizeMultiplier: 1.3 }))),
        h(View, { style: [styles.transport, styles.playerFooter] }, landscape && icon('sliders', openSound, accent, 23, { label: 'Sound' }), landscape && icon('list', () => go('queue'), c.ink, 23, { label: 'Queue' }), icon('clock', timerSheet, state.sleepRemaining ? accent : c.muted, 23, { label: state.sleepRemaining ? 'Sleep timer active' : 'Sleep timer' }), h(Pressable, { onPress: openLyrics, style: styles.iconButton, accessibilityRole: 'button', accessibilityLabel: 'Lyrics' }, text('Lyrics', { color: c.muted, fontSize: 13 }, { maxFontSizeMultiplier: 1.2 })), icon('more-horizontal', mainMenu, c.muted, 23, { label: 'More music options' })), !landscape && state.sleepRemaining > 0 && h(SleepRemaining, { style: styles.timer, prefix: 'Sleep timer · ' }))));
  } else if (page === 'library' && tab === 'For You') {
    content = h(View, { style: styles.flex }, browseHeader('For You'), h(ForYou, { c, onSaved: async () => accept(await Native.snapshot()) }));
  } else if (page === 'recommendations-settings') {
    content = h(View, { style: styles.flex }, header('Personal mixes', null, () => go('settings')), h(PersonalMixesSettings, { c }));
  } else if (page === 'filters') {
    content = h(LibrarySettings, { state, command, c, scan, chooseFolder, onBack: () => go('settings') });
  } else if (page === 'settings') {
    content = h(View, { testID: 'settings-screen', collapsable: false, style: styles.flex }, header('Settings'), h(ScrollView, { contentContainerStyle: styles.settingsBody },
      text('LIBRARY', styles.section), groupRow('Choose folder', 'Select music folders on your phone', 'folder', chooseFolder, undefined, 'Choose folder'), groupRow('Scan for songs', scanning ? 'Scanning…' : `${songs.length} songs on this phone`, 'music', scan), groupRow('Filter audio files', 'Hide short clips and small audio files', 'filter', () => go('filters')), groupRow('Excluded folders', `${state.excludedCount || 0} folders hidden`, 'folder', () => go('filters')),
      h(View, { style: styles.groupRow }, h(View, { style: styles.flex }, text('Include subfolders', styles.songTitle), text('Include songs in nested folders when playing a folder', styles.subtitle)), h(Switch, { value: !!state.includeSubfolders, onValueChange: value => command('includeSubfolders', { value }), trackColor: { false: c.track, true: accent }, thumbColor: c.onAccent, accessibilityLabel: 'Include subfolders when playing' })),
      text('PERSONAL MIXES', styles.section), groupRow('Personal mixes', 'Local recommendations and audio analysis', 'star', () => go('recommendations-settings')),
      text('PLAYBACK', styles.section), groupRow('Sound', 'Equalizer, boost, dynamics and playback', 'sliders', openSound), groupRow('Sleep timer', state.sleepRemaining ? 'Active' : 'Off', 'clock', timerSheet), groupRow('Playback speed', `${state.speed}×`, 'play', speedSheet),
      h(View, { style: styles.groupRow }, h(View, { style: styles.flex }, text('Pause when disconnected', styles.songTitle), text('Headphones and Bluetooth', styles.subtitle)), h(Switch, { value: state.pauseDisconnect, onValueChange: value => command('pauseDisconnect', { value }), trackColor: { false: c.track, true: accent }, accessibilityLabel: 'Pause when disconnected' })),
      text('APPEARANCE', styles.section), groupRow('Theme', state.theme, 'sun', themeSheet, undefined, 'Theme'), text('ABOUT', styles.section), groupRow('Aiplayed', 'Version 1.3.0 · Your music, offline', 'music', () => Alert.alert('Aiplayed', 'An independent local music player inspired by Mi Music. No ads, streaming or accounts. Not affiliated with Xiaomi.')), groupRow('App permissions', 'Audio access and notifications', 'shield', () => Linking.openSettings()), groupRow('Clear listening history', 'Keeps music files and playlists', 'clock', () => Alert.alert('Clear listening history?', 'Recently played songs, recommendation listening signals and taste profiles will be removed. Favourites, playlists and audio analysis stay.', [{ text: 'Cancel' }, { text: 'Clear', onPress: () => command('clearHistory') }]))));
  } else if (page === 'queue') {
    content = h(View, { style: styles.flex }, header('Playing queue'), text(`${state.queue.length} songs`, styles.count), h(FlatList, { data: state.queue, keyExtractor: (item, index) => `${item.id}-${index}`, renderItem: ({ item, index }) => songRow(item, index, state.queue, true), contentContainerStyle: styles.list, ListEmptyComponent: empty }));
  } else if ((page === 'library' && tab === 'Folders') || (page === 'collection' && selection?.kind === 'Folders')) {
    const path = folderPath;
    const folderHeader = h(TextInput, { style: styles.search, value: query, onChangeText: setQuery, onFocus: () => setSearchFocused(true), onBlur: () => setSearchFocused(false), placeholder: 'Search this folder', placeholderTextColor: c.muted, accessibilityLabel: 'Search folders and tracks' });
    // Only search collapses. Keep the controls in normal list flow, without
    // reserving a second header-sized gap or stacking the shared row margins.
    const folderControlStyle = [styles.listControls, { marginTop: 0, minHeight: 44, paddingLeft: 8 }];
    const actions = h(View, { style: { paddingBottom: 8 } },
      h(View, { style: folderControlStyle }, text('Folders and songs', styles.subtitle), h(View, { style: styles.flex }), sortControl()),
      path && h(View, { style: { marginTop: 4, marginBottom: 8 } }, button(`Play folder · ${folderSongs.length} songs`, () => play(folderSongs))));
    content = h(View, { testID: `folder-screen:${path || 'roots'}`, collapsable: false, style: styles.flex },
      browseHeader(path ? displayFolder(path) : 'Folders', path ? backFolder : null),
      h(ScrollSurface, { color: c.bg }, h(IndexedSongList, { c, sessionKey, focused: searchFocused, header: folderHeader, prelude: actions, indexed: true, field: 'displayName', data: folderRows, keyExtractor: item => item.directory ? `folder:${item.name}` : `track:${item.id}`, contentContainerStyle: styles.list, refreshing: scanning, onRefresh: scan,
        renderItem: ({ item }) => item.directory ? groupRow(item.name === '/storage/emulated/0' ? 'Internal storage' : folderName(item.name), `${item.count} songs in this folder tree`, 'folder', () => go('collection', { kind: 'Folders', name: item.name, root: selection?.root || item.name }), () => folderOptions(item.name), `Open folder ${item.name}`) : songRow(item, selectedIndices.get(item.id), selected),
        ListEmptyComponent: h(View, { style: styles.empty }, text('No music here yet', styles.emptyTitle), text('Choose music folders or adjust library filters in Settings.', styles.emptyDetail)) })));
  } else {
    const collection = page === 'collection';
    const listHeader = h(View, null,
      h(TextInput, { style: styles.search, value: query, onChangeText: setQuery, onFocus: () => setSearchFocused(true), onBlur: () => setSearchFocused(false), placeholder: 'Search your music', placeholderTextColor: c.muted, accessibilityLabel: 'Search your music', returnKeyType: 'search', autoCorrect: false }),
      h(View, { style: styles.listControls }, text(scanning ? 'Scanning…' : `${collection || tab === 'Songs' ? selected.length : groupData.length} ${!collection && tab !== 'Songs' ? tab.toLowerCase() : 'songs'}`, styles.subtitle), h(View, { style: styles.flex }),
        (collection || tab === 'Songs') && h(Pressable, { onPress: () => play(selected, Math.floor(Math.random() * selected.length), true), style: styles.shuffleAll, accessibilityRole: 'button' }, text('Shuffle all', { color: accent, fontWeight: '600' })),
        !['playlist', 'recent'].includes(selection?.kind) && sortControl()));
    content = h(View, { style: styles.flex },
      browseHeader(collection ? selection?.name : tab, collection ? () => { setSelection(null); setPage('library'); setQuery(''); } : null, selection?.kind === 'playlist' ? icon('more-vertical', () => playlistOptions(selection.name)) : null),
      h(ScrollSurface, { color: c.bg }, collection || tab === 'Songs'
        ? h(IndexedSongList, { c, sessionKey, focused: searchFocused, header: listHeader, rowHeight: styles.songRow.height, indexed: !['playlist', 'recent'].includes(selection?.kind), field: 'title',  data: selected, renderItem: ({ item, index }) => songRow(item, index, selected), contentContainerStyle: styles.list, refreshing: scanning, onRefresh: scan, ListEmptyComponent: empty })
        : h(IndexedSongList, { c, sessionKey, focused: searchFocused, header: listHeader, prelude: tab === 'Playlists' && groupData.length > 0 ? h(View, { style: { alignItems: 'center', paddingVertical: 16 } }, button('New playlist', () => createPlaylist())) : null, indexed: true, field: 'name', data: groupData, keyExtractor: item => item.name, contentContainerStyle: styles.list, renderItem: ({ item }) => groupRow(item.name, `${item.count} songs`, tab === 'Playlists' ? 'list' : tab === 'Artists' ? 'user' : 'disc', () => go('collection', { kind: tab === 'Playlists' ? 'playlist' : tab, name: item.name }), tab === 'Playlists' ? () => playlistOptions(item.name) : undefined), ListEmptyComponent: tab === 'Playlists' ? h(View, { style: styles.empty }, text('Make it a playlist', styles.emptyTitle), text('Your favourite combinations, ready whenever you are.', styles.emptyDetail), button('New playlist', () => createPlaylist())) : empty })));
  }

  return h(SafeAreaView, { style: styles.root, onLayout: hideNativeSplash }, h(StatusBar, { barStyle: dark ? 'light-content' : 'dark-content', backgroundColor: c.bg }), content, page !== 'player' && mini, page !== 'player' && h(View, { style: styles.bottomNav }, ...[
    ['Library', 'music', { bg: c.lavender, ink: c.purpleInk, detail: c.mintInk, pattern: 'arcs' }],
    ['Playlists', 'list', { bg: c.mint, ink: c.mintInk, detail: c.blueInk, pattern: 'checks' }],
    ['Sound', 'sliders', { bg: c.peach, ink: c.peachInk, detail: c.purpleInk, pattern: 'waves' }],
    ['Settings', 'settings', { bg: c.blue, ink: c.blueInk, detail: c.roseInk, pattern: 'dots' }],
  ].map(([title, glyph, tone]) => {
      const active = activeDestination(page, tab, selection) === title;
      const onPress = () => navigateRoot(title);
      return h(View, { key: title, style: styles.navSlot }, h(Pressable, { key: title, onPress, style: ({ pressed }) => [styles.navItem, { opacity: pressed && !c.dark ? 0.94 : 1 }], accessibilityRole: 'tab', accessibilityLabel: title, accessibilityState: { selected: active } },
        ({ pressed }) => h(React.Fragment, null, (active || pressed) && h(TabHighlight, { tone }),
          h(View, { style: styles.navIcon }, h(Feather, { name: glyph, size: 22, color: active || pressed ? tone.ink : c.muted })), text(title, [styles.navLabel, (active || pressed) && { color: tone.ink, fontWeight: '700' }]))));
    })),
    folderPicker && h(FolderPicker, { c, roots: state.musicRoots || [], onClose: () => setFolderPicker(false), onSelect: selectFolder }),
    h(Sheet, { scrollable: !sheet?.lyrics, visible: !!sheet, title: sheet?.title, c, onClose: () => setSheet(null), returnFocus: sheet?.browse ? browseTrigger : overlayReturn.current },
      sheet?.lyrics ? h(Lyrics, { key: state.current?.id ?? 'none', song: state.current, c }) : sheet?.timer ? h(SleepTimer, { c, command, onClose: () => setSheet(null) }) : sheet?.browse ? destinations.map(([title, glyph]) => h(Pressable, { key: title, accessibilityRole: 'button', accessibilityLabel: title, accessibilityState: { selected: currentBrowse === title }, onPress: () => selectBrowse(title), style: [styles.sheetItem, { backgroundColor: currentBrowse === title ? c.lavender : c.card }] }, h(Feather, { name: glyph, size: 24, color: accent }), text(title, { flex: 1, color: c.ink, fontSize: 17, fontWeight: '600' }), currentBrowse === title && h(Feather, { name: 'check', size: 24, color: accent })))
      : (sheet?.items || []).map((item, index) => h(Pressable, { key: index, accessibilityRole: 'button', accessibilityLabel: item.label, accessibilityHint: item.detail, accessibilityState: item.selected === undefined ? undefined : { selected: item.selected }, style: [styles.sheetItem, { backgroundColor: colors[index % colors.length].bg }], onPress: () => { if (!item.keep) setSheet(null); item.action(); } }, h(Feather, { name: item.icon || 'music', size: 24, color: accent }), h(View, { style: styles.flex }, text(item.label, styles.sheetItemText), item.detail && text(item.detail, styles.subtitle))))),
    h(Modal, { visible: !!nameDialog, transparent: true, animationType: 'fade', onRequestClose: closeName }, h(KeyboardAvoidingView, { behavior: 'padding', style: styles.dialogBackdrop }, h(Pressable, { onPress: closeName, disabled: savingName, accessibilityRole: 'button', accessibilityLabel: 'Close dialog', feedback: false, style: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } }), h(View, { style: styles.dialog }, text(nameDialog?.kind === 'rename' ? 'Rename playlist' : 'New playlist', styles.sheetTitle), h(TextInput, { value: name, onChangeText: setName, autoFocus: true, maxLength: 100, accessibilityLabel: 'Playlist name', placeholder: 'Playlist name', placeholderTextColor: c.muted, style: styles.nameInput, onSubmitEditing: saveName }), h(View, { style: styles.dialogButtons }, h(Pressable, { onPress: closeName, disabled: savingName, style: styles.cancel }, text('Cancel', { color: c.muted })), button(savingName ? 'Saving…' : 'Save', saveName, undefined, savingName))))));
}

function makeStyles(c, compactPlayer = false, fontScale = 1) {
  const accent = c.accent;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg }, flex: { flex: 1 }, text: { color: c.ink, fontSize: 15 }, iconButton: { borderRadius: 24, overflow: 'hidden', width: 48, height: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    button: { overflow: 'hidden', backgroundColor: c.peach, borderRadius: 28, minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25, paddingVertical: 12 }, buttonText: { color: c.peachInk, fontSize: 15, fontWeight: '600' },
    browseButton: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 28, backgroundColor: c.lavender, overflow: 'hidden', justifyContent: 'center' },
    libraryHeader: { gap: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 4 }, brand: { fontSize: 23, fontWeight: '700', letterSpacing: -1 },
    search: { marginHorizontal: 20, backgroundColor: `${c.card}D9`, borderWidth: 1, borderColor: c.dark ? c.controlBorder : c.line, color: c.ink, paddingHorizontal: 18, paddingVertical: 9, minHeight: 42, borderRadius: 16, fontSize: 15 }, listControls: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 4, paddingLeft: 24, paddingRight: 12, minHeight: 52 }, shuffleAll: { minHeight: 48, justifyContent: 'center', borderRadius: 24, overflow: 'hidden', padding: 10 },
    list: { paddingHorizontal: 16, paddingBottom: 16 }, songRow: { borderRadius: 18, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 9, height: Math.max(72, Math.ceil(36 * fontScale + 24)) }, songLabels: { flex: 1, paddingHorizontal: 13, gap: 6 }, songTitle: { fontSize: 15, lineHeight: 20, fontWeight: '500' }, subtitle: { fontSize: 12, lineHeight: 16, color: c.muted },
    bottomNav: { flexDirection: 'row', backgroundColor: c.card, paddingTop: 6, paddingBottom: 4 }, navSlot: { flex: 1, minWidth: 0, paddingHorizontal: 4 }, navItem: { borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', minHeight: 58, paddingVertical: 4, gap: 2 }, navIcon: { width: 58, height: 32, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, navLabel: { fontSize: 11, color: c.muted }, mini: { overflow: 'hidden', flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 6, marginBottom: 10, paddingLeft: 12, paddingRight: 6, paddingVertical: 5, backgroundColor: c.lavender, borderRadius: 24 }, miniTitle: { fontSize: 14, fontWeight: '600' },
    pageHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 68 }, pageTitle: { flex: 1, fontSize: 24, fontWeight: '600' }, overline: { flex: 1, textAlign: 'center', color: c.muted, fontSize: 11, letterSpacing: 2 },
    playerHeader: { minHeight: compactPlayer ? 48 : 60, flexShrink: 0 },
    playerBody: { flex: 1, minHeight: 0, paddingHorizontal: 24, paddingTop: 4, paddingBottom: 10 },
    playerArtSpace: { flex: 1, minWidth: 0, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
    playerControls: { flexShrink: 0, alignSelf: 'stretch', minWidth: 0 },
    playerTitles: { flexDirection: 'row', alignItems: 'center', marginTop: compactPlayer ? 4 : 12, marginBottom: compactPlayer ? 4 : 8 },
    playerTitle: { fontSize: compactPlayer ? 20 : 24, fontWeight: '600' }, playerArtist: { color: c.muted, fontSize: compactPlayer ? 13 : 15, marginTop: 4 },
    slider: { width: '100%', height: compactPlayer ? 28 : 36 }, times: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
    transport: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: compactPlayer ? 6 : 12 },
    playerActions: { width: '100%', flexDirection: 'row', gap: 12, marginTop: compactPlayer ? 8 : 12 },
    playerPill: { overflow: 'hidden', flex: 1, minHeight: 48, borderRadius: 28, backgroundColor: c.line, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
    playerFooter: { marginTop: compactPlayer ? 4 : 8 }, bigPlay: { width: compactPlayer ? 56 : 72, height: compactPlayer ? 56 : 72, borderRadius: 36, backgroundColor: accent },
    repeatOne: { position: 'absolute', right: 6, bottom: 3, fontSize: 10, color: accent }, timer: { color: accent, fontSize: 12, marginTop: 4, textAlign: 'center' },
    groupRow: { overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 12, paddingVertical: 12, backgroundColor: c.card, borderRadius: 22, marginBottom: 8 }, groupIcon: { width: 54, height: 54, borderRadius: 18, overflow: 'hidden', backgroundColor: c.line, alignItems: 'center', justifyContent: 'center' }, settingsBody: { paddingHorizontal: 24, paddingBottom: 28 }, section: { color: accent, fontSize: 11, letterSpacing: 1.8, fontWeight: '600', marginTop: 26, marginBottom: 12 }, count: { color: c.muted, fontSize: 13, paddingHorizontal: 24, marginVertical: 10 },
    empty: { padding: 32, paddingTop: 44, alignItems: 'center', gap: 20 }, emptyTitle: { fontSize: 21, fontWeight: '600', textAlign: 'center' }, emptyDetail: { fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 22 }, welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36, gap: 28 }, welcomeTitle: { fontSize: 38, fontWeight: '700', textAlign: 'center', letterSpacing: -1 }, welcomeDetail: { color: c.muted, fontSize: 16, lineHeight: 25, textAlign: 'center' }, settingsLink: { padding: 12 },
    modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.dialogScrim }, backdrop: { flex: 1 }, sheet: { backgroundColor: c.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20, maxHeight: '80%' }, sheetHandle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', backgroundColor: c.track, marginBottom: 20 }, menuIcon: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }, sheetTitle: { fontSize: 23, fontWeight: '600', marginBottom: 16 }, sheetItem: { flexDirection: 'row', alignItems: 'center', minHeight: 76, paddingVertical: 14, paddingHorizontal: 12, gap: 10, borderRadius: 22, marginBottom: 10, overflow: 'hidden' }, sheetItemText: { fontSize: 15, fontWeight: '600', flexShrink: 1 }, dialogBackdrop: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: c.dialogScrim }, dialog: { padding: 24, backgroundColor: c.card, borderRadius: 24 }, nameInput: { color: c.ink, padding: 12, borderBottomWidth: 1, borderColor: c.dark ? c.controlBorder : c.line, fontSize: 16, marginBottom: 24 }, dialogButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 14 }, cancel: { padding: 12 }
  });
}

export default function App() { return h(GestureHandlerRootView, { style: { flex: 1 } }, h(SafeAreaProvider, null, h(ThemeProvider, null, h(MotionProvider, null, h(MusicApp))))); }



