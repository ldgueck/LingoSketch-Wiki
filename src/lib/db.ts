import Database from 'better-sqlite3';
import path from 'path';

// Use a persistent database file
const db = new Database(path.join(process.cwd(), 'wiki.sqlite'));

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS pages (
    name TEXT PRIMARY KEY,
    content TEXT NOT NULL
  )
`);

export default db;
