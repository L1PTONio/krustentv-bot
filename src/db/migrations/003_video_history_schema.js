export default {
  version: '003_video_history_schema',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS video_history (
        video_id TEXT PRIMARY KEY,
        seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
};
