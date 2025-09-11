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
    <div className="bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Step Tabs */}
        <div className="flex">
          {STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => onStepChange(step.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                currentStep === step.id
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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
      <div className="px-4 pb-2 text-xs text-gray-600">
        {friendly[currentStep]}
      </div>
    </div>
  );
}