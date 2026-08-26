import { databaseProvider } from '../database/database_provider';
import Database from 'better-sqlite3';

export const dbManager = databaseProvider;
export const db: Database.Database = databaseProvider.getRawConnection();
export type DatabaseConnection = Database.Database;
