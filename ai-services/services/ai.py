import io
import asyncio
from typing import Dict, Any
import aiohttp
from PIL import Image
from .moderator import CombinedModerator

class AIService:
    def __init__(self):
        # Load the combined moderator (NudeNet + MultiDetect)
        self.moderator = CombinedModerator(
            nudenet_threshold=0.5, 
            multidetect_threshold=0.85
        )
        
    async def classify_image(self, image_url: str) -> Dict[str, Any]:
        try:
            # Download image asynchronously from SeaweedFS URL
            async with aiohttp.ClientSession() as session:
                async with session.get(image_url, timeout=10) as response:
                    response.raise_for_status()
                    content = await response.read()
            
            # Read image using PIL
            image = Image.open(io.BytesIO(content))
            
            # Convert to RGB if necessary (e.g. RGBA pngs)
            if image.mode != 'RGB':
                image = image.convert('RGB')

            # Chạy model nặng trong threadpool để không chặn event loop
            result = await asyncio.to_thread(self.moderator.moderate_image, image)

            return {
                'success': True,
                'image_url': image_url,
                'decision': result.decision,
                'reason': result.reason,
                'nudenet_scores': {
                     det.class_name: round(det.score, 2) 
                     for det in result.nudenet.detections 
                     if det.score > 0.1
                },
                'multidetect_scores': {
                     k: round(v, 2) 
                     for k, v in result.multidetect.scores.items() 
                     if v > 0.1
                }
            }

        except Exception as e:
            return {
                'success': False,
                'image_url': image_url,
                'error': str(e),
                'decision': 'allow', # Default to allow if error happens to prevent locking system
                'reason': f"Error downloading/processing image: {str(e)}"
            }

