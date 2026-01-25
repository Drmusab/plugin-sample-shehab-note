import { Request, Response, NextFunction } from 'express';
import { ApiKeyManager } from '../../auth/ApiKeyManager';
import { WebhookError } from '../types/Error';

/**
 * Failed auth attempt tracking
 */
class AuthBlockTracker {
  private attempts: Map<string, { count: number; blockedUntil: number | null }> =
    new Map();

  recordFailure(ip: string, maxAttempts: number, blockDuration: number): void {
    const record = this.attempts.get(ip) || { count: 0, blockedUntil: null };
    record.count++;

    if (record.count >= maxAttempts) {
      record.blockedUntil = Date.now() + blockDuration;
    }

    this.attempts.set(ip, record);
  }

  isBlocked(ip: string): boolean {
    const record = this.attempts.get(ip);
    if (!record || !record.blockedUntil) return false;

    if (Date.now() > record.blockedUntil) {
      // Block expired, reset
      this.attempts.delete(ip);
      return false;
    }

    return true;
  }

  reset(ip: string): void {
    this.attempts.delete(ip);
  }
}

export class AuthMiddleware {
  private blockTracker = new AuthBlockTracker();

  constructor(
    private apiKeyManager: ApiKeyManager,
    private maxFailedAttempts: number = 5,
    private blockDuration: number = 300000 // 5 minutes
  ) {}

  /**
   * Express middleware function
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const clientIp = this.getClientIp(req);

        // Check if IP is blocked
        if (this.blockTracker.isBlocked(clientIp)) {
          throw new WebhookError(
            'FORBIDDEN',
            'Too many failed authentication attempts. Temporary block in effect.',
            { retryAfter: 300 }
          );
        }

        // Extract API key from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          this.blockTracker.recordFailure(
            clientIp,
            this.maxFailedAttempts,
            this.blockDuration
          );
          throw new WebhookError('UNAUTHORIZED', 'Missing Authorization header');
        }

        const match = authHeader.match(/^Bearer (.+)$/);
        if (!match) {
          this.blockTracker.recordFailure(
            clientIp,
            this.maxFailedAttempts,
            this.blockDuration
          );
          throw new WebhookError(
            'UNAUTHORIZED',
            'Invalid Authorization header format. Expected: Bearer <api_key>'
          );
        }

        const apiKey = match[1];

        // Validate API key
        const { workspaceId, keyId } = await this.apiKeyManager.validateKey(apiKey);

        // Reset failed attempts on successful auth
        this.blockTracker.reset(clientIp);

        // Attach to request context
        (req as any).context = {
          workspaceId,
          apiKey,
          keyId,
          clientIp,
          userAgent: req.headers['user-agent'] || 'unknown',
          isHttps: this.isHttps(req),
          receivedAt: new Date(),
        };

        next();
      } catch (error) {
        if (error instanceof WebhookError) {
          next(error);
        } else {
          next(new WebhookError('INTERNAL_ERROR', 'Authentication failed'));
        }
      }
    };
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Check if request is HTTPS
   */
  private isHttps(req: Request): boolean {
    const proto = req.headers['x-forwarded-proto'];
    return proto === 'https' || req.protocol === 'https';
  }
}
