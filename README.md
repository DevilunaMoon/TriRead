# TriRead

A fast, lightweight, 100% offline Android document reader built in pure Kotlin and Jetpack Compose, inspired by ReadEra.

## Features
- **3-Category Dashboard:** Dedicated **PDF**, **Docs** (`.doc`, `.docx`), and **Slides** (`.ppt`, `.pptx`) tabs with live counts, debounced search, **Continue Reading** banner, and `All / Favorites / Unread` filters.
- **Offline Auto-Scan:** Room + `MediaStore.Files` background diff-sync detects newly downloaded files automatically, paired with a manual SAF (`OpenDocument`) file picker.
- **Three Native Offline Viewers:**
  - **PDF:** Native `PdfRenderer` with lazy `visiblePage ± 1` bitmap buffer and pinch-to-zoom.
  - **DOCX / DOC:** Pure-Kotlin `ZipInputStream` + `XmlPullParser` reflowable reader with **Day / Sepia / Night** themes, adjustable font size, and line spacing.
  - **PPTX / PPT:** Swipeable `HorizontalPager` slides with embedded images, zoom, and speaker notes toggle.
- **Auto-Resume & Immersive Mode:** Tap center screen for full-screen reading; page progress persists automatically to Room.

## Downloading the APK from GitHub
1. Push this repository to GitHub (`main` branch).
2. Open the **Actions** tab → click the latest **Build TriRead APK** workflow run.
3. Download **`TriRead-debug-apk`** under **Artifacts**, unzip it, and install `app-debug.apk` on your Android phone.

