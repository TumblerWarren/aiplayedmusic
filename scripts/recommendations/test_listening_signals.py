"""Execute the production v1->v2 schema migration and retention/reset SQL in SQLite."""
from pathlib import Path
import re
import sqlite3
import unittest

SOURCE = Path('modules/local-music/android/src/main/java/app/localmusic/player/recommendations/RecommendationStore.java').read_text()
CREATE = SOURCE.split('void onCreate(SQLiteDatabase db){', 1)[1].split('migrateHabits(db);', 1)[0]
MIGRATION = SOURCE.split('void migrateHabits(SQLiteDatabase db){', 1)[1].split('@Override public void onUpgrade', 1)[0]


def statements(source):
    return re.findall(r'db.execSQL\("([^"\n]+)"\);', source)


class SignalTests(unittest.TestCase):
    def legacy(self):
        db = sqlite3.connect(':memory:')
        db.execute('PRAGMA foreign_keys=ON')
        for sql in statements(CREATE):
            db.execute(sql)
        embedding = bytes(range(256)) * 15
        db.execute("INSERT INTO tracks(id,identity,fingerprint,status,embedding) VALUES(1,'uri','fp','ready',?)", (embedding,))
        db.execute('INSERT INTO segments VALUES(1,0,0,?)', (embedding,))
        db.execute("INSERT INTO sessions(id,track_id,started,ended,duration,played,covered,reason) VALUES('old',1,100000,200000,120000,100000,100000,'completion')")
        db.commit()
        return db, embedding

    def migrate(self, db):
        with db:
            for sql in statements(MIGRATION):
                db.execute(sql)

    def test_migration_preserves_fp32_analysis_and_does_not_invent_local_times(self):
        db, embedding = self.legacy()
        self.migrate(db)
        self.assertEqual(db.execute('SELECT status,embedding FROM tracks').fetchone(), ('ready', embedding))
        self.assertEqual(db.execute('SELECT embedding FROM segments').fetchone()[0], embedding)
        self.assertEqual(db.execute('SELECT played,covered,unique_covered,origin,selected FROM sessions').fetchone(), (100000, 100000, None, 'legacy', 0))
        self.assertEqual(db.execute('SELECT COUNT(*) FROM listening_context').fetchone()[0], 0)
        self.assertEqual(db.execute('SELECT revision FROM habit_revision').fetchone()[0], 0)

    def test_history_reset_cascades_context_and_weights_but_keeps_analysis(self):
        db, embedding = self.legacy()
        self.migrate(db)
        db.execute("INSERT INTO listening_context VALUES('old','2026-11-04',3,8,'Asia/Kolkata',100000)")
        db.execute("INSERT INTO habit_ranker VALUES(1,1,'[0.23,0.12,0.16,0.04]',0)")
        reset = SOURCE.split('void clearHistory(){', 1)[1].split('void clearAnalysis()', 1)[0]
        for table in re.findall(r'db.delete\("(\w+)",null,null\)', reset):
            db.execute('DELETE FROM ' + table)
        for table in ['sessions', 'profiles', 'snapshots', 'listening_context', 'habit_ranker']:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0], 0, table)
        self.assertEqual(db.execute('SELECT embedding FROM tracks').fetchone()[0], embedding)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM segments').fetchone()[0], 1)

    def test_retention_does_not_leave_context_for_deleted_sessions(self):
        db, _ = self.legacy()
        self.migrate(db)
        db.execute("INSERT INTO listening_context VALUES('old','2026-11-04',3,8,'UTC',100000)")
        db.execute("DELETE FROM sessions WHERE started < ?", (100001,))
        self.assertEqual(db.execute('SELECT COUNT(*) FROM listening_context').fetchone()[0], 0)
        self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_checkpoint_update_preserves_existing_context_rows(self):
        db, _ = self.legacy()
        self.migrate(db)
        db.execute("INSERT INTO listening_context VALUES('old','2026-11-04',3,8,'UTC',100000)")
        db.execute("UPDATE sessions SET played=110000 WHERE id='old'")
        self.assertEqual(db.execute('SELECT heard FROM listening_context').fetchone()[0], 100000)

    def test_changed_file_does_not_inherit_new_format_listening(self):
        db, _ = self.legacy()
        self.migrate(db)
        db.execute("UPDATE sessions SET file_fingerprint='fp' WHERE id='old'")
        query = re.search(r'rawQuery\("(SELECT s.id,s.track_id[^"\n]+)"', SOURCE).group(1)
        self.assertEqual(len(db.execute(query).fetchall()), 1)
        db.execute("UPDATE tracks SET fingerprint='changed-file' WHERE id=1")
        self.assertEqual(db.execute(query).fetchall(), [], 'a reused track ID must not attach old listening to a changed file')


if __name__ == '__main__':
    unittest.main()
