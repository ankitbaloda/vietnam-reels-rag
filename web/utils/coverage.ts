import { Citation, CoverageCategory } from '../types';

// Categorize citations based on source/title content
export function categorizeCitation(citation: Citation): CoverageCategory {
  const text = `${citation.source || ''} ${citation.title || ''}`.toLowerCase();
  
  if (text.includes('playbook') || text.includes('guide') || text.includes('manual')) {
    return 'Playbook';
  }
  if (text.includes('daywise') || text.includes('day-wise') || text.includes('narration') || text.includes('daily')) {
    return 'Daywise Narrations';
  }
  if (text.includes('cost') || text.includes('price') || text.includes('budget') || text.includes('expense')) {
    return 'Costs';
  }
  if (text.includes('style') || text.includes('template') || text.includes('format')) {
    return 'Style Guide';
  }
  if (text.includes('travel') || text.includes('itinerary') || text.includes('trip') || text.includes('destination')) {
    return 'Travel Files';
  }
  
  return 'Other';
}

// Group citations by category
export function groupCitationsByCategory(citations: Citation[]): Record<CoverageCategory, Citation[]> {
  const groups: Record<CoverageCategory, Citation[]> = {
    'Playbook': [],
    'Daywise Narrations': [],
    'Costs': [],
    'Style Guide': [],
    'Travel Files': [],
    'Other': []
  };

  citations.forEach(citation => {
    const category = categorizeCitation(citation);
    groups[category].push(citation);
  });

  return groups;
}

// Get coverage summary
export function getCoverageSummary(citations: Citation[]): { category: CoverageCategory; count: number }[] {
  const groups = groupCitationsByCategory(citations);
  return Object.entries(groups)
    .map(([category, items]) => ({ category: category as CoverageCategory, count: items.length }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count);
}