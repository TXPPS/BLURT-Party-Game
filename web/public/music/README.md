# Music

Drop your two tracks in this folder. Nothing else is needed — no config, no rebuild
step beyond the normal `pnpm build`.

| Purpose | Filenames (either format) |
|---|---|
| Menus, lobby, results — anywhere nobody is under time pressure | `lobby.ogg` / `lobby.mp3` |
| The match itself — answering, voting, drawing | `game.ogg` / `game.mp3` |

**Ogg is preferred**, and is tried first. It is patent-free, tends to be smaller at the
same perceived quality, and loops cleanly — Ogg Vorbis stores the exact sample count,
whereas MP3 frames are padded at both ends, so an MP3 loop usually has an audible gap
at the seam. Ship `.mp3` as well if you need Safari on older iOS; the player falls
back to it automatically.

Both files are optional and independent. If a track is missing the game simply plays
nothing for those screens — no error, no console noise, no broken state. That is the
default state of this folder, and it is a supported way to run.

## Practical notes

- **Make them loop.** The player loops natively with no crossfade at the seam, so the
  file itself has to end where it begins.
- **Mix them quiet.** The player is conservative by default (see `MUSIC_LEVEL` in
  `shared/constants.ts`) but it cannot rescue a track mastered hot. Bed music should
  sit under conversation.
- **Keep them small.** They are static assets on the same Worker as the game; a couple
  of megabytes each is plenty for a loop.
- **Rights.** Only put files here that you have the right to distribute. Everything
  else in this repo is original or permissively licensed, and this folder should not
  be the exception.

## If a track does not play

The player asks the server for each candidate URL and accepts it only when the
response is `audio/*`. That check exists because the site is a single-page app: a
request for a file that is not here comes back **200 with `index.html`**, not a 404,
so status alone cannot tell "present" from "absent".

The practical consequence is that a file which is here but served as something else
will be skipped silently. To check what the server actually says:

```
curl -sI https://<your-host>/music/lobby.ogg | grep -i content-type
content-type: audio/ogg          # good
content-type: text/html          # not there, or not recognised as audio
```

Two other things that make a track silent, both by design: music plays only on the
shared screen (the host's device, or any device switched to the big-screen layout),
and nothing plays at all until somebody has tapped or typed once, because browsers
require a gesture before audio can start.
