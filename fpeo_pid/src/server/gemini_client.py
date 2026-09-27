import os
import json
import time
import logging
from typing import Optional, Type, Any
from pydantic import BaseModel
from google import genai
from config import DEFAULT_GEMINI_MODEL

logger = logging.getLogger("fpeo.gemini")

class GeminiClientService:
    """Encapsulates Google GenAI SDK interaction for structured and unstructured generation."""

    def __init__(self, default_model: str = DEFAULT_GEMINI_MODEL):
        self.default_model = default_model

    def _resolve_client(self, api_key: Optional[str] = None) -> genai.Client:
        key = api_key or os.environ.get("GEMINI_API_KEY")
        if not key:
            raise ValueError(
                "GEMINI_API_KEY not configured. Please supply an API key in the UI settings panel "
                "or set the GEMINI_API_KEY environment variable."
            )
        return genai.Client(api_key=key)

    def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        temperature: float = 0.1,
    ) -> str:
        client = self._resolve_client(api_key)
        target_model = model if (model and model.startswith("gemini-")) else self.default_model

        logger.info(f"[GEMINI] Text generation request to model '{target_model}' (prompt length: {len(prompt)} chars)")
        t0 = time.time()

        kwargs: dict[str, Any] = {
            "model": target_model,
            "input": prompt,
            "generation_config": {"temperature": temperature},
        }
        if system_instruction:
            kwargs["system_instruction"] = system_instruction

        try:
            interaction = client.interactions.create(**kwargs)
            duration = time.time() - t0
            output_text = interaction.output_text.strip()
            logger.info(f"[GEMINI] Text generation received in {duration:.2f}s ({len(output_text)} chars)")
            return output_text
        except Exception as exc:
            duration = time.time() - t0
            logger.error(f"[GEMINI] Generation failed on model '{target_model}' after {duration:.2f}s: {exc}")
            raise exc

    def generate_structured(
        self,
        prompt: str,
        response_schema: Type[BaseModel],
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        temperature: float = 0.1,
    ) -> BaseModel:
        client = self._resolve_client(api_key)
        target_model = model if (model and model.startswith("gemini-")) else self.default_model

        logger.info(f"[GEMINI] Structured generation request ({response_schema.__name__}) to model '{target_model}' (prompt: {len(prompt)} chars)")
        t0 = time.time()

        json_schema = response_schema.model_json_schema()
        kwargs: dict[str, Any] = {
            "model": target_model,
            "input": prompt,
            "generation_config": {"temperature": temperature},
            "response_format": {
                "type": "text",
                "mime_type": "application/json",
                "schema": json_schema,
            },
        }
        if system_instruction:
            kwargs["system_instruction"] = system_instruction

        try:
            interaction = client.interactions.create(**kwargs)
            duration = time.time() - t0
            raw_text = interaction.output_text.strip()
            logger.info(f"[GEMINI] Structured response received in {duration:.2f}s ({len(raw_text)} chars)")

            if raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1]
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:]
                raw_text = raw_text.strip()

            parsed_data = json.loads(raw_text)
            return response_schema.model_validate(parsed_data)
        except Exception as exc:
            duration = time.time() - t0
            logger.error(f"[GEMINI] Structured call failed on model '{target_model}' after {duration:.2f}s: {exc}")
            raise exc

gemini_service = GeminiClientService()

