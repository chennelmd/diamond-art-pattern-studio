# Diamond Art Pattern Studio

A local-first workspace prototype for creating and managing production-ready diamond-art patterns.

## Run locally

Python 3.10+ is required. Create an environment and install the local image-processing dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python server.py
```

Then open `http://localhost:4173`.

## Current prototype

- Responsive project dashboard with recent-project status and production metrics
- Production checklist and manufacturer profile visibility
- New-project artwork picker for PNG, JPEG, and TIFF files
- Server-side PNG/JPEG/TIFF validation and decoding with 100 MB and 100-megapixel safety limits
- Clear errors for corrupted, unsupported, oversized, or undecodable artwork
- Automatic photo/illustration detection with resampling chosen for smooth photographs or crisp graphic artwork
- Import and setup workspace with image metadata, aspect-ratio locking, drill profiles, multi-vendor selection, and exact whole-cell grid calculations
- Color-reduced, true-proportion drill-grid preview with zoom, grid inspection, palette counts, and PNG download
- Shape-accurate round and square drill rendering with explained whole-cell rounding choices
- Artwork-based minimum-size recommendations using measured edge detail, color variety, aspect ratio, resolution, and drill pitch
- Non-destructive crop positioning and configurable transparent-PNG background flattening
- Conversion-stage confetti cleanup that is completed before manual pattern editing
- Transparent-region modes for full-drill fill, empty partial-drill areas, or later selective editing
- Fully local static assets and application behavior
