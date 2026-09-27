import time
import logging
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from config import DEFAULT_GEMINI_MODEL, DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_URL
from reasoner import reasoner_service
from llm_explainer import llm_explainer_service
from qa_pipeline import qa_pipeline_instance

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("fpeo.api")

app = FastAPI(
    title="FPEO Semantic Reasoner & Ontology-Driven GraphRAG API",
    description="Backend service combining HermiT OWL DL Reasoner, Ontology-Driven Multi-Hop GraphRAG, SPARQL Synthesis, and Google Gemini / Ollama LLM Providers",
    version="2.4.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AuditRequest(BaseModel):
    ttl_contents: List[str]
    llm_provider: Optional[str] = "gemini"
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = DEFAULT_GEMINI_MODEL
    ollama_url: Optional[str] = DEFAULT_OLLAMA_URL
    ollama_model: Optional[str] = DEFAULT_OLLAMA_MODEL

class ExplainRequest(BaseModel):
    justifications: List[Dict[str, Any]]
    llm_provider: Optional[str] = "gemini"
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = DEFAULT_GEMINI_MODEL
    ollama_url: Optional[str] = DEFAULT_OLLAMA_URL
    ollama_model: Optional[str] = DEFAULT_OLLAMA_MODEL

class QARequest(BaseModel):
    question: str
    active_fpso_id: Optional[str] = None
    active_module_id: Optional[str] = None
    ttl_contents: Optional[List[str]] = None
    llm_provider: Optional[str] = "gemini"
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = DEFAULT_GEMINI_MODEL
    ollama_url: Optional[str] = DEFAULT_OLLAMA_URL
    ollama_model: Optional[str] = DEFAULT_OLLAMA_MODEL

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "FPEO Reasoner & GraphRAG Backend",
        "supported_providers": ["gemini", "ollama", "none"],
        "pipeline": "HermiT OWL DL Reasoner -> Inferred Graph Materialization -> Dynamic Ontology Mapping -> Multi-Hop GraphRAG -> SPARQL Synthesis -> LLM Response / Deterministic Grounding"
    }

@app.post("/api/audit")
def audit_ontology(request: AuditRequest):
    if not request.ttl_contents:
        raise HTTPException(status_code=400, detail="No TTL content provided in request payload.")

    logger.info(f"[API] Starting semantic consistency audit for {len(request.ttl_contents)} payload(s)")
    t_start = time.time()

    try:
        audit_result = reasoner_service.execute_audit(request.ttl_contents)
        logger.info(
            f"[API] Audit completed: isConsistent={audit_result['isConsistent']}, "
            f"justifications={len(audit_result.get('justifications', []))}, "
            f"inferredTriples={audit_result.get('inferredTriples', 0)}, "
            f"fromCache={audit_result.get('fromCache', False)}"
        )

        if not audit_result["isConsistent"] and audit_result.get("justifications"):
            logger.info(f"[API] Inconsistency detected. Synthesizing diagnostic with provider: '{request.llm_provider}'...")
            audit_result["llmExplanation"] = llm_explainer_service.execute_audit(
                justifications=audit_result["justifications"],
                llm_provider=request.llm_provider,
                gemini_api_key=request.gemini_api_key,
                gemini_model=request.gemini_model or DEFAULT_GEMINI_MODEL,
                ollama_url=request.ollama_url,
                ollama_model=request.ollama_model or DEFAULT_OLLAMA_MODEL,
            )

        duration = time.time() - t_start
        logger.info(f"[API] Audit request finished in {duration:.2f}s")
        return audit_result
    except Exception as exc:
        logger.error(f"[API] Audit execution failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Reasoner error: {str(exc)}")

@app.post("/api/explain")
def explain_justifications(request: ExplainRequest):
    try:
        explanation = llm_explainer_service.execute_audit(
            justifications=request.justifications,
            llm_provider=request.llm_provider,
            gemini_api_key=request.gemini_api_key,
            gemini_model=request.gemini_model or DEFAULT_GEMINI_MODEL,
            ollama_url=request.ollama_url,
            ollama_model=request.ollama_model or DEFAULT_OLLAMA_MODEL,
        )
        return {"explanation": explanation}
    except Exception as exc:
        logger.error(f"[API] Explanation synthesis failed: {exc}")
        raise HTTPException(status_code=500, detail=f"LLM explanation error: {str(exc)}")

@app.post("/api/qa")
def answer_natural_language_question(request: QARequest):
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Natural language question must not be empty.")

    try:
        response = qa_pipeline_instance.execute_qa(
            question=request.question,
            active_fpso_id=request.active_fpso_id,
            active_module_id=request.active_module_id,
            ttl_contents=request.ttl_contents,
            llm_provider=request.llm_provider,
            gemini_api_key=request.gemini_api_key,
            gemini_model=request.gemini_model or DEFAULT_GEMINI_MODEL,
            ollama_url=request.ollama_url,
            ollama_model=request.ollama_model or DEFAULT_OLLAMA_MODEL,
        )
        return response
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        err_msg = str(exc)
        logger.error(f"[API] GraphRAG pipeline failed: {err_msg}")

        if "429" in err_msg or "quota" in err_msg.lower() or "too_many_requests" in err_msg.lower():
            raise HTTPException(
                status_code=429,
                detail="Rate limit / Quota exceeded on Google AI Studio API (Free Tier: 20 requests/minute). Please wait 30 to 50 seconds before sending another query."
            )

        raise HTTPException(status_code=500, detail=f"GraphRAG pipeline error: {err_msg}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
