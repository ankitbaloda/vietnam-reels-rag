'use client';

import { useState } from 'react';
import { StepId } from '../types';
import { getPromptsForStep, PromptInfo, loadPromptContent } from '../utils/prompts';

interface StepTabsProps {
  currentStep: StepId;
  onStepChange: (step: StepId) => void;
}

const STEPS: { id: StepId; label: string; description: string }[] = [
  { id: 'ideation', label: 'Ideation', description: 'Generate and refine ideas' },
  { id: 'outline', label: 'Outline', description: 'Create content structure' },
  { id: 'edl', label: 'EDL', description: 'Edit decision list' },
  { id: 'script', label: 'Script', description: 'Write the script' },
  { id: 'suno', label: 'Suno', description: 'Audio generation' },
  { id: 'handoff', label: 'Handoff', description: 'Final delivery' }
];

export default function StepTabs({ currentStep, onStepChange }: StepTabsProps) {
  const [showPrompts, setShowPrompts] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptInfo | null>(null);
  const [promptContent, setPromptContent] = useState<string>('');
  const [editedPromptContent, setEditedPromptContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  
  const friendly: Record<StepId, string> = {
    ideation: 'Make a list of grounded reel ideas based on your docs and style.',
    outline: 'Turn an idea into a simple, bullet-point outline.',
    edl: 'Create an Edit Decision List: a shot-by-shot plan to edit.',
    script: 'Write the full script in your voice and style.',
    suno: 'Draft a music prompt you can paste into Suno.',
    handoff: 'Bundle everything so your editor knows exactly what to do.',
  };

  const currentStepPrompts = getPromptsForStep(currentStep);

  const handleViewPrompt = async (prompt: PromptInfo) => {
    setSelectedPrompt(prompt);
    setLoadingPrompt(true);
    setIsEditing(false);
    try {
      const content = await loadPromptContent(prompt.filename);
      setPromptContent(content);
      setEditedPromptContent(content);
    } catch (error) {
      const errorContent = `# Error loading prompt\n\nFailed to load ${prompt.filename}`;
      setPromptContent(errorContent);
      setEditedPromptContent(errorContent);
    } finally {
      setLoadingPrompt(false);
    }
  };

  const handleUsePrompt = (content: string) => {
    // Copy prompt to clipboard
    navigator.clipboard.writeText(content);
    
    // Show a more helpful message
    const message = `Prompt copied to clipboard!\n\n📋 Paste it into the chat input below to use this ${selectedPrompt?.title} prompt.`;
    alert(message);
    
    // Close the modal
    setSelectedPrompt(null);
  };

  return (
    <div className="bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between px-6 py-2">
        {/* Step Tabs */}
        <div className="flex">
          {STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => onStepChange(step.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg mx-1 transition-colors ${
                currentStep === step.id
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={step.description}
            >
              {step.label}
            </button>
          ))}
        </div>

        {/* Prompts Button */}
        {currentStepPrompts.length > 0 && (
          <button
            onClick={() => setShowPrompts(!showPrompts)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors border ${
              showPrompts 
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700' 
                : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-700'
            }`}
            title={`${showPrompts ? 'Hide' : 'Show'} ${currentStepPrompts.length} prompt${currentStepPrompts.length > 1 ? 's' : ''} for ${currentStep}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {showPrompts ? 'Hide' : 'Show'} Prompts ({currentStepPrompts.length})
          </button>
        )}
      </div>
      
      {/* Friendly description */}
      <div className="px-6 pb-3 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
        {friendly[currentStep]}
      </div>

      {/* Prompts Panel */}
      {showPrompts && currentStepPrompts.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
          <div className="px-6 py-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Available Prompts for {STEPS.find(s => s.id === currentStep)?.label}
            </h3>
            <div className="space-y-2">
              {currentStepPrompts.map((prompt) => (
                <div
                  key={prompt.filename}
                  className="flex items-start justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {prompt.title}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {prompt.description}
                    </p>
                    <code className="text-xs text-gray-500 dark:text-gray-500 mt-1 block">
                      {prompt.filename}
                    </code>
                  </div>
                  <div className="flex gap-1 ml-4">
                    <button
                      onClick={() => handleViewPrompt(prompt)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium border border-blue-200 dark:border-blue-700"
                      title="View and use this prompt"
                    >
                      Select
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(prompt.filename);
                        // Show a brief confirmation
                        const button = document.activeElement as HTMLButtonElement;
                        const originalText = button.textContent;
                        button.textContent = 'Copied!';
                        setTimeout(() => {
                          button.textContent = originalText;
                        }, 1000);
                      }}
                      className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Copy filename to clipboard"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              💡 These prompts are specifically designed for the {STEPS.find(s => s.id === currentStep)?.label.toLowerCase()} step of your workflow.
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {selectedPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedPrompt(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {selectedPrompt.title}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedPrompt.description}
                </p>
              </div>
              <div className="flex gap-2">
                {!loadingPrompt && (
                  <button
                    onClick={() => {
                      if (isEditing) {
                        setPromptContent(editedPromptContent);
                        setIsEditing(false);
                      } else {
                        setIsEditing(true);
                      }
                    }}
                    className="px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    {isEditing ? 'Save Changes' : 'Edit'}
                  </button>
                )}
                <button
                  onClick={() => handleUsePrompt(isEditing ? editedPromptContent : promptContent)}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  disabled={loadingPrompt}
                >
                  Use Prompt
                </button>
                <button
                  onClick={() => setSelectedPrompt(null)}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingPrompt ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading prompt...</span>
                </div>
              ) : isEditing ? (
                <div className="space-y-3">
                  <div className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700">
                    ✏️ <strong>Editing mode:</strong> Modify the prompt below. Changes are temporary and won&apos;t affect the original file.
                  </div>
                  <textarea
                    value={editedPromptContent}
                    onChange={(e) => setEditedPromptContent(e.target.value)}
                    className="w-full h-96 text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-4 font-mono leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your custom prompt here..."
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    💡 Click &quot;Save Changes&quot; to apply your edits, then &quot;Use Prompt&quot; to copy the modified version.
                  </div>
                </div>
              ) : (
                <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  {promptContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}