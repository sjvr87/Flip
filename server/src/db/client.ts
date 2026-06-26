import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs, { type Database } from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database | null = null;
let persistTimer: NodeJS.Timeout | null = null;

export function getDbPath(): string {
    return process.env.FLIP_DB_PATH ?? path.join(process.cwd(), 'data', 'flip-multiverse.db');
}

function schedulePersist(): void {
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
        persistTimer = null;
        persistDb();
    }, 250);
}

export function persistDb(): void {
    if (!db) return;
    const dbPath = getDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
}

export async function initDb(): Promise<Database> {
    if (db) return db;

    const SQL = await initSqlJs({
        locateFile: (file) =>
            path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
    });

    const dbPath = getDbPath();
    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys = ON');
    return db;
}

export function getDb(): Database {
    if (!db) {
        throw new Error('Database not initialized — call initDb() first');
    }
    return db;
}

export function closeDb(): void {
    if (db) {
        persistDb();
        db.close();
        db = null;
    }
}

function columnExists(table: string, column: string): boolean {
    const rows = dbAll<{ name: string }>(`PRAGMA table_info(${table})`);
    return rows.some((row) => row.name === column);
}

function applyIncrementalMigrations(): void {
    if (!columnExists('post_deliveries', 'destination')) {
        dbRun('ALTER TABLE post_deliveries ADD COLUMN destination TEXT');
    }
}

export function runMigrations(): void {
    const database = getDb();
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    database.exec(sql);
    applyIncrementalMigrations();
    schedulePersist();
}

/** Run SQL with params; persists after mutating statements. */
export function dbRun(sql: string, params: unknown[] = []): void {
    const database = getDb();
    database.run(sql, params as (string | number | null)[]);
    if (/^\s*(INSERT|UPDATE|DELETE|CREATE|DROP)/i.test(sql)) {
        schedulePersist();
    }
}

export function dbGet<T>(sql: string, params: unknown[] = []): T | undefined {
    const stmt = getDb().prepare(sql);
    stmt.bind(params as (string | number | null)[]);
    if (stmt.step()) {
        const row = stmt.getAsObject() as T;
        stmt.free();
        return row;
    }
    stmt.free();
    return undefined;
}

export function dbAll<T>(sql: string, params: unknown[] = []): T[] {
    const stmt = getDb().prepare(sql);
    stmt.bind(params as (string | number | null)[]);
    const rows: T[] = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
}

/** Test helper — in-memory DB. */
export async function createTestDb(): Promise<Database> {
    const SQL = await initSqlJs();
    const testDb = new SQL.Database();
    testDb.run('PRAGMA foreign_keys = ON');
    const schemaPath = path.join(__dirname, 'schema.sql');
    testDb.exec(fs.readFileSync(schemaPath, 'utf8'));
    return testDb;
}
