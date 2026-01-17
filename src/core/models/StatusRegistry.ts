import { Status } from './Status';

export class StatusRegistry {
  private statuses: Map<string, Status> = new Map();
  private static instance: StatusRegistry | null = null;

  private constructor() {
    this.addDefaultStatuses();
  }

  static getInstance(): StatusRegistry {
    if (!StatusRegistry.instance) {
      StatusRegistry.instance = new StatusRegistry();
    }
    return StatusRegistry.instance;
  }

  private addDefaultStatuses(): void {
    this.add(Status.TODO);
    this.add(Status.IN_PROGRESS);
    this.add(Status.DONE);
    this.add(Status.CANCELLED);
  }

  add(status: Status): void {
    this.statuses.set(status.symbol, status);
  }

  get(symbol: string): Status {
    const status = this.statuses.get(symbol);
    if (status) return status;
    
    // Return unknown status with inferred type
    return new Status({
      symbol,
      name: 'Unknown',
      nextStatusSymbol: 'x',
      type: Status.getTypeForUnknownSymbol(symbol),
    });
  }

  getNextStatus(current: Status): Status {
    return this.get(current.nextStatusSymbol);
  }

  getAllStatuses(): Status[] {
    return Array.from(this.statuses.values());
  }

  /** Reset to defaults (for testing) */
  reset(): void {
    this.statuses.clear();
    this.addDefaultStatuses();
  }
}
