import os
import re
import json
import time
import logging
import urllib.request
import urllib.error
from typing import Optional, Type, Any, Dict
from pydantic import BaseModel

from config import DEFAULT_GEMINI_MODEL, DEFAULT_OLLAMA_URL, DEFAULT_OLLAMA_MODEL
from gemini_client import GeminiClientService, gemini_service

logger = logging.getLogger("fpeo.llm_provider")

def clean_json_text(raw_text: str) -> str:
    """Extracts and cleans JSON substrings from LLM response text."""
    text = raw_text.strip()
    if "```" in text:
        matches = re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if matches:
            text = matches[0].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
    return text

class OllamaClientService:
    """Encapsulates HTTP interaction with local Ollama service using the chat endpoint."""

    def __init__(self, default_url: str = DEFAULT_OLLAMA_URL, default_model: str = DEFAULT_OLLAMA_MODEL):
        self.default_url = default_url
        self.default_model = default_model

    def _resolve_endpoint(self, url: Optional[str] = None) -> str:
        base = url.strip().rstrip("/") if (url and url.strip()) else self.default_url
        return f"{base}/api/chat"

    def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        ollama_url: Optional[str] = None,
        temperature: float = 0.1,
    ) -> str:
        target_url = self._resolve_endpoint(ollama_url)
        target_model = model.strip() if (model and model.strip()) else self.default_model

        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        payload: Dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }

        logger.info(f"[OLLAMA] Chat request to model '{target_model}' at {target_url}")
        t0 = time.time()

        try:
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                target_url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=120) as response:
                res_body = response.read().decode("utf-8")
                data = json.loads(res_body)
                msg = data.get("message", {})
                output = msg.get("content", "").strip()
                if not output and "thinking" in msg:
                    output = msg.get("thinking", "").strip()

                logger.info(f"[OLLAMA] Response received in {(time.time() - t0):.2f}s ({len(output)} chars)")
                return output
        except urllib.error.HTTPError as http_err:
            err_body = http_err.read().decode("utf-8", errors="ignore")
            logger.error(f"[OLLAMA] HTTP {http_err.code} on '{target_model}': {err_body}")
            raise RuntimeError(f"Ollama ({target_model}) error HTTP {http_err.code}: {err_body}")
        except Exception as exc:
            logger.error(f"[OLLAMA] Request failed on '{target_model}' after {(time.time() - t0):.2f}s: {exc}")
            raise exc

    def generate_structured(
        self,
        prompt: str,
        response_schema: Type[BaseModel],
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        ollama_url: Optional[str] = None,
        temperature: float = 0.0,
    ) -> BaseModel:
        target_url = self._resolve_endpoint(ollama_url)
        target_model = model.strip() if (model and model.strip()) else self.default_model

        fields_desc = []
        for fname, ffield in response_schema.model_fields.items():
            fdesc = ffield.description or fname
            fields_desc.append(f'  "{fname}": <{fdesc}>')
        fields_str = "{\n" + ",\n".join(fields_desc) + "\n}"

        augmented_system = (
            (system_instruction or "You are an expert ontology engineer.") +
            "\n\nOUTPUT FORMAT REQUIREMENT:"
            "\nYou MUST respond strictly in valid JSON matching this exact structure:"
            f"\n```json\n{fields_str}\n```"
            "\nOutput ONLY the JSON object inside a ```json ... ``` code block. Do NOT include any introductory or concluding text."
        )

        messages = [
            {"role": "system", "content": augmented_system},
            {"role": "user", "content": prompt},
        ]

        payload: Dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }

        logger.info(f"[OLLAMA] Structured request ({response_schema.__name__}) to '{target_model}' at {target_url}")
        t0 = time.time()

        try:
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                target_url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=120) as response:
                res_body = response.read().decode("utf-8")
                data = json.loads(res_body)
                msg = data.get("message", {})
                raw_output = msg.get("content", "").strip()
                if not raw_output and "thinking" in msg:
                    raw_output = msg.get("thinking", "").strip()

                cleaned_json = clean_json_text(raw_output)

                try:
                    parsed = json.loads(cleaned_json)
                except Exception as json_err:
                    logger.warning(f"[OLLAMA] Raw output ({len(raw_output)} chars): {repr(raw_output)}")
                    match = re.search(r"(\{[\s\S]*\})", raw_output)
                    if match:
                        parsed = json.loads(match.group(1))
                    else:
                        raise json_err

                validated = response_schema.model_validate(parsed)
                logger.info(f"[OLLAMA] Structured output validated in {(time.time() - t0):.2f}s")
                return validated
        except urllib.error.HTTPError as http_err:
            err_body = http_err.read().decode("utf-8", errors="ignore")
            logger.error(f"[OLLAMA] HTTP {http_err.code} on '{target_model}': {err_body}")
            raise RuntimeError(f"Ollama ({target_model}) error HTTP {http_err.code}: {err_body}")
        except Exception as exc:
            logger.error(f"[OLLAMA] Structured call failed on '{target_model}' after {(time.time() - t0):.2f}s: {exc}")
            raise exc

