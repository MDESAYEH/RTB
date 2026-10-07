/** Additive schema shared by local bootstrap and the offline import tool. */
export const storageSchema = `
CREATE TABLE IF NOT EXISTS media_uploads(id TEXT PRIMARY KEY,actor TEXT NOT NULL,name TEXT NOT NULL,type TEXT NOT NULL,size INTEGER NOT NULL,expires INTEGER NOT NULL,result TEXT);
CREATE INDEX IF NOT EXISTS media_upload_expiry ON media_uploads(expires);
CREATE TABLE IF NOT EXISTS media_chunks(upload TEXT NOT NULL REFERENCES media_uploads(id) ON DELETE CASCADE,part INTEGER NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(upload,part));
CREATE TABLE IF NOT EXISTS migration_imports(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,time TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS media_publications(id TEXT PRIMARY KEY,bytes INTEGER NOT NULL);
`;

export const storageSchemaVersion = 5;
