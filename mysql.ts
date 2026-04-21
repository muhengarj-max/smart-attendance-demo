import mysql from "mysql2/promise";

const DB_HOST = process.env.DB_HOST?.trim();
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_NAME = process.env.DB_NAME?.trim();
const DB_USER = process.env.DB_USER?.trim();
const DB_PASSWORD = process.env.DB_PASSWORD ?? "";

export const isMySqlConfigured = () => Boolean(DB_HOST && DB_NAME && DB_USER && Number.isFinite(DB_PORT));

let pool: mysql.Pool | null = null;

export const getMySqlPool = () => {
  if (!isMySqlConfigured()) {
    return null;
  }

  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: false,
      timezone: "Z",
    });
  }

  return pool;
};

export const initializeMySqlSchema = async () => {
  const activePool = getMySqlPool();
  if (!activePool) {
    return false;
  }

  await activePool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      password VARCHAR(255) NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'admin',
      approved TINYINT(1) NOT NULL DEFAULT 0,
      is_locked TINYINT(1) NOT NULL DEFAULT 0,
      locked_until DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      firebase_uid VARCHAR(255) NULL,
      supabase_uid VARCHAR(255) NULL,
      auth_provider VARCHAR(50) NULL,
      subscription_plan VARCHAR(50) NULL,
      subscription_status VARCHAR(50) NOT NULL DEFAULT 'inactive',
      subscription_started_at DATETIME NULL,
      subscription_expires_at DATETIME NULL,
      subscription_payment_reference VARCHAR(255) NULL,
      trial_session_used TINYINT(1) NOT NULL DEFAULT 0,
      trial_sessions_used INT NOT NULL DEFAULT 0,
      trial_session_id VARCHAR(255) NULL,
      trial_started_at DATETIME NULL,
      UNIQUE KEY idx_admins_username (username),
      UNIQUE KEY idx_admins_firebase_uid (firebase_uid),
      UNIQUE KEY idx_admins_supabase_uid (supabase_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  return true;
};

export const verifyMySqlConnection = async () => {
  const activePool = getMySqlPool();
  if (!activePool) {
    return false;
  }

  const connection = await activePool.getConnection();
  try {
    await connection.ping();
    return true;
  } finally {
    connection.release();
  }
};
