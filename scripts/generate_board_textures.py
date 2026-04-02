from __future__ import annotations

import math
import random
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "src" / "assets" / "board-textures"
BOARD_SIZE = 768
SQUARE_COUNT = 8
SQUARE_SIZE = BOARD_SIZE // SQUARE_COUNT
FRAME_SIZE = 768


def smoothstep(value: float) -> float:
    return value * value * (3.0 - 2.0 * value)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def lerp(a: float, b: float, amount: float) -> float:
    return a + (b - a) * amount


def mix_color(dark: tuple[int, int, int], light: tuple[int, int, int], tone: float) -> tuple[int, int, int]:
    return tuple(int(lerp(dark[index], light[index], tone)) for index in range(3))


class ValueNoise:
    def __init__(self, width: int, height: int, cell_size: int, seed: int) -> None:
        self.cell_size = cell_size
        self.grid_width = width // cell_size + 4
        self.grid_height = height // cell_size + 4
        rng = random.Random(seed)
        self.grid = [
            [rng.random() for _ in range(self.grid_width)]
            for _ in range(self.grid_height)
        ]

    def sample(self, x: float, y: float) -> float:
        gx = x / self.cell_size
        gy = y / self.cell_size
        raw_x0 = math.floor(gx)
        raw_y0 = math.floor(gy)
        x0 = int(raw_x0) % (self.grid_width - 1)
        y0 = int(raw_y0) % (self.grid_height - 1)
        fx = smoothstep(gx - raw_x0)
        fy = smoothstep(gy - raw_y0)

        a = lerp(self.grid[y0][x0], self.grid[y0][x0 + 1], fx)
        b = lerp(self.grid[y0 + 1][x0], self.grid[y0 + 1][x0 + 1], fx)
        return lerp(a, b, fy)


def create_noise_stack(width: int, height: int, seed: int) -> list[ValueNoise]:
    return [
        ValueNoise(width, height, 192, seed + 11),
        ValueNoise(width, height, 96, seed + 23),
        ValueNoise(width, height, 48, seed + 37),
        ValueNoise(width, height, 24, seed + 53),
        ValueNoise(width, height, 12, seed + 71),
    ]


def wood_patch(
    size: int,
    seed: int,
    dark: tuple[int, int, int],
    light: tuple[int, int, int],
    angle: float,
    contrast: float = 1.0,
    shimmer: float = 0.08,
) -> list[list[tuple[int, int, int]]]:
    noise_fields = create_noise_stack(size, size, seed)
    rows: list[list[tuple[int, int, int]]] = []
    cos_angle = math.cos(angle)
    sin_angle = math.sin(angle)

    for y in range(size):
        row: list[tuple[int, int, int]] = []
        for x in range(size):
            centered_x = x - size / 2
            centered_y = y - size / 2
            u = centered_x * cos_angle - centered_y * sin_angle + size / 2
            v = centered_x * sin_angle + centered_y * cos_angle + size / 2

            warp = (noise_fields[0].sample(u, v) - 0.5) * 56.0
            warp += (noise_fields[1].sample(u * 1.1, v * 0.9) - 0.5) * 24.0
            fiber = 0.5 + 0.5 * math.sin((u + warp) / 7.8)
            ripples = 0.5 + 0.5 * math.sin((u + warp * 0.6) / 16.0 + noise_fields[2].sample(u, v) * 4.0)
            pores = noise_fields[4].sample(u * 1.35, v * 1.4)
            mottling = noise_fields[3].sample(u, v)

            tone = fiber * 0.48 + ripples * 0.26 + mottling * 0.16 + pores * 0.10
            tone = clamp((tone - 0.5) * contrast + 0.5)

            edge = min(x, y, size - 1 - x, size - 1 - y)
            if edge < 3:
                tone *= 0.94
            elif edge > size - 10:
                tone *= 0.98

            gloss = (noise_fields[1].sample(v * 0.4 + 14.0, u * 0.25 + 9.0) - 0.5) * shimmer
            tone = clamp(tone + gloss)

            row.append(mix_color(dark, light, tone))
        rows.append(row)

    return rows


def add_vignette(
    pixels: list[list[tuple[int, int, int]]],
    strength: float,
) -> list[list[tuple[int, int, int]]]:
    height = len(pixels)
    width = len(pixels[0])
    cx = width / 2
    cy = height / 2
    max_distance = math.sqrt(cx * cx + cy * cy)

    updated: list[list[tuple[int, int, int]]] = []
    for y, row in enumerate(pixels):
        next_row: list[tuple[int, int, int]] = []
        for x, color in enumerate(row):
            distance = math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / max_distance
            shade = 1.0 - distance * strength
            next_row.append(tuple(int(channel * shade) for channel in color))
        updated.append(next_row)
    return updated


def board_image(style: dict[str, tuple[int, int, int] | int]) -> list[list[tuple[int, int, int]]]:
    pixels = [[(0, 0, 0) for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    seed_base = int(style["seed"])

    for rank in range(SQUARE_COUNT):
        for file in range(SQUARE_COUNT):
            is_light = (rank + file) % 2 == 0
            palette_key = "light" if is_light else "dark"
            dark, light = style[palette_key]
            local_seed = seed_base + rank * 31 + file * 17 + (0 if is_light else 503)
            rng = random.Random(local_seed)
            angle = rng.uniform(-0.18, 0.18) + (0.08 if not is_light else -0.02)
            patch = wood_patch(
                SQUARE_SIZE,
                local_seed,
                dark,
                light,
                angle,
                contrast=1.18 if is_light else 1.25,
                shimmer=0.05 if is_light else 0.03,
            )

            base_y = rank * SQUARE_SIZE
            base_x = file * SQUARE_SIZE
            for py in range(SQUARE_SIZE):
                pixels[base_y + py][base_x : base_x + SQUARE_SIZE] = patch[py]

    return add_vignette(pixels, 0.08)


def frame_image(style: dict[str, tuple[int, int, int] | int]) -> list[list[tuple[int, int, int]]]:
    dark, light = style["frame"]
    pixels = wood_patch(
        FRAME_SIZE,
        int(style["seed"]) + 991,
        dark,
        light,
        angle=0.06,
        contrast=1.28,
        shimmer=0.02,
    )
    return add_vignette(pixels, 0.18)


def write_png(path: Path, pixels: list[list[tuple[int, int, int]]]) -> None:
    height = len(pixels)
    width = len(pixels[0])
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for red, green, blue in row:
            raw.extend((red, green, blue, 255))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


STYLES = {
    "walnut": {
        "seed": 1201,
        "light": ((193, 146, 92), (244, 215, 169)),
        "dark": ((78, 50, 30), (144, 96, 59)),
        "frame": ((45, 25, 14), (122, 76, 44)),
    },
    "rosewood": {
        "seed": 2219,
        "light": ((198, 147, 103), (245, 214, 181)),
        "dark": ((74, 25, 24), (155, 72, 60)),
        "frame": ((35, 12, 12), (104, 41, 35)),
    },
    "ebony": {
        "seed": 3341,
        "light": ((198, 180, 150), (247, 235, 214)),
        "dark": ((20, 18, 16), (66, 53, 41)),
        "frame": ((10, 10, 10), (56, 46, 37)),
    },
}


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for name, style in STYLES.items():
        write_png(OUTPUT_DIR / f"{name}-board.png", board_image(style))
        write_png(OUTPUT_DIR / f"{name}-frame.png", frame_image(style))

    print(f"Generated textures in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
