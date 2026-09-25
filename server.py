"""Local server for Diamond Art Pattern Studio.

Serves the static interface and validates/decodes source artwork with Pillow so
TIFF support does not depend on the browser's image codecs.
"""

from __future__ import annotations

import atexit
import shutil
import tempfile
import uuid
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from PIL import Image, ImageOps, UnidentifiedImageError


ROOT = Path(__file__).resolve().parent
UPLOAD_ROOT = Path(tempfile.mkdtemp(prefix="diamond-art-studio-"))
MAX_UPLOAD_BYTES = 100 * 1024 * 1024
MAX_IMAGE_PIXELS = 100_000_000
PREVIEW_MAX_SIDE = 2400
ALLOWED_FORMATS = {"PNG", "JPEG", "TIFF"}

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
atexit.register(lambda: shutil.rmtree(UPLOAD_ROOT, ignore_errors=True))


def error(message: str, status: int, code: str):
    return jsonify({"error": message, "code": code}), status


def classify_artwork(image: Image.Image) -> tuple[str, float]:
    """Distinguish flat-edged artwork from continuously varying photographs."""
    sample = image.convert("RGBA")
    sample.thumbnail((256, 256), Image.Resampling.LANCZOS)
    background = Image.new("RGBA", sample.size, "white")
    background.alpha_composite(sample)
    pixels = list(background.convert("RGB").getdata())
    width, height = sample.size
    flat_pairs = 0
    compared_pairs = 0
    for y in range(height):
        row_start = y * width
        for x in range(width - 1):
            left = pixels[row_start + x]
            right = pixels[row_start + x + 1]
            compared_pairs += 1
            if max(abs(left[channel] - right[channel]) for channel in range(3)) <= 8:
                flat_pairs += 1
    flatness = flat_pairs / max(1, compared_pairs)
    return ("illustration" if flatness >= 0.52 else "photo", flatness)


@app.errorhandler(413)
def too_large(_exception):
    return error(
        "This file is larger than the 100 MB artwork-import limit. Export a smaller lossless copy and try again.",
        413,
        "file_too_large",
    )


@app.post("/api/artwork/inspect")
def inspect_artwork():
    upload = request.files.get("artwork")
    if upload is None or not upload.filename:
        return error("Choose a PNG, JPEG, or TIFF artwork file.", 400, "file_missing")

    asset_id = uuid.uuid4().hex
    asset_dir = UPLOAD_ROOT / asset_id
    asset_dir.mkdir()
    source_path = asset_dir / "source"
    upload.save(source_path)

    try:
        with Image.open(source_path) as opened:
            detected_format = (opened.format or "").upper()
            if detected_format not in ALLOWED_FORMATS:
                return error(
                    "The selected file is not a supported PNG, JPEG, or TIFF image.",
                    415,
                    "unsupported_format",
                )

            width, height = opened.size
            if width * height > MAX_IMAGE_PIXELS:
                return error(
                    "The image exceeds the 100-megapixel safety limit. Resize it before importing.",
                    413,
                    "pixel_limit_exceeded",
                )
            frame_count = getattr(opened, "n_frames", 1)
            opened.seek(0)
            opened.load()
            if width < 2 or height < 2:
                return error("The image dimensions are too small to create a pattern.", 422, "invalid_dimensions")

            normalized = ImageOps.exif_transpose(opened)
            artwork_type, artwork_flatness = classify_artwork(normalized)
            has_transparency = normalized.mode in {"RGBA", "LA"} or (
                normalized.mode == "P" and "transparency" in normalized.info
            )
            if has_transparency:
                preview = normalized.convert("RGBA")
                preview_format = "PNG"
                preview_name = "preview.png"
            else:
                preview = normalized.convert("RGB")
                preview_format = "JPEG"
                preview_name = "preview.jpg"

            preview.thumbnail((PREVIEW_MAX_SIDE, PREVIEW_MAX_SIDE), Image.Resampling.LANCZOS)
            save_options = {"quality": 92, "optimize": True} if preview_format == "JPEG" else {"optimize": True}
            preview.save(asset_dir / preview_name, preview_format, **save_options)
    except Image.DecompressionBombError:
        return error(
            "The image exceeds the 100-megapixel safety limit. Resize it before importing.",
            413,
            "pixel_limit_exceeded",
        )
    except (UnidentifiedImageError, OSError, ValueError):
        return error(
            "The image could not be decoded. It may be corrupted or use an unsupported TIFF compression.",
            422,
            "decode_failed",
        )

    return jsonify(
        {
            "assetId": asset_id,
            "fileName": Path(upload.filename).name,
            "fileSize": source_path.stat().st_size,
            "format": detected_format,
            "width": width,
            "height": height,
            "hasTransparency": has_transparency,
            "artworkType": artwork_type,
            "artworkFlatness": round(artwork_flatness, 4),
            "frameCount": frame_count,
            "previewUrl": f"/api/artwork/{asset_id}/{preview_name}",
        }
    )


@app.get("/api/artwork/<asset_id>/<preview_name>")
def artwork_preview(asset_id: str, preview_name: str):
    if not asset_id.isalnum() or preview_name not in {"preview.png", "preview.jpg"}:
        return error("Preview not found.", 404, "preview_not_found")
    return send_from_directory(UPLOAD_ROOT / asset_id, preview_name)


@app.get("/")
def index():
    response = send_from_directory(ROOT, "index.html")
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/<path:path>")
def static_file(path: str):
    if path not in {"app.js", "conversion.js", "dmc-colors.js", "editor.js", "geometry.js", "styles.css"}:
        return error("File not found.", 404, "not_found")
    response = send_from_directory(ROOT, path)
    response.headers["Cache-Control"] = "no-cache"
    return response


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=4173, debug=False)
