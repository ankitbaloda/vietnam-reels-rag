'use client';

import { StepId } from '../types';

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
  const friendly: Record<StepId, string> = {
    ideation: 'Make a list of grounded reel ideas based on your docs and style.',
    outline: 'Turn an idea into a simple, bullet-point outline.',
    edl: 'Create an Edit Decision List: a shot-by-shot plan to edit.',
    script: 'Write the full script in your voice and style.',
    suno: 'Draft a music prompt you can paste into Suno.',
    handoff: 'Bundle everything so your editor knows exactly what to do.',
  };

  return (
    <div className="bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Step Tabs */}
        <div className="flex">
          {STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => onStepChange(step.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-lg mx-1 transition-colors ${
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

        {/* Removed run button per request */}
      </div>
      {/* Friendly description */}
      <div className="px-6 pb-3 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
        {friendly[currentStep]}
      </div>
    </div>
  );
}