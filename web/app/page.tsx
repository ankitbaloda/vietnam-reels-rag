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
  generateId,
  generateSessionName,
  autoRenameSession
} from '../utils/localStorage';
import { fetchModels, fetchHistory, runPipelineStep } from '../utils/api';
import SessionSidebar from '../components/SessionSidebar';
import HeaderControls from '../components/HeaderControls';
import StepTabs from '../components/StepTabs';
import ChatView from '../components/ChatView';
import MetaPanel from '../components/MetaPanel';
import RightPanel from '../components/RightPanel';
import Dashboard from '../components/Dashboard';

export default function Home() {
  // State management
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [ragEnabled, setRagEnabled] = useState<boolean>(false);
  const [topK, setTopK] = useState<number>(25);
  const [temperature, setTemperature] = useState<number>(0.4);
  const [persona, setPersona] = useState<string>('Both');
  const [trip, setTrip] = useState<string>('vietnam');
  const [finals, setFinals] = useState<Record<string, Record<StepId, FinalEntry[]>>>({});
  const [usage, setUsage] = useState<Record<string, UsageStat>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPipelineRunning, setIsPipelineRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState<boolean>(false);
  const [showDashboard, setShowDashboard] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<'actions' | 'usage'>('actions');

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
    
    // Handle user messages carefully to prevent disappearance
    if (role === 'user') {
      // Always add user messages - remove duplicate detection
      // (User should be able to send the same message multiple times)
      updatedMessages.push(message);
    } else {
      // Assistant message - always add it (no filtering/replacement)
      updatedMessages.push(message);
    }
    
    // Auto-name session from first user message across all steps, if still default
    const totalMsgsBefore = Object.values(currentSession.messagesByStep || {}).reduce((acc, arr) => acc + (arr?.length || 0), 0);
    const shouldAutoName = role === 'user' && totalMsgsBefore === 0 && (!currentSession.name || currentSession.name === 'New Chat');
    const autoName = shouldAutoName ? generateSessionName(content) : currentSession.name;
    
    // Create intermediate session for auto-rename check
    const intermediateSession = {
      ...currentSession,
      name: autoName,
      messagesByStep: {
        ...currentSession.messagesByStep,
        [currentSession.currentStep]: updatedMessages
      }
    };
    
    // Auto-rename session based on conversation after 2+ exchanges
    const totalMsgsAfter = Object.values(intermediateSession.messagesByStep || {}).reduce((acc, arr) => acc + (arr?.length || 0), 0);
    const shouldAutoRename = totalMsgsAfter >= 4 && !intermediateSession.autoRenamed && role === 'assistant';
    const finalName = shouldAutoRename ? autoRenameSession(intermediateSession) : intermediateSession.name;
    
    const updatedSession = {
      ...intermediateSession,
      name: finalName,
      autoRenamed: shouldAutoRename || intermediateSession.autoRenamed
    };
    
    // Update state immediately to prevent race conditions
    setCurrentSession(updatedSession);
    
    const updatedSessions = sessions.map(s => s.id === currentSession.id ? updatedSession : s);
    setSessions(updatedSessions);
    saveSessions(updatedSessions);
    
    // Debug logging to track message persistence
    console.log(`Message added - Role: ${role}, Current messages count: ${updatedMessages.length}`, {
      content: content.slice(0, 50) + '...',
      sessionId: currentSession.id,
      step: currentSession.currentStep,
      totalMessages: updatedMessages.length
    });
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
    <div className="h-screen bg-white dark:bg-gray-900 flex overflow-hidden">
      {/* Sessions Sidebar - Fixed */}
      <div className={`${sidebarCollapsed ? 'w-0' : 'w-64'} transition-all duration-300 overflow-hidden flex-shrink-0`}>
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
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header with model controls - Fixed */}
        <div className="flex-shrink-0">
          <HeaderControls
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            ragEnabled={ragEnabled}
            onRAGToggle={setRagEnabled}
            topK={topK}
            onTopKChange={setTopK}
            temperature={temperature}
            onTemperatureChange={setTemperature}
            persona={persona}
            onPersonaChange={setPersona}
            trip={trip}
            onTripChange={setTrip}
            sessionTitle={currentSession?.name}
            onSessionTitleChange={(title) => handleSessionRename(currentSession?.id || '', title)}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            rightPanelCollapsed={rightPanelCollapsed}
            onToggleRightPanel={() => setRightPanelCollapsed(!rightPanelCollapsed)}
            onShowDashboard={() => setShowDashboard(true)}
            usage={currentSessionUsage}
            modelId={selectedModel}
          />
        </div>

        {/* Step Tabs - Fixed */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
          <StepTabs
            currentStep={currentSession.currentStep}
            onStepChange={handleStepChange}
          />
        </div>

        {/* Chat View and Right Panel - Scrollable */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="flex-1 overflow-hidden">
            <ChatView
              messages={currentMessages}
              onSendMessage={handleSendMessage}
              onMarkFinal={handleMarkFinal}
              selectedModel={selectedModel}
              ragEnabled={ragEnabled}
              topK={topK}
              temperature={temperature}
              persona={persona}
              trip={trip}
              sessionId={currentSession.id}
              currentStep={currentSession.currentStep}
              models={models}
              isLoading={isLoading}
              onUsageUpdate={handleUsageUpdate}
            />
          </div>

          {/* Right Panel - Fixed */}
          <div className={`${rightPanelCollapsed ? 'w-0' : 'w-80'} transition-all duration-300 overflow-hidden flex-shrink-0`}>
            <RightPanel
              tab={rightPanelTab}
              onTabChange={setRightPanelTab}
              citations={currentCitations}
              finals={currentSessionFinals}
              currentStep={currentSession.currentStep}
              usage={currentSessionUsage}
              modelId={selectedModel}
              messages={currentMessages}
              persona={persona}
              trip={trip}
              topK={topK}
              temperature={temperature}
              collapsed={rightPanelCollapsed}
              onToggleCollapse={() => setRightPanelCollapsed(!rightPanelCollapsed)}
            />
          </div>
        </div>
      </div>

      {/* Dashboard Modal */}
      {showDashboard && (
        <Dashboard
          sessions={sessions}
          finals={finals}
          onClose={() => setShowDashboard(false)}
          onOpenSession={(session) => {
            setCurrentSession(session);
            setShowDashboard(false);
          }}
        />
      )}

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