# Diamond Art Pattern Studio

A local-first workspace prototype for creating and managing production-ready diamond-art patterns.

## Run locally

The prototype has no build step or runtime dependencies:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Current prototype

- Responsive project dashboard with recent-project status and production metrics
- Production checklist and manufacturer profile visibility
- New-project artwork picker for PNG, JPEG, and TIFF files
- Import and setup workspace with image metadata, aspect-ratio locking, drill profiles, and exact whole-cell grid calculations
- Color-reduced, true-proportion drill-grid preview with zoom, grid inspection, palette counts, and PNG download
- Fully local static assets and application behavior
