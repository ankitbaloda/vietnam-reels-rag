'use client';

import { useState, useEffect } from 'react';
import { Message, ModelItem } from '../types';
import Markdown from './Markdown';

interface ABCompareProps {
  models: ModelItem[];
  isOpen: boolean;
  onClose: () => void;
  onTest: (userMessage: string, model1: string, model2: string) => Promise<{
    model1Response: string;
    model2Response: string;
    model1Citations?: any[];
    model2Citations?: any[];
  }>;
  onChooseWinner: (content: string, model: string) => void;
  isLoading: boolean;
  defaultUserMessage?: string;
  defaultModelA?: string;
}

export default function ABCompare({
  models,
  isOpen,
  onClose,
  onTest,
  onChooseWinner,
  isLoading,
  defaultUserMessage,
  defaultModelA,
}: ABCompareProps) {
  const [userMessage, setUserMessage] = useState('');
  const [model1, setModel1] = useState('');
  const [model2, setModel2] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Initialize defaults when opened
  useEffect(() => {
    if (isOpen) {
      if (defaultUserMessage && !userMessage) setUserMessage(defaultUserMessage);
      // Choose sensible defaults
      if (defaultModelA && !model1) setModel1(defaultModelA);
      if (!model2) {
        const others = models.filter(m => m.id !== defaultModelA);
        const recommended = others.find(m => m.recommended);
        setModel2((recommended || others[0] || models[0])?.id || '');
      }
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  const [results, setResults] = useState<{
    userMessage: string;
    model1: string;
    model1Response: string;
    model2: string;
    model2Response: string;
  model1Citations?: any[];
  model2Citations?: any[];
  } | null>(null);

  const handleTest = async () => {
    if (!userMessage.trim() || !model1 || !model2 || model1 === model2) return;
    setError(null);
    try {
      const responses = await onTest(userMessage, model1, model2);
      setResults({
        userMessage,
        model1,
        model1Response: responses.model1Response,
        model2,
        model2Response: responses.model2Response,
        model1Citations: responses.model1Citations,
        model2Citations: responses.model2Citations,
      });
    } catch (error) {
      console.error('A/B test failed:', error);
      setError(error instanceof Error ? error.message : 'A/B test failed');
    }
  };

  const handleChooseWinner = (response: string, model: string) => {
    onChooseWinner(response, model);
    onClose();
    setResults(null);
    setUserMessage('');
  };

  const handleClose = () => {
    onClose();
    setResults(null);
    setUserMessage('');
  };

  if (!isOpen) return null;

  const recommendedModels = models.filter(m => m.recommended);
  const otherModels = models.filter(m => !m.recommended);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">A/B Model Comparison</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-3 py-2 rounded text-sm">{error}</div>
          )}
          {/* Input Section */}
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Test Message
                </label>
                <textarea
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder="Enter your test message..."
                  className="w-full h-20 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Model A
                </label>
                <select
                  value={model1}
                  onChange={(e) => setModel1(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select Model A</option>
                  {recommendedModels.length > 0 && (
                    <optgroup label="Recommended">
                      {recommendedModels.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherModels.length > 0 && (
                    <optgroup label="Other">
                      {otherModels.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Model B
                </label>
                <select
                  value={model2}
                  onChange={(e) => setModel2(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select Model B</option>
                  {recommendedModels.length > 0 && (
                    <optgroup label="Recommended">
                      {recommendedModels.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherModels.length > 0 && (
                    <optgroup label="Other">
                      {otherModels.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <button
              onClick={handleTest}
              disabled={!userMessage.trim() || !model1 || !model2 || model1 === model2 || isLoading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !userMessage.trim() || !model1 || !model2 || model1 === model2 || isLoading
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
              }`}
            >
              {isLoading ? 'Testing...' : 'Run A/B Test'}
            </button>
          </div>

          {/* Results Section */}
          {results && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Test Query:</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{results.userMessage}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Model A Response */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Model A: {models.find(m => m.id === results.model1)?.label}
                    </h3>
                    <button
                      onClick={() => handleChooseWinner(results.model1Response, results.model1)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors dark:bg-green-500 dark:hover:bg-green-600"
                    >
                      Choose Winner
                    </button>
                  </div>
                  <div className="p-4 max-h-96 overflow-y-auto bg-white dark:bg-gray-800">
                    <div className="text-gray-900 dark:text-gray-100">
                      <Markdown content={results.model1Response || 'No response'} />
                    </div>
                    {Array.isArray(results.model1Citations) && results.model1Citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Sources</h4>
                        <div className="space-y-1">
                          {results.model1Citations.map((c: any, i: number) => (
                            <div key={i} className="text-xs text-gray-600 dark:text-gray-400">{c.title || c.source}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Model B Response */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Model B: {models.find(m => m.id === results.model2)?.label}
                    </h3>
                    <button
                      onClick={() => handleChooseWinner(results.model2Response, results.model2)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors dark:bg-green-500 dark:hover:bg-green-600"
                    >
                      Choose Winner
                    </button>
                  </div>
                  <div className="p-4 max-h-96 overflow-y-auto bg-white dark:bg-gray-800">
                    <div className="text-gray-900 dark:text-gray-100">
                      <Markdown content={results.model2Response || 'No response'} />
                    </div>
                    {Array.isArray(results.model2Citations) && results.model2Citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Sources</h4>
                        <div className="space-y-1">
                          {results.model2Citations.map((c: any, i: number) => (
                            <div key={i} className="text-xs text-gray-600 dark:text-gray-400">{c.title || c.source}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}