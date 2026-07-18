# Journal Scanner (iOS)

Film yourself flipping through a handwritten journal — every page is detected,
captured, straightened, digitized, and made word-searchable. The original
handwriting is always preserved; the recognized text lives alongside it.
Backups go to your own Google Drive, encrypted on-device by default.

## How it works

**Capture** — Point the camera at the journal and flip pages. A state machine
watches the video stream: Vision document segmentation finds the page,
a sharpness metric (luma-gradient energy) and frame-to-frame perceptual
hashing (dHash) detect when the page is steady and in focus, and the best
frame is perspective-corrected and captured automatically. A large hash jump
is recognized as a page flip, which re-arms capture; near-duplicate hashes
suppress double captures if you linger.

**Recognition** — Apple Vision handwriting OCR runs entirely on-device.
Each word keeps its bounding box, confidence, and alternative readings.

**Learning your handwriting** — three feedback loops:
1. *Personal lexicon*: confidently recognized and user-confirmed words build
   unigram/bigram frequency tables; your most frequent words are fed to
   Vision as `customWords`, biasing recognition toward your vocabulary.
2. *Context correction*: candidate readings are re-ranked by Vision
   confidence + personal word frequency + bigram fit with surrounding words.
3. *Review queue*: words the model isn't sure about show up with their
   handwriting crop and candidate buttons. Corrections are remembered — a
   misread you've fixed twice is auto-fixed forever after.

**Storage & search** — SQLite (WAL) with an FTS5 index. Search matches every
word across every journal, with snippets, prefix matching, and diacritic
folding. Original page images are kept at full resolution.

**Cloud** — Google Drive via OAuth 2.0 PKCE (no SDK, no client secret) using
the narrow `drive.file` scope: the app can only touch files it created.
Uploads (page JPEG + text-sidecar JSON) are AES-256-GCM encrypted on-device
by default; the key never leaves the Keychain. A recovery key can be exported
from Settings and used with `tools/decrypt_backup.py` off-device.

**Export** — "Export searchable PDF" produces the original handwriting with
an invisible, selectable text layer at the exact word positions — searchable
in Preview, Drive, Spotlight, anywhere.

## Project layout

```
Sources/
  App/        App entry, dependency container
  Models/     Domain types
  Persistence/ SQLite wrapper, FTS5, file storage, domain store
  Capture/    Camera session, page detection, quality metrics, auto-capture engine
  OCR/        Vision recognizer, personal lexicon, context corrector, pipeline
  Cloud/      OAuth PKCE, Drive REST client, AES-GCM vault, sync engine
  Export/     Searchable PDF exporter
  UI/         SwiftUI views (Home, Scan, Page, Search, Review, Settings)
Tests/        Unit tests for store/FTS, corrector/lexicon, hashing
tools/        Off-device backup decryption script
```

No third-party dependencies. iOS 16+, iPhone + iPad.

## Building

Requires a Mac with Xcode 15+.

```bash
brew install xcodegen
cd JournalScanner
xcodegen generate
open JournalScanner.xcodeproj
```

Select your signing team, then run on a **physical device** (the camera and
handwriting OCR need real hardware; the simulator is fine for the unit tests:
`Cmd+U`).

### Google Drive setup (one-time)

1. In [Google Cloud Console](https://console.cloud.google.com), create a
   project → *APIs & Services* → enable **Google Drive API**.
2. *Credentials* → *Create credentials* → *OAuth client ID* → **iOS**, bundle
   id `com.jaidesai.JournalScanner`.
3. Put the client ID in `Sources/Cloud/GoogleAuth.swift`
   (`Config.clientID`) and the **reversed** client ID in `project.yml` under
   `CFBundleURLSchemes`, then re-run `xcodegen generate`.

Until then the app works fully offline — cloud sync is the only feature that
needs the client ID.

### Field tuning

Auto-capture thresholds live at the top of `Capture/AutoCaptureEngine.swift`
(`requiredStableFrames`, `minSharpness`, flip/duplicate hash distances). They
are set to sensible defaults but should be tuned with a real journal, real
lighting, and a real hand holding the phone.

## Privacy model

- OCR is 100% on-device (Apple Vision). No analytics, no third-party servers.
- The only network calls in the entire app are to Google OAuth/Drive, and
  only after you explicitly connect Drive.
- Uploads are client-side encrypted by default (AES-256-GCM, key in the
  Keychain, never synced). Google stores ciphertext.
- Scope is `drive.file` — the app cannot read anything else in your Drive.

## Roadmap (not yet implemented)

- iCloud Drive / Dropbox / WebDAV as alternative backends
- Page reordering + merge/split of journals; date detection from entries
- Search-result word highlighting on the original page image
- Live Text-style tap-to-select on page images
- On-device embedding search ("find entries about feeling homesick")
- Background sync via `BGProcessingTask`
