import os
import logging
from typing import Dict, Any, List, Optional

from config import (
    DEFAULT_GEMINI_MODEL,
    DEFAULT_OLLAMA_MODEL,
    QA_SYSTEM_PROMPT,
    QA_PROMPT_TEMPLATE,
    AUDIT_SYSTEM_PROMPT,
    AUDIT_PROMPT_TEMPLATE,
)
from llm_provider import UnifiedLLMProvider, unified_llm_provider

logger = logging.getLogger("fpeo.llm_explainer")

class LLMExplainerService:
    """Executor that provides LLM explanations for HermiT DL audit justifications and SPARQL-grounded answers."""

    def __init__(
        self,
        llm_provider: UnifiedLLMProvider = unified_llm_provider,
        qa_system_prompt: str = QA_SYSTEM_PROMPT,
        qa_prompt_template: str = QA_PROMPT_TEMPLATE,
        audit_system_prompt: str = AUDIT_SYSTEM_PROMPT,
        audit_prompt_template: str = AUDIT_PROMPT_TEMPLATE,
    ):
        self.llm_provider = llm_provider
        self.qa_system_prompt = qa_system_prompt
        self.qa_prompt_template = qa_prompt_template
        self.audit_system_prompt = audit_system_prompt
        self.audit_prompt_template = audit_prompt_template

    def explain_audit_justifications(
        self,
        justifications: List[Dict[str, Any]],
        llm_provider: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        gemini_model: str = DEFAULT_GEMINI_MODEL,
        ollama_url: Optional[str] = None,
        ollama_model: str = DEFAULT_OLLAMA_MODEL,
    ) -> Optional[str]:
        resolved_provider = self.llm_provider.resolve_provider(llm_provider, gemini_api_key, ollama_url)

        if resolved_provider == "none":
            return None

        prompt = self.audit_prompt_template.format(justifications=justifications)

        return self.llm_provider.generate_text(
            prompt=prompt,
            system_instruction=self.audit_system_prompt,
            provider=resolved_provider,
            gemini_api_key=gemini_api_key,
            gemini_model=gemini_model,
            ollama_url=ollama_url,
            ollama_model=ollama_model,
            temperature=0.2,
        )

    def generate_grounded_answer(
        self,
        question: str,
        sparql_query: str,
        sparql_results: List[Dict[str, Any]],
        llm_provider: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        gemini_model: str = DEFAULT_GEMINI_MODEL,
        ollama_url: Optional[str] = None,
        ollama_model: str = DEFAULT_OLLAMA_MODEL,
    ) -> str:
        resolved_provider = self.llm_provider.resolve_provider(llm_provider, gemini_api_key, ollama_url)

        if resolved_provider == "none":
            raise ValueError("O motor de inferência LLM está desabilitado nas configurações.")

        if not sparql_results:
            results_text = "NENHUM REGISTRO RETORNADO (0 resultados na execução da consulta SPARQL)."
        else:
            results_text = f"Total de {len(sparql_results)} registro(s) retornado(s):\n" + "\n".join(
                f"- Registro {i}: " + ", ".join(
                    f"{k} = {v.split('#')[-1].split('/')[-1] if ('#' in str(v) or '/' in str(v)) else v}"
                    for k, v in row.items()
                )
                for i, row in enumerate(sparql_results, 1)
            )

        prompt = self.qa_prompt_template.format(
            question=question,
            sparql_query=sparql_query,
            results_text=results_text,
        )

        ans = ""
        try:
            ans = self.llm_provider.generate_text(
                prompt=prompt,
                system_instruction=self.qa_system_prompt,
                provider=resolved_provider,
                gemini_api_key=gemini_api_key,
                gemini_model=gemini_model,
                ollama_url=ollama_url,
                ollama_model=ollama_model,
                temperature=0.2,
            )
        except Exception as exc:
            logger.warning(f"[LLM EXPLAINER] Text generation failed ({exc}), formulating structured fallback response.")

        if ans and ans.strip():
            return ans.strip()

        # Fallback: Formulate clear, structured response from the SPARQL results
        if not sparql_results:
            return f"Nenhum registro correspondente foi encontrado no grafo ontológico para a pergunta: *\"{question}\"*."

        lines = [f"Com base na consulta semântica ao grafo ontológico ({len(sparql_results)} registro(s) retornado(s)):\n"]
        for row in sparql_results:
            eq = row.get("equipment", "").split("#")[-1].split("/")[-1]
            lbl = row.get("label") or eq
            typ = row.get("type", "").split("#")[-1].split("/")[-1]
            details = []
            if lbl and lbl != eq:
                details.append(f"**{lbl}** (`{eq}`)")
            else:
                details.append(f"**{eq}**")
            if typ:
                details.append(f"Tipo: `{typ}`")
            for k, v in row.items():
                if k not in ("equipment", "label", "type") and str(v).strip():
                    v_clean = str(v).split("#")[-1].split("/")[-1]
                    details.append(f"{k}: `{v_clean}`")
            lines.append("- " + " | ".join(details))

        return "\n".join(lines)

    execute_audit = explain_audit_justifications
    execute_qa = generate_grounded_answer

llm_explainer_service = LLMExplainerService()
