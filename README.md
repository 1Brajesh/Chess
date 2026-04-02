# Chess Board

A React chess board with:

- standard 2D board and pieces
- legal move play
- board flip
- undo and rewind to the start
- setup/editor mode for custom positions
- local save/load in the browser
- selectable board and piece styles
- optional Supabase-backed online rooms for live two-player play

## Local development

```bash
npm install
npm run dev
```

## GitHub Pages

This repo is configured to deploy to:

`https://1Brajesh.github.io/Chess/`

Deployment runs automatically from the `main` branch using the workflow at `.github/workflows/deploy.yml`.

If GitHub Pages is not already enabled for the repository:

1. Open repository `Settings`
2. Open `Pages`
3. Set the source to `GitHub Actions`

## Supabase Multiplayer Setup

The app is already wired to this Supabase project in the browser:

- Project URL: `https://pjbpghknzqmwfykbtvzp.supabase.co`
- Publishable key: configured in [src/lib/supabase.js](/Volumes/T7/kritika4/Documents/Coding/Chess/src/lib/supabase.js)

One-time dashboard setup:

1. In Supabase, open `Authentication` > `Providers` and enable `Anonymous Sign-Ins`
2. Open the SQL editor and run [supabase/schema.sql](/Volumes/T7/kritika4/Documents/Coding/Chess/supabase/schema.sql)
3. Push `main` so GitHub Pages rebuilds with the online-room UI

What the online mode does:

- `Host Online Game` creates a room and assigns the host to White
- `Join Room` claims the Black seat if it is still open
- moves are synced live through Supabase Realtime
- setup mode, undo, rewind, and local save loading stay local-only while a room is connected

## Asset Credits

- `Wood + Ivory` and `Neo Wood` piece sets are vendored from `chess-fen2img` (MIT).
- The `chess-fen2img` package README credits the underlying piece images to [Marcel van Kervinck](https://marcelk.net/chess/pieces/) and [GiorgioMegrelli](https://github.com/GiorgioMegrelli/chess.com-boards-and-pieces).
