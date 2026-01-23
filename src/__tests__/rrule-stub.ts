export class RRule {
  origOptions: any;
  private rruleStr: string;
  
  constructor(options: any) {
    this.origOptions = options;
    this.rruleStr = '';
  }
  
  after(date: Date, inc?: boolean): Date | null {
    const opts = this.origOptions;
    
    // Check if series has ended (UNTIL)
    if (opts.until && date >= opts.until) {
      return null;
    }
    
    // Simple increment based on frequency
    const result = new Date(date);
    
    // If inclusive, return the same date if valid, otherwise next
    if (!inc) {
      result.setDate(result.getDate() + 1);
    }
    
    // Apply time from dtstart if available
    if (opts.dtstart) {
      result.setHours(opts.dtstart.getHours());
      result.setMinutes(opts.dtstart.getMinutes());
      result.setSeconds(0);
      result.setMilliseconds(0);
    }
    
    return result;
  }
  
  between(after: Date, before: Date, inc?: boolean): Date[] {
    const opts = this.origOptions;
    const results: Date[] = [];
    const current = new Date(after);
    
    while (current <= before) {
      const candidate = new Date(current);
      
      // Apply time from dtstart if available  
      if (opts.dtstart) {
        candidate.setHours(opts.dtstart.getHours());
        candidate.setMinutes(opts.dtstart.getMinutes());
        candidate.setSeconds(0);
        candidate.setMilliseconds(0);
      }
      
      results.push(candidate);
      current.setDate(current.getDate() + 1);
    }
    
    return results;
  }
  
  toText(): string {
    const opts = this.origOptions;
    const freq = opts.freq;
    
    // Map frequency to text
    const freqMap: { [key: number]: string } = {
      0: 'year',
      1: 'month', 
      2: 'week',
      3: 'day',
      4: 'hour',
      5: 'minute',
      6: 'second'
    };
    
    const freqName = freqMap[freq] || 'day';
    return `every ${freqName}`;
  }
  
  rrules(): RRule[] {
    return [this];
  }
}

export class RRuleSet {
  private rules: RRule[] = [];
  
  rrules(): RRule[] {
    return this.rules;
  }
}

export function rrulestr(str: string): RRule {
  // Parse basic RRULE string
  const normalized = str.startsWith('RRULE:') ? str.substring(6) : str;
  const parts = normalized.split(';');
  const options: any = {};
  
  // Check for invalid input
  if (!normalized.match(/FREQ=/i)) {
    throw new Error('Invalid RRULE format');
  }
  
  parts.forEach(part => {
    const [key, value] = part.split('=');
    if (!key || !value) return;
    
    switch (key.toUpperCase()) {
      case 'FREQ':
        // Map FREQ to number (3 = daily, 2 = weekly, 1 = monthly, 0 = yearly)
        const freqMap: { [key: string]: number } = {
          'YEARLY': 0,
          'MONTHLY': 1,
          'WEEKLY': 2,
          'DAILY': 3,
          'HOURLY': 4,
          'MINUTELY': 5,
          'SECONDLY': 6
        };
        options.freq = freqMap[value.toUpperCase()] ?? 3;
        break;
      case 'INTERVAL':
        options.interval = parseInt(value, 10);
        break;
      case 'UNTIL':
        // Parse UNTIL date
        options.until = new Date(value);
        break;
      case 'COUNT':
        options.count = parseInt(value, 10);
        break;
      case 'BYDAY':
        options.byweekday = value.split(',');
        break;
    }
  });
  
  // Set default dtstart if not provided
  if (!options.dtstart) {
    options.dtstart = new Date();
  }
  
  return new RRule(options);
}
