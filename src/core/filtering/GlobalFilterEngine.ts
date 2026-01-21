import type { GlobalFilterConfig, FilterRule } from './FilterRule';
import { StatusRegistry } from '@/core/models/StatusRegistry';
import type { StatusType } from '@/core/models/Status';
import type { Task } from '@/core/models/Task';

/**
 * Engine for evaluating global filter rules
 */
export class GlobalFilterEngine {
  private config: GlobalFilterConfig;
  private compiledExcludeFolders: RegExp[] = [];
  private compiledExcludeNotebooks: RegExp[] = [];
  private compiledExcludeTags: RegExp[] = [];
  private compiledExcludeFilePatterns: RegExp[] = [];
  private statusRegistry = StatusRegistry.getInstance();

  constructor(config: GlobalFilterConfig) {
    this.config = config;
    this.compileExclusions();
  }

  /**
   * Evaluate whether a block should be treated as a task
   * @param blockContent - The markdown content of the block
   * @param blockPath - Optional path to the document (for path filtering)
   * @returns true if block passes filter (should be treated as task)
   */
  evaluate(blockContent: string, blockPath?: string): boolean {
    if (!this.config.enabled) {
      return true;
    }

    if (!this.passesExclusions(blockContent, blockPath)) {
      return false;
    }

    // If mode is 'all', pass everything after exclusions
    if (this.config.mode === 'all') {
      return true;
    }

    const activeRules = this.config.rules.filter(r => r.enabled);
    if (activeRules.length === 0) {
      // No rules = pass all (default behavior)
      return true;
    }

    // Evaluate each rule
    const matches = activeRules.map(rule =>
      this.evaluateRule(rule, blockContent, blockPath)
    );

    const allMatch = matches.every(m => m);
    const anyMatch = matches.some(m => m);

    // Include mode: pass if ALL rules match (AND logic)
    // Exclude mode: pass if NO rule matches (NOR logic)
    return this.config.mode === 'include' ? allMatch : !anyMatch;
  }

  /**
   * Update filter configuration
   */
  updateConfig(config: GlobalFilterConfig): void {
    this.config = config;
    this.compileExclusions();
  }

  /**
   * Get current configuration
   */
  getConfig(): GlobalFilterConfig {
    return this.config;
  }

  /**
   * Test a single rule against content
   */
  private evaluateRule(rule: FilterRule, content: string, path?: string): boolean {
    switch (rule.type) {
      case 'tag':
        const tags = this.extractTags(content);
        // Support wildcards: #work/* matches #work/urgent
        const pattern = rule.pattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return tags.some(tag => regex.test(tag));

      case 'regex':
        try {
          // Parse regex pattern with flags if provided (e.g., /pattern/flags)
          const regexMatch = rule.pattern.match(/^\/(.+)\/([gimsuy]*)$/);
          let regex: RegExp;
          if (regexMatch) {
            // Pattern with flags: /pattern/flags
            regex = new RegExp(regexMatch[1], regexMatch[2]);
          } else {
            // Plain pattern without slashes
            regex = new RegExp(rule.pattern);
          }
          return regex.test(content);
        } catch {
          return false; // Invalid regex = no match
        }

      case 'path':
        if (!path) return false;
        return path.includes(rule.pattern);

      case 'marker':
        // Custom marker like "TODO:", "TASK:"
        return content.includes(rule.pattern);

      default:
        return false;
    }
  }

  /**
   * Evaluate filter against a task (for previews)
   */
  evaluateTask(task: Task): boolean {
    if (!this.config.enabled) {
      return true;
    }

    const content = task.linkedBlockContent ?? task.name ?? '';
    const path = task.path;

    if (!this.passesExclusions(content, path, task.statusSymbol, task.tags)) {
      return false;
    }

    if (this.config.mode === 'all') {
      return true;
    }

    const activeRules = this.config.rules.filter(r => r.enabled);
    if (activeRules.length === 0) {
      return true;
    }

    const matches = activeRules.map(rule =>
      this.evaluateRule(rule, content, path)
    );
    const allMatch = matches.every(m => m);
    const anyMatch = matches.some(m => m);
    return this.config.mode === 'include' ? allMatch : !anyMatch;
  }

  /**
   * Extract tags from content
   */
  private extractTags(content: string): string[] {
    const tagMatches = content.match(/#[\w/-]+/g);
    return tagMatches || [];
  }

  private passesExclusions(
    content: string,
    path?: string,
    statusSymbol?: string,
    tags?: string[]
  ): boolean {
    const normalizedPath = path ? this.normalizePath(path) : undefined;
    const tagList = tags ?? this.extractTags(content);

    if (normalizedPath) {
      if (this.compiledExcludeFolders.some(regex => regex.test(normalizedPath))) {
        return false;
      }
      if (this.compiledExcludeNotebooks.some(regex => regex.test(normalizedPath))) {
        return false;
      }
      if (this.compiledExcludeFilePatterns.some(regex => regex.test(normalizedPath))) {
        return false;
      }
    }

    if (tagList.length > 0 && this.compiledExcludeTags.length > 0) {
      if (tagList.some(tag => this.compiledExcludeTags.some(regex => regex.test(tag)))) {
        return false;
      }
    }

    if (this.config.excludeStatusTypes.length > 0) {
      const type = this.resolveStatusType(statusSymbol, content);
      if (type && this.config.excludeStatusTypes.includes(type)) {
        return false;
      }
    }

    return true;
  }

  private resolveStatusType(statusSymbol?: string, content?: string): StatusType | null {
    const symbol = statusSymbol ?? this.extractStatusSymbol(content ?? '');
    if (!symbol) {
      return null;
    }
    return this.statusRegistry.get(symbol).type;
  }

  private extractStatusSymbol(content: string): string | null {
    const match = content.match(/^\s*-\s*\[(.)\]/);
    return match ? match[1] : null;
  }

  private compileExclusions(): void {
    this.compiledExcludeFolders = this.config.excludeFolders.map(pattern =>
      this.compilePathPattern(pattern)
    );
    this.compiledExcludeNotebooks = this.config.excludeNotebooks.map(pattern =>
      this.compilePathPattern(pattern)
    );
    this.compiledExcludeFilePatterns = this.config.excludeFilePatterns.map(pattern =>
      this.compilePathPattern(pattern)
    );
    this.compiledExcludeTags = this.config.excludeTags.map(tag => this.compileTagPattern(tag));
  }

  private compileTagPattern(pattern: string): RegExp {
    const sanitized = pattern.trim();
    if (!sanitized) {
      return /^$/;
    }
    const wildcard = sanitized.replace(/\*/g, '.*');
    return new RegExp(`^${wildcard}$`, 'i');
  }

  private compilePathPattern(pattern: string): RegExp {
    const trimmed = pattern.trim();
    if (!trimmed) {
      return /^$/;
    }
    const regexLiteral = trimmed.match(/^\/(.+)\/([gimsuy]*)$/);
    if (regexLiteral) {
      try {
        return new RegExp(regexLiteral[1], regexLiteral[2]);
      } catch {
        return /^$/;
      }
    }
    return this.globToRegExp(trimmed);
  }

  private globToRegExp(pattern: string): RegExp {
    const normalized = this.normalizePath(pattern);
    let regexSource = normalized
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '::DOUBLE_STAR::')
      .replace(/\*/g, '[^/]*')
      .replace(/::DOUBLE_STAR::/g, '.*');
    if (!regexSource.startsWith('.*')) {
      regexSource = `.*${regexSource}`;
    }
    return new RegExp(regexSource);
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
  }
}
