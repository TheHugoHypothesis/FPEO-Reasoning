import { AuditResult, AppSettings } from './types';

export async function runSemanticAudit(
    ttlContents: string[],
    settings: AppSettings
): Promise<AuditResult> {
    const backendUrl = settings.backendUrl ? settings.backendUrl.replace(/\/$/, '') : 'http://localhost:8000';

    try {
        const res = await fetch(`${backendUrl}/api/audit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ttl_contents: ttlContents,
                llm_provider: settings.llmProvider || 'gemini',
                gemini_api_key: settings.geminiApiKey ? settings.geminiApiKey.trim() : undefined,
                gemini_model: settings.geminiModel || undefined,
                ollama_url: settings.ollamaUrl || undefined,
                ollama_model: settings.ollamaModel || undefined,
            }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Serviço raciocinador respondeu com erro HTTP ${res.status}: ${errorText}`);
        }

        const data = await res.json();
        return {
            isConsistent: data.isConsistent,
            status: data.status,
            justifications: data.justifications || [],
            llmExplanation: data.llmExplanation,
            timestamp: new Date().toLocaleTimeString('pt-BR'),
        };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido ao conectar com o serviço backend.';
        throw new Error(`Falha ao conectar com o servidor Raciocinador HermiT (${backendUrl}): ${message}`);
    }
}
