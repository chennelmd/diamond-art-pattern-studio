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


if __name__ == "__main__":
    unittest.main()
