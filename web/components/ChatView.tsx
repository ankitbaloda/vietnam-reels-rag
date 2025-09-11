'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, ModelItem, StepId, Citation, Role, RAGResponse } from '../types';
import Markdown from './Markdown';
import ABCompare from './ABCompare';
import { sendChatMessage, sendRAGQuery } from '../utils/api';
import { streamSSE } from '../utils/stream';
import { generateId } from '../utils/localStorage';

interface ChatViewProps {
  messages: Message[];
  onSendMessage: (content: string, model: string, role: Role, citations?: Citation[]) => void;
  onMarkFinal: (content: string, model?: string) => void;
  selectedModel: string;
  ragEnabled: boolean;
  topK: number;
  temperature: number;
  sessionId?: string;
  currentStep: StepId;
  models: ModelItem[];
  isLoading: boolean;
  onUsageUpdate?: (usage: { promptTokens?: number; completionTokens?: number }) => void;
}

export default function ChatView({
  messages,
  onSendMessage,
  onMarkFinal,
  selectedModel,
  ragEnabled,
  topK,
  temperature,
  sessionId,
  currentStep,
  models,
  isLoading,
}: ChatViewProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [abCompareOpen, setAbCompareOpen] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState('');
  const [abLoading, setAbLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [streamCitations, setStreamCitations] = useState<Citation[] | undefined>(undefined);
  const [variants, setVariants] = useState<Array<{ id: string; content: string; model?: string }>>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [activity, setActivity] = useState<string>('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    const threshold = 120; // px from bottom
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  useEffect(() => {
    if (isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setShowJumpToLatest(true);
    }
  }, [messages]);

  const systemForStep = (step: StepId): string => {
    switch (step) {
      case 'ideation': return 'Generate a grounded Idea Card & Outline based only on available sources. Keep headings, bullets, and avoid inventing facts.';
      case 'outline': return 'Create a concise, bullet-point outline with clear headings based on the idea.';
      case 'edl': return 'Draft an Edit Decision List: shot-by-shot plan; one best candidate clip per shot with key metadata, no filenames.';
      case 'script': return 'Write a clear, concise Hinglish-style script with helpful headings and bullet points.';
      case 'suno': return 'Draft a clean, direct Suno music prompt matching tone and pacing.';
      default: return 'Respond clearly with headings and bullet points; keep it concise and grounded.';
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setShowSearch(v => !v); }
      if (showSearch && e.key === 'Escape') { e.preventDefault(); setShowSearch(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSearch]);

  useEffect(() => {
    if (!showSearch) { setSearchQuery(''); setSearchResults([]); return; }
    const q = searchQuery.trim().toLowerCase();
    if (!q) { setSearchResults([]); return; }
    const res = messages.filter((m) => (m.content || '').toLowerCase().includes(q));
    setSearchResults(res.slice(-20));
  }, [showSearch, searchQuery, messages]);

  const startStream = (url: string, body: any, onDone: (finalText: string) => void) => {
    setStreamBuffer('');
    setStreamCitations(undefined);
    let acc = '';
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const stop = streamSSE(
      url,
      body,
      (evt) => {
        if (evt.type === 'context' && Array.isArray(evt.citations)) setStreamCitations(evt.citations as any);
        else if (evt.type === 'message') { acc += evt.delta; setStreamBuffer(acc); }
        else if (evt.type === 'error') setError(evt.error);
        else if (evt.type === 'done') { onDone(acc || 'No response'); setActivity(''); setIsStreaming(false); }
      },
      signal,
    );
    signal.addEventListener('abort', () => stop());
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;
    if (isStreaming) { setQueuedPrompt(inputValue.trim()); return; }

    const userMessage = inputValue.trim();
    setInputValue('');
    setError(null);

    const userMsg: Message = { id: generateId(), role: 'user', content: userMessage, ts: Date.now(), step: currentStep };
    onSendMessage(userMsg.content, selectedModel, 'user');
    setLastUserMessage(userMsg.content);

    try {
      setActivity('Thinking…');
      setIsStreaming(true);
      const url = ragEnabled ? '/api/rag/chat/stream' : '/api/chat/stream';
      const body = ragEnabled
        ? { query: userMessage, model: selectedModel, top_k: topK, temperature, session_id: sessionId, step: currentStep }
        : { model: selectedModel, messages: [ { role: 'system', content: systemForStep(currentStep) }, ...[...messages, userMsg].map(m => ({ role: m.role, content: m.content })) ], temperature, session_id: sessionId, step: currentStep };
      startStream(url, body, (finalText) => {
        onSendMessage(finalText, selectedModel, 'assistant', streamCitations);
        setVariants(v => [...v, { id: generateId(), content: finalText, model: selectedModel }]);
      });
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      setIsStreaming(false);
    } finally {
      if (!isStreaming && queuedPrompt) { const qp = queuedPrompt; setQueuedPrompt(null); setInputValue(qp); Promise.resolve().then(() => handleSubmit()); }
    }
  };

  const handleRegenerate = async () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const prompt = lastUser?.content || lastUserMessage || inputValue;
    if (!prompt) return;
    try {
      setActivity('Regenerating…');
      setIsStreaming(true);
      const url = ragEnabled ? '/api/rag/chat/stream' : '/api/chat/stream';
      const body = ragEnabled
        ? { query: prompt, model: selectedModel, top_k: topK, temperature, session_id: sessionId, step: currentStep }
        : { model: selectedModel, messages: [ { role: 'system', content: systemForStep(currentStep) }, ...messages.filter(m => m.role !== 'assistant').map(m => ({ role: m.role, content: m.content })), { role: 'user', content: prompt } ], temperature, session_id: sessionId, step: currentStep };
      startStream(url, body, (finalText) => {
        onSendMessage(finalText, selectedModel, 'assistant', streamCitations);
        setVariants(v => [...v, { id: generateId(), content: finalText, model: selectedModel }]);
      });
    } catch (err) {
      console.error('Regenerate failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to regenerate';
      setError(errorMessage);
      setIsStreaming(false);
    }
  };

  const handleABTest = async (userMessage: string, model1: string, model2: string) => {
    setAbLoading(true);
    try {
      const call = async (mId: string) => {
        try {
          const resp = ragEnabled
            ? await sendRAGQuery({ query: userMessage, model: mId, top_k: topK, temperature, session_id: sessionId, step: currentStep })
            : await sendChatMessage({
                model: mId,
                messages: [
                  { role: 'system', content: systemForStep(currentStep) },
                  ...messages.map(m => ({ role: m.role, content: m.content })),
                  { role: 'user', content: userMessage },
                ] as any,
                temperature,
                session_id: sessionId,
                step: currentStep,
              });
          return { content: resp.choices[0]?.message?.content || 'No response', citations: (resp as RAGResponse).citations };
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Request failed';
          return { content: `Error: ${msg}`, citations: undefined };
        }
      };

      const [r1, r2] = await Promise.all([call(model1), call(model2)]);
      return { model1Response: r1.content, model2Response: r2.content, model1Citations: r1.citations, model2Citations: r2.citations };
    } finally {
      setAbLoading(false);
    }
  };

  const handleChooseWinner = (content: string, model: string) => {
    onSendMessage(content, model, 'assistant');
  };

  return (
    <div className="flex-1 flex flex-col">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        aria-live="polite"
        onScroll={() => { if (isNearBottom()) setShowJumpToLatest(false); else setShowJumpToLatest(true); }}
      >
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-3 ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-900 border border-gray-200'}`}>
              {message.role === 'user' ? (
                <div>
                  <div className="flex items-center gap-2">
                    {typeof message.editCount === 'number' && (<span className="text-gray-200">Edited ×{message.editCount}</span>)}
                    <button onClick={() => { setInputValue(message.content); textareaRef.current?.focus(); }} className="underline">Edit & Regenerate</button>
                  </div>
                </div>
              ) : (
                <div>
                  <Markdown content={message.content} />
                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Sources</h4>
                      <div className="space-y-2">
                        {message.citations.map((citation, idx) => (
                          <div key={idx} className="text-xs text-gray-600">
                            <span className="font-medium">{citation.title || citation.source}</span>
                            {citation.excerpt && (<div className="mt-1 text-gray-500">{citation.excerpt}</div>)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => navigator.clipboard.writeText(message.content)} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">Copy</button>
                    <button onClick={() => onMarkFinal(message.content, message.model)} className="text-xs text-yellow-600 hover:text-yellow-800 transition-colors">Mark Final</button>
                    {message.id === [...messages].reverse().find(m => m.role === 'assistant')?.id && (
                      <button onClick={() => handleRegenerate()} className="text-xs text-blue-600 hover:text-blue-800 transition-colors">Regenerate</button>
                    )}
                  </div>
                  {message.model && (<div className="mt-2 text-xs text-gray-400">via {models.find(m => m.id === message.model)?.label || message.model}</div>)}
                </div>
              )}
            </div>
          </div>
        ))}

        {isStreaming && streamBuffer && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-50 text-gray-900 border border-gray-200">
              <Markdown content={streamBuffer} />
              {streamCitations && streamCitations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Sources</h4>
                  <div className="space-y-2">
                    {streamCitations.map((citation: any, idx: number) => (
                      <div key={idx} className="text-xs text-gray-600"><span className="font-medium">{citation.title || citation.source}</span></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {(isLoading || (isStreaming && !streamBuffer)) && (
          <div className="flex justify-start">
            <div className="bg-gray-50 text-gray-600 rounded-lg px-4 py-3 border border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <span className="ml-2 text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mx-4 mb-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm flex items-center justify-between gap-3">
          <span className="truncate">{error}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => { setError(null); handleRegenerate(); }} className="text-red-700 border border-red-300 rounded px-2 py-0.5 text-xs hover:bg-red-100">Retry</button>
            <button onClick={() => setError(null)} aria-label="Dismiss error" className="text-red-500 hover:text-red-700">×</button>
          </div>
        </div>
      )}
      {activity && !error && (<div className="mx-4 mb-2 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-xs">{activity}</div>)}

      <div className="border-t border-gray-200 p-4">
        {showSearch && (
          <div className="fixed inset-0 z-40 flex items-start justify-center p-4 bg-black/20" onClick={() => setShowSearch(false)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl border border-gray-200" onClick={(e)=>e.stopPropagation()}>
              <div className="border-b p-3">
                <input value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Search this conversation (Esc to close)" className="w-full outline-none text-sm px-2 py-1" autoFocus />
              </div>
              <div className="max-h-80 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">No matches</div>
                ) : (
                  searchResults.map((m)=> (
                    <div key={m.id} className="p-3 border-t first:border-t-0">
                      <div className="text-xs text-gray-500 mb-1">{m.role} • {new Date(m.ts).toLocaleString()}</div>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        {showJumpToLatest && (
          <div className="mb-2 flex justify-center">
            <button onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowJumpToLatest(false); }} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded px-3 py-1">Jump to latest</button>
          </div>
        )}
        <div className="flex gap-2 mb-2">
          <button onClick={() => setAbCompareOpen(true)} className="text-sm text-blue-600 hover:text-blue-800 transition-colors">A/B Compare</button>
          {isStreaming && (
            <button
              onClick={() => { abortRef.current?.abort(); setIsStreaming(false); setStreamBuffer(''); setStreamCitations(undefined); setActivity(''); }}
              className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
              aria-label="Stop streaming"
              title="Stop (Esc)"
            >
              Stop
            </button>
          )}
        </div>
        <form onSubmit={(e) => handleSubmit(e)} className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              const ta = textareaRef.current;
              if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, Math.round(window.innerHeight * 0.6)) + 'px'; }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
              else if (e.key === 'Escape' && isStreaming) { e.preventDefault(); abortRef.current?.abort(); }
            }}
            placeholder={ragEnabled ? "Ask about your documents..." : "Type your message..."}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{ height: 'auto', maxHeight: '60vh', overflowY: 'auto' }}
            disabled={false}
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!inputValue.trim() ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {isStreaming ? 'Queue' : 'Send'}
          </button>
        </form>

        {variants.length > 1 && (
          <div className="mt-3">
            <button className="text-xs text-gray-600 underline" onClick={() => setShowVersions(!showVersions)}>
              {showVersions ? 'Hide versions' : `Show versions (${variants.length})`}
            </button>
            {showVersions && (
              <div className="mt-2 border border-gray-200 rounded">
                {variants.map((v, i) => (
                  <div key={v.id} className="p-2 border-t first:border-t-0">
                    <div className="text-xs text-gray-500 mb-1">Variant {i + 1} {v.model ? `• ${v.model}` : ''}</div>
                    <div className="prose prose-sm max-w-none line-clamp-4">{v.content}</div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => onSendMessage(v.content, v.model || selectedModel, 'assistant')} className="text-xs text-blue-600 hover:text-blue-800">Use this</button>
                      <button onClick={() => navigator.clipboard.writeText(v.content)} className="text-xs text-gray-600 hover:text-gray-800">Copy</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ABCompare
        models={models}
        isOpen={abCompareOpen}
        onClose={() => setAbCompareOpen(false)}
        onTest={handleABTest}
        onChooseWinner={(content, model) => onSendMessage(content, model, 'assistant')}
        isLoading={abLoading}
        defaultUserMessage={lastUserMessage || inputValue}
        defaultModelA={selectedModel}
      />
    </div>
  );
}