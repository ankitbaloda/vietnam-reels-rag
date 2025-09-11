"use client";

import { useEffect, useState } from "react";
import { ModelItem } from "../types";
import { fetchModels } from "../utils/api";

interface HeaderControlsProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  ragEnabled: boolean;
  onRAGToggle: (enabled: boolean) => void;
  topK: number;
  onTopKChange: (topK: number) => void;
  temperature: number;
  onTemperatureChange: (t: number) => void;
  sessionTitle?: string;
  onSessionTitleChange?: (title: string) => void;
}

export default function HeaderControls(props: HeaderControlsProps) {
  const {
    selectedModel,
    onModelChange,
    ragEnabled,
    onRAGToggle,
    topK,
    onTopKChange,
    temperature,
    onTemperatureChange,
  sessionTitle,
  onSessionTitleChange,
  } = props;

  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [costFilter, setCostFilter] = useState<"all" | "free" | "paid">("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('theme') as any) || 'system';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    root.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchModels();
        if (mounted) setModels(data.items || []);
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || "Failed to load models");
          if (models.length === 0) {
            setModels([
              {
                id: "gpt-3.5-turbo",
                provider: "OpenAI",
                label: "GPT-3.5 Turbo",
                free: true,
                paid: false,
                recommended: true,
              },
            ]);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const providers = Array.from(new Set(models.map((m: ModelItem) => m.provider)));
  const filtered = models.filter((m: ModelItem) => {
    if (providerFilter !== "all" && m.provider !== providerFilter) return false;
    if (costFilter === "free" && !m.free) return false;
    if (costFilter === "paid" && !m.paid) return false;
    return true;
  });
  const recommended = filtered.filter((m: ModelItem) => m.recommended);
  const others = filtered.filter((m: ModelItem) => !m.recommended);

  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Conversation title */}
        <div className="flex items-center gap-2 mr-4">
          <input
            type="text"
            value={sessionTitle ?? ''}
            onChange={(e) => onSessionTitleChange?.(e.target.value)}
            placeholder="Untitled conversation"
            className="text-base md:text-lg font-semibold text-gray-900 border-b border-transparent focus:border-blue-400 outline-none bg-transparent px-1"
            aria-label="Conversation title"
          />
        </div>
        {/* RAG Toggle */}
        <div className="flex items-center gap-2" title="Use your documents to ground answers (Recommended)">
          <label className="text-sm font-medium text-gray-700">RAG</label>
          <button
            onClick={() => onRAGToggle(!ragEnabled)}
            className={`w-10 h-6 rounded-full transition-colors ${ragEnabled ? "bg-blue-600" : "bg-gray-300"}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${ragEnabled ? "translate-x-5" : "translate-x-1"}`} />
          </button>
        </div>

  {/* Model */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Model:</label>
          <select
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 min-w-40"
            disabled={loading}
          >
            {loading ? (
              <option>Loading...</option>
            ) : error ? (
              <option>Error loading</option>
            ) : (
              <>
                {recommended.length > 0 && (
                  <optgroup label="Recommended">
                    {recommended.map((m: ModelItem) => (
                      <option key={m.id} value={m.id}>
                        {m.label || m.id}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="All">
                  {others.map((m: ModelItem) => (
                    <option key={m.id} value={m.id}>
                      {m.label || m.id}
                    </option>
                  ))}
                </optgroup>
              </>
            )}
          </select>
        </div>

        {/* Theme */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Theme:</label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
            aria-label="Theme selector"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        {/* Advanced toggle */}
        <button
          className="text-sm text-gray-600 border border-gray-300 rounded px-2 py-1 hover:bg-gray-50"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? "Hide Advanced" : "Advanced"}
        </button>
      </div>

      {showAdvanced && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Provider:</label>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="all">All</option>
              {providers.map((p: string) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Cost:</label>
            <select
              value={costFilter}
              onChange={(e) => setCostFilter(e.target.value as "all" | "free" | "paid")}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="all">All</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {ragEnabled && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Top K:</label>
              <input
                type="number"
                value={topK}
                onChange={(e) => onTopKChange(Number(e.target.value))}
                min={1}
                max={20}
                className="text-sm border border-gray-300 rounded px-2 py-1 w-16"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Temp:</label>
            <input
              type="number"
              value={temperature}
              onChange={(e) => onTemperatureChange(Number(e.target.value))}
              min={0}
              max={2}
              step={0.1}
              className="text-sm border border-gray-300 rounded px-2 py-1 w-16"
            />
          </div>
        </div>
      )}
    </div>
  );
}