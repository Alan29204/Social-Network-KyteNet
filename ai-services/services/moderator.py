"""Combined moderation: NudeNet + MultiDetect."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from PIL import Image

from .multidetect_engine import MultiDetectResult, MultiDetectEngine
from .nudenet_engine import NudeNetResult, NudeNetEngine

Decision = Literal["allow", "block"]


@dataclass
class CombinedResult:
    decision: Decision
    nudenet: NudeNetResult
    multidetect: MultiDetectResult
    reason: str


class CombinedModerator:
    """Block when either NudeNet or MultiDetect flags content."""

    def __init__(
        self,
        nudenet_threshold: float = 0.5,
        multidetect_threshold: float = 0.85, # Updated to 0.85 for Action Movies
    ) -> None:
        self.nudenet = NudeNetEngine(threshold=nudenet_threshold)
        self.multidetect = MultiDetectEngine(threshold=multidetect_threshold)

    def moderate_image(self, image: Image.Image) -> CombinedResult:
        nudenet_result = self.nudenet.moderate_image(image)
        multidetect_result = self.multidetect.moderate_image(image)

        if nudenet_result.decision == "block" and multidetect_result.decision == "block":
            reason = f"{nudenet_result.reason}; {multidetect_result.reason}"
            decision = "block"
        elif nudenet_result.decision == "block":
            reason = nudenet_result.reason
            decision = "block"
        elif multidetect_result.decision == "block":
            reason = multidetect_result.reason
            decision = "block"
        else:
            reason = "Ca hai model deu cho phep"
            decision = "allow"

        return CombinedResult(
            decision=decision,
            nudenet=nudenet_result,
            multidetect=multidetect_result,
            reason=reason,
        )

    def moderate_file(self, path: str | Path) -> CombinedResult:
        image_path = Path(path)
        if not image_path.is_file():
            raise FileNotFoundError(f"Image not found: {image_path}")

        with Image.open(image_path) as image:
            return self.moderate_image(image)
