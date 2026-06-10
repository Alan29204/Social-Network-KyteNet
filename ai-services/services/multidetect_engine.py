"""MultiDetect engine (abhi099k/image-multi-detect)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import numpy as np
import onnxruntime as ort
from huggingface_hub import hf_hub_download
from PIL import Image

Decision = Literal["allow", "block"]

MODEL_REPO = "abhi099k/image-multi-detect"
MODEL_FILE = "model.onnx"

LABELS = (
    "nsfw",
    "violence",
    "weapon",
    "smoking",
    "alcohol",
    "drugs",
    "sensitive",
    "hate",
)

DEFAULT_BLOCK_LABELS = frozenset(
    {
        "nsfw",
        "violence",
        "weapon",
        "sensitive",
        "hate",
    }
)

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


@dataclass
class MultiDetectResult:
    decision: Decision
    scores: dict[str, float]
    block_labels: list[str]
    max_block_score: float
    reason: str


class MultiDetectEngine:
    def __init__(
        self,
        threshold: float = 0.5,
        block_labels: frozenset[str] | None = None,
        model_path: str | None = None,
    ) -> None:
        self.threshold = threshold
        self.block_labels = block_labels or DEFAULT_BLOCK_LABELS

        if model_path is None:
            model_path = hf_hub_download(repo_id=MODEL_REPO, filename=MODEL_FILE)

        providers = ["CPUExecutionProvider"]
        if "CUDAExecutionProvider" in ort.get_available_providers():
            providers.insert(0, "CUDAExecutionProvider")

        self.session = ort.InferenceSession(model_path, providers=providers)

    def _preprocess(self, image: Image.Image) -> np.ndarray:
        rgb = image.convert("RGB").resize((224, 224), Image.BILINEAR)
        array = np.asarray(rgb, dtype=np.float32) / 255.0
        array = (array - IMAGENET_MEAN) / IMAGENET_STD
        array = np.transpose(array, (2, 0, 1))
        return np.expand_dims(array, axis=0)

    def _predict_scores(self, image: Image.Image) -> dict[str, float]:
        tensor = self._preprocess(image)
        logits = self.session.run(None, {"input": tensor})[0][0]
        probs = 1.0 / (1.0 + np.exp(-logits))
        return {label: float(probs[index]) for index, label in enumerate(LABELS)}

    def moderate_image(self, image: Image.Image) -> MultiDetectResult:
        scores = self._predict_scores(image)

        block_labels = [
            label
            for label in self.block_labels
            if scores[label] >= self.threshold
        ]

        max_block_score = max(
            (scores[label] for label in self.block_labels),
            default=0.0,
        )

        if block_labels:
            details = ", ".join(
                f"{label} ({scores[label]:.2%})" for label in block_labels
            )
            return MultiDetectResult(
                decision="block",
                scores=scores,
                block_labels=block_labels,
                max_block_score=max_block_score,
                reason=f"MultiDetect: {details}",
            )

        return MultiDetectResult(
            decision="allow",
            scores=scores,
            block_labels=[],
            max_block_score=max_block_score,
            reason="MultiDetect: khong co nhan chan nao vuot nguong",
        )

    def moderate_file(self, path: str | Path) -> MultiDetectResult:
        image_path = Path(path)
        if not image_path.is_file():
            raise FileNotFoundError(f"Image not found: {image_path}")

        with Image.open(image_path) as image:
            return self.moderate_image(image)
