# Lightning lesson — localization lock

## Do not modify (approved)

| Language | Transcript | Keyframes (`js/video-keyframes.js`) | Scene timing |
|----------|------------|-------------------------------------|--------------|
| **English (`en`)** | `video/transcripts.json` → `en` | `en` block | `scene-timing.json` → `en` |
| **Bahasa Melayu (`ms`)** | `video/transcripts.json` → `ms` | `ms` + `ms.factMid` | `scene-timing.json` → `ms` |
| **Japanese (`ja`)** | `video/transcripts.json` → `ja` | `ja` + `ja.factMid` | `scene-timing.json` → `ja` |

Regenerating narration or retuning keyframes / scene timing for any language requires explicit approval.

Each language uses **only its own** keyframe block at runtime (`en` → `en`, `ms` → `ms`, `ja` → `ja`). English keyframes are never applied to Malay or Japanese.
