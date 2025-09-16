import { useState } from 'react';
import { FinalEntry, Citation, StepId, Message } from '../types';
import { estimateCostUSD, getModelPricing } from '../utils/pricing';
import { estimateConversationTokens } from '../utils/tokenizer';
import { getCoverageSummary, groupCitationsByCategory } from '../utils/coverage';
import { formatDateTime } from '../utils/dateUtils';

interface RightPanelProps {
  tab: 'actions' | 'usage';
  onTabChange: (tab: 'actions' | 'usage') => void;
  citations: Citation[];
  finals: Record<StepId, FinalEntry[]>;
  currentStep: StepId;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
  modelId?: string;
  messages: Message[];
  persona: string;
  trip: string;
  topK: number;
  temperature: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function RightPanel({
  tab,
  onTabChange,
  citations,
  finals,
  currentStep,
  usage,
  modelId,
  messages,
  persona,
  trip,
  topK,
  temperature,
  collapsed = false,
  onToggleCollapse
}: RightPanelProps) {
  const coverageSummary = getCoverageSummary(citations);
  const stepFinals = finals[currentStep] || [];
  const cost = usage ? estimateCostUSD(usage, modelId) : undefined;
  const pricing = getModelPricing(modelId);

  // Use actual API usage data when available, fallback to estimation
  const sessionTokens = usage ? {
    totalInput: usage.promptTokens || 0,
    totalOutput: usage.completionTokens || 0
  } : {
    // Fallback to estimation if no API usage data available
    totalInput: estimateConversationTokens(
      messages.map(m => ({ role: m.role, content: m.content })), 
      modelId
    ).inputTokens,
    totalOutput: estimateConversationTokens(
      messages.map(m => ({ role: m.role, content: m.content })), 
      modelId
    ).outputTokens
  };

  const tabs = [
    { id: 'actions' as const, label: 'Actions', icon: '⚡' },
    { id: 'usage' as const, label: 'Usage', icon: '📊' }
  ];

  return (
    <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col h-full relative">
      {/* Collapse Button */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="absolute top-2 left-2 z-10 p-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          title={collapsed ? "Expand panel" : "Collapse panel"}
        >
          {collapsed ? (
            <svg className="w-3 h-3 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      )}
      
      {/* Tab Headers */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex">
          {tabs.map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => onTabChange(tabItem.id)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                tab === tabItem.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <span className="mr-1">{tabItem.icon}</span>
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'actions' && (
          <div className="p-4 space-y-4">
            {/* Coverage Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Coverage</h3>
              {coverageSummary.length > 0 ? (
                <div className="space-y-2">
                  {coverageSummary.map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded-lg text-xs border border-gray-200 dark:border-gray-600"
                    >
                      <span className="text-gray-700 dark:text-gray-300">{item.category}</span>
                      <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No sources available</p>
              )}
            </div>

            {/* Sources Used */}
            {citations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Sources Used</h3>
                <div className="space-y-2">
                  {citations.slice(0, 5).map((citation, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700">
                      <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {citation.title || citation.source}
                      </div>
                      {citation.excerpt && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {citation.excerpt}
                        </div>
                      )}
                    </div>
                  ))}
                  {citations.length > 5 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                      +{citations.length - 5} more sources
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Finals */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Finals ({currentStep})
              </h3>
              {stepFinals.length > 0 ? (
                <div className="space-y-2">
                  {stepFinals.map((final) => (
                    <div
                      key={final.id}
                      className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs"
                    >
                      <div className="font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                        {final.model || 'Unknown Model'}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 line-clamp-3">
                        {final.content.substring(0, 100)}...
                      </div>
                      <div className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">
                        {formatDateTime(final.ts)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No finals marked yet</p>
              )}
            </div>
          </div>
        )}

        {tab === 'usage' && (
          <div className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Token Usage & Cost</h3>
            
            {/* Current Request Usage */}
            {usage && (usage.promptTokens || usage.completionTokens) ? (
              <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Last Request</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Input Tokens:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{(usage.promptTokens || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Output Tokens:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{(usage.completionTokens || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Tokens:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{((usage.promptTokens || 0) + (usage.completionTokens || 0)).toLocaleString()}</span>
                  </div>
                  {cost && (
                    <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-1 mt-2">
                      <span className="text-gray-900 dark:text-gray-100 font-medium">Request Cost:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">${cost.totalUSD.toFixed(4)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Last Request</h4>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  No token usage data available. Make a request to see usage statistics.
                </div>
              </div>
            )}

            {/* Session Cumulative Usage */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <h4 className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2">Session Total</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-blue-600 dark:text-blue-400">Total Input:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">{sessionTokens.totalInput.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600 dark:text-blue-400">Total Output:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">{sessionTokens.totalOutput.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-blue-200 dark:border-blue-700 pt-1 mt-2">
                  <span className="text-blue-900 dark:text-blue-100 font-medium">Est. Session Cost:</span>
                  <span className="font-semibold text-blue-900 dark:text-blue-100">
                    ${((sessionTokens.totalInput / 10000) * pricing.inputPer10K + (sessionTokens.totalOutput / 10000) * pricing.outputPer10K).toFixed(4)}
                  </span>
                </div>
              </div>
            </div>

            {/* Model Pricing Info */}
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Model Pricing</h4>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Model:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{modelId || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Input per 10K:</span>
                  <span className="font-medium">${pricing.inputPer10K.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Output per 10K:</span>
                  <span className="font-medium">${pricing.outputPer10K.toFixed(4)}</span>
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Configuration</h4>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Step:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{currentStep}</span>
                </div>
                <div className="flex justify-between">
                  <span>Persona:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{persona}</span>
                </div>
                <div className="flex justify-between">
                  <span>Trip:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{trip}</span>
                </div>
                <div className="flex justify-between">
                  <span>Top-K:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{topK}</span>
                </div>
                <div className="flex justify-between">
                  <span>Temperature:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{temperature}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}