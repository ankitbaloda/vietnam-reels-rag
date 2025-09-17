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
  // Don't rename if already auto-renamed
  if (session.autoRenamed) return session.name;
  
  const allMessages = Object.values(session.messagesByStep).flat();
  const userMessages = allMessages.filter(m => m.role === 'user');
  
  // Need at least 1 user message to auto-rename
  if (userMessages.length < 1) return session.name;
  
  // Get first user message which often contains the main topic
  const firstMessage = userMessages[0].content;
  const allUserText = userMessages.slice(0, 3).map(m => m.content).join(' ');
  
  // Extract key topics/themes using improved keyword extraction
  const keywords = extractKeywords(allUserText);
  
  if (keywords.length === 0) {
    // Fallback to first few words of the first message
    const firstWords = firstMessage.split(/\s+/).slice(0, 4).join(' ');
    return firstWords.length > 10 ? firstWords : session.name;
  }
  
  // Generate a meaningful name from keywords (focus on travel/video terms)
  const sessionName = keywords.slice(0, 3).join(' ');
  return sessionName.length > 3 ? sessionName : session.name;
  return sessionName.length > 3 ? sessionName : session.name;
}

// Enhanced keyword extraction for travel/video content
function extractKeywords(text: string): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
    'his', 'her', 'its', 'our', 'their', 'what', 'when', 'where', 'why', 'how', 'which', 'who',
    'about', 'make', 'help', 'need', 'want', 'like', 'create', 'please', 'tell'
  ]);
  
  // Priority keywords for travel/video content
  const priorityKeywords = new Set([
    'vietnam', 'hanoi', 'saigon', 'hcmc', 'danang', 'hoi', 'nha', 'trang', 'halong', 'sapa', 'mekong',
    'reel', 'reels', 'video', 'travel', 'trip', 'journey', 'adventure', 'explore', 'food', 'street',
    'temple', 'market', 'beach', 'mountain', 'city', 'culture', 'local', 'authentic', 'experience',
    'itinerary', 'guide', 'tips', 'budget', 'backpack', 'solo', 'family', 'couple', 'romantic',
    'instagram', 'story', 'content', 'viral', 'trending', 'epic', 'amazing', 'beautiful', 'stunning'
  ]);
  
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 30); // Process more words
  
  // Count word frequency and boost priority keywords
  const frequency: Record<string, number> = {};
  words.forEach(word => {
    const boost = priorityKeywords.has(word) ? 3 : 1; // Boost priority keywords
    frequency[word] = (frequency[word] || 0) + boost;
  });
  
  // Return words sorted by frequency, then alphabetically
  return Object.entries(frequency)
    .sort(([a, freqA], [b, freqB]) => freqB - freqA || a.localeCompare(b))
    .map(([word]) => word)
    .slice(0, 8); // Return more keywords
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