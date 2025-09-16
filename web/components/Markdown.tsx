'use client';

interface MarkdownProps {
  content: string;
  className?: string;
}

export default function Markdown({ content, className = '' }: MarkdownProps) {
  // Enhanced markdown rendering with better ChatGPT-style formatting
  const renderMarkdown = (text: string): string => {
    return text
      // Headers with better spacing and dark mode support
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-6 mb-3 text-gray-900 dark:text-gray-100">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-gray-100">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-6 mb-4 text-gray-900 dark:text-gray-100">$1</h1>')
      
      // Bold and italic with proper styling
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-gray-100">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em class="italic text-gray-800 dark:text-gray-200">$1</em>')
      
      // Code blocks with syntax highlighting support and dark mode
      .replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || '';
        return `<pre class="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 rounded-lg text-sm overflow-x-auto my-4 font-mono"><code class="text-gray-800 dark:text-gray-200" data-language="${language}">${code.trim()}</code></pre>`;
      })
      
      // Inline code with better styling
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded text-sm font-mono border border-gray-200 dark:border-gray-600">$1</code>')
      
      // Lists with better styling and nesting support
      .replace(/^(\s*)- (.*$)/gm, (match, indent, content) => {
        const level = Math.floor(indent.length / 2);
        const marginClass = level > 0 ? `ml-${Math.min(level * 4, 16)}` : 'ml-0';
        return `<li class="${marginClass} my-1 flex items-start"><span class="text-gray-600 dark:text-gray-400 mr-2 mt-1.5 w-2 h-2 bg-current rounded-full flex-shrink-0"></span><span class="text-gray-800 dark:text-gray-200">${content}</span></li>`;
      })
      
      // Numbered lists
      .replace(/^(\s*)(\d+)\. (.*$)/gm, (match, indent, number, content) => {
        const level = Math.floor(indent.length / 2);
        const marginClass = level > 0 ? `ml-${Math.min(level * 4, 16)}` : 'ml-0';
        return `<li class="${marginClass} my-1 flex items-start"><span class="text-gray-600 dark:text-gray-400 mr-2 font-medium min-w-[1.5rem]">${number}.</span><span class="text-gray-800 dark:text-gray-200">${content}</span></li>`;
      })
      
      // Blockquotes
      .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 text-gray-700 dark:text-gray-300 italic">$1</blockquote>')
      
      // Links with proper styling and security
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline transition-colors">$1</a>')
      
      // Tables (basic support)
      .replace(/\|(.+)\|/g, (match, content) => {
        const cells = content.split('|').map((cell: string) => cell.trim()).filter((cell: string) => cell);
        const cellsHtml = cells.map((cell: string) => `<td class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">${cell}</td>`).join('');
        return `<tr>${cellsHtml}</tr>`;
      })
      
      // Horizontal rules
      .replace(/^---+$/gm, '<hr class="my-6 border-gray-300 dark:border-gray-600">')
      
      // Paragraphs - wrap non-HTML content in paragraphs
      .split('\n\n')
      .map(paragraph => {
        const trimmed = paragraph.trim();
        if (!trimmed) return '';
        // Skip if already wrapped in HTML tags
        if (trimmed.match(/^<(h[1-6]|pre|blockquote|hr|li|tr)/)) {
          return trimmed;
        }
        return `<p class="mb-4 text-gray-800 dark:text-gray-200 leading-relaxed">${trimmed}</p>`;
      })
      .join('\n')
      
      // Line breaks for remaining single newlines
      .replace(/\n/g, '<br>');
  };

  return (
    <div 
      className={`prose prose-sm max-w-none text-gray-800 dark:text-gray-200 ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}