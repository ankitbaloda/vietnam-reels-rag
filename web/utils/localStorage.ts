import { Session, FinalEntry, UsageStat, StepId } from '../types';

// Simple DJB2 hash function for generating IDs
export function hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

// Generate UUID-like string
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generate smart session names from first user message
export function generateSessionName(firstMessage: string): string {
  if (!firstMessage || firstMessage.trim().length === 0) {
    return `Session ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
  }
  
  const cleaned = firstMessage
    .replace(/[^\w\s]/g, '') // Remove special characters
    .trim()
    .slice(0, 50); // Limit to 50 characters
  
  const words = cleaned.split(/\s+/).filter(word => word.length > 0);
  const sessionName = words.slice(0, Math.min(6, Math.max(4, words.length))).join(' ');
  
  return sessionName || `Session ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
}

// Auto-rename session based on conversation summary
export function autoRenameSession(session: Session): string {
  // Don't rename if already auto-renamed or no messages
  if (session.autoRenamed) return session.name;
  
  const allMessages = Object.values(session.messagesByStep).flat();
  const userMessages = allMessages.filter(m => m.role === 'user');
  const assistantMessages = allMessages.filter(m => m.role === 'assistant');
  
  // Need at least 2 exchanges to auto-rename
  if (userMessages.length < 2 || assistantMessages.length < 1) return session.name;
  
  // Get first few user messages to understand the topic
  const topicMessages = userMessages.slice(0, 3).map(m => m.content).join(' ');
  
  // Extract key topics/themes using simple keyword extraction
  const keywords = extractKeywords(topicMessages);
  
  if (keywords.length === 0) return session.name;
  
  // Generate a meaningful name from keywords
  const sessionName = keywords.slice(0, 4).join(' ');
  return sessionName.length > 3 ? sessionName : session.name;
}

// Simple keyword extraction
function extractKeywords(text: string): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
    'his', 'her', 'its', 'our', 'their', 'what', 'when', 'where', 'why', 'how', 'which', 'who'
  ]);
  
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 20); // Process first 20 meaningful words
  
  // Count word frequency
  const frequency: Record<string, number> = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  // Return words sorted by frequency, then alphabetically
  return Object.entries(frequency)
    .sort(([a, freqA], [b, freqB]) => freqB - freqA || a.localeCompare(b))
    .map(([word]) => word)
    .slice(0, 6);
}

// Safe JSON parse with fallback
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

// Sessions management
export function loadSessions(): Session[] {
  if (typeof window === 'undefined') return [];
  const sessions = localStorage.getItem('sessions');
  return safeJsonParse(sessions, []);
}

export function saveSessions(sessions: Session[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('sessions', JSON.stringify(sessions));
}

// Finals management
export function loadFinals(): Record<string, Record<StepId, FinalEntry[]>> {
  if (typeof window === 'undefined') return {};
  const finals = localStorage.getItem('finals');
  return safeJsonParse(finals, {});
}

export function saveFinals(finals: Record<string, Record<StepId, FinalEntry[]>>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('finals', JSON.stringify(finals));
}

// Usage stats management
export function loadUsage(): Record<string, UsageStat> {
  if (typeof window === 'undefined') return {};
  const usage = localStorage.getItem('usage');
  return safeJsonParse(usage, {});
}

export function saveUsage(usage: Record<string, UsageStat>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('usage', JSON.stringify(usage));
}

// Helper to create a new session
export function createNewSession(name?: string): Session {
  const id = generateId();
  return {
    id,
    name: name || 'New Chat',
    createdAt: Date.now(),
    currentStep: 'ideation',
    messagesByStep: {
      ideation: [],
      outline: [],
      edl: [],
      script: [],
      suno: [],
      handoff: []
    }
  };
}

// Helper to create a final entry
export function createFinalEntry(content: string, model?: string): FinalEntry {
  return {
    id: hash(content),
    content,
    model,
    ts: Date.now()
  };
}