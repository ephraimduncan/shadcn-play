import { drizzle } from "drizzle-orm/libsql/web";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let _db: LibSQLDatabase<typeof schema> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";

    _db = drizzle({
      connection: {
        url,
        authToken: process.env.TURSO_AUTH_TOKEN,
      },
      schema,
    });
  }
  return _db;
}
