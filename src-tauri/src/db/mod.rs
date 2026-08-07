use rusqlite::{params, Connection, Result};
use serde::{de::DeserializeOwned, Serialize};
use std::path::Path;

pub fn initialize(path: &Path) -> Result<()> {
    let connection = Connection::open(path)?;
    connection.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         CREATE TABLE IF NOT EXISTS sync_queue (
           id TEXT PRIMARY KEY, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
           operation TEXT NOT NULL, payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, synced_at TEXT
         );
         CREATE TABLE IF NOT EXISTS cache (
           key TEXT PRIMARY KEY, entity TEXT NOT NULL, value TEXT NOT NULL,
           version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS sync_queue_pending_idx ON sync_queue(created_at) WHERE synced_at IS NULL;
         CREATE INDEX IF NOT EXISTS cache_entity_idx ON cache(entity, updated_at DESC);",
    )
}

pub fn save_cache<T: Serialize>(path: &Path, key: &str, entity: &str, value: &T) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let serialized = serde_json::to_string(value).map_err(|error| error.to_string())?;
    connection.execute(
        "INSERT INTO cache(key, entity, value, updated_at) VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET entity=excluded.entity, value=excluded.value, updated_at=CURRENT_TIMESTAMP",
        params![key, entity, serialized],
    ).map_err(|error| error.to_string())?;
    Ok(())
}

pub fn read_cache<T: DeserializeOwned>(path: &Path, key: &str) -> Result<Option<T>, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let value = connection.query_row(
        "SELECT value FROM cache WHERE key=?1",
        [key],
        |row| row.get::<_, String>(0),
    );
    match value {
        Ok(serialized) => serde_json::from_str(&serialized).map(Some).map_err(|error| error.to_string()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}
