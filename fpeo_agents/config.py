import atexit
import os
import sys
from openai import OpenAI

LLAMA_ENDPOINT = "http://localhost:8080/v1"
MODEL_NAME = "gemma-4-12b-it-qat"
ENDPOINT_SPARQL = "http://localhost:3030/fpeo/sparql"
VOID_PATH = "fpeo_void.ttl"

MAX_RETRIES = 5
MAX_TOKENS = 4096  # Suficiente para o reasoning do gpt-oss + tool call / SPARQL
TEMPERATURE = 0.1
MAX_TOOL_CALLS_PER_ATTEMPT = 15

# Suprime stderr ao finalizar processos locais
atexit.register(lambda: setattr(sys, "stderr", open(os.devnull, "w")))

client = OpenAI(
    base_url=LLAMA_ENDPOINT,
    api_key="not-needed",
)
