import { createClient } from "@libsql/client/web";

let ensureColumnsPromise: Promise<void> | null = null;

export async function ensureSnippetsGlobalCssColumn() {
  if (ensureColumnsPromise) {
    return ensureColumnsPromise;
  }

  ensureColumnsPromise = (async () => {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    try {
      const tableInfo = await client.execute("PRAGMA table_info(snippets)");

      const columnNames = new Set(
        tableInfo.rows
          .filter((row) => row !== null && typeof row === "object")
          .map((row) => (row as Record<string, unknown>).name),
      );

      if (!columnNames.has("global_css")) {
        await client.execute("ALTER TABLE snippets ADD COLUMN global_css text");
      }
      if (!columnNames.has("source")) {
        await client.execute("ALTER TABLE snippets ADD COLUMN source text");
      }
    } finally {
      client.close();
    }
  })().catch((error) => {
    ensureColumnsPromise = null;
    throw error;
  });

  return ensureColumnsPromise;
}
