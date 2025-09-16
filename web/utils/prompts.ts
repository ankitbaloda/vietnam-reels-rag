import { StepId } from '../types';

export interface PromptInfo {
  filename: string;
  title: string;
  description: string;
  step: StepId;
}

// Mapping of prompts to their corresponding steps
export const PROMPT_MAPPINGS: PromptInfo[] = [
  // Ideation step
  {
    filename: '01_ideation_and_edl.md',
    title: 'Ideation & EDL',
    description: 'Generate creative reel ideas and create edit decision list',
    step: 'ideation'
  },
  {
    filename: '01_ideation_with_edl_summary.md',
    title: 'Ideation with EDL Summary',
    description: 'Refined ideation process with EDL integration',
    step: 'ideation'
  },
  {
    filename: '01a_ideation_outline.md',
    title: 'Ideation to Outline',
    description: 'Generate ideas and structure them into an outline',
    step: 'ideation'
  },
  {
    filename: '01a_ideation_outline_no_edl.md',
    title: 'Ideation Outline (No EDL)',
    description: 'Create outline without edit decision list',
    step: 'ideation'
  },
  
  // Outline step
  {
    filename: '01a_ideation_outline.md',
    title: 'Create Outline',
    description: 'Structure your ideas into a clear outline',
    step: 'outline'
  },
  {
    filename: '01a_ideation_outline_no_edl.md',
    title: 'Outline Structure',
    description: 'Organize content without video editing details',
    step: 'outline'
  },
  
  // EDL step
  {
    filename: '01b_edl_from_outline.md',
    title: 'EDL from Outline',
    description: 'Convert outline into detailed edit decision list',
    step: 'edl'
  },
  {
    filename: '02_edl_from_script.md',
    title: 'EDL from Script',
    description: 'Create edit decision list from completed script',
    step: 'edl'
  },
  
  // Script step
  {
    filename: '02_script_vipinclaude.md',
    title: 'Script Writing (Vipin Style)',
    description: 'Write script in Vipin Chahal\'s distinctive style',
    step: 'script'
  },
  
  // Handoff step
  {
    filename: '04_editor_handoff.md',
    title: 'Editor Handoff',
    description: 'Prepare final package for video editor',
    step: 'handoff'
  }
];

// Get prompts for a specific step
export function getPromptsForStep(step: StepId): PromptInfo[] {
  return PROMPT_MAPPINGS.filter(prompt => prompt.step === step);
}

// Get all available steps that have prompts
export function getStepsWithPrompts(): StepId[] {
  return Array.from(new Set(PROMPT_MAPPINGS.map(p => p.step)));
}

// Load prompt content (for future implementation)
export async function loadPromptContent(filename: string): Promise<string> {
  try {
    // Fetch from the API endpoint
    const response = await fetch(`/api/prompts/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load prompt: ${filename} (${response.status})`);
    }
    return await response.text();
  } catch (error) {
    console.error('Error loading prompt:', error);
    return `# Error loading prompt: ${filename}\n\nPrompt file could not be loaded.\n\n${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}