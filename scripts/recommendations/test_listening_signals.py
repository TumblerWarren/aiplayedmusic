"""Execute the production aggregate SQL against real session rows."""
from pathlib import Path
import re
import sqlite3
import unittest

SOURCE=Path('modules/local-music/android/src/main/java/app/localmusic/player/recommendations/RecommendationStore.java').read_text()
DDL=re.search(r'db.execSQL\("(CREATE TABLE sessions[^\"]+)"\)',SOURCE).group(1)
QUERY=re.search(r'String query="([^\"]+)";',SOURCE).group(1)


class SignalTests(unittest.TestCase):
    def test_unheard_is_neutral_and_open_play_is_only_recent(self):
        db=sqlite3.connect(':memory:');db.execute(DDL)
        def add(identifier,track,played,covered,reason,early=0):
            db.execute('INSERT INTO sessions(id,track_id,started,ended,duration,played,covered,reason,early_next) VALUES(?,?,?,?,?,?,?,?,?)',(identifier,track,100000,110000,120000,played,covered,reason,early))
        add('unheard-error',1,0,0,'error')
        add('unheard-interruption',2,0,0,'interruption')
        add('currently-playing',3,2000,2000,'open')
        for i in range(5):add('good-'+str(i),4,100000,100000,'completion')
        for i in range(5):add('skip-'+str(i),5,1000,1000,'next',1)
        rows={row[0]:row for row in db.execute(QUERY,(0,))}
        self.assertNotIn(1,rows);self.assertNotIn(2,rows)
        self.assertEqual(rows[3][2:4],(0,0),'Open plays have no premature positive/negative contribution')
        self.assertEqual(rows[3][4],110000,'Actual current playback can receive the recency penalty')
        self.assertEqual(rows[4][2],3,'Repeated positive contributions are capped per day')
        self.assertEqual(rows[5][3],2,'Repeated deliberate skips are capped per day')


if __name__=='__main__':unittest.main()
