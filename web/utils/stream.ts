export type StreamEvent =
  | { type: 'message'; delta: string }
  | { type: 'done'; finish_reason?: string }
  | { type: 'error'; error: string }
  | { type: 'context'; citations: any[] }
  | { type: 'usage'; prompt_tokens?: number; completion_tokens?: number; context_tokens?: number; rag_enabled?: boolean };

export function streamSSE(url: string, body: any, onEvent: (e: StreamEvent) => void, signal?: AbortSignal): () => void {
  const controller = new AbortController();
  const combined = combineSignals(signal, controller.signal);
  const resp = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: combined,
  }).then(async (r) => {
    if (!r.ok || !r.body) {
      onEvent({ type: 'error', error: `HTTP ${r.status}` });
      onEvent({ type: 'done', finish_reason: 'error' });
      return;
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = chunk.split('\n');
        let event = 'message';
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        try {
          const obj = data ? JSON.parse(data) : {};
          if (event === 'message') onEvent({ type: 'message', delta: obj.delta || '' });
          else if (event === 'done') onEvent({ type: 'done', finish_reason: obj.finish_reason });
          else if (event === 'error') onEvent({ type: 'error', error: obj.error || 'error' });
          else if (event === 'context') onEvent({ type: 'context', citations: obj.citations || [] });
          else if (event === 'usage') onEvent({ type: 'usage', prompt_tokens: obj.prompt_tokens, completion_tokens: obj.completion_tokens, context_tokens: obj.context_tokens, rag_enabled: obj.rag_enabled });
        } catch {
          // ignore malformed events
        }
      }
    }
  }).catch((e) => {
    onEvent({ type: 'error', error: e?.message || 'network error' });
    onEvent({ type: 'done', finish_reason: 'error' });
  });
  return () => controller.abort();
}

function combineSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a && !b) return undefined;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  a?.addEventListener('abort', onAbort);
  b?.addEventListener('abort', onAbort);
  if (a?.aborted || b?.aborted) ctrl.abort();
  return ctrl.signal;
}
