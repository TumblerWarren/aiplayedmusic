"""Focused offline checks. Requires a JDK; no Android SDK, model download or audio decode."""
from pathlib import Path
import subprocess
import tempfile

root = Path('modules/local-music/android/src/main/java/app/localmusic/player/recommendations')
tests = Path('scripts/recommendations/tests')
with tempfile.TemporaryDirectory(prefix='aiplayed-habits-') as classes:
    production = ['AnalysisPolicy.java', 'ListeningClock.java', 'ListeningContext.java', 'ListeningHabits.java', 'TasteRanker.java']
    fixtures = ['EngineLogicTest.java', 'ListeningHabitsTest.java', 'HabitEvaluation.java']
    subprocess.run(['java', 'com.sun.tools.javac.Main', '-d', classes, *[str(root / f) for f in production], *[str(tests / f) for f in fixtures]], check=True, timeout=60)
    for name in ['EngineLogicTest', 'ListeningHabitsTest']:
        subprocess.run(['java', '-cp', classes, name], check=True, timeout=60)
    subprocess.run(['java', '-cp', classes, 'HabitEvaluation', 'verification/recommendations/contextual-personalization.json'], check=True, timeout=60)
for name in ['test_listening_signals.py', 'test_recorder.py']:
    subprocess.run(['python', str(Path('scripts/recommendations') / name)], check=True, timeout=60)
