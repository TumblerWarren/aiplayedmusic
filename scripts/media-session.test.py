import unittest
from android_media_session import is_playing, session_text

def dump(state, package='app.localmusic.player', active=True):
    return ('    Aiplayed session\n      package='+package+'\n      active='+str(active).lower()+
            '\n      state=PlaybackState {state='+state+', position=1250, speed=1.0}\n'+
            '      metadata: description=A00 Song, AArtist, AAlbum\n')

class SessionTests(unittest.TestCase):
    def test_old_numeric_and_android_15_named_playing(self):
        for state in ['3','PLAYING(3)']: self.assertTrue(is_playing(dump(state)))
    def test_pause_buffer_error_and_inactive_fail(self):
        for state in ['2','PAUSED(2)','BUFFERING(6)','ERROR(7)','13']:
            self.assertFalse(is_playing(dump(state)))
        self.assertFalse(is_playing(dump('PLAYING(3)',active=False)))
    def test_other_players_cannot_satisfy_aiplayed_check(self):
        other = dump('PLAYING(3)',package='other.player')
        self.assertFalse(is_playing(other))
        self.assertFalse(is_playing(dump('PAUSED(2)')+other))
        self.assertTrue(is_playing(other+dump('PLAYING(3)')))
        self.assertNotIn('other.player',session_text(dump('PAUSED(2)')+other))

if __name__ == '__main__': unittest.main()
