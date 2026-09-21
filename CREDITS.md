# Credits & third-party assets

## Lightning lesson — background music

The animated lesson (`/video/`) uses **“Epic Trailer”** (also published as **“Cinematic Trailer”**) by **Hans Williamson**, via the **Music for Video Library** creator channel.

| Field | Detail |
|-------|--------|
| **Composer** | Hans Williamson |
| **Track** | Epic Trailer / Cinematic Trailer |
| **Creator** | [Music for Video Library](https://www.patreon.com/no_copyrightmusic) (Patreon) |
| **Download source** | [520. Epic Trailer — Patreon post](https://www.patreon.com/no_copyrightmusic/posts/520-epic-trailer-41895373) (member download) |
| **Public reference** | [YouTube — Cinematic Trailer](https://www.youtube.com/watch?v=knRAM6AHcKI) |
| **File in repo** | `bgmusic.mp3` (project root) |

### License / usage

The audio file was downloaded through an active **Patreon membership** to Music for Video Library, per that post’s member terms. Retain your Patreon access and any download receipts if you need to confirm usage later.

### How it is used in this project

| Language | Implementation |
|----------|----------------|
| **English** | Mixed into `video/narration-en.mp3` |
| **Bahasa Melayu** | Looped via `bgmusic.mp3` alongside `video/narration-ms.mp3` |
| **Japanese** | Looped via `bgmusic.mp3` alongside `video/narration-ja.mp3` |

Suggested attribution (plain text):

> Background music: “Epic Trailer” (“Cinematic Trailer”) by Hans Williamson — Music for Video Library (Patreon)

## University logos

The home-page logo strip uses each partner university's own official logo file,
downloaded from that university's website. The marks are trademarks of their
respective universities and are used here to identify the joint-research partners.

| University | Source | Repository file |
|---|---|---|
| Universiti Tenaga Nasional | www.uniten.edu.my | `images/logos/uniten-official.png` |
| Universiti Teknikal Malaysia Melaka | www.utem.edu.my | `images/logos/utem-official.png` |
| Kindai University | www.kindai.ac.jp | `images/logos/kindai.svg` |

`scripts/build_partner_logos.py` only rescales and pads these files so the three
read at the same size; the artwork itself is unmodified. For UNITEN the primary
mark is used without the "The Energy University" descriptor, which is unreadable
at logo-row size.

## Other third-party notices

See [LICENSE](LICENSE) for OpenStreetMap, Leaflet, Plotly, and other library/data attributions.
