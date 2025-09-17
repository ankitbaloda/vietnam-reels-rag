'use client';

interface MarkdownProps {
  content: string;
  className?: string;
}

export default function Markdown({ content, className = '' }: MarkdownProps) {
  // Enhanced markdown rendering with better ChatGPT-style formatting
  const renderMarkdown = (text: string): string => {
    return text
      // Headers with better spacing, visual hierarchy, and dark mode support
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-8 mb-4 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-8 mb-4 text-gray-900 dark:text-gray-100 border-b-2 border-gray-300 dark:border-gray-600 pb-2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-6 text-gray-900 dark:text-gray-100 border-b-2 border-blue-200 dark:border-blue-700 pb-3">$1</h1>')
      
      // Bold and italic with enhanced styling
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-gray-100 bg-yellow-50 dark:bg-yellow-900/20 px-1 rounded">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em class="italic text-gray-800 dark:text-gray-200 font-medium">$1</em>')
      
      // Code blocks with syntax highlighting support and dark mode
      .replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || '';
        return `<pre class="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 rounded-lg text-sm overflow-x-auto my-4 font-mono"><code class="text-gray-800 dark:text-gray-200" data-language="${language}">${code.trim()}</code></pre>`;
      })
      
      // Inline code with better styling
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded text-sm font-mono border border-gray-200 dark:border-gray-600">$1</code>')
      
      // Lists with enhanced styling, better bullets, and nesting support
      .replace(/^(\s*)- (.*$)/gm, (match, indent, content) => {
        const level = Math.floor(indent.length / 2);
        const marginClass = level > 0 ? `ml-${Math.min(level * 6, 24)}` : 'ml-0';
        const bulletColor = level === 0 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400';
        const bulletSize = level === 0 ? 'w-2 h-2' : 'w-1.5 h-1.5';
        return `<li class="${marginClass} my-2 flex items-start"><span class="${bulletColor} mr-3 mt-2 ${bulletSize} bg-current rounded-full flex-shrink-0"></span><span class="text-gray-800 dark:text-gray-200 leading-relaxed">${content}</span></li>`;
      })
      
      // Numbered lists with enhanced styling
      .replace(/^(\s*)(\d+)\. (.*$)/gm, (match, indent, number, content) => {
        const level = Math.floor(indent.length / 2);
        const marginClass = level > 0 ? `ml-${Math.min(level * 6, 24)}` : 'ml-0';
        const numberColor = level === 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400';
        return `<li class="${marginClass} my-2 flex items-start"><span class="${numberColor} mr-3 font-semibold min-w-[2rem] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-center text-sm">${number}</span><span class="text-gray-800 dark:text-gray-200 leading-relaxed">${content}</span></li>`;
      })
      
      // Enhanced blockquotes with better visual design
      .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 pl-6 pr-4 py-4 my-6 text-gray-700 dark:text-gray-300 italic rounded-r-lg shadow-sm">💡 $1</blockquote>')
      
      // Links with enhanced styling and hover effects
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline decoration-2 underline-offset-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 py-0.5 rounded transition-all duration-200 font-medium">$1 ↗</a>')
      
      // Enhanced tables with better styling
      .replace(/\|(.+)\|/g, (match, content) => {
        const cells = content.split('|').map((cell: string) => cell.trim()).filter((cell: string) => cell);
        const cellsHtml = cells.map((cell: string, index: number) => {
          const isHeader = content.includes('---'); // Simple header detection
          const cellClass = isHeader ? 
            'px-4 py-3 bg-gray-100 dark:bg-gray-800 font-semibold text-gray-900 dark:text-gray-100 border-b-2 border-gray-300 dark:border-gray-600' :
            'px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200';
          return `<td class="${cellClass}">${cell}</td>`;
        }).join('');
        return `<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">${cellsHtml}</tr>`;
      })
      
      // Enhanced horizontal rules with gradient effect
      .replace(/^---+$/gm, '<hr class="my-8 border-0 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent">')
      
      // Paragraphs with better spacing and typography - wrap non-HTML content in paragraphs
      .split('\n\n')
      .map(paragraph => {
        const trimmed = paragraph.trim();
        if (!trimmed) return '';
        // Skip if already wrapped in HTML tags
        if (trimmed.match(/^<(h[1-6]|pre|blockquote|hr|li|tr)/)) {
          return trimmed;
        }
        return `<p class="mb-6 text-gray-800 dark:text-gray-200 leading-relaxed text-base">${trimmed}</p>`;
      })
      .join('\n')
      
      // Line breaks for remaining single newlines with proper spacing
      .replace(/\n/g, '<br class="my-2">');
  };

  return (
    <div 
      className={`prose prose-sm max-w-none text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-100 dark:border-gray-800 shadow-sm ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}