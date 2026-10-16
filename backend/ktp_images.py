from io import BytesIO
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError


def normalize_ktp_image(content: bytes) -> bytes:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as source:
                if source.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValueError("Gunakan gambar JPG, PNG, atau WebP")
                if source.width * source.height > 40_000_000:
                    raise ValueError("Resolusi gambar terlalu besar. Gunakan maksimal 40 megapiksel")
                source.load()
                image = ImageOps.exif_transpose(source).convert("RGB")
                image.thumbnail((2400, 2400))
                output = BytesIO()
                # Re-encode pixels only; camera EXIF (including GPS) is not copied.
                image.save(output, format="JPEG", quality=90, optimize=True)
                return output.getvalue()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValueError("Gambar KTP rusak atau tidak dapat dibaca") from None
