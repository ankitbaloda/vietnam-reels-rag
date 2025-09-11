'use client';

import { useState, useEffect, useCallback } from 'react';
import { Session, Message, ModelItem, StepId, FinalEntry, UsageStat, Citation, Role } from '../types';
import {
  loadSessions,
  saveSessions,
  loadFinals,
  saveFinals,
  loadUsage,
  saveUsage,
  createNewSession,
  createFinalEntry,
  generateId
} from '../utils/localStorage';
import { fetchModels, fetchHistory, runPipelineStep } from '../utils/api';
import SessionSidebar from '../components/SessionSidebar';
import HeaderControls from '../components/HeaderControls';
import StepTabs from '../components/StepTabs';
import ChatView from '../components/ChatView';
import MetaPanel from '../components/MetaPanel';

export default function Home() {
  // State management
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [ragEnabled, setRagEnabled] = useState<boolean>(true);
  const [topK, setTopK] = useState<number>(25);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [finals, setFinals] = useState<Record<string, Record<StepId, FinalEntry[]>>>({});
  const [usage, setUsage] = useState<Record<string, UsageStat>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPipelineRunning, setIsPipelineRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Load from localStorage
        const savedSessions = loadSessions();
        const savedFinals = loadFinals();
        const savedUsage = loadUsage();
        
        setSessions(savedSessions);
        setFinals(savedFinals);
        setUsage(savedUsage);
        
        // Set current session or create new one
        if (savedSessions.length > 0) {
          setCurrentSession(savedSessions[0]);
        } else {
          const newSession = createNewSession();
          setSessions([newSession]);
          setCurrentSession(newSession);
          saveSessions([newSession]);
        }

  // Load models
  const modelsData = await fetchModels();
  const items = modelsData.items || [];
  setModels(items);

  // Prefer GPT‑5 mini by id or label, else recommended, else first
  const preferOrder = ['gpt-5-mini', 'openrouter/gpt-5-mini', 'gpt-4o-mini', 'openai/gpt-4o-mini'];
  const byId = preferOrder.map(id => items.find(m => m.id === id)).find(Boolean);
  const byLabel = items.find(m => (m.label || '').toLowerCase().includes('gpt-5') && (m.label || '').toLowerCase().includes('mini'));
  const recommended = items.find(m => m.recommended);
  const firstModel = items[0];
  setSelectedModel((byId || byLabel || recommended || firstModel)?.id || '');

      } catch (err) {
        console.error('Failed to initialize:', err);
        setError('Failed to initialize application');
      }
    };

    initializeData();
  }, []);

  // Sync with server history when session changes
  useEffect(() => {
    if (currentSession) {
      syncWithServerHistory(currentSession.id);
    }
  }, [currentSession]);

  const syncWithServerHistory = async (sessionId: string) => {
    try {
      const history = await fetchHistory({ session_id: sessionId, limit: 200 });
      // TODO: Merge server history with local state
      // This would involve comparing timestamps and merging message arrays
    } catch (err) {
      console.error('Failed to sync with server history:', err);
    }
  };

  // Session management
  const handleSessionCreate = () => {
    const newSession = createNewSession();
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    setCurrentSession(newSession);
    saveSessions(updatedSessions);
  };

  const handleSessionSelect = (session: Session) => {
    setCurrentSession(session);
  };

  const handleSessionRename = (sessionId: string, newName: string) => {
    const updatedSessions = sessions.map(s => 
      s.id === sessionId ? { ...s, name: newName } : s
    );
    setSessions(updatedSessions);
    saveSessions(updatedSessions);
    
    if (currentSession?.id === sessionId) {
      setCurrentSession({ ...currentSession, name: newName });
    }
  };

  const handleSessionDelete = (sessionId: string) => {
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    saveSessions(updatedSessions);
    
    if (currentSession?.id === sessionId) {
      setCurrentSession(updatedSessions[0] || null);
    }
    
    // Clean up finals and usage
    const updatedFinals = { ...finals };
    delete updatedFinals[sessionId];
    setFinals(updatedFinals);
    saveFinals(updatedFinals);
    
    const updatedUsage = { ...usage };
    delete updatedUsage[sessionId];
    setUsage(updatedUsage);
    saveUsage(updatedUsage);
  };

  const handleSessionDuplicate = (session: Session) => {
    const duplicatedSession = {
      ...session,
      id: generateId(),
      name: `${session.name} (Copy)`,
      createdAt: Date.now()
    };
    
    const updatedSessions = [duplicatedSession, ...sessions];
    setSessions(updatedSessions);
    setCurrentSession(duplicatedSession);
    saveSessions(updatedSessions);
  };

  // Step management
  const handleStepChange = (step: StepId) => {
    if (!currentSession) return;
    
    const updatedSession = { ...currentSession, currentStep: step };
    setCurrentSession(updatedSession);
    
    const updatedSessions = sessions.map(s => 
      s.id === currentSession.id ? updatedSession : s
    );
    setSessions(updatedSessions);
    saveSessions(updatedSessions);
  };

  // Accumulate token usage (basic cost tracker)
  const handleUsageUpdate = (u: { promptTokens?: number; completionTokens?: number }) => {
    if (!currentSession) return;
    const prev = usage[currentSession.id] || {};
    const next = {
      promptTokens: (prev.promptTokens || 0) + (u.promptTokens || 0),
      completionTokens: (prev.completionTokens || 0) + (u.completionTokens || 0),
    };
    const updated = { ...usage, [currentSession.id]: next };
    setUsage(updated);
    saveUsage(updated);
  };

  // Message handling
  const handleSendMessage = useCallback((content: string, model: string, role: Role, citations?: Citation[]) => {
    if (!currentSession) return;
    
    const message: Message = {
      id: generateId(),
      role,
      content,
      model: role === 'assistant' ? model : undefined,
      ts: Date.now(),
      step: currentSession.currentStep,
      citations
    };
    
    const currentStepMessages = currentSession.messagesByStep[currentSession.currentStep] || [];
    let updatedMessages = [...currentStepMessages];
    // If the user is sending a message that exactly matches the last user message, treat it as an edit/regenerate
    if (role === 'user' && currentStepMessages.length > 0) {
      const last = currentStepMessages[currentStepMessages.length - 1];
      if (last.role === 'user' && last.content === content) {
        // bump editCount
        const bumped = { ...last, editCount: (last.editCount || 0) + 1 };
        updatedMessages = [...currentStepMessages.slice(0, -1), bumped];
      } else {
        updatedMessages.push(message);
      }
    } else {
      updatedMessages.push(message);
    }
  // Auto-name session from first user message across all steps, if still default
  const totalMsgsBefore = Object.values(currentSession.messagesByStep || {}).reduce((acc, arr) => acc + (arr?.length || 0), 0);
  const shouldAutoName = role === 'user' && totalMsgsBefore === 0 && (!currentSession.name || currentSession.name.startsWith('Session '));
    const autoName = shouldAutoName
      ? (() => {
          const base = content.trim().replace(/\s+/g, ' ').slice(0, 60);
          const cleaned = base.replace(/[\n\r\t]+/g, ' ').replace(/[#*`_>\[\](){}]|\|/g, '').trim();
          return cleaned || currentSession.name;
        })()
      : currentSession.name;
    const updatedSession = {
      ...currentSession,
      name: autoName,
      messagesByStep: {
        ...currentSession.messagesByStep,
        [currentSession.currentStep]: updatedMessages
      }
    };
    
    setCurrentSession(updatedSession);
    
  const updatedSessions = sessions.map(s => s.id === currentSession.id ? updatedSession : s);
    setSessions(updatedSessions);
    saveSessions(updatedSessions);
  }, [currentSession, sessions]);

  // Finals management
  const handleMarkFinal = (content: string, model?: string) => {
    if (!currentSession) return;
    
    const finalEntry = createFinalEntry(content, model);
    const sessionFinals = finals[currentSession.id] || {} as Record<StepId, FinalEntry[]>;
    const stepFinals = sessionFinals[currentSession.currentStep] || [];
    
    // Avoid duplicates
    if (stepFinals.some(f => f.id === finalEntry.id)) return;
    
    const updatedStepFinals = [...stepFinals, finalEntry];
    const updatedSessionFinals = { ...sessionFinals, [currentSession.currentStep]: updatedStepFinals };
    const updatedFinals = { ...finals, [currentSession.id]: updatedSessionFinals };
    
    setFinals(updatedFinals);
    saveFinals(updatedFinals);
  };

  // Get current step messages
  const currentMessages = currentSession 
    ? currentSession.messagesByStep[currentSession.currentStep] || []
    : [];

  // Get current step citations for coverage
  const currentCitations = currentMessages
    .filter(m => m.citations)
    .flatMap(m => m.citations || []);

  // Get current session finals
  const currentSessionFinals = currentSession && finals[currentSession.id] 
    ? finals[currentSession.id] 
    : {} as Record<StepId, FinalEntry[]>;

  // Get current session usage
  const currentSessionUsage = currentSession ? usage[currentSession.id] : undefined;

  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Loading Reels RAG UI...</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex">
      {/* Header Controls */}
      {/* Sessions Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-0' : 'w-64'} transition-all duration-300 overflow-hidden`}>
        <SessionSidebar
          sessions={sessions}
          currentSession={currentSession}
          onSessionSelect={handleSessionSelect}
          onSessionCreate={handleSessionCreate}
          onSessionRename={handleSessionRename}
          onSessionDelete={handleSessionDelete}
          onSessionDuplicate={handleSessionDuplicate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with model controls */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {sidebarCollapsed && (
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentSession?.name || 'New Chat'}
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Model Selector */}
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
              
              {/* RAG Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">RAG</span>
                <button
                  onClick={() => setRagEnabled(!ragEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors ${
                    ragEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform ${
                      ragEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Step Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <StepTabs
            currentStep={currentSession.currentStep}
            onStepChange={handleStepChange}
          />
        </div>

        {/* Chat View */}
        <div className="flex-1 flex">
          <ChatView
            messages={currentMessages}
            onSendMessage={handleSendMessage}
            onMarkFinal={handleMarkFinal}
            selectedModel={selectedModel}
            ragEnabled={ragEnabled}
            topK={topK}
            temperature={temperature}
            sessionId={currentSession.id}
            currentStep={currentSession.currentStep}
            models={models}
            isLoading={isLoading}
            onUsageUpdate={handleUsageUpdate}
          />

          {/* Meta Panel */}
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <MetaPanel
              citations={currentCitations}
              finals={currentSessionFinals}
              currentStep={currentSession.currentStep}
              usage={currentSessionUsage}
              modelId={selectedModel}
            />
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 ml-4"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}