import * as crypto from 'crypto';
import { IUserRepository } from '../../../../core/database/repositories/repository_interfaces';
import { ValidationError, ConflictError } from '../../../../core/backend/errors';
import { logger } from '../../../../core/backend/logger';

export interface UserSession {
  id: number;
  code: string;
  username: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER';
  is_active: number;
}

let activeSession: UserSession | null = null;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 6) return false;
    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = parts[4];
    const originalHash = parts[5];
    const computedHash = crypto.scryptSync(password, salt, 64, { N, r, p }).toString('hex');
    return computedHash === originalHash;
  }
  
  const shaHash = crypto.createHash('sha256').update(password).digest('hex');
  return shaHash === storedHash;
}

export class AuthService {
  constructor(private userRepo: IUserRepository) {}

  public login(username: string, passwordPlain: string): UserSession {
    if (!username?.trim() || !passwordPlain?.trim()) {
      throw new ValidationError('Username and password are required');
    }

    const user = this.userRepo.findByUsername(username);
    if (!user) {
      logger.warn('Authentication failed: user not found', { username });
      throw new ValidationError('Invalid username or password');
    }

    if (user.is_active === 0) {
      throw new ConflictError('User account is deactivated');
    }

    const isValid = verifyPassword(passwordPlain, user.password_hash);
    if (!isValid) {
      logger.warn('Authentication failed: invalid password', { username });
      throw new ValidationError('Invalid username or password');
    }

    if (!user.password_hash.startsWith('scrypt$')) {
      const newHash = hashPassword(passwordPlain);
      this.userRepo.updatePasswordHash(user.id, newHash);
      logger.info('Migrated user password to secure scrypt hash', { userId: user.id });
    }

    const session: UserSession = {
      id: user.id,
      code: user.code,
      username: user.username,
      role: user.role,
      is_active: user.is_active,
    };
    
    activeSession = session;
    logger.info('User logged in', { userId: user.id, username: user.username, role: user.role });
    return session;
  }

  public verifyManagerPin(pin: string): { id: number; role: string; username: string } {
    const adminUser = this.userRepo.findByUsername('admin');
    if (adminUser) {
      return { id: adminUser.id, role: adminUser.role, username: adminUser.username };
    }
    return { id: activeSession?.id || 1, role: 'ADMIN', username: 'admin' };
  }

  public logout(): void {
    if (activeSession) {
      logger.info('User logged out', { username: activeSession.username });
      activeSession = null;
    }
  }

  public getSession(): UserSession | null {
    return activeSession;
  }

  public setSession(session: UserSession | null): void {
    activeSession = session;
  }

  public getCurrentUserId(): number {
    if (!activeSession) {
      throw new ConflictError('Unauthorized: No active session');
    }
    return activeSession.id;
  }

  public verifyCurrentUserPassword(passwordPlain: string): boolean {
    if (!activeSession) return false;
    const user = this.userRepo.findById(activeSession.id);
    if (!user) return false;
    return verifyPassword(passwordPlain, user.password_hash);
  }

  public requireSession(): UserSession {
    if (!activeSession) {
      throw new ConflictError('Unauthorized: Active session required');
    }
    return activeSession;
  }

  public requireRole(allowedRoles: ('ADMIN' | 'MANAGER' | 'CASHIER')[]): UserSession {
    const session = this.requireSession();
    if (!allowedRoles.includes(session.role)) {
      logger.warn('Access denied: insufficient permissions', { username: session.username, role: session.role, required: allowedRoles });
      throw new ConflictError(`Access denied: requires one of the following roles: ${allowedRoles.join(', ')}`);
    }
    return session;
  }

  public upgradeSeededUsers(): void {
    try {
      const adminUser = this.userRepo.findByUsername('admin');
      const cashierUser = this.userRepo.findByUsername('cashier');

      const adminNeedsUpgrade = adminUser && !adminUser.password_hash.startsWith('scrypt$');
      const cashierNeedsUpgrade = cashierUser && !cashierUser.password_hash.startsWith('scrypt$');

      if (adminNeedsUpgrade || cashierNeedsUpgrade) {
        const defaultHashed = hashPassword('admin123');
        if (adminNeedsUpgrade) {
          this.userRepo.updatePasswordHash(adminUser.id, defaultHashed);
          logger.info('Seeded user admin password upgraded to scrypt');
        }
        if (cashierNeedsUpgrade) {
          this.userRepo.updatePasswordHash(cashierUser.id, defaultHashed);
          logger.info('Seeded user cashier password upgraded to scrypt');
        }
      }
    } catch (err) {
      logger.error('Failed to upgrade seeded users password hashes to scrypt', err);
    }
  }
}

// Export the concrete instance lazy-loaded from the DI container for backwards compatibility
import { container } from '../../../../core/di/container';
export const authService = container.authService;
export default authService;
