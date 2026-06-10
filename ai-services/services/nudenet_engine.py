"""NudeNet engine (notAI-tech/NudeNet)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from nudenet import NudeDetector
from PIL import Image

Decision = Literal["allow", "block"]

DEFAULT_BLOCK_CLASSES = frozenset(
    {
        "FEMALE_BREAST_EXPOSED",
        "FEMALE_GENITALIA_EXPOSED",
        "MALE_GENITALIA_EXPOSED",
        "BUTTOCKS_EXPOSED",
        "ANUS_EXPOSED",
    }
)


@dataclass
class Detection:
    class_name: str
    score: float
    box: list[int]


@dataclass
class NudeNetResult:
    decision: Decision
    detections: list[Detection]
    block_detections: list[Detection]
    max_block_score: float
    reason: str


class NudeNetEngine:
    def __init__(
        self,
        threshold: float = 0.5,
        block_classes: frozenset[str] | None = None,
    ) -> None:
        self.threshold = threshold
        self.block_classes = block_classes or DEFAULT_BLOCK_CLASSES
        self.detector = NudeDetector()

    def _to_bgr_array(self, image: Image.Image) -> np.ndarray:
        rgb = np.array(image.convert("RGB"))
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    def _parse_detections(self, raw: list[dict]) -> list[Detection]:
        return [
            Detection(
                class_name=item["class"],
                score=float(item["score"]),
                box=[int(value) for value in item["box"]],
            )
            for item in raw
        ]

    def moderate_image(self, image: Image.Image) -> NudeNetResult:
        raw = self.detector.detect(self._to_bgr_array(image))
        detections = self._parse_detections(raw)

        block_detections = [
            item
            for item in detections
            if item.class_name in self.block_classes and item.score >= self.threshold
        ]

        max_block_score = max(
            (item.score for item in block_detections),
            default=0.0,
        )

        if block_detections:
            details = ", ".join(
                f"{item.class_name} ({item.score:.2%})" for item in block_detections
            )
            return NudeNetResult(
                decision="block",
                detections=detections,
                block_detections=block_detections,
                max_block_score=max_block_score,
                reason=f"NudeNet: {details}",
            )

        if detections:
            return NudeNetResult(
                decision="allow",
                detections=detections,
                block_detections=[],
                max_block_score=0.0,
                reason="NudeNet: co phat hien nhung khong vuot nguong",
            )

        return NudeNetResult(
            decision="allow",
            detections=[],
            block_detections=[],
            max_block_score=0.0,
            reason="NudeNet: khong phat hien vung nhay cam",
        )

    def moderate_file(self, path: str | Path) -> NudeNetResult:
        image_path = Path(path)
        if not image_path.is_file():
            raise FileNotFoundError(f"Image not found: {image_path}")

        with Image.open(image_path) as image:
            return self.moderate_image(image)
