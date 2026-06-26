import { runMigrations, initDb } from './client.js';

await initDb();
runMigrations();
console.log('Migrations applied.');
