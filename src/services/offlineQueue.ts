import * as SQLite from 'expo-sqlite';
import { QueuedMedia } from '../types';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('nightwatch.db');
    await dbInstance.execAsync(`
      CREATE TABLE IF NOT EXISTS media_queue (
        id TEXT PRIMARY KEY NOT NULL,
        localUri TEXT NOT NULL,
        mediaType TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        geohash TEXT NOT NULL,
        geohashArea TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL,
        retryCount INTEGER NOT NULL DEFAULT 0,
        lastError TEXT
      );
    `);
  }
  return dbInstance;
};

export const initDB = async (): Promise<void> => {
  await getDB();
};

export const enqueue = async (
  item: Omit<QueuedMedia, 'status' | 'retryCount'>
): Promise<void> => {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO media_queue (
      id, localUri, mediaType, category, description,
      latitude, longitude, geohash, geohashArea,
      timestamp, status, retryCount, lastError
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL);`,
    [
      item.id,
      item.localUri,
      item.mediaType,
      item.category,
      item.description || '',
      item.latitude,
      item.longitude,
      item.geohash,
      item.geohashArea,
      item.timestamp,
    ]
  );
};

export const getNextPending = async (): Promise<QueuedMedia | null> => {
  const db = await getDB();
  const row = await db.getFirstAsync<QueuedMedia>(
    `SELECT * FROM media_queue WHERE status = 'pending' ORDER BY timestamp ASC LIMIT 1;`
  );
  return row || null;
};

export const updateStatus = async (
  id: string,
  status: QueuedMedia['status'],
  error?: string
): Promise<void> => {
  const db = await getDB();
  await db.runAsync(
    `UPDATE media_queue SET status = ?, lastError = ? WHERE id = ?;`,
    [status, error || null, id]
  );
};

export const incrementRetry = async (
  id: string,
  error: string
): Promise<number> => {
  const db = await getDB();
  await db.runAsync(
    `UPDATE media_queue SET retryCount = retryCount + 1, lastError = ? WHERE id = ?;`,
    [error, id]
  );
  const row = await db.getFirstAsync<{ retryCount: number }>(
    `SELECT retryCount FROM media_queue WHERE id = ?;`,
    [id]
  );
  return row?.retryCount || 0;
};

export const markCompleted = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.runAsync(`DELETE FROM media_queue WHERE id = ?;`, [id]);
};

export const getPendingCount = async (): Promise<number> => {
  const db = await getDB();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM media_queue WHERE status IN ('pending', 'uploading');`
  );
  return result?.count || 0;
};

export const getAll = async (): Promise<QueuedMedia[]> => {
  const db = await getDB();
  const rows = await db.getAllAsync<QueuedMedia>(
    `SELECT * FROM media_queue ORDER BY timestamp DESC;`
  );
  return rows;
};

export const deleteItem = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.runAsync(`DELETE FROM media_queue WHERE id = ?;`, [id]);
};
