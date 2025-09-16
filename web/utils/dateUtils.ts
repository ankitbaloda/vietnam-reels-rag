// Date utility functions for consistent formatting

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  // If less than 24 hours ago, show relative time
  if (diffInHours < 24) {
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      if (diffInMinutes < 1) return 'Just now';
      return `${diffInMinutes}m ago`;
    }
    return `${Math.floor(diffInHours)}h ago`;
  }
  
  // If less than 7 days ago, show day name
  if (diffInHours < 24 * 7) {
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    return `${diffInDays} days ago`;
  }
  
  // Otherwise show formatted date - use "16 September" format
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric'
  };
  
  return date.toLocaleDateString('en-GB', options);
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  // If today, show time only
  if (diffInHours < 24 && date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
  
  // If yesterday
  if (diffInHours < 48 && diffInHours >= 24) {
    return `Yesterday ${date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })}`;
  }
  
  // Otherwise show date and time - use "16 September" format
  const dateStr = date.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'long'
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  return `${dateStr} ${timeStr}`;
}

export function formatFullDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}