# Diamond Art Pattern Studio

A local-first workspace prototype for creating and managing production-ready diamond-art patterns.

Product requirements, including professional-print sizing and exact grid-scaling rules, are documented in [the application specification](SPEC.md).

## Run locally

Python 3.10+ is required. Create an environment and install the local image-processing dependencies.

### macOS and Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python server.py
```

### Windows Command Prompt (`cmd.exe`)

Windows normally exposes Python as `python` or `py`, not `python3`. The commands below call the virtual environment's interpreter directly, so activation is not required:

```bat
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe server.py
```

If `python` is not recognized, replace it in the first command with `py`:

```bat
py -m venv .venv
```

To activate the environment in Command Prompt instead, run `.venv\Scripts\activate.bat`. The Unix command `source .venv/bin/activate` does not work in Command Prompt.

### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python server.py
```

Then open `http://localhost:4173`.

The current interface shows `Build 2026.09.28` in the footer. If that build label or the highlighted **Preview appearance** card is missing, the server is running an older checkout; update the project files before restarting it. The local server disables caching for the page so a refresh loads the current interface.

## Choosing a pattern size

After importing artwork, use the **Choose pattern size** menu in the artwork size guide:

- **Smaller** uses 20 fewer drills on the artwork's shorter side.
- **Recommended** uses the detail-based grid suggested by the artwork analysis.
- **Larger** uses 20 more drills on the shorter side for additional detail.

Choosing an option immediately updates the Width and Height fields. You can still type a custom size into those fields afterward. The physical sizes change when the drill pitch changes: round and square 2.5 mm drills use the same physical grid size, while the 2.8 mm profile produces a larger painting from the same drill count.

## Current prototype

- Responsive project dashboard with recent-project status and production metrics
- Production checklist and manufacturer profile visibility
- New-project artwork picker for PNG, JPEG, and TIFF files
- Server-side PNG/JPEG/TIFF validation and decoding with 100 MB and 100-megapixel safety limits
- Clear errors for corrupted, unsupported, oversized, or undecodable artwork
- Automatic photo/illustration detection with resampling chosen for smooth photographs or crisp graphic artwork
- A manual artwork-sampling override for resaved images that automatic detection classifies differently from the original
  - Find **Artwork sampling** in the highlighted **Preview appearance** card at the top of the right-hand Pattern dimensions panel.
- Deterministic adaptive color reduction mapped to the standard 447-color DMC drill reference with visible codes and drill counts
- Connected click-and-tolerance background selection with preserve, automatic/manual 3–5 shade simplification, and solid-color replacement
- Import and setup workspace with image metadata, aspect-ratio locking, drill profiles, multi-vendor selection, and exact whole-cell grid calculations
- Color-reduced, true-proportion drill-grid preview with zoom, grid inspection, palette counts, and PNG download
- Numbered column and row coordinates outside the top and left edges of preview and print grids, with a visible preview toggle enabled by default
- Shape-accurate round and square drill rendering with explained whole-cell rounding choices
- Exact-scale professional print preflight with centimeter-based sizing, whole-inch canvas recommendations, centered margins, DPI metadata, undersized-canvas protection, and PNG export
- Artwork-based smaller/recommended/larger grid tiers using measured edge detail, color variety, aspect ratio, resolution, and drill pitch
- Non-destructive crop positioning and configurable transparent-PNG background flattening
- Conversion-stage confetti cleanup that is completed before manual pattern editing
- Step 3 cell editor with paint, erase, eyedropper, drag editing, live drill counts, and stroke-level undo/redo
- Transparent-region modes for full-drill fill, empty partial-drill areas, or later selective editing
- Fully local static assets and application behavior

## DMC color reference

The MVP uses the standard 447-color DMC-numbered subset commonly used for diamond drills. Codes, names, and screen RGB approximations are derived from the numeric columns of the [CrossStitchCreator DMC reference table](https://github.com/adrianj/CrossStitchCreator/blob/master/CrossStitchCreator/Resources/DMC%20Cotton%20Floss%20converted%20to%20RGB%20Values.csv); discontinued floss-only shades are excluded. The software matches colors perceptually in CIELAB space.

Screen colors are approximations and physical resin can vary by supplier and production lot. A future supplier-calibration layer should override RGB measurements without changing the saved DMC codes. DMC is a trademark of its respective owner; this project is not affiliated with or endorsed by DMC.
