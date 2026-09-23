import io
import unittest

from PIL import Image

import server


def image_bytes(image_format, mode="RGB"):
    output = io.BytesIO()
    color = (200, 40, 80, 128) if mode == "RGBA" else (200, 40, 80)
    Image.new(mode, (24, 16), color).save(output, image_format)
    output.seek(0)
    return output


class ArtworkImportTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def import_image(self, image_format, filename, mode="RGB"):
        return self.client.post(
            "/api/artwork/inspect",
            data={"artwork": (image_bytes(image_format, mode), filename)},
            content_type="multipart/form-data",
        )

    def test_imports_png_with_transparency(self):
        response = self.import_image("PNG", "art.png", "RGBA")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["format"], "PNG")
        self.assertTrue(payload["hasTransparency"])
        self.assertEqual((payload["width"], payload["height"]), (24, 16))
        preview_response = self.client.get(payload["previewUrl"])
        self.assertEqual(preview_response.status_code, 200)
        preview_response.close()

    def test_imports_jpeg(self):
        response = self.import_image("JPEG", "art.jpg")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["format"], "JPEG")

    def test_serves_dmc_color_reference(self):
        response = self.client.get("/dmc-colors.js?v=20260919")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"DmcPalette", response.data)
        response.close()

    def test_disables_stale_interface_caching(self):
        page = self.client.get("/")
        self.assertEqual(page.status_code, 200)
        self.assertEqual(page.headers["Cache-Control"], "no-store")
        self.assertIn(b"Build 2026.09.27", page.data)
        page.close()

        script = self.client.get("/app.js")
        self.assertEqual(script.status_code, 200)
        self.assertEqual(script.headers["Cache-Control"], "no-cache")
        script.close()

    def test_imports_tiff_without_browser_tiff_support(self):
        response = self.import_image("TIFF", "art.tiff")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["format"], "TIFF")
        self.assertTrue(payload["previewUrl"].endswith("preview.jpg"))

    def test_rejects_invalid_image(self):
        response = self.client.post(
            "/api/artwork/inspect",
            data={"artwork": (io.BytesIO(b"not an image"), "broken.tiff")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.get_json()["code"], "decode_failed")

    def test_detects_flat_illustration(self):
        image = Image.new("RGB", (128, 128), "white")
        for x in range(64):
            for y in range(128):
                image.putpixel((x, y), (20, 60, 140))
        artwork_type, flatness = server.classify_artwork(image)
        self.assertEqual(artwork_type, "illustration")
        self.assertGreater(flatness, 0.9)

    def test_detects_continuously_varying_photo(self):
        image = Image.effect_noise((128, 128), 100).convert("RGB")
        artwork_type, flatness = server.classify_artwork(image)
        self.assertEqual(artwork_type, "photo")
        self.assertLess(flatness, 0.52)


if __name__ == "__main__":
    unittest.main()
