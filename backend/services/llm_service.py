"""
LLM service — generates farmer-friendly advice using OpenAI.
"""

import logging
import os
from typing import AsyncGenerator

try:
    import openai
except ImportError:
    openai = None

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are KrishiBot, an expert agricultural advisor for Indian farmers.
You have deep knowledge of crop diseases, soil science, crop selection, and sustainable
farming practices. You receive a structured farm analysis report and relevant knowledge
passages, then provide clear, actionable, farmer-friendly advice.

Rules:
- Be specific and practical — avoid vague statements.
- Structure your response with clear sections: Summary, Immediate Actions, 
  Crop Recommendations, Soil Management, Warnings (if any).
- Use simple language a rural farmer can understand.
- Adapt response language as instructed (Tamil, Hindi, Telugu, or English).
- Always mention if confidence is low and recommend consulting a local agronomist.
- Do NOT hallucinate fertiliser brand names or dosages you are unsure about.
- Keep response under 500 words unless detail is critical.
"""


class LLMService:
    def __init__(self, api_key: str, base_url: str = None):
        if openai is None:
            raise RuntimeError("openai package is not installed.")
        kwargs = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self._sync_client = openai.OpenAI(**kwargs)
        self._async_client = openai.AsyncOpenAI(**kwargs)
        self.model = os.getenv("LLM_MODEL", "gpt-4o-mini")

    async def invoke(self, context: str, rag_passages: str = "", prompt: str = "") -> str:
        """
        Async generation — returns full response string.
        """
        if openai is None:
            return "LLM service unavailable."

        user_message = ""
        if rag_passages:
            user_message += "--- Reference Knowledge ---\n" + rag_passages + "\n\n"
        if context:
            user_message += "--- Analysis Context ---\n" + context + "\n\n"
        
        user_message += f"User Question: {prompt}" if prompt else "Please provide general agricultural advice based on the context above."

        try:
            response = await self._async_client.chat.completions.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message}
                ],
            )
            return response.choices[0].message.content
        except Exception as exc:
            logger.error("OpenAI API error: %s", exc)
            raise RuntimeError(f"LLM service error: {exc}") from exc

    async def stream(self, context: str, rag_passages: str = "", prompt: str = "") -> AsyncGenerator[str, None]:
        """
        Async streaming generator — yields text chunks.
        Use with FastAPI StreamingResponse.
        """
        if openai is None:
            yield "LLM service unavailable."
            return

        user_message = ""
        if rag_passages:
            user_message += "--- Reference Knowledge ---\n" + rag_passages + "\n\n"
        if context:
            user_message += "--- Analysis Context ---\n" + context + "\n\n"
        
        user_message += f"User Question: {prompt}" if prompt else "Please provide general agricultural advice based on the context above."

        try:
            stream = await self._async_client.chat.completions.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message}
                ],
                stream=True
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as exc:
            logger.error("OpenAI API stream error: %s", exc)
            yield f"\n[Error: {exc}]"
