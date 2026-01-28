export interface Status {
  symbol: string; // ' ', 'x', '-'
  name: string; // 'Todo', 'Done', 'Cancelled'
  type: 'TODO' | 'DONE' | 'CANCELLED' | 'IN_PROGRESS' | 'NON_TASK';
  
  isCompleted(): boolean;
  isCancelled(): boolean;
}

export class StatusImpl implements Status {
  constructor(
    public symbol: string,
    public name: string,
    public type: 'TODO' | 'DONE' | 'CANCELLED' | 'IN_PROGRESS' | 'NON_TASK'
  ) {}
  
  isCompleted(): boolean {
    return this.type === 'DONE';
  }
  
  isCancelled(): boolean {
    return this.type === 'CANCELLED';
  }
}

export class StatusRegistry {
  private static instance: StatusRegistry;
  public registeredStatuses: Status[] = [
    new StatusImpl(' ', 'Todo', 'TODO'),
    new StatusImpl('x', 'Done', 'DONE'),
    new StatusImpl('-', 'Cancelled', 'CANCELLED'),
  ];

  static getInstance(): StatusRegistry {
    if (!this.instance) {
      this.instance = new StatusRegistry();
    }
    return this.instance;
  }

  bySymbol(symbol: string): Status {
    return this.registeredStatuses.find(s => s.symbol === symbol) 
      || this.registeredStatuses[0];
  }
}

export class StatusType {
  static readonly TODO = 'TODO';
  static readonly DONE = 'DONE';
  static readonly CANCELLED = 'CANCELLED';
  static readonly IN_PROGRESS = 'IN_PROGRESS';
  static readonly NON_TASK = 'NON_TASK';
}
