/**
 * Configuration for global task filtering
 */
export interface GlobalFilterConfig {
  /** Enable global filter */
  enabled: boolean;
  
  /** Filter mode: include (whitelist) or exclude (blacklist) */
  mode: 'include' | 'exclude';
  
  /** Tag pattern to match (e.g., "#task") */
  tagPattern?: string;
  
  /** Path pattern to match (e.g., "tasks/") */
  pathPattern?: string;
  
  /** Custom regex pattern */
  regex?: string;
}

/**
 * Control which checklist items are treated as tasks
 */
export class GlobalFilter {
  private compiledRegex: RegExp | null = null;

  /**
   * Check if a checklist item should be treated as a task
   * @param line The markdown line
   * @param filepath File containing the line
   * @param config Filter configuration
   * @returns true if line should be treated as a task
   */
  isTask(line: string, filepath: string, config: GlobalFilterConfig): boolean {
    if (!config.enabled) {
      // When disabled, all checklist items are tasks
      return true;
    }

    // Check if line matches patterns
    const matches = this.lineMatches(line, filepath, config);

    // Apply mode logic
    if (config.mode === 'include') {
      // Include mode: only items matching patterns are tasks
      return matches;
    } else {
      // Exclude mode: all items EXCEPT those matching patterns are tasks
      return !matches;
    }
  }

  /**
   * Check if line matches the configured patterns
   */
  private lineMatches(line: string, filepath: string, config: GlobalFilterConfig): boolean {
    const matches: boolean[] = [];

    // Check tag pattern
    if (config.tagPattern) {
      matches.push(this.matchesTag(line, config.tagPattern));
    }

    // Check path pattern
    if (config.pathPattern) {
      matches.push(this.matchesPath(filepath, config.pathPattern));
    }

    // Check regex pattern
    if (config.regex) {
      matches.push(this.matchesRegex(line, config.regex));
    }

    // If no patterns configured, return false
    if (matches.length === 0) {
      return false;
    }

    // Use AND logic: all patterns must match
    return matches.every(m => m === true);
  }

  /**
   * Check if line contains tag pattern
   */
  private matchesTag(line: string, tagPattern: string): boolean {
    // Simple substring match
    return line.includes(tagPattern);
  }

  /**
   * Check if filepath matches path pattern
   */
  private matchesPath(filepath: string, pathPattern: string): boolean {
    // Normalize path separators
    const normalizedPath = filepath.replace(/\\/g, '/');
    const normalizedPattern = pathPattern.replace(/\\/g, '/');
    
    return normalizedPath.includes(normalizedPattern);
  }

  /**
   * Check if line matches regex pattern
   */
  private matchesRegex(line: string, regexPattern: string): boolean {
    try {
      // Extract flags if present (e.g., "/pattern/i")
      const match = regexPattern.match(/^\/(.+)\/([gimsuvy]*)$/);
      
      let pattern: string;
      let flags: string | undefined;
      
      if (match) {
        pattern = match[1];
        flags = match[2] || undefined;
      } else {
        pattern = regexPattern;
      }

      const regex = new RegExp(pattern, flags);
      return regex.test(line);
    } catch (error) {
      // Invalid regex, return false
      return false;
    }
  }

  /**
   * Compile regex patterns from config for efficient matching
   * (Useful for optimization in the future)
   */
  private compilePatterns(config: GlobalFilterConfig): RegExp[] {
    const patterns: RegExp[] = [];

    if (config.regex) {
      try {
        const match = config.regex.match(/^\/(.+)\/([gimsuvy]*)$/);
        
        let pattern: string;
        let flags: string | undefined;
        
        if (match) {
          pattern = match[1];
          flags = match[2] || undefined;
        } else {
          pattern = config.regex;
        }

        patterns.push(new RegExp(pattern, flags));
      } catch (error) {
        // Invalid regex, skip
      }
    }

    return patterns;
  }
}
