'use client';

import { FinalEntry, Citation, StepId } from '../types';
import { estimateCostUSD } from '../utils/pricing';
import { getCoverageSummary, groupCitationsByCategory } from '../utils/coverage';

interface MetaPanelProps {
  citations: Citation[];
  finals: Record<StepId, FinalEntry[]>;
  currentStep: StepId;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
  modelId?: string;
}

export default function MetaPanel({ citations, finals, currentStep, usage, modelId }: MetaPanelProps) {
  const coverageSummary = getCoverageSummary(citations);
  const stepFinals = finals[currentStep] || [];
  const cost = usage ? estimateCostUSD(usage, modelId) : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Coverage Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Coverage</h3>
        {coverageSummary.length > 0 ? (
          <div className="space-y-2">
            {coverageSummary.map((item) => (
              <div
                key={item.category}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-xs"
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

      {/* Finals Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Finals ({currentStep})
        </h3>
        {stepFinals.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-y-auto">
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

      {/* Usage Section */}
      {usage && (usage.promptTokens || usage.completionTokens) && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Token Usage</h3>
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
            {usage.promptTokens && usage.completionTokens && (
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-1 mt-2">
                <span className="text-gray-900 dark:text-gray-100 font-medium">Total:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {(usage.promptTokens + usage.completionTokens).toLocaleString()}
                </span>
              </div>
            )}
            {cost && (
              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Est. Prompt $:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">${cost.promptUSD.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Est. Completion $:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">${cost.completionUSD.toFixed(4)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-1 mt-1">
                  <span className="text-gray-900 dark:text-gray-100 font-medium">Est. Total $:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">${cost.totalUSD.toFixed(4)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sources Details */}
      {citations.length > 0 && (
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Sources Used</h3>
          <div className="space-y-3">
            {citations.map((citation, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {citation.title || citation.source}
                </div>
                {citation.excerpt && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {citation.excerpt}
                  </div>
                )}
                {citation.url && (
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                  >
                    View Source
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}