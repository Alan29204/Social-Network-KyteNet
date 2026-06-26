from sentence_transformers import SentenceTransformer
from core.settings import settings

class Embeddings:
    _models = {}

    def __init__(self, model_name: str | None = None):
        self.model_name = model_name or settings.EMBEDDING_MODEL_NAME
        if self.model_name not in self._models:
            self._models[self.model_name] = SentenceTransformer(self.model_name)
        self.model = self._models[self.model_name]

    # Embedding text
    def get_embedding_text(self, text: str) -> list:
        return self.model.encode(text).tolist()
