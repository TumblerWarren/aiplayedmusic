const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { harness, nodes } = require('./ui-harness.cjs');

test('the retired native screens, theme, renderer and bridge cannot be packaged or opened', () => {
  const root = 'modules/local-music/android/src/main';
  for (const name of ['java/app/localmusic/player/NativeMusicActivity.java', 'java/app/localmusic/player/Ui.java', 'res/values/styles.xml', 'res/drawable/ic_app.xml'])
    assert(!fs.existsSync(path.join(root, name)), 'Remove legacy UI file ' + name);
  const files = fs.readdirSync(root, { recursive: true }).filter(p => /\.(?:java|kt|xml)$/.test(p));
  for (const name of files) {
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    assert(!/NativeMusicActivity|MusicNative(?:Dark)?Theme|\bUi\.|AsyncFunction\("openNative"\)/.test(text), 'Legacy UI reference in ' + name);
    assert(!/extends\s+(?:Activity|AppCompatActivity)|setContentView\(|android\.widget\./.test(text), 'Duplicate native application UI in ' + name);
  }
  const service = fs.readFileSync(path.join(root, 'java/app/localmusic/player/PlaybackService.java'), 'utf8');
  assert(service.includes('getLaunchIntentForPackage(getPackageName())'), 'notification opens the current launcher');
  const bridge = fs.readFileSync(path.join(root, 'java/app/localmusic/player/LocalMusicModule.kt'), 'utf8');
  for (const required of ['AsyncFunction("shareSong")', 'Intent.ACTION_SEND', 'Intent.EXTRA_STREAM', 'Intent.FLAG_GRANT_READ_URI_PERMISSION', 'ClipData.newRawUri', 'Intent.createChooser']) assert(bridge.includes(required));
});

test('packaging gate rejects legacy screens or themes while allowing Android system UI', () => {
  const { verifyCurrentUi } = require('./verify-apk-branding.cjs');
  assert(verifyCurrentUi('MainActivity PlaybackService', 'Theme.App.SplashScreen'));
  assert.throws(() => verifyCurrentUi('app.localmusic.player.NativeMusicActivity', ''), /retired native interface/);
  assert.throws(() => verifyCurrentUi('MainActivity', 'style/MusicNativeDarkTheme'), /retired native interface/);
});

test('custom sleep minutes retain the full 1–1440 range and reject invalid input', () => {
  const ui = harness('src/SleepTimer.js', ['SleepTimer', 'timerMinutes'], { useMusicSlice: () => ({ sleepRemaining: 125000 }) });
  for (const value of ['1', '77', '1440']) assert.equal(ui.context.exports.timerMinutes(value), Number(value));
  for (const value of ['', '0', '-5', '1441', '1.5', '1e2', '2 minutes']) assert.equal(ui.context.exports.timerMinutes(value), null);
  const commands = [], closed = [];
  const props = { c: {}, command: async (...args) => { commands.push(args); return {}; }, onClose: () => closed.push(true) };
  let tree = ui.render('SleepTimer', props); ui.effects();
  const input = () => nodes(tree).find(n => n.type === 'TextInput');
  const save = () => nodes(tree).find(n => n.props.accessibilityLabel === 'Set sleep timer').props.onPress();
  assert.equal(input().props.value, '3', 'prefill the rounded-up remaining timer');
  input().props.onChangeText('0'); tree = ui.render('SleepTimer', props);
  return save().then(async () => {
    tree = ui.render('SleepTimer', props); assert(nodes(tree).some(n => n.props.accessibilityRole === 'alert')); assert.equal(commands.length, 0);
    input().props.onChangeText('77'); tree = ui.render('SleepTimer', props); await save();
    assert.equal(JSON.stringify(commands), JSON.stringify([['sleep', { minutes: 77 }]])); assert.equal(closed.length, 1);
  });
});

test('custom timer commits once and failed or late saves cannot close a different menu', async () => {
  const ui = harness('src/SleepTimer.js', ['SleepTimer', 'timerMinutes'], { useMusicSlice: () => ({}) });
  let finish, count = 0, closed = 0;
  const props = { c: {}, command: () => { count++; return new Promise(resolve => { finish = resolve; }); }, onClose: () => closed++ };
  let tree = ui.render('SleepTimer', props); ui.effects();
  const save = () => nodes(tree).find(n => n.props.accessibilityLabel === 'Set sleep timer').props.onPress();
  const pending = save(); save(); assert.equal(count, 1);
  finish(undefined); await pending; tree = ui.render('SleepTimer', props);
  assert.equal(closed, 0); assert(nodes(tree).some(n => n.props.accessibilityRole === 'alert'));
  const late = save(); ui.slots.forEach(slot => slot?.cleanup?.()); finish({}); await late;
  assert.equal(closed, 0, 'closed custom timer must not dismiss a replacement sheet');
});
