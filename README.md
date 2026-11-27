# TriRead

**TriRead** is a lightweight, 100% offline Android document reader built with **Kotlin & Jetpack Compose** for **PDF**, **Word (`.doc` / `.docx`)**, and **PowerPoint (`.ppt` / `.pptx`)** files.

## Features
- **Full-Storage Offline Scanner** — Scans your Android storage (including `Downloads`, `Documents`, and messaging folders) to automatically find newly downloaded documents. Tap **Scan / Refresh** anytime to pick up new files.
- **ReadEra-Inspired Library** — Filter by **All / PDF / Word / PPT**, search by file name or folder, sort by newest/name/size, and spot recently downloaded files with a `NEW` badge.
- **Built-in Offline Viewers**:
  - **PDF:** Native Android `PdfRenderer` with smooth scrolling, page counter, and zoom controls.
  - **Word (`.docx`):** Offline reader with **Light / Sepia / Dark** themes, font size controls, tables, and embedded images.
  - **PowerPoint (`.pptx`):** Swipeable slide deck viewer with slide counter, light/dark slide mode, and embedded images.
  - **External App Fallback:** One-tap button to open any document in an external viewer via `FileProvider`.
- **Zero Database & Zero Internet Required** — Everything stays local on your device.

## Download APK
Every push to `main` automatically builds an installable APK via **GitHub Actions**:
1. Open the **Actions** tab on GitHub.
2. Click the latest **Build TriRead APK** workflow run.
3. Download **`TriRead-debug-apk`** under **Artifacts**, unzip it, and install `app-debug.apk` on your Android 14 phone.

## Tech Stack
- Kotlin 2.0 + Jetpack Compose (Material 3)
- Target SDK 34 (Android 14) / Min SDK 26 (Android 8.0)
- `MANAGE_EXTERNAL_STORAGE` for full-device document scanning

## License
MIT License — see [LICENSE](LICENSE).
