import { useState } from 'react';
import { FinalEntry, Citation, StepId, Message } from '../types';
import { estimateCostUSD } from '../utils/pricing';
import { getCoverageSummary, groupCitationsByCategory } from '../utils/coverage';

interface RightPanelProps {
  tab: 'output' | 'raw' | 'logs' | 'settings';
  onTabChange: (tab: 'output' | 'raw' | 'logs' | 'settings') => void;
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
  temperature
}: RightPanelProps) {
  const coverageSummary = getCoverageSummary(citations);
  const stepFinals = finals[currentStep] || [];
  const cost = usage ? estimateCostUSD(usage, modelId) : undefined;

  const tabs = [
    { id: 'output' as const, label: 'Output', icon: '📄' },
    { id: 'raw' as const, label: 'Raw', icon: '🔧' },
    { id: 'logs' as const, label: 'Logs', icon: '📋' },
    { id: 'settings' as const, label: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col h-full">
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
        {tab === 'output' && (
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
                        {new Date(final.ts).toLocaleString()}
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

        {tab === 'raw' && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Raw Data</h3>
            <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-3 text-xs text-green-400 font-mono overflow-x-auto">
              <pre>{JSON.stringify({
                currentStep,
                persona,
                trip,
                topK,
                temperature,
                modelId,
                messageCount: messages.length,
                citationCount: citations.length,
                finalCount: stepFinals.length
              }, null, 2)}</pre>
            </div>
          </div>
        )}

        {tab === 'logs' && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Activity Log</h3>
            <div className="space-y-2">
              {messages.slice(-10).map((message, index) => (
                <div key={message.id} className="text-xs p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-medium ${message.role === 'user' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                      {message.role === 'user' ? 'User' : 'Assistant'}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {new Date(message.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-gray-600 dark:text-gray-300 line-clamp-2">
                    {message.content.substring(0, 100)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Advanced Settings</h3>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Step: {currentStep}
              </label>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Step-specific context and memory
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Persona: {persona}
              </label>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Voice and style configuration
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trip Context: {trip}
              </label>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Location and trip-specific data
              </div>
            </div>

            {/* Token Usage */}
            {usage && (usage.promptTokens || usage.completionTokens) && (
              <div>
                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Token Usage</h4>
                <div className="space-y-1 text-xs">
                  {usage.promptTokens && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Prompt:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{usage.promptTokens.toLocaleString()}</span>
                    </div>
                  )}
                  {usage.completionTokens && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Completion:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{usage.completionTokens.toLocaleString()}</span>
                    </div>
                  )}
                  {cost && (
                    <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-1 mt-2">
                      <span className="text-gray-900 dark:text-gray-100 font-medium">Est. Cost:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">${cost.totalUSD.toFixed(4)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}