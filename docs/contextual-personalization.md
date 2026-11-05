# Listening habits and contextual personal mixes

Unreleased source change based on main `930eb3cacd965df3075e6ff828e982b108f64da1`. This extends the existing S-SONDO FP32 engine; it adds no audio model, inference runtime, download or permission. Exact APK size requires an Android build.

## What changes

The engine combines long-term engagement, recent interests, local-hour/weekday routines, rediscovery and the existing audio embeddings. Up to three separate audio taste profiles remain separate; current habits affect both song ordering and which profile is shown first. Artist/album spacing, duplicate removal, eligibility checks and fixed queues are retained. After there is enough history, up to three slots in a full thirty-track mix prefer eligible unheard neighbours from the same taste, with spacing and small-library fallback.

Search, library, playlist, folder, shuffle, queue and recommendation origins are recorded natively. Starting a recommendation queue is not treated as choosing its first song. Automatic continuation and repeat are weaker evidence than an explicit selection or replay. Queue origin survives process restart.

## Listening time and dates

Heard wall time comes from the monotonic playback clock, excluding pauses, buffering and seek jumps. Media coverage stays separate from wall time; merged heard ranges prevent replaying one small section from fabricating full-song coverage. Ranges are capped at 256 per session; pathological seeking conservatively undercounts further distinct coverage.

The recorder splits actual heard time across local calendar hours, retaining the local date, weekday and IANA timezone. Midnight, DST and timezone changes do not add heard time. A wall-clock correction differing by over two seconds from monotonic elapsed time contributes no context for that interval. Resuming after thirty minutes without heard audio starts a new visit and closes the old one neutrally.

Context is an overlapping circular four-hour kernel, with stronger evidence for the same weekday and weaker evidence for another day of the same weekday/weekend class. There are no inferred mood, religion, activity or seasonal labels. Exact calendar dates are used for caps, decay and retention, not unsupported anniversary predictions.

## Engagement and ranking

Positive evidence combines actual heard time and unique media coverage. The target is 70% of track duration, capped at ten minutes: meaningful listening to long medleys need not reach the end. Open sessions contribute only after two minutes and substantial coverage. Contributions are capped at three per track/local day. Deliberate early Next remains weak negative evidence; errors, focus loss and disconnection are not dislikes. Context-specific skips have more effect in the matching context than elsewhere.

Long-term evidence decays over 45 days; recent interests over seven days; routines over thirty days. A routine needs matching evidence on at least three distinct days before gaining confidence. One day of repeat playback cannot create a routine. Personal scoring gradually replaces the old audio-led fallback as evidence grows across multiple days. Explanations such as “Often played around this time” are shown only when their evidence threshold is met; artist subtitles remain factual.

The small Java pairwise learner uses only an explicitly skipped track and a subsequent deliberate, sustained choice within thirty minutes. Unheard songs are never negative labels. Feature construction excludes later outcomes. It uses at most the latest 2,000 sessions and eighty pairs, needs twenty pairs over four dates, regularises four bounded feature weights toward defaults, and holds out the last fifth of decisions. Learned weights are accepted only when later pairwise loss improves. Otherwise defaults remain active. Four weights are persisted locally, separate from FP32 embeddings.

## Migration, retention and reset

SQLite schema v1 upgrades additively to v2. Tracks and segment blobs are retained byte-for-byte; no re-analysis is requested. Legacy sessions retain their general engagement but have unknown intent/local context. Their historical timezone is not guessed.

New sessions retain their analysed file fingerprint. Changed files cannot inherit a previous file's new-format listening associations. Current eligibility and index membership are checked before ranking and again before playing. Sessions are retained for at most 180 days or 20,000 rows. Context rows cascade with session deletion and have an additional 80,000-row ceiling; a single active session retains at most 512 hour buckets. These limits can discard older detailed context while retaining capped general engagement.

Clear listening history removes sessions, context buckets, taste profiles, ranking weights and snapshots. Favourites, playlists and audio embeddings remain. Disabling recommendations stops new recording. Deleting analysis disables recommendations and removes the audio index while retaining listening history, as before.

## Refresh and playback boundaries

Snapshot keys include local date/hour/timezone, listening revision, library fingerprints and favourites. Terminal listening updates and minute checkpoints of sustained listening can invalidate suggestions. Foreground context changes are checked once per minute. Retrieval and analysis stay off the playback thread, and score values are cached before sorting.

The separate recommendation progress event carries the small mix-version identifier. Embeddings, raw history and learned weights do not enter React or the playback snapshot. Opening For You, a context change or explicit refresh retrieves current suggestions. A late result after reset/disable cannot restore stale suggestions. Refresh never starts playback, saves a playlist or edits the already-playing queue.

## Validation

Run `python scripts/recommendations/check_habits.py` and `npm run check` from the repository root. The focused runner exercises production Java accounting, context aggregation, ranking and learning, real SQLite migration/reset SQL and the production recorder against controllable Android/service doubles. The Android CoreGate additionally checks a real v1 database upgrade, context/weight reset, recommendation origin and automatic/manual distinction with the actual playback service. The existing Kotlin bridge compilation workflow covers the updated play-source argument.

`verification/recommendations/contextual-personalization.json` records a synthetic chronological study and host measurements. The fixture reveals held-out choices only after prediction. Its results are not proof of human relevance, regional-music quality, emulator behaviour or physical-phone performance. Representative phone listening and Android integration still require validation before release. The expanded Android CoreGate and Kotlin bridge jobs must pass before merging. Host checks alone do not establish Android integration or device behaviour. This change does not bump the release version or start a release build; use a new version and Android version code before publishing.
