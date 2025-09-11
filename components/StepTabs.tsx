import { StepId } from '../web/types';

const friendly: Record<StepId, string> = {
  ideation: 'Generate grounded reel ideas from your travel footage and viral frameworks. Use RAG for best results.',
  outline: 'Develop selected idea into structured storyline with mini-chapters and shot planning.',
  edl: 'Create detailed Edit Decision List with exact clips from your Travel Files Directory.',
  script: 'Generate Hinglish voice-over script in Vipin/Divya style with timing alignment.',
  suno: 'Create custom music prompt for Suno AI based on script mood and duration.',
  handoff: 'Package everything for editor: idea, EDL, script, audio, and assembly instructions.',
};

export default friendly;