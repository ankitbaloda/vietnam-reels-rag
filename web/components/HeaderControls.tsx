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
  persona: string;
  onPersonaChange: (persona: string) => void;
  trip: string;
  onTripChange: (trip: string) => void;
  sessionTitle?: string;
  onSessionTitleChange?: (title: string) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  rightPanelCollapsed?: boolean;
  onToggleRightPanel?: () => void;
  onShowDashboard: () => void;
  usage?: { promptTokens?: number; completionTokens?: number };
  modelId?: string;
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
    persona,
    onPersonaChange,
    trip,
    onTripChange,
    sessionTitle,
    onSessionTitleChange,
    sidebarCollapsed,
    onToggleSidebar,
    rightPanelCollapsed = false,
    onToggleRightPanel,
    onShowDashboard,
    usage,
    modelId,
  } = props;  const [models, setModels] = useState<ModelItem[]>([]);
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
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {sidebarCollapsed && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          
          {/* Model */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Model:</label>
            <select
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 min-w-40 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  <optgroup label="Other Models">
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

          {/* Persona */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Persona:</label>
            <select
              value={persona}
              onChange={(e) => onPersonaChange(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="Vipin">Vipin</option>
              <option value="Divya">Divya</option>
              <option value="Both">Both</option>
              <option value="Freehand">Freehand</option>
            </select>
          </div>

          {/* Trip */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Trip:</label>
            <input
              type="text"
              value={trip}
              onChange={(e) => onTripChange(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-24 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="vietnam"
            />
          </div>

          {/* RAG Toggle */}
          <div className="flex items-center gap-2" title="Use your documents to ground answers (Recommended)">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">RAG</label>
            <button
              onClick={() => onRAGToggle(!ragEnabled)}
              className={`w-10 h-6 rounded-full transition-colors ${ragEnabled ? "bg-blue-600" : "bg-gray-300"}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${ragEnabled ? "translate-x-5" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Theme */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme:</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              aria-label="Theme selector"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          {/* Advanced toggle */}
          <button
            className="text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 transition-colors"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "Hide Advanced" : "Advanced"}
          </button>
          
          <button
            onClick={onShowDashboard}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            Dashboard
          </button>
          
          {onToggleRightPanel && (
            <button
              onClick={onToggleRightPanel}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title={rightPanelCollapsed ? "Show right panel" : "Hide right panel"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {rightPanelCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                )}
              </svg>
            </button>
          )}
          
          {usage && (usage.promptTokens || usage.completionTokens) && (
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {((usage.promptTokens || 0) + (usage.completionTokens || 0)).toLocaleString()} tokens
            </div>
          )}
        </div>
      </div>

      {showAdvanced && (
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Provider:</label>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cost:</label>
            <select
              value={costFilter}
              onChange={(e) => setCostFilter(e.target.value as "all" | "free" | "paid")}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {ragEnabled && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Top K:</label>
              <input
                type="number"
                value={topK}
                onChange={(e) => onTopKChange(Number(e.target.value))}
                min={1}
                max={20}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-16 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Temp:</label>
            <input
              type="number"
              value={temperature}
              onChange={(e) => onTemperatureChange(Number(e.target.value))}
              min={0}
              max={2}
              step={0.1}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-16 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}