ollama_service = OllamaClientService()

class UnifiedLLMProvider:
    """Unified dispatcher for Gemini, Ollama, and deterministic No-LLM modes."""

    def __init__(
        self,
        gemini_client: GeminiClientService = gemini_service,
        ollama_client: OllamaClientService = ollama_service,
    ):
        self.gemini_client = gemini_client
        self.ollama_client = ollama_client

    def resolve_provider(
        self,
        provider: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        ollama_url: Optional[str] = None,
    ) -> str:
        if provider:
            p = provider.lower().strip()
            if p in ("gemini", "ollama", "none"):
                return p
        if gemini_api_key and gemini_api_key.strip():
            return "gemini"
        if ollama_url and ollama_url.strip():
            return "ollama"
        if os.environ.get("GEMINI_API_KEY"):
            return "gemini"
        return "none"

    def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        provider: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        gemini_model: Optional[str] = None,
        ollama_url: Optional[str] = None,
        ollama_model: Optional[str] = None,
        temperature: float = 0.1,
    ) -> str:
        active_provider = self.resolve_provider(provider, gemini_api_key, ollama_url)

        if active_provider == "gemini":
            return self.gemini_client.generate_text(
                prompt=prompt,
                system_instruction=system_instruction,
                model=gemini_model,
                api_key=gemini_api_key,
                temperature=temperature,
            )
        elif active_provider == "ollama":
            return self.ollama_client.generate_text(
                prompt=prompt,
                system_instruction=system_instruction,
                model=ollama_model,
                ollama_url=ollama_url,
                temperature=temperature,
            )
        else:
            raise ValueError("O motor de inferência LLM está desabilitado nas configurações.")

    def generate_structured(
        self,
        prompt: str,
        response_schema: Type[BaseModel],
        system_instruction: Optional[str] = None,
        provider: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        gemini_model: Optional[str] = None,
        ollama_url: Optional[str] = None,
        ollama_model: Optional[str] = None,
        temperature: float = 0.0,
    ) -> BaseModel:
        active_provider = self.resolve_provider(provider, gemini_api_key, ollama_url)

        if active_provider == "gemini":
            return self.gemini_client.generate_structured(
                prompt=prompt,
                response_schema=response_schema,
                system_instruction=system_instruction,
                model=gemini_model,
                api_key=gemini_api_key,
                temperature=temperature,
            )
        elif active_provider == "ollama":
            return self.ollama_client.generate_structured(
                prompt=prompt,
                response_schema=response_schema,
                system_instruction=system_instruction,
                model=ollama_model,
                ollama_url=ollama_url,
                temperature=temperature,
            )
        else:
            raise ValueError("O motor de inferência LLM está desabilitado nas configurações.")

unified_llm_provider = UnifiedLLMProvider()
