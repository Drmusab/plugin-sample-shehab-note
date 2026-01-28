// Stub implementations for Obsidian-Tasks dependencies

export class GlobalFilter {
  private static instance: GlobalFilter;
  
  static getInstance(): GlobalFilter {
    if (!this.instance) {
      this.instance = new GlobalFilter();
    }
    return this.instance;
  }
  
  removeAsWordFrom(text: string): string {
    return text;
  }
  
  includedIn(text: string): boolean {
    return false;
  }
  
  prependTo(text: string): string {
    return text;
  }
}

export function parseTypedDateForSaving(dateString: string, forwardOnly?: boolean): string {
  // Simple date parsing - just return as is for now
  return dateString;
}

export function parseTypedDateForDisplayUsingFutureDate(
  id: string,
  dateString: string,
  forwardOnly: boolean
): string {
  if (!dateString || dateString.trim() === '') {
    return '';
  }
  
  // Simple parsing - try to parse as date
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return 'invalid date';
  }
  
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

export function doAutocomplete(text: string): string {
  // Simple autocomplete stubs
  const replacements: Record<string, string> = {
    'td': new Date().toISOString().split('T')[0],
    'tm': new Date(Date.now() + 86400000).toISOString().split('T')[0],
    'yd': new Date(Date.now() - 86400000).toISOString().split('T')[0],
  };
  
  const lower = text.toLowerCase().trim();
  return replacements[lower] || text;
}

export class PriorityTools {
  static parsePriorityFromText(text: string): any {
    return null;
  }
  
  static priorityValue(priority: string): any {
    // Map priority string to enum
    const map: Record<string, string> = {
      'highest': '⏫',
      'high': '🔺',
      'medium': '🔼',
      'none': '',
      'normal': '',
      'low': '🔽',
      'lowest': '⏬',
    };
    return map[priority.toLowerCase()] || '';
  }
}

export async function replaceTaskWithTasks(params: {
  originalTask: any;
  newTasks: any[];
}): Promise<void> {
  // Stub - will be handled by our bridge
}

export function capitalizeFirstLetter(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function updateSettings(settings: any): void {
  // Stub - settings updates handled elsewhere
}
