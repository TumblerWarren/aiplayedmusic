# Verification records

## Current release

- [STATUS.txt](STATUS.txt): v1.2.6 APK, exact application source, checksum and completed build/emulator gates.
- [TEST_VALIDITY_AUDIT.md](TEST_VALIDITY_AUDIT.md): reproduced test-driver defects, corrected assertions, validation of the existing APK and limits of screenshots/style IDs.
- [DEVICE_CHECKLIST.md](DEVICE_CHECKLIST.md): physical-device and listening checks still to complete.
- [BRANCH_AUDIT_1.2.6.json](BRANCH_AUDIT_1.2.6.json): all branch tips included in main at the recorded revision.
- [RELEASE_NOTES_1.2.6.md](RELEASE_NOTES_1.2.6.md): released features.
- [MAINTENANCE_CLEANUP.md](MAINTENANCE_CLEANUP.md): documentation and dead-code cleanup after publication.

## Historical records

The v1.2/v1.2.3/v1.2.4 reviews, release notes, ICON_AND_GESTURES, PASTEL_PLAY and [folder/theme troubleshooting log](FOLDER_AND_THEME_CHECK_FIX.md) describe their named revision or investigation. Their pending statements and assertion counts are historical, not the current release status. [AUDIO_REVIEW.md](../docs/AUDIO_REVIEW.md) is the dated DSP review; current audio behavior and limits are in [AUDIO_ENGINE.md](../docs/AUDIO_ENGINE.md).

The original build status is preserved in [history/STATUS_1.2.0.txt](history/STATUS_1.2.0.txt). Old artifact URLs are not current download links: obsolete APK assets were deleted at the user's request, and retained Actions evidence has a retention period. Use the v1.2.6 release link in STATUS.txt; v1.2.5 remains the retained previous stable APK.

App source, test-driver source and APK identity are separate records. A test-only correction can validate a retained APK when runtime/build inputs are proven unchanged. A documentation or dead-code cleanup does not retroactively change the released APK or establish a new native/device result.
