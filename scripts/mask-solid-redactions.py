#!/usr/bin/env python3

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def main():
    parser = argparse.ArgumentParser(description="Mask large near-solid redaction rectangles before OMR inference.")
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    image = cv2.imread(str(args.source), cv2.IMREAD_COLOR)
    if image is None:
        raise SystemExit(f"Cannot read {args.source}")
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    binary = np.where(gray < 45, 255, 0).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    rectangles = []
    for label in range(1, count):
        x, y, width, height, area = map(int, stats[label])
        box_area = width * height
        fill = area / box_area if box_area else 0
        if area < 3500 or width < 100 or height < 12 or width / max(height, 1) < 3 or fill < .7:
            continue
        pad = 2
        x1, y1 = max(0, x - pad), max(0, y - pad)
        x2, y2 = min(image.shape[1], x + width + pad), min(image.shape[0], y + height + pad)
        surrounding = gray[max(0, y1 - 8):min(gray.shape[0], y2 + 8), max(0, x1 - 8):min(gray.shape[1], x2 + 8)]
        background = int(np.percentile(surrounding[surrounding > 80], 70)) if np.any(surrounding > 80) else 235
        image[y1:y2, x1:x2] = background
        rectangles.append({"x": x1, "y": y1, "width": x2 - x1, "height": y2 - y1, "fill": round(fill, 4), "replacementGray": background})

    args.output.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(args.output), image)
    report = {"schemaVersion": 1, "source": str(args.source), "output": str(args.output), "maskedRectangles": rectangles}
    if args.report:
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
