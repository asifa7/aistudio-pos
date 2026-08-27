import { db } from '../../../core/backend/db';
import { hashPassword } from '../../auth/backend/service/auth_service';
import { ValidationError, ConflictError } from '../../../core/backend/errors';
import { logger } from '../../../core/backend/logger';

export interface UserDTO {
  id: number;
  code: string;
  username: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER';
  is_active: number;
  created_at: string;
}

export class RolePermissionsService {
  public getPermissions(): Record<string, Record<string, boolean>> {
    const rows = db.prepare('SELECT role, permission_key, allowed FROM role_permissions').all() as Array<{
      role: string;
      permission_key: string;
      allowed: number;
    }>;

    const result: Record<string, Record<string, boolean>> = {
      ADMIN: {},
      MANAGER: {},
      CASHIER: {},
    };

    for (const row of rows) {
      if (!result[row.role]) {
        result[row.role] = {};
      }
      result[row.role][row.permission_key] = row.allowed === 1;
    }

    return result;
  }

  public updatePermission(role: string, permissionKey: string, allowed: boolean): void {
    db.prepare(`
      INSERT INTO role_permissions (role, permission_key, allowed, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(role, permission_key) DO UPDATE SET
        allowed = excluded.allowed,
        updated_at = CURRENT_TIMESTAMP
    `).run(role, permissionKey, allowed ? 1 : 0);

    logger.info('Updated role permission', { role, permissionKey, allowed });
  }

  public getUsers(): UserDTO[] {
    const rows = db.prepare(`
      SELECT id, code, username, role, is_active, created_at
      FROM users
      ORDER BY id ASC
    `).all() as UserDTO[];
    return rows;
  }

  public saveUser(data: {
    id?: number;
    code?: string;
    username: string;
    passwordPlain?: string;
    role: 'ADMIN' | 'MANAGER' | 'CASHIER';
    is_active?: number;
  }): UserDTO {
    const trimmedUsername = data.username?.trim();
    if (!trimmedUsername) {
      throw new ValidationError('Username is required');
    }

    if (data.id) {
      // Update existing user
      const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(data.id) as any;
      if (!existing) {
        throw new ConflictError('User not found');
      }

      if (data.passwordPlain && data.passwordPlain.trim()) {
        const newHash = hashPassword(data.passwordPlain.trim());
        db.prepare(`
          UPDATE users
          SET username = ?, role = ?, is_active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(trimmedUsername, data.role, data.is_active ?? existing.is_active, newHash, data.id);
      } else {
        db.prepare(`
          UPDATE users
          SET username = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(trimmedUsername, data.role, data.is_active ?? existing.is_active, data.id);
      }

      logger.info('User updated', { userId: data.id, username: trimmedUsername });
      return db.prepare('SELECT id, code, username, role, is_active, created_at FROM users WHERE id = ?').get(data.id) as UserDTO;
    } else {
      // Create new user
      if (!data.passwordPlain || !data.passwordPlain.trim()) {
        throw new ValidationError('Password / PIN is required for new user');
      }

      // Generate next code e.g. USR-00002
      const lastUser = db.prepare('SELECT id FROM users ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined;
      const nextId = (lastUser?.id || 0) + 1;
      const code = data.code || `USR-${String(nextId).padStart(5, '0')}`;
      const passwordHash = hashPassword(data.passwordPlain.trim());

      const res = db.prepare(`
        INSERT INTO users (code, username, password_hash, role, is_active)
        VALUES (?, ?, ?, ?, ?)
      `).run(code, trimmedUsername, passwordHash, data.role, data.is_active ?? 1);

      logger.info('User created', { userId: res.lastInsertRowid, username: trimmedUsername, code });
      return db.prepare('SELECT id, code, username, role, is_active, created_at FROM users WHERE id = ?').get(res.lastInsertRowid) as UserDTO;
    }
  }

  public toggleUserActive(userId: number, isActive: number): void {
    db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(isActive, userId);
    logger.info('User active status toggled', { userId, isActive });
  }
}

export const rolePermissionsService = new RolePermissionsService();
export default rolePermissionsService;
