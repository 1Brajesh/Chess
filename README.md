# Chess Board

A React chess board with:

- standard 2D board and pieces
- legal move play
- board flip
- undo and rewind to the start
- setup/editor mode for custom positions
- local save/load in the browser
- selectable board and piece styles

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

## Asset Credits

- `Wood + Ivory` and `Neo Wood` piece sets are vendored from `chess-fen2img` (MIT).
- The `chess-fen2img` package README credits the underlying piece images to [Marcel van Kervinck](https://marcelk.net/chess/pieces/) and [GiorgioMegrelli](https://github.com/GiorgioMegrelli/chess.com-boards-and-pieces).
