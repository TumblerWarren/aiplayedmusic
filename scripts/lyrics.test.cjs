const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { harness, nodes } = require('./ui-harness.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('LRC timestamps, repeat stamps, offsets, blank lines, Unicode and seeking use displayed lyric order', async () => {
  const { parseLyrics, currentLyric } = await import('../src/lyrics.js');
  const lyrics = parseLyrics('\uFEFF[ar:Artist]\r\n[offset:500]\r\n[00:10.5]Later\r\n[00:02.25][00:05]こんにちは\r\n[00:08]\r\n');
  assert.equal(lyrics.timed, true);
  assert.deepEqual(lyrics.lines, [{ time: 1750, text: 'こんにちは' }, { time: 4500, text: 'こんにちは' }, { time: 7500, text: '' }, { time: 10000, text: 'Later' }]);
  for (const [position, expected] of [[0,-1], [1750,0], [4499,0], [4500,1], [7500,2], [10000,3], [3000,0]])
    assert.equal(currentLyric(lyrics.lines, position), expected);
  assert.deepEqual(parseLyrics('First\r\nSecond'), { timed: false, lines: [{ text: 'First' }, { text: 'Second' }] });
  assert.equal(parseLyrics('[offset:-200]\n[00:00.01]Start').lines[0].time, 210);
});

test('lyrics use saved text, preserve it on picker cancellation/error, and remove only the selected song', async () => {
  const api = await import('../src/lyrics.js');
  let picked = null, chooses = 0, removes = 0;
  const native = {
    getLyrics: async id => { assert.equal(id, '7'); return '[00:00]Saved\n[00:10]Later'; },
    chooseLyrics: async id => { assert.equal(id, '7'); chooses++; if (picked instanceof Error) throw picked; return picked; },
    removeLyrics: async id => { assert.equal(id, '7'); removes++; return ''; },
  };
  const progress = { position: 12000, currentId: 7 };
  const ui = harness('src/Lyrics.js', ['Lyrics'], { ...api, Native: native, useMusicSlice: () => progress, useMotionAllowed: () => false, useWindowDimensions: () => ({ height: 800 }) });
  const props = { song: { id: 7, title: 'Song', artist: 'Artist' }, c: {} };
  const render = () => ui.render('Lyrics', props);
  render(); ui.effects(); await flush();
  let tree = render(), list = nodes(tree).find(n => n.type === 'FlatList');
  assert.equal(list.props.data[0].text, 'Saved'); assert.equal(list.props.extraData, 1);
  const button = label => nodes(tree).find(n => n.props.accessibilityLabel === label);
  await button('Replace lyrics file').props.onPress(); tree = render();
  assert.equal(nodes(tree).find(n => n.type === 'FlatList').props.data[0].text, 'Saved');
  picked = new Error('Unreadable file'); await button('Replace lyrics file').props.onPress(); tree = render();
  assert(nodes(tree).some(n => n.props.accessibilityRole === 'alert'));
  assert.equal(nodes(tree).find(n => n.type === 'FlatList').props.data[0].text, 'Saved');
  picked = 'Replacement lyrics'; await button('Replace lyrics file').props.onPress(); tree = render();
  assert.equal(nodes(tree).find(n => n.type === 'FlatList').props.data[0].text, 'Replacement lyrics');
  await button('Remove lyrics').props.onPress(); tree = render();
  assert(button('Choose lyrics file')); assert.equal(removes, 1); assert.equal(chooses, 3);
});

test('file picker locks repeated taps; late results cannot update an unmounted lyrics view', async () => {
  const api = await import('../src/lyrics.js');
  let finish, requests = 0;
  const ui = harness('src/Lyrics.js', ['Lyrics'], { ...api, Native: {
    getLyrics: async () => '', chooseLyrics: () => { requests++; return new Promise(resolve => { finish = resolve; }); },
  }, useMusicSlice: () => ({}), useMotionAllowed: () => false, useWindowDimensions: () => ({ height: 800 }) });
  const props = { song: { id: 9, title: 'Song' }, c: {} };
  ui.render('Lyrics', props); ui.effects(); await flush();
  const tree = ui.render('Lyrics', props), button = nodes(tree).find(n => n.props.accessibilityLabel === 'Choose lyrics file');
  const operation = button.props.onPress(); button.props.onPress(); assert.equal(requests, 1);
  ui.slots.forEach(slot => slot?.cleanup?.());
  finish('Old track lyrics'); await operation;
  assert.equal(ui.slots[0], '', 'late file result must not enter a closed or changed-song view');
});

test('Android lyric reader validates actual UTF-8 bytes and the size limit before replacing saved lyrics', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiplayed-lyrics-'));
  try {
    const source = `package app.localmusic.player;
import java.io.*;
import java.nio.charset.StandardCharsets;
public class LyricsFileTest {
  static void rejects(byte[] bytes) throws Exception {
    try { LyricsFile.read(new ByteArrayInputStream(bytes)); throw new AssertionError("Invalid lyrics accepted"); }
    catch (IOException expected) {}
  }
  public static void main(String[] args) throws Exception {
    String text = "こんにちは\\n[00:01.2]Hello";
    if (!LyricsFile.read(new ByteArrayInputStream(("\\uFEFF" + text).getBytes(StandardCharsets.UTF_8))).equals(text)) throw new AssertionError("UTF-8/BOM");
    byte[] limit = new byte[LyricsFile.LIMIT]; java.util.Arrays.fill(limit, (byte)'a');
    if (LyricsFile.read(new ByteArrayInputStream(limit)).length() != limit.length) throw new AssertionError("Limit");
    rejects(new byte[LyricsFile.LIMIT + 1]); rejects(new byte[]{(byte)0xc3, 0x28});
    rejects(new byte[]{'a',0,'b'}); rejects(new byte[0]); rejects("  \\n".getBytes(StandardCharsets.UTF_8));
    System.out.println("Lyric reader byte validation passed");
  }
}`;
    const file = path.join(dir, 'LyricsFileTest.java'); fs.writeFileSync(file, source);
    const compile = spawnSync('java', ['com.sun.tools.javac.Main', '-d', dir, 'modules/local-music/android/src/main/java/app/localmusic/player/LyricsFile.java', file], { encoding: 'utf8' });
    assert.equal(compile.status, 0, compile.stderr);
    const run = spawnSync('java', ['-cp', dir, 'app.localmusic.player.LyricsFileTest'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the current Lyrics button cannot launch the legacy native player', () => {
  const app = fs.readFileSync('App.js', 'utf8');
  assert(!app.includes('openNative('));
});
