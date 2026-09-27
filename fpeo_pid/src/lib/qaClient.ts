export interface SemanticConceptMeta {
  uri: string;
  label: string;
  local_name: string;
}

export interface SemanticMappingMeta {
  target_classes: SemanticConceptMeta[];
  target_properties: SemanticConceptMeta[];
  context_entities: SemanticConceptMeta[];
  active_fpso_filter?: string | null;
  active_module_filter?: string | null;
}

export interface ExploredTripleMeta {
  subject: string;
  predicate: string;
  object: string;
  source_file?: string;
}

export interface ExplorationMeta {
  seed_nodes: Array<{ uri: string; label: string; local_name: string; types: string[] }>;
  explored_triples: ExploredTripleMeta[];
  relevant_predicates: string[];
  subgraph_text: string;
  discovered_instances: any[];
  provenance_sources?: string[];
}

import { LLMProvider } from './types';

export interface QARequest {
  question: string;
  active_fpso_id?: string;
  active_module_id?: string;
  ttl_contents?: string[];
  llm_provider?: LLMProvider;
  gemini_api_key?: string;
  gemini_model?: string;
  ollama_url?: string;
  ollama_model?: string;
}

export interface QAResponse {
  question: string;
  semantic_mapping: SemanticMappingMeta;
  exploration: ExplorationMeta;
  sparql_query: string;
  sparql_intent: string;
  sparql_results: Array<Record<string, string>>;
  llm_response: string;
  hermit_consistency?: {
    isConsistent: boolean;
    justificationsCount: number;
    inferredTriples: number;
    fromCache: boolean;
  };
  provenance: string[];
  timestamp: string;
}

export async function askOntologyGraphRAG(
  request: QARequest,
  backendUrl: string = 'http://localhost:8000'
): Promise<QAResponse> {
  const endpoint = `${backendUrl.replace(/\/$/, '')}/api/qa`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorData.detail || `Erro na API GraphRAG (${response.status})`);
  }

  return response.json();
}
