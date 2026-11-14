"""Extract seven transparent walking loops from the supplied screen recording.

Requires FFmpeg, NumPy and Pillow. Run from any directory with:
    python scripts/build-walker-sprites.py --source path/to/recording.mp4
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image


FPS = 15
CROP = (180, 170, 650, 940)  # Includes the changing ground line beneath the feet.
FRAME_SIZE = (320, 463)
INK = (34, 31, 30)
LOOPS = (
    ("walk-01", 0.03, 1.33),
    ("walk-02", 3.23, 4.50),
    ("walk-03", 6.93, 8.23),
    ("walk-04", 11.93, 13.23),
    ("walk-05", 16.93, 18.23),
    ("walk-06", 21.00, 22.07),
    ("walk-07", 38.03, 39.80),
)


def decode_loop(source: Path, start: float, end: float) -> np.ndarray:
    x, y, width, height = CROP
    result = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-ss", f"{start:.2f}", "-t", f"{end - start:.2f}",
            "-i", str(source), "-vf",
            f"fps={FPS},crop={width}:{height}:{x}:{y},format=rgb24",
            "-f", "rawvideo", "pipe:1",
        ],
        capture_output=True,
        check=True,
    )
    frame_bytes = width * height * 3
    if len(result.stdout) % frame_bytes:
        raise ValueError("FFmpeg returned an incomplete walking frame")
    frames = np.frombuffer(result.stdout, dtype=np.uint8).reshape(
        -1, height, width, 3,
    )
    if len(frames) < 8:
        raise ValueError(f"Too few frames between {start} and {end} seconds")
    return frames


def transparent_frame(pixels: np.ndarray) -> Image.Image:
    # The recording's cream backdrop varies slightly by row. The left edge of
    # this crop stays empty except where the changing ground line reaches it.
    # Reuse the sample above the line for bottom rows so the line survives.
    background = np.median(pixels[:, :16, :], axis=1)
    background[-60:] = background[-61]
    darkness = np.mean(background[:, None, :] - pixels, axis=2)
    alpha = np.clip((darkness - 8) * (255 / 190), 0, 255).astype(np.uint8)

    rgba = np.empty((*alpha.shape, 4), dtype=np.uint8)
    rgba[:, :, :3] = INK
    rgba[:, :, 3] = alpha
    return Image.fromarray(rgba, "RGBA").resize(FRAME_SIZE, Image.Resampling.LANCZOS)


def build(source: Path, output_dir: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(source)
    output_dir.mkdir(parents=True, exist_ok=True)

    for name, start, end in LOOPS:
        frames = decode_loop(source, start, end)
        strip = Image.new("RGBA", (FRAME_SIZE[0] * len(frames), FRAME_SIZE[1]))
        for index, pixels in enumerate(frames):
            strip.alpha_composite(transparent_frame(pixels), (index * FRAME_SIZE[0], 0))
        output = output_dir / f"{name}.webp"
        strip.save(output, "WEBP", lossless=True, method=6)
        print(f"{name}: {len(frames)} frames, {len(frames) / FPS:.2f}s, {output.stat().st_size:,} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument(
        "--output", type=Path,
        default=Path(__file__).resolve().parents[1] / "public" / "images" / "walkers",
    )
    arguments = parser.parse_args()
    build(arguments.source, arguments.output)
