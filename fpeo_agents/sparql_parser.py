import re

def remove_reasoning_blocks(text: str) -> str:
    if not text:
        return ""
    cleaned = text
    cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r"<analysis>.*?</analysis>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r"<reasoning>.*?</reasoning>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    return cleaned.strip()

def extract_sparql(text: str) -> str:
    if not text:
        return ""

    cleaned = remove_reasoning_blocks(text)
    if not cleaned:
        return ""

    match = re.search(r"```(?:sparql)?\s*(.*?)\s*```", cleaned, re.DOTALL | re.IGNORECASE)
    if match:
        query = match.group(1).strip()
        if query:
            return query

    cleaned = re.sub(r"```(?:sparql)?", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace("```", "").strip()

    query_start = re.search(r"\b(?:PREFIX|BASE)\b", cleaned, re.IGNORECASE)
    if query_start:
        return cleaned[query_start.start():].strip()

    query_start = re.search(r"\b(?:SELECT|ASK|CONSTRUCT|DESCRIBE)\b", cleaned, re.IGNORECASE)
    if query_start:
        return cleaned[query_start.start():].strip()

    return cleaned

def enforce_canonical_prefixes(query: str, canonical_bindings: dict[str, str]) -> str:
    """Descarta prefixes alucinados pelo LLM e injeta as URIs oficiais do grafo."""
    lines = query.splitlines()
    body_lines = []

    # Remove qualquer linha PREFIX gerada pelo modelo
    for line in lines:
        if re.match(r"^\s*PREFIX\s+[a-zA-Z0-9_-]+:\s*<.*?>\s*$", line, re.IGNORECASE):
            continue
        body_lines.append(line)

    clean_body = "\n".join(body_lines).strip()

    # Injeta apenas os prefixos canônicos que são realmente utilizados no corpo da query
    injected_prefixes = []
    for prefix, uri in canonical_bindings.items():
        if not prefix:
            continue
        if re.search(r"\b" + re.escape(prefix) + r":", clean_body):
            injected_prefixes.append(f"PREFIX {prefix}: <{uri}>")

    return "\n".join(injected_prefixes) + "\n\n" + clean_body

def looks_like_sparql(query: str) -> bool:
    if not query:
        return False
    query = query.strip()
    if not re.match(r"^(?:PREFIX|BASE|SELECT|ASK|CONSTRUCT|DESCRIBE)\b", query, re.IGNORECASE):
        return False
    if re.search(r"\b(?:SELECT|CONSTRUCT|DESCRIBE)\b", query, re.IGNORECASE):
        if "{" not in query or "}" not in query:
            return False
    return True

def extract_model_response(response):
    message = response.choices[0].message
    content = getattr(message, "content", None) or ""
    reasoning = getattr(message, "reasoning", None) or ""
    reasoning_content = getattr(message, "reasoning_content", None) or ""
    return content, reasoning, reasoning_content
