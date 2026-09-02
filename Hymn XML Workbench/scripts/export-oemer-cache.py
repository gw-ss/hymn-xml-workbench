#!/usr/bin/env python3

import argparse
import json
import pickle
from pathlib import Path

import cv2
import numpy as np
from oemer.dewarp import dewarp, estimate_coords


def main():
    parser = argparse.ArgumentParser(description="Export inspectable Oemer segmentation masks from a saved inference cache.")
    parser.add_argument("image", type=Path)
    parser.add_argument("cache", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--without-deskew", action="store_true")
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    with args.cache.open("rb") as handle:
        prediction = pickle.load(handle)

    masks = {
        "staff": prediction["staff"].astype(np.uint8),
        "symbols": prediction["symbols"].astype(np.uint8),
        "noteheads": prediction["note"].astype(np.uint8),
        "stems-rests": prediction["stems_rests"].astype(np.uint8),
        "clefs-accidentals": prediction["clefs_keys"].astype(np.uint8),
    }
    height, width = masks["staff"].shape
    image = cv2.imread(str(args.image), cv2.IMREAD_COLOR)
    if image is None:
        raise SystemExit(f"Cannot read {args.image}")
    image = cv2.resize(image, (width, height), interpolation=cv2.INTER_AREA)

    if not args.without_deskew:
        coords_x, coords_y = estimate_coords(masks["staff"])
        masks = {name: dewarp(mask, coords_x, coords_y).astype(np.uint8) for name, mask in masks.items()}
        image = np.dstack([dewarp(image[..., channel], coords_x, coords_y) for channel in range(3)]).astype(np.uint8)

    cv2.imwrite(str(args.output / "source-resized.png"), image)
    colors = {
        "staff": (40, 70, 235),
        "symbols": (30, 190, 240),
        "noteheads": (50, 190, 55),
        "stems-rests": (230, 120, 25),
        "clefs-accidentals": (190, 55, 185),
    }
    overlay = image.copy()
    counts = {}
    for name, mask in masks.items():
        binary = np.where(mask > 0, 255, 0).astype(np.uint8)
        counts[name] = int(np.count_nonzero(binary))
        cv2.imwrite(str(args.output / f"mask-{name}.png"), binary)
        color = np.zeros_like(image); color[:] = colors[name]
        selected = binary > 0
        overlay[selected] = cv2.addWeighted(overlay, .35, color, .65, 0)[selected]
    cv2.imwrite(str(args.output / "overlay-all.png"), overlay)
    report = {"schemaVersion": 1, "provider": "oemer", "image": str(args.image), "cache": str(args.cache), "width": width, "height": height, "deskewed": not args.without_deskew, "pixelCounts": counts}
    (args.output / "segmentation-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
