'use client';

interface MarkdownProps {
  content: string;
  className?: string;
}

export default function Markdown({ content, className = '' }: MarkdownProps) {
  // Enhanced markdown rendering with compact, ChatGPT-style formatting
  const renderMarkdown = (text: string): string => {
    return text
      // Headers with better spacing and reduced margins
      .replace(/^### (.*$)/gm, '<h3 class="text-base font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-1">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-lg font-semibold mt-5 mb-3 text-gray-900 dark:text-gray-100 border-b-2 border-gray-300 dark:border-gray-600 pb-1">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold mt-6 mb-4 text-gray-900 dark:text-gray-100 border-b-2 border-blue-200 dark:border-blue-700 pb-2">$1</h1>')
      
      // Bold and italic with enhanced styling but less intrusive highlighting
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-gray-100">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em class="italic text-gray-800 dark:text-gray-200">$1</em>')
      
      // Code blocks with reduced margins
      .replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || '';
        return `<pre class="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-lg text-sm overflow-x-auto my-3 font-mono"><code class="text-gray-800 dark:text-gray-200" data-language="${language}">${code.trim()}</code></pre>`;
      })
      
      // Inline code with compact styling
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
      
      // Lists with reduced spacing and better bullets
      .replace(/^(\s*)- (.*$)/gm, (match, indent, content) => {
        const level = Math.floor(indent.length / 2);
        const marginClass = level > 0 ? `ml-${Math.min(level * 4, 16)}` : 'ml-0';
        const bulletColor = level === 0 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400';
        return `<li class="${marginClass} my-1 flex items-start"><span class="${bulletColor} mr-2 mt-1.5 w-1.5 h-1.5 bg-current rounded-full flex-shrink-0"></span><span class="text-gray-800 dark:text-gray-200 leading-relaxed">${content}</span></li>`;
      })
      
      // Numbered lists with compact styling
      .replace(/^(\s*)(\d+)\. (.*$)/gm, (match, indent, number, content) => {
        const level = Math.floor(indent.length / 2);
        const marginClass = level > 0 ? `ml-${Math.min(level * 4, 16)}` : 'ml-0';
        const numberColor = level === 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400';
        return `<li class="${marginClass} my-1 flex items-start"><span class="${numberColor} mr-2 font-medium min-w-[1.5rem] text-sm">${number}.</span><span class="text-gray-800 dark:text-gray-200 leading-relaxed">${content}</span></li>`;
      })
      
      // Compact blockquotes
      .replace(/^> (.*$)/gm, '<blockquote class="border-l-3 border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 pl-4 pr-3 py-2 my-3 text-gray-700 dark:text-gray-300 text-sm rounded-r">💡 $1</blockquote>')
      
      // Links with minimal styling
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline underline-offset-1">$1</a>')
      
      // Compact horizontal rules
      .replace(/^---+$/gm, '<hr class="my-4 border-0 h-px bg-gray-300 dark:bg-gray-600">')
      
      // Process paragraphs with reduced spacing
      .split('\n\n')
      .map(paragraph => {
        const trimmed = paragraph.trim();
        if (!trimmed) return '';
        // Skip if already wrapped in HTML tags
        if (trimmed.match(/^<(h[1-6]|pre|blockquote|hr|li)/)) {
          return trimmed;
        }
        return `<p class="mb-3 text-gray-800 dark:text-gray-200 leading-relaxed">${trimmed}</p>`;
      })
      .join('\n')
      
      // Compact line breaks
      .replace(/\n/g, '<br class="my-1">');
  };

  return (
    <div 
      className={`prose prose-sm max-w-none text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-100 dark:border-gray-800 shadow-sm ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}