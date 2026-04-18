import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import fs from "fs";
import { createHash } from "crypto";
import { applicationDefault, cert, getApps as getAdminApps, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage as getAdminStorage, type Storage } from "firebase-admin/storage";
// import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.SQLITE_DB_PATH || process.env.DATABASE_PATH || path.join(process.cwd(), "attendance.db");
const DB_DIR = path.dirname(DB_PATH);
if (DB_DIR && DB_DIR !== "." && !fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
const db = new Database(DB_PATH);
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = Number(process.env.PORT || 3001);
const IS_PRODUCTION = NODE_ENV === "production";
const IS_RENDER = process.env.RENDER === "true" || Boolean(process.env.RENDER_SERVICE_ID);
const USE_VITE_DEV_SERVER = NODE_ENV !== "production" && !IS_RENDER;
const ADMIN_COOKIE_NAME = "admin_token";
const AUTH_SESSION_SECONDS = 30 * 24 * 60 * 60;
const AUTH_TOKEN_EXPIRES_IN = "30d";
const ATTENDANCE_DIR = process.env.ATTENDANCE_DIR || path.join(process.cwd(), "attendance");

type AdminRow = {
  id: number;
  username: string;
  role: string;
  approved?: number;
  is_locked?: number;
  locked_until?: string | null;
  subscription_plan?: string | null;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
  subscription_payment_reference?: string | null;
  trial_session_used?: number;
  trial_sessions_used?: number;
  trial_session_id?: string | null;
  trial_started_at?: string | null;
};

declare global {
  namespace Express {
    interface Request {
      admin?: AdminRow;
    }
  }
}

const getRequiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const isRemoteUrl = (value?: string | null) => /^https?:\/\//i.test(String(value || ""));

const JWT_SECRET = getRequiredEnv("JWT_SECRET");
const SUPER_ADMIN_USERNAME = getRequiredEnv("SUPER_ADMIN_USERNAME");
const SUPER_ADMIN_PASSWORD = getRequiredEnv("SUPER_ADMIN_PASSWORD");
const ADMIN_USERNAME = process.env.ADMIN_USERNAME?.trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const FIREBASE_WEB_API_KEY = process.env.VITE_FIREBASE_API_KEY;
const FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET;
const hasFirebaseAdminConfig = Boolean(FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS || FIREBASE_PROJECT_ID);
const hasFirestoreCredentials = Boolean(FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);

if ((ADMIN_USERNAME && !ADMIN_PASSWORD) || (!ADMIN_USERNAME && ADMIN_PASSWORD)) {
  throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must be set together, or both omitted.");
}

if (hasFirebaseAdminConfig && !getAdminApps().length) {
  if (FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credential = FIREBASE_SERVICE_ACCOUNT_JSON
      ? cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON))
      : applicationDefault();
    initializeAdminApp({ credential, projectId: FIREBASE_PROJECT_ID, storageBucket: FIREBASE_STORAGE_BUCKET });
  } else {
    initializeAdminApp({ projectId: FIREBASE_PROJECT_ID, storageBucket: FIREBASE_STORAGE_BUCKET });
  }
}
const firestoreDb: Firestore | null = hasFirestoreCredentials && getAdminApps().length ? getAdminFirestore() : null;
const firebaseStorage: Storage | null = hasFirestoreCredentials && FIREBASE_STORAGE_BUCKET && getAdminApps().length ? getAdminStorage() : null;

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    approved INTEGER NOT NULL DEFAULT 0,
    is_locked INTEGER NOT NULL DEFAULT 0,
    locked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_by_admin_id INTEGER,
    lat REAL,
    lng REAL,
    radius REAL,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    name TEXT,
    reg_number TEXT,
    image TEXT,
    lat REAL,
    lng REAL,
    device_fingerprint TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS attendance_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    reg_number TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    expires_at DATETIME,
    UNIQUE(session_id, reg_number, device_fingerprint)
  );
`);

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_session_device ON attendance(session_id, device_fingerprint);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_session_reg ON attendance(session_id, reg_number);
  CREATE INDEX IF NOT EXISTS idx_verifications_lookup ON attendance_verifications(session_id, reg_number, expires_at);
`);
const ensureColumn = (tableName: string, columnName: string, definition: string) => {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

ensureColumn("admins", "role", "TEXT NOT NULL DEFAULT 'admin'");
ensureColumn("admins", "approved", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("admins", "is_locked", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("admins", "locked_until", "DATETIME");
ensureColumn("admins", "created_at", "DATETIME");
ensureColumn("admins", "firebase_uid", "TEXT");
ensureColumn("admins", "auth_provider", "TEXT");
ensureColumn("admins", "subscription_plan", "TEXT");
ensureColumn("admins", "subscription_status", "TEXT NOT NULL DEFAULT 'inactive'");
ensureColumn("admins", "subscription_started_at", "DATETIME");
ensureColumn("admins", "subscription_expires_at", "DATETIME");
ensureColumn("admins", "subscription_payment_reference", "TEXT");
ensureColumn("admins", "trial_session_used", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("admins", "trial_sessions_used", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("admins", "trial_session_id", "TEXT");
ensureColumn("admins", "trial_started_at", "DATETIME");
ensureColumn("sessions", "created_by_admin_id", "INTEGER");
ensureColumn("sessions", "deleted_at", "DATETIME");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_firebase_uid ON admins(firebase_uid) WHERE firebase_uid IS NOT NULL");
db.prepare("UPDATE admins SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)").run();
db.prepare("UPDATE admins SET approved = 1 WHERE approved != 1").run();
db.prepare("UPDATE admins SET approved = 1 WHERE role = 'super_admin' OR username = ?").run(SUPER_ADMIN_USERNAME);
if (ADMIN_USERNAME) {
  db.prepare("UPDATE admins SET approved = 1 WHERE username = ?").run(ADMIN_USERNAME);
}

// Seed bootstrap accounts from environment variables only.
if (ADMIN_USERNAME && ADMIN_PASSWORD) {
  const adminExists = db.prepare("SELECT * FROM admins WHERE username = ?").get(ADMIN_USERNAME);
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare("INSERT INTO admins (username, password, role, approved) VALUES (?, ?, 'admin', 1)").run(ADMIN_USERNAME, hashedPassword);
  }
}
const superAdminExists = db.prepare("SELECT * FROM admins WHERE username = ?").get(SUPER_ADMIN_USERNAME) as AdminRow | undefined;
if (!superAdminExists) {
  const hashedPassword = bcrypt.hashSync(SUPER_ADMIN_PASSWORD, 10);
  db.prepare("INSERT INTO admins (username, password, role, approved) VALUES (?, ?, 'super_admin', 1)").run(SUPER_ADMIN_USERNAME, hashedPassword);
} else if (superAdminExists.role !== "super_admin") {
  db.prepare("UPDATE admins SET role = 'super_admin', approved = 1 WHERE username = ?").run(SUPER_ADMIN_USERNAME);
}

const cleanFirestoreData = (row: Record<string, any>) => {
  const data: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined) {
      data[key] = value;
    }
  }
  return data;
};

const toFirestoreValue = (value: any): Record<string, any> => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  return { stringValue: String(value) };
};

const fromFirestoreValue = (value: any) => {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("nullValue" in value) return null;
  return null;
};

const toFirestoreFields = (row: Record<string, any>) => {
  const fields: Record<string, any> = {};
  for (const [key, value] of Object.entries(cleanFirestoreData(row))) {
    fields[key] = toFirestoreValue(value);
  }
  return fields;
};

const fromFirestoreFields = (fields: Record<string, any> = {}) => {
  const row: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    row[key] = fromFirestoreValue(value);
  }
  return row;
};

const firestoreRestUrl = (collectionName: string, id: string) => {
  if (!FIREBASE_PROJECT_ID) return null;
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/(default)/documents/${collectionName}/${encodeURIComponent(id)}`;
};

const getGoogleAdminFromFirestoreRest = async (firebaseUid: string, idToken: string) => {
  const url = firestoreRestUrl("googleAdmins", firebaseUid);
  if (!url) return null;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Failed to read Google account from Firestore");
  }

  const data: any = await response.json();
  return fromFirestoreFields(data.fields);
};

const saveGoogleAdminToFirestoreRest = async (firebaseUid: string, idToken: string, row: Record<string, any>) => {
  const url = firestoreRestUrl("googleAdmins", firebaseUid);
  if (!url) return;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields({ ...row, firebase_uid: firebaseUid }) }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to save Google account to Firestore${text ? `: ${text}` : ""}`);
  }
};

const verifyFirebaseAccountToken = async (idToken: string) => {
  if (getAdminApps().length) {
    try {
      return await getAdminAuth().verifyIdToken(idToken);
    } catch (err) {
      console.error("Firebase Admin token verification failed, trying REST fallback:", err);
    }
  }

  if (!FIREBASE_WEB_API_KEY) {
    throw new Error("Firebase token verification is not configured");
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Firebase REST token verification failed${text ? `: ${text}` : ""}`);
  }

  const data: any = await response.json();
  const user = data.users?.[0];
  if (!user?.localId) {
    throw new Error("Firebase account was not found");
  }

  return {
    uid: user.localId,
    email: user.email,
    email_verified: user.emailVerified === true,
  };
};

const mirrorToFirestore = async (collectionName: string, id: string | number | bigint, row: Record<string, any>) => {
  if (!firestoreDb) return;
  await firestoreDb.collection(collectionName).doc(String(id)).set(cleanFirestoreData(row), { merge: true });
  if (collectionName === "admins" && row.firebase_uid) {
    await firestoreDb.collection("googleAdmins").doc(String(row.firebase_uid)).set(cleanFirestoreData(row), { merge: true });
  }
};

const deleteFromFirestore = async (collectionName: string, id: string | number | bigint) => {
  if (!firestoreDb) return;
  await firestoreDb.collection(collectionName).doc(String(id)).delete();
};

const syncAdminToFirestore = (id: string | number | bigint) => {
  const row: any = db.prepare("SELECT * FROM admins WHERE id = ?").get(id);
  if (row) {
    void mirrorToFirestore("admins", row.id, row).catch((err) => console.error("Failed to mirror admin:", err));
  }
};

const syncSessionToFirestore = (id: string) => {
  const row: any = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
  if (row) {
    void mirrorToFirestore("sessions", row.id, row).catch((err) => console.error("Failed to mirror session:", err));
  }
};

const syncAttendanceToFirestore = (id: string | number | bigint) => {
  const row: any = db.prepare("SELECT * FROM attendance WHERE id = ?").get(id);
  if (row) {
    void mirrorToFirestore("attendance", row.id, row).catch((err) => console.error("Failed to mirror attendance:", err));
  }
};

const SUBSCRIPTION_PLANS = {
  monthly: { amount: 25000, months: 1, label: "Monthly Plan" },
  quarterly: { amount: 70000, months: 3, label: "Quarterly Plan" },
  annual: { amount: 180000, months: 12, label: "Annual Plan" },
} as const;
const FREE_TRIAL_SESSION_LIMIT = 3;

type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;

const getSubscriptionPlan = (planId: unknown, amount?: number): SubscriptionPlanId | null => {
  const id = String(planId || "").trim().toLowerCase();
  if (id in SUBSCRIPTION_PLANS) return id as SubscriptionPlanId;

  const entry = Object.entries(SUBSCRIPTION_PLANS).find(([, plan]) => plan.amount === amount);
  return entry ? (entry[0] as SubscriptionPlanId) : null;
};

const addPlanMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const hasActiveSubscription = (admin: Pick<AdminRow, "role" | "subscription_status" | "subscription_expires_at">) => {
  if (admin.role === "super_admin") return true;
  if (admin.subscription_status !== "active" || !admin.subscription_expires_at) return false;
  return new Date(admin.subscription_expires_at).getTime() > Date.now();
};

const getTrialSessionsUsed = (admin: Pick<AdminRow, "trial_sessions_used" | "trial_session_used">) => {
  const count = Number(admin.trial_sessions_used || 0);
  if (count > 0) return count;
  return Number(admin.trial_session_used || 0);
};

const canUseFreeTrialSession = (admin: Pick<AdminRow, "role" | "trial_sessions_used" | "trial_session_used">) => {
  if (admin.role === "super_admin") return false;
  return getTrialSessionsUsed(admin) < FREE_TRIAL_SESSION_LIMIT;
};

const toPublicAdmin = (admin: any) => ({
  id: admin.id,
  username: admin.username,
  role: admin.role,
  approved: admin.approved,
  is_locked: admin.is_locked,
  locked_until: admin.locked_until,
  subscription_plan: admin.subscription_plan || null,
  subscription_status: admin.subscription_status || "inactive",
  subscription_expires_at: admin.subscription_expires_at || null,
  subscription_payment_reference: admin.subscription_payment_reference || null,
  trial_session_used: getTrialSessionsUsed(admin),
  trial_sessions_used: getTrialSessionsUsed(admin),
  trial_sessions_remaining: Math.max(0, FREE_TRIAL_SESSION_LIMIT - getTrialSessionsUsed(admin)),
  trial_session_limit: FREE_TRIAL_SESSION_LIMIT,
  trial_session_id: admin.trial_session_id || null,
  trial_started_at: admin.trial_started_at || null,
});

const expireAdminSubscriptionIfNeeded = (admin: AdminRow) => {
  if (admin.role === "super_admin") return admin;
  if (admin.subscription_status !== "active" || !admin.subscription_expires_at) return admin;

  const expiryTime = new Date(admin.subscription_expires_at).getTime();
  if (!Number.isFinite(expiryTime) || expiryTime > Date.now()) return admin;

  db.prepare("UPDATE admins SET subscription_status = 'expired' WHERE id = ?").run(admin.id);
  syncAdminToFirestore(admin.id);
  return {
    ...admin,
    subscription_status: "expired",
  };
};

const activateAdminSubscription = async (adminId: unknown, planId: unknown, reference: string) => {
  const id = Number(adminId);
  if (!Number.isInteger(id)) return false;

  const planKey = getSubscriptionPlan(planId);
  if (!planKey) return false;

  const plan = SUBSCRIPTION_PLANS[planKey];
  const now = new Date();
  const admin = db.prepare("SELECT id, subscription_expires_at FROM admins WHERE id = ?").get(id) as AdminRow | undefined;
  if (!admin) return false;

  const currentExpiry = admin.subscription_expires_at ? new Date(admin.subscription_expires_at) : now;
  const startsFrom = currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  const expiresAt = addPlanMonths(startsFrom, plan.months).toISOString();

  db.prepare(`
    UPDATE admins
    SET subscription_plan = ?,
        subscription_status = 'active',
        subscription_started_at = COALESCE(subscription_started_at, ?),
        subscription_expires_at = ?,
        subscription_payment_reference = ?
    WHERE id = ?
  `).run(planKey, now.toISOString(), expiresAt, reference, id);
  syncAdminToFirestore(id);
  return true;
};

const restoreFirestoreData = async () => {
  if (!firestoreDb) {
    console.warn("Firestore persistence is disabled. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS to keep data after Render restarts.");
    return;
  }

  const [adminSnapshot, sessionSnapshot, attendanceSnapshot] = await Promise.all([
    firestoreDb.collection("admins").get(),
    firestoreDb.collection("sessions").get(),
    firestoreDb.collection("attendance").get(),
  ]);

  const upsertAdmin = db.prepare(`
    INSERT INTO admins (id, username, password, role, approved, is_locked, locked_until, created_at, firebase_uid, auth_provider, subscription_plan, subscription_status, subscription_started_at, subscription_expires_at, subscription_payment_reference, trial_session_used, trial_sessions_used, trial_session_id, trial_started_at)
    VALUES (@id, @username, @password, @role, @approved, @is_locked, @locked_until, @created_at, @firebase_uid, @auth_provider, @subscription_plan, @subscription_status, @subscription_started_at, @subscription_expires_at, @subscription_payment_reference, @trial_session_used, @trial_sessions_used, @trial_session_id, @trial_started_at)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      password = excluded.password,
      role = excluded.role,
      approved = excluded.approved,
      is_locked = excluded.is_locked,
      locked_until = excluded.locked_until,
      created_at = excluded.created_at,
      firebase_uid = excluded.firebase_uid,
      auth_provider = excluded.auth_provider,
      subscription_plan = excluded.subscription_plan,
      subscription_status = excluded.subscription_status,
      subscription_started_at = excluded.subscription_started_at,
      subscription_expires_at = excluded.subscription_expires_at,
      subscription_payment_reference = excluded.subscription_payment_reference,
      trial_session_used = excluded.trial_session_used,
      trial_sessions_used = excluded.trial_sessions_used,
      trial_session_id = excluded.trial_session_id,
      trial_started_at = excluded.trial_started_at
  `);
  const upsertSession = db.prepare(`
    INSERT INTO sessions (id, name, created_by_admin_id, lat, lng, radius, expires_at, is_active, deleted_at, created_at)
    VALUES (@id, @name, @created_by_admin_id, @lat, @lng, @radius, @expires_at, @is_active, @deleted_at, @created_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      created_by_admin_id = excluded.created_by_admin_id,
      lat = excluded.lat,
      lng = excluded.lng,
      radius = excluded.radius,
      expires_at = excluded.expires_at,
      is_active = excluded.is_active,
      deleted_at = excluded.deleted_at,
      created_at = excluded.created_at
  `);
  const upsertAttendance = db.prepare(`
    INSERT INTO attendance (id, session_id, name, reg_number, image, lat, lng, device_fingerprint, submitted_at)
    VALUES (@id, @session_id, @name, @reg_number, @image, @lat, @lng, @device_fingerprint, @submitted_at)
    ON CONFLICT(id) DO UPDATE SET
      session_id = excluded.session_id,
      name = excluded.name,
      reg_number = excluded.reg_number,
      image = excluded.image,
      lat = excluded.lat,
      lng = excluded.lng,
      device_fingerprint = excluded.device_fingerprint,
      submitted_at = excluded.submitted_at
  `);

  const restoreTransaction = db.transaction(() => {
    for (const doc of adminSnapshot.docs) {
      const data = doc.data();
      upsertAdmin.run({
        id: Number(data.id || doc.id),
        username: data.username,
        password: data.password || "",
        role: data.role || "admin",
        approved: 1,
        is_locked: Number(data.is_locked || 0),
        locked_until: data.locked_until || null,
        created_at: data.created_at || null,
        firebase_uid: data.firebase_uid || null,
        auth_provider: data.auth_provider || null,
        subscription_plan: data.subscription_plan || null,
        subscription_status: data.subscription_status || "inactive",
        subscription_started_at: data.subscription_started_at || null,
        subscription_expires_at: data.subscription_expires_at || null,
        subscription_payment_reference: data.subscription_payment_reference || null,
        trial_session_used: Number(data.trial_session_used || 0),
        trial_sessions_used: Number(data.trial_sessions_used || data.trial_session_used || 0),
        trial_session_id: data.trial_session_id || null,
        trial_started_at: data.trial_started_at || null,
      });
    }

    for (const doc of sessionSnapshot.docs) {
      const data = doc.data();
      upsertSession.run({
        id: String(data.id || doc.id),
        name: data.name || null,
        created_by_admin_id: data.created_by_admin_id ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        radius: data.radius ?? null,
        expires_at: data.expires_at || null,
        is_active: Number(data.is_active ?? 1),
        deleted_at: data.deleted_at || null,
        created_at: data.created_at || null,
      });
    }

    for (const doc of attendanceSnapshot.docs) {
      const data = doc.data();
      upsertAttendance.run({
        id: Number(data.id || doc.id),
        session_id: data.session_id,
        name: data.name,
        reg_number: data.reg_number,
        image: data.image || "",
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        device_fingerprint: data.device_fingerprint || null,
        submitted_at: data.submitted_at || null,
      });
    }
  });

  restoreTransaction();
  const localAdmins: any[] = db.prepare("SELECT * FROM admins").all();
  const localSessions: any[] = db.prepare("SELECT * FROM sessions").all();
  const localAttendance: any[] = db.prepare("SELECT * FROM attendance").all();
  await Promise.all([
    ...localAdmins.map((row) => mirrorToFirestore("admins", row.id, row)),
    ...localSessions.map((row) => mirrorToFirestore("sessions", row.id, row)),
    ...localAttendance.map((row) => mirrorToFirestore("attendance", row.id, row)),
  ]);
  console.log(`Restored Firestore data: ${adminSnapshot.size} admins, ${sessionSnapshot.size} sessions, ${attendanceSnapshot.size} attendance records.`);
};

const createLocalAdminFromGoogleFirestore = (googleAdmin: Record<string, any>) => {
  const email = String(googleAdmin.username || googleAdmin.email || "").trim().toLowerCase();
  const firebaseUid = String(googleAdmin.firebase_uid || "");
  if (!email || !firebaseUid) return null;

  const existing: any = db.prepare("SELECT * FROM admins WHERE firebase_uid = ? OR lower(username) = ?").get(firebaseUid, email);
  if (existing) return existing;

  const generatedPassword = bcrypt.hashSync(uuidv4(), 10);
  const result = db.prepare("INSERT INTO admins (username, password, role, approved, is_locked, firebase_uid, auth_provider) VALUES (?, ?, ?, ?, ?, ?, 'google')")
    .run(
      email,
      generatedPassword,
      googleAdmin.role || "admin",
      1,
      Number(googleAdmin.is_locked || 0),
      firebaseUid,
    );
  return db.prepare("SELECT * FROM admins WHERE id = ?").get(result.lastInsertRowid);
};

const uploadSelfieToFirebaseStorage = async (objectPath: string, buffer: Buffer) => {
  if (!firebaseStorage) return null;

  const bucket = firebaseStorage.bucket(FIREBASE_STORAGE_BUCKET);
  const file = bucket.file(objectPath);
  await file.save(buffer, {
    contentType: "image/jpeg",
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${encodeURI(objectPath)}`;
};

const deleteSelfieFromFirebaseStorage = async (imageUrl?: string | null) => {
  if (!firebaseStorage || !imageUrl || !FIREBASE_STORAGE_BUCKET) return;
  const marker = `/${FIREBASE_STORAGE_BUCKET}/`;
  const markerIndex = imageUrl.indexOf(marker);
  if (markerIndex === -1) return;

  const objectPath = decodeURIComponent(imageUrl.slice(markerIndex + marker.length));
  await firebaseStorage.bucket(FIREBASE_STORAGE_BUCKET).file(objectPath).delete({ ignoreNotFound: true });
};

const fetchRemoteImageBuffer = async (imageUrl?: string | null) => {
  if (!isRemoteUrl(imageUrl)) return null;
  const response = await fetch(String(imageUrl));
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
};

async function startServer() {
  await restoreFirestoreData();
  db.prepare("UPDATE admins SET approved = 1 WHERE approved != 1").run();
  if (firestoreDb) {
    const approvedAdmins: any[] = db.prepare("SELECT * FROM admins").all();
    await Promise.all(approvedAdmins.map((row) => mirrorToFirestore("admins", row.id, row)));
  }

const app = express();
  // const options = {
  //   key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  //   cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
  // };
  const loginAttempts = new Map<string, { count: number; firstAttemptAt: number }>();
  const publicRateLimits = new Map<string, { count: number; firstRequestAt: number }>();

  // Create attendance directory if it doesn't exist
  if (!fs.existsSync(ATTENDANCE_DIR)) {
    fs.mkdirSync(ATTENDANCE_DIR, { recursive: true });
  }

  app.use(express.json({
    limit: "6mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  }));

  const getImagePathFromUrl = (imageUrl?: string | null) => {
    if (!imageUrl) return null;
    const urlParts = imageUrl.split("/api/attendance-images/");
    if (urlParts.length <= 1) return null;
    return path.join(ATTENDANCE_DIR, urlParts[1]);
  };

  const getRequestToken = (req: any) => {
    const headerToken = req.headers.authorization?.split(" ")[1];
    const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
    const cookieHeader = String(req.headers.cookie || "");
    const cookieToken = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`))
      ?.slice(ADMIN_COOKIE_NAME.length + 1);
    return headerToken || queryToken || cookieToken;
  };

  const setAuthCookie = (res: any, token: string) => {
    const parts = [
      `${ADMIN_COOKIE_NAME}=${token}`,
      "HttpOnly",
      "Path=/",
      "SameSite=Lax",
      `Max-Age=${AUTH_SESSION_SECONDS}`,
    ];

    if (IS_PRODUCTION) {
      parts.push("Secure");
    }

    res.setHeader("Set-Cookie", parts.join("; "));
  };

  const clearAuthCookie = (res: any) => {
    const parts = [
      `${ADMIN_COOKIE_NAME}=`,
      "HttpOnly",
      "Path=/",
      "SameSite=Lax",
      "Max-Age=0",
    ];

    if (IS_PRODUCTION) {
      parts.push("Secure");
    }

    res.setHeader("Set-Cookie", parts.join("; "));
  };

  const normalizeRegNumber = (value: unknown) => String(value || "").trim().toUpperCase();
  const hashFingerprint = (value: unknown) => createHash("sha256").update(String(value || "")).digest("hex");
  const isFiniteNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);
  const getClientIp = (req: any) => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown");
  const authenticateFromRequest = (req: any) => {
    const token = getRequestToken(req);
    if (!token) {
      return null;
    }

    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      return null;
    }
  };

  const cleanupExpiredVerifications = db.prepare("DELETE FROM attendance_verifications WHERE expires_at IS NOT NULL AND expires_at < ?");
  const canManageSession = (admin: any, session: any) => session?.created_by_admin_id === admin?.id;
  const enforceRateLimit = (req: any, res: any, bucket: string, maxRequests: number, windowMs: number) => {
    const key = `${bucket}:${getClientIp(req)}`;
    const nowMs = Date.now();
    const current = publicRateLimits.get(key);

    if (!current || nowMs - current.firstRequestAt >= windowMs) {
      publicRateLimits.set(key, { count: 1, firstRequestAt: nowMs });
      return true;
    }

    if (current.count >= maxRequests) {
      res.status(429).json({ error: "Too many requests. Please try again later." });
      return false;
    }

    publicRateLimits.set(key, { count: current.count + 1, firstRequestAt: current.firstRequestAt });
    return true;
  };

  // --- API ROUTES ---

  app.get("/api/firebase-config", (_req, res) => {
    const config = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
      measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
    };
    const missing = Object.entries(config)
      .filter(([key, value]) => key !== "measurementId" && !value)
      .map(([key]) => key);

    if (missing.length) {
      return res.status(503).json({ error: "Firebase is not configured", missing });
    }

    res.json(config);
  });

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const decoded = authenticateFromRequest(req);
    if (!decoded) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    let admin: any = db.prepare("SELECT id, username, role, approved, is_locked, locked_until, subscription_plan, subscription_status, subscription_expires_at, subscription_payment_reference, trial_session_used, trial_sessions_used, trial_session_id, trial_started_at FROM admins WHERE id = ?").get((decoded as any).id);
    if (!admin) {
      res.status(401).json({ error: "Admin account not found" });
      return;
    }
    const now = new Date().toISOString();
    if (admin.is_locked === 1) {
      clearAuthCookie(res);
      res.status(423).json({ error: "Account is temporarily locked", lockedUntil: admin.locked_until });
      return;
    }
    admin = expireAdminSubscriptionIfNeeded(admin);
    req.admin = admin;
    next();
  };

  const requireSuperAdmin = (req: any, res: any, next: any) => {
    if (req.admin?.role !== "super_admin") {
      return res.status(403).json({ error: "Super admin access required" });
    }
    next();
  };

  registerSnippePaymentRoutes(app, authenticate);

  app.get("/api/attendance-images/*", (req, res) => {
    const decoded = authenticateFromRequest(req);
    if (!decoded) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const admin: any = db.prepare("SELECT id, role FROM admins WHERE id = ?").get((decoded as any).id);
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const relativeFilePath = decodeURIComponent(req.params[0] || "");
    const sessionId = relativeFilePath.split(/[\\/]/)[0];
    const session: any = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
    if (!session || !canManageSession(admin, session)) {
      return res.status(403).json({ error: "You do not have permission to view this image" });
    }
    const resolvedPath = path.resolve(ATTENDANCE_DIR, relativeFilePath);
    const resolvedRoot = path.resolve(ATTENDANCE_DIR) + path.sep;

    if (!resolvedPath.startsWith(resolvedRoot) || !fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.sendFile(resolvedPath);
  });

  // Admin Login
  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    const clientIp = getClientIp(req);
    const nowMs = Date.now();
    const attemptWindowMs = 15 * 60 * 1000;
    const maxAttempts = 10;
    const currentAttempt = loginAttempts.get(clientIp);

    if (currentAttempt && nowMs - currentAttempt.firstAttemptAt < attemptWindowMs && currentAttempt.count >= maxAttempts) {
      return res.status(429).json({ error: "Too many login attempts. Please try again later." });
    }

    const admin: any = db.prepare("SELECT * FROM admins WHERE username = ?").get(username);
    const now = new Date().toISOString();
    if (admin?.is_locked === 1) {
      return res.status(423).json({ error: "Account is temporarily locked", lockedUntil: admin.locked_until });
    }
    if (admin && bcrypt.compareSync(password, admin.password)) {
      loginAttempts.delete(clientIp);
      const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: AUTH_TOKEN_EXPIRES_IN });
      setAuthCookie(res, token);
      res.json({
        token,
        admin: toPublicAdmin(admin),
      });
    } else {
      if (!currentAttempt || nowMs - currentAttempt.firstAttemptAt >= attemptWindowMs) {
        loginAttempts.set(clientIp, { count: 1, firstAttemptAt: nowMs });
      } else {
        loginAttempts.set(clientIp, { count: currentAttempt.count + 1, firstAttemptAt: currentAttempt.firstAttemptAt });
      }
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/admin/register", (req, res) => {
    const { username, password } = req.body;

    if (typeof username !== "string" || !username.trim() || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Username and password are required. Password must be at least 6 characters." });
    }

    const existing = db.prepare("SELECT id FROM admins WHERE username = ?").get(username.trim());
    if (existing) {
      return res.status(409).json({ error: "Account already exists" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare("INSERT INTO admins (username, password, role, approved) VALUES (?, ?, 'admin', 1)").run(username.trim(), hashedPassword);
    syncAdminToFirestore(result.lastInsertRowid);
    const admin: any = db.prepare("SELECT * FROM admins WHERE id = ?").get(result.lastInsertRowid);
    const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: AUTH_TOKEN_EXPIRES_IN });
    setAuthCookie(res, token);
    res.json({ token, admin: toPublicAdmin(admin), message: "Account created." });
  });

  app.post("/api/admin/firebase-auth", async (req, res) => {
    const { idToken, mode } = req.body;
    const authMode = mode === "register" ? "register" : "login";

    if (!hasFirebaseAdminConfig || !getAdminApps().length) {
      return res.status(503).json({ error: "Firebase account login is not configured on the server" });
    }

    if (typeof idToken !== "string" || !idToken.trim()) {
      return res.status(400).json({ error: "Missing Firebase account token" });
    }

    try {
      const decoded = await verifyFirebaseAccountToken(idToken);
      const email = String(decoded.email || "").trim().toLowerCase();
      const firebaseUid = decoded.uid;

      if (!email) {
        return res.status(403).json({ error: "Use an account with an email address" });
      }

      let admin: any = db.prepare("SELECT * FROM admins WHERE firebase_uid = ? OR lower(username) = ?").get(firebaseUid, email);
      if (!admin) {
        const firebaseAdmin = await getGoogleAdminFromFirestoreRest(firebaseUid, idToken).catch((err) => {
          console.error("Failed to load Firebase admin from Firestore:", err);
          return null;
        });
        if (firebaseAdmin) {
          admin = createLocalAdminFromGoogleFirestore(firebaseAdmin);
        }
      }

      if (authMode === "register") {
        if (admin) {
          if (!admin.firebase_uid) {
            db.prepare("UPDATE admins SET firebase_uid = ?, auth_provider = 'firebase' WHERE id = ?").run(firebaseUid, admin.id);
            admin = { ...admin, firebase_uid: firebaseUid, auth_provider: "firebase" };
          }
          db.prepare("UPDATE admins SET approved = 1 WHERE id = ?").run(admin.id);
          admin = { ...admin, approved: 1 };
          syncAdminToFirestore(admin.id);
          await saveGoogleAdminToFirestoreRest(firebaseUid, idToken, {
            id: admin.id,
            username: email,
            email,
            role: admin.role || "admin",
            approved: 1,
            is_locked: Number(admin.is_locked || 0),
            firebase_uid: firebaseUid,
            auth_provider: admin.auth_provider || "firebase",
          }).catch((err) => console.error("Failed to save Firebase admin fallback:", err));
          const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: AUTH_TOKEN_EXPIRES_IN });
          setAuthCookie(res, token);
          return res.json({ token, admin: toPublicAdmin(admin), message: "Account connected." });
        }

        const generatedPassword = bcrypt.hashSync(uuidv4(), 10);
        const result = db.prepare("INSERT INTO admins (username, password, role, approved, firebase_uid, auth_provider) VALUES (?, ?, 'admin', 1, ?, 'firebase')")
          .run(email, generatedPassword, firebaseUid);
        syncAdminToFirestore(result.lastInsertRowid);
        const createdAdmin: any = db.prepare("SELECT * FROM admins WHERE id = ?").get(result.lastInsertRowid);
        await saveGoogleAdminToFirestoreRest(firebaseUid, idToken, {
          id: Number(result.lastInsertRowid),
          username: email,
          email,
          role: "admin",
          approved: 1,
          is_locked: 0,
          firebase_uid: firebaseUid,
          auth_provider: "firebase",
        });
        const token = jwt.sign({ id: createdAdmin.id, username: createdAdmin.username, role: createdAdmin.role }, JWT_SECRET, { expiresIn: AUTH_TOKEN_EXPIRES_IN });
        setAuthCookie(res, token);
        return res.json({ token, admin: toPublicAdmin(createdAdmin), message: "Account created." });
      }

      if (!admin) {
        return res.status(404).json({ error: "Account is not registered. Create account first." });
      }

      if (!admin.firebase_uid) {
        db.prepare("UPDATE admins SET firebase_uid = ?, auth_provider = 'firebase' WHERE id = ?").run(firebaseUid, admin.id);
        admin = { ...admin, firebase_uid: firebaseUid, auth_provider: "firebase" };
        syncAdminToFirestore(admin.id);
      }

      if (admin.is_locked === 1) {
        return res.status(423).json({ error: "Account is temporarily locked", lockedUntil: admin.locked_until });
      }
      const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: AUTH_TOKEN_EXPIRES_IN });
      setAuthCookie(res, token);
      return res.json({
        token,
        admin: toPublicAdmin(admin),
      });
    } catch (err) {
      return res.status(401).json({ error: "Firebase account verification failed" });
    }
  });

  app.post("/api/admin/google-auth", async (req, res) => {
    const { idToken, mode } = req.body;
    const authMode = mode === "register" ? "register" : "login";

    if (!hasFirebaseAdminConfig || !getAdminApps().length) {
      return res.status(503).json({ error: "Google account login is not configured on the server" });
    }

    if (typeof idToken !== "string" || !idToken.trim()) {
      return res.status(400).json({ error: "Missing Google account token" });
    }

    try {
      const decoded = await verifyFirebaseAccountToken(idToken);
      const email = String(decoded.email || "").trim().toLowerCase();
      const firebaseUid = decoded.uid;

      if (!email || decoded.email_verified !== true) {
        return res.status(403).json({ error: "Use a verified Google account email" });
      }

      let admin: any = db.prepare("SELECT * FROM admins WHERE firebase_uid = ? OR lower(username) = ?").get(firebaseUid, email);
      if (!admin) {
        const googleAdmin = await getGoogleAdminFromFirestoreRest(firebaseUid, idToken).catch((err) => {
          console.error("Failed to load Google admin from Firestore:", err);
          return null;
        });
        if (googleAdmin) {
          admin = createLocalAdminFromGoogleFirestore(googleAdmin);
        }
      }

      if (authMode === "register") {
        if (admin) {
          if (!admin.firebase_uid) {
            db.prepare("UPDATE admins SET firebase_uid = ?, auth_provider = 'google' WHERE id = ?").run(firebaseUid, admin.id);
            admin = { ...admin, firebase_uid: firebaseUid, auth_provider: "google" };
          }
          db.prepare("UPDATE admins SET approved = 1 WHERE id = ?").run(admin.id);
          admin = { ...admin, approved: 1 };
          syncAdminToFirestore(admin.id);
          await saveGoogleAdminToFirestoreRest(firebaseUid, idToken, {
            id: admin.id,
            username: email,
            email,
            role: admin.role || "admin",
            approved: 1,
            is_locked: Number(admin.is_locked || 0),
            firebase_uid: firebaseUid,
            auth_provider: "google",
          }).catch((err) => console.error("Failed to save Google admin fallback:", err));
          const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: AUTH_TOKEN_EXPIRES_IN });
          setAuthCookie(res, token);
          return res.json({ token, admin: toPublicAdmin(admin), message: "Google account connected." });
        }

        const generatedPassword = bcrypt.hashSync(uuidv4(), 10);
        const result = db.prepare("INSERT INTO admins (username, password, role, approved, firebase_uid, auth_provider) VALUES (?, ?, 'admin', 1, ?, 'google')")
          .run(email, generatedPassword, firebaseUid);
        syncAdminToFirestore(result.lastInsertRowid);
        const createdAdmin: any = db.prepare("SELECT * FROM admins WHERE id = ?").get(result.lastInsertRowid);
        await saveGoogleAdminToFirestoreRest(firebaseUid, idToken, {
          id: Number(result.lastInsertRowid),
          username: email,
          email,
          role: "admin",
          approved: 1,
          is_locked: 0,
          firebase_uid: firebaseUid,
          auth_provider: "google",
        });
        const token = jwt.sign({ id: createdAdmin.id, username: createdAdmin.username, role: createdAdmin.role }, JWT_SECRET, { expiresIn: AUTH_TOKEN_EXPIRES_IN });
        setAuthCookie(res, token);
        return res.json({ token, admin: toPublicAdmin(createdAdmin), message: "Google account registered." });
      }

      if (!admin) {
        return res.status(404).json({ error: "Google account is not registered. Create account first." });
      }

      if (!admin.firebase_uid) {
        db.prepare("UPDATE admins SET firebase_uid = ?, auth_provider = 'google' WHERE id = ?").run(firebaseUid, admin.id);
        admin = { ...admin, firebase_uid: firebaseUid, auth_provider: "google" };
        syncAdminToFirestore(admin.id);
      }

      if (admin.is_locked === 1) {
        return res.status(423).json({ error: "Account is temporarily locked", lockedUntil: admin.locked_until });
      }
      const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: AUTH_TOKEN_EXPIRES_IN });
      setAuthCookie(res, token);
      return res.json({
        token,
        admin: toPublicAdmin(admin),
      });
    } catch (err) {
      return res.status(401).json({ error: "Google account verification failed" });
    }
  });

  app.get("/api/admin/me", authenticate, (req: any, res) => {
    res.json(toPublicAdmin(req.admin));
  });

  app.post("/api/admin/logout", (_req, res) => {
    clearAuthCookie(res);
    res.json({ success: true });
  });

  app.get("/api/admin/users", authenticate, requireSuperAdmin, (_req, res) => {
    const admins = db.prepare("SELECT id, username, role, approved, is_locked, locked_until, created_at FROM admins ORDER BY role DESC, created_at ASC").all();
    res.json(admins);
  });

  app.post("/api/admin/users", authenticate, requireSuperAdmin, (req, res) => {
    const { username, password, role } = req.body;
    if (typeof username !== "string" || !username.trim() || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Username and password are required. Password must be at least 6 characters." });
    }
    if (role !== "admin") {
      return res.status(400).json({ error: "Only regular admin accounts can be created here" });
    }
    const existing = db.prepare("SELECT id FROM admins WHERE username = ?").get(username.trim());
    if (existing) {
      return res.status(409).json({ error: "Admin username already exists" });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare("INSERT INTO admins (username, password, role, approved) VALUES (?, ?, ?, 1)").run(username.trim(), hashedPassword, role);
    syncAdminToFirestore(result.lastInsertRowid);
    res.json({ success: true });
  });

  app.delete("/api/admin/users/:id", authenticate, requireSuperAdmin, (req: any, res) => {
    const { id } = req.params;
    const target: any = db.prepare("SELECT id, username, role FROM admins WHERE id = ?").get(id);
    if (!target) {
      return res.status(404).json({ error: "Admin user not found" });
    }
    if (target.id === req.admin.id) {
      return res.status(400).json({ error: "You cannot delete your own super admin account" });
    }
    if (target.role === "super_admin") {
      return res.status(403).json({ error: "Cannot delete another super admin account" });
    }
    db.prepare("DELETE FROM admins WHERE id = ?").run(id);
    void deleteFromFirestore("admins", id).catch((err) => console.error("Failed to delete admin mirror:", err));
    res.json({ success: true });
  });

  app.patch("/api/admin/users/:id/lock", authenticate, requireSuperAdmin, (req: any, res) => {
    const { id } = req.params;
    const target: any = db.prepare("SELECT id, role FROM admins WHERE id = ?").get(id);
    if (!target) {
      return res.status(404).json({ error: "Admin user not found" });
    }
    if (target.id === req.admin.id) {
      return res.status(400).json({ error: "You cannot lock your own super admin account" });
    }
    if (target.role === "super_admin") {
      return res.status(403).json({ error: "Cannot lock another super admin account" });
    }
    db.prepare("UPDATE admins SET is_locked = 1, locked_until = NULL WHERE id = ?").run(id);
    syncAdminToFirestore(id);
    res.json({ success: true });
  });

  app.patch("/api/admin/users/:id/unlock", authenticate, requireSuperAdmin, (req: any, res) => {
    const { id } = req.params;
    const target: any = db.prepare("SELECT id, role FROM admins WHERE id = ?").get(id);
    if (!target) {
      return res.status(404).json({ error: "Admin user not found" });
    }
    if (target.role === "super_admin") {
      return res.status(403).json({ error: "Cannot modify another super admin account" });
    }
    db.prepare("UPDATE admins SET is_locked = 0, locked_until = NULL WHERE id = ?").run(id);
    syncAdminToFirestore(id);
    res.json({ success: true });
  });

  app.patch("/api/admin/users/:id/password", authenticate, requireSuperAdmin, (req: any, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }

    const target: any = db.prepare("SELECT id, role FROM admins WHERE id = ?").get(id);
    if (!target) {
      return res.status(404).json({ error: "Admin user not found" });
    }

    if (target.role === "super_admin") {
      return res.status(403).json({ error: "Cannot reset another super admin password here" });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE admins SET password = ? WHERE id = ?").run(hashedPassword, id);
    syncAdminToFirestore(id);
    res.json({ success: true });
  });

  app.patch("/api/admin/change-password", authenticate, (req: any, res) => {
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    if (
      typeof oldPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmNewPassword !== "string"
    ) {
      return res.status(400).json({ error: "All password fields are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ error: "New password and confirmation do not match." });
    }

    const admin: any = db.prepare("SELECT * FROM admins WHERE id = ?").get(req.admin.id);
    if (!admin || !bcrypt.compareSync(oldPassword, admin.password)) {
      return res.status(400).json({ error: "Old password is incorrect." });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE admins SET password = ? WHERE id = ?").run(hashedPassword, req.admin.id);
    syncAdminToFirestore(req.admin.id);
    clearAuthCookie(res);
    res.json({ success: true, message: "Password changed successfully. Please log in again." });
  });

  // Create Session
  app.post("/api/sessions", authenticate, (req, res) => {
    const hasPaidAccess = hasActiveSubscription(req.admin);
    const hasTrialAccess = canUseFreeTrialSession(req.admin);
    if (!hasPaidAccess && !hasTrialAccess) {
      return res.status(402).json({
        error: "You have reached the free trial limit. Please pay for a subscription package to continue creating sessions.",
        paymentRequired: true,
        trialLimitReached: true,
        trialSessionsUsed: FREE_TRIAL_SESSION_LIMIT,
        trialSessionLimit: FREE_TRIAL_SESSION_LIMIT,
      });
    }

    const { name, lat, lng, radius, minutes } = req.body;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      !isFiniteNumber(lat) ||
      !isFiniteNumber(lng) ||
      !isFiniteNumber(radius) ||
      !Number.isInteger(minutes) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      radius < 5 ||
      radius > 1000 ||
      minutes < 1 ||
      minutes > 24 * 60
    ) {
      return res.status(400).json({ error: "Invalid session input" });
    }

    const id = uuidv4().slice(0, 8);
    const expiresAt = new Date(Date.now() + minutes * 60000).toISOString();
    db.prepare("INSERT INTO sessions (id, name, created_by_admin_id, lat, lng, radius, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, name.trim(), req.admin.id, lat, lng, radius / 1000, expiresAt); // radius in km
    syncSessionToFirestore(id);
    if (!hasPaidAccess && hasTrialAccess) {
      const nextTrialCount = Math.min(FREE_TRIAL_SESSION_LIMIT, getTrialSessionsUsed(req.admin) + 1);
      db.prepare("UPDATE admins SET trial_session_used = ?, trial_sessions_used = ?, trial_session_id = ?, trial_started_at = COALESCE(trial_started_at, ?) WHERE id = ?")
        .run(nextTrialCount, nextTrialCount, id, new Date().toISOString(), req.admin.id);
      syncAdminToFirestore(req.admin.id);
    }
    res.json({
      id,
      trialUsed: !hasPaidAccess && hasTrialAccess,
      trialSessionsUsed: !hasPaidAccess && hasTrialAccess ? Math.min(FREE_TRIAL_SESSION_LIMIT, getTrialSessionsUsed(req.admin) + 1) : getTrialSessionsUsed(req.admin),
      trialSessionsRemaining: !hasPaidAccess && hasTrialAccess ? Math.max(0, FREE_TRIAL_SESSION_LIMIT - getTrialSessionsUsed(req.admin) - 1) : Math.max(0, FREE_TRIAL_SESSION_LIMIT - getTrialSessionsUsed(req.admin)),
      trialSessionLimit: FREE_TRIAL_SESSION_LIMIT,
    });
  });

  // Delete Session
  app.delete("/api/sessions/:id", authenticate, (req, res) => {
    const { id } = req.params;
    const session: any = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (!canManageSession(req.admin, session)) {
      return res.status(403).json({ error: "You do not have permission to delete this session" });
    }

    db.prepare("UPDATE sessions SET is_active = 0, deleted_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    syncSessionToFirestore(id);
    res.json({ success: true });
  });

  // Get Sessions
  app.get("/api/sessions", authenticate, (req, res) => {
    const includeDeleted = req.query.includeDeleted === "1";
    const sessions = includeDeleted
      ? db.prepare("SELECT * FROM sessions WHERE created_by_admin_id = ? ORDER BY created_at DESC").all(req.admin.id)
      : db.prepare("SELECT * FROM sessions WHERE created_by_admin_id = ? AND deleted_at IS NULL ORDER BY created_at DESC").all(req.admin.id);
    res.json(sessions);
  });

  // Toggle Session
  app.patch("/api/sessions/:id/toggle", authenticate, (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    if (typeof is_active !== "boolean") {
      return res.status(400).json({ error: "Invalid toggle payload" });
    }
    const session: any = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (session.deleted_at) {
      return res.status(410).json({ error: "Session was deleted" });
    }
    if (!canManageSession(req.admin, session)) {
      return res.status(403).json({ error: "You do not have permission to update this session" });
    }
    db.prepare("UPDATE sessions SET is_active = ? WHERE id = ?").run(is_active ? 1 : 0, id);
    syncSessionToFirestore(id);
    res.json({ success: true });
  });

  // Get Session Details (Public)
  app.get("/api/public/sessions/:id", (req, res) => {
    if (!enforceRateLimit(req, res, "public-session", 120, 15 * 60 * 1000)) return;
    const session: any = db.prepare("SELECT * FROM sessions WHERE id = ? AND deleted_at IS NULL").get(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    
    const now = new Date().toISOString();
    if (session.is_active === 0 || session.expires_at < now) {
      return res.status(403).json({ error: "Session expired or inactive", expired: true });
    }
    
    res.json({
      id: session.id,
      lat: session.lat,
      lng: session.lng,
      radius: session.radius,
      expires_at: session.expires_at
    });
  });

  app.post("/api/public/check-submission-status", (req, res) => {
    if (!enforceRateLimit(req, res, "public-check", 40, 15 * 60 * 1000)) return;
    const { sessionId, regNumber, deviceFingerprint } = req.body;
    const normalizedRegNumber = normalizeRegNumber(regNumber);

    if (!sessionId || !normalizedRegNumber || !deviceFingerprint) {
      return res.status(400).json({ canVerify: false, error: "Missing session, registration number, or device fingerprint" });
    }

    const session: any = db.prepare("SELECT * FROM sessions WHERE id = ? AND deleted_at IS NULL").get(sessionId);
    if (!session) return res.status(404).json({ canVerify: false, error: "Session not found" });

    const now = new Date().toISOString();
    cleanupExpiredVerifications.run(now);
    if (session.is_active === 0 || session.expires_at < now) {
      return res.status(403).json({ canVerify: false, error: "Session expired or inactive" });
    }

    const deviceHash = hashFingerprint(deviceFingerprint);

    const existingDeviceAttendance: any = db.prepare(
      "SELECT * FROM attendance WHERE session_id = ? AND device_fingerprint = ?"
    ).get(sessionId, deviceHash);

    if (existingDeviceAttendance) {
      return res.json({
        canVerify: false,
        reason: "Attendance already submitted from this device",
      });
    }

    const existingAttendance: any = db.prepare(
      "SELECT * FROM attendance WHERE session_id = ? AND reg_number = ?"
    ).get(sessionId, normalizedRegNumber);

    if (existingAttendance) {
      return res.json({
        canVerify: false,
        reason: "Attendance already submitted for this registration number",
      });
    }

    const activeOtherBrowser: any = db.prepare(
      `SELECT * FROM attendance_verifications
       WHERE session_id = ? AND reg_number = ? AND device_fingerprint != ? AND expires_at > ?
       ORDER BY last_attempt DESC LIMIT 1`
    ).get(sessionId, normalizedRegNumber, deviceHash, now);

    if (activeOtherBrowser) {
      return res.json({
        canVerify: false,
        reason: "Verification already started in another browser for this registration number",
        nextAttemptTime: activeOtherBrowser.expires_at,
      });
    }

    db.prepare(
      `INSERT INTO attendance_verifications (session_id, reg_number, device_fingerprint, status, attempts, last_attempt, expires_at)
       VALUES (?, ?, ?, 'pending', 0, ?, ?)
       ON CONFLICT(session_id, reg_number, device_fingerprint)
       DO UPDATE SET last_attempt = excluded.last_attempt, expires_at = excluded.expires_at`
    ).run(sessionId, normalizedRegNumber, deviceHash, now, session.expires_at);

    res.json({
      canVerify: true,
      reason: "Verification can proceed",
      expiresAt: session.expires_at,
    });
  });

  // Submit Attendance
  app.post("/api/public/submit", async (req, res) => {
    if (!enforceRateLimit(req, res, "public-submit", 20, 15 * 60 * 1000)) return;
    const { sessionId, name, regNumber, image, lat, lng, deviceFingerprint } = req.body;
    const normalizedRegNumber = normalizeRegNumber(regNumber);

    if (
      typeof sessionId !== "string" ||
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 120 ||
      !normalizedRegNumber ||
      normalizedRegNumber.length > 60 ||
      typeof image !== "string" ||
      !image.startsWith("data:image/jpeg;base64,") ||
      image.length > 6_000_000 ||
      !isFiniteNumber(lat) ||
      !isFiniteNumber(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      typeof deviceFingerprint !== "string" ||
      deviceFingerprint.length < 16 ||
      deviceFingerprint.length > 512
    ) {
      return res.status(400).json({ error: "Invalid attendance payload" });
    }

    const session: any = db.prepare("SELECT * FROM sessions WHERE id = ? AND deleted_at IS NULL").get(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const now = new Date().toISOString();
    cleanupExpiredVerifications.run(now);
    if (session.is_active === 0 || session.expires_at < now) {
      return res.status(403).json({ error: "Session expired or inactive" });
    }

    // GPS Check (Haversine formula)
    function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
      const R = 6371; // km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    const dist = getDistance(lat, lng, session.lat, session.lng);
    if (dist > session.radius) {
      return res.status(400).json({ error: `Out of range. Distance: ${(dist * 1000).toFixed(1)}m, Allowed: ${(session.radius * 1000).toFixed(1)}m` });
    }

    // Device Check (hash the fingerprint for cross-browser uniqueness)
    const deviceHash = hashFingerprint(deviceFingerprint);
    const existing = db.prepare("SELECT * FROM attendance WHERE session_id = ? AND device_fingerprint = ?")
      .get(sessionId, deviceHash);
    if (existing) {
      return res.status(400).json({ error: "Attendance already submitted from this device" });
    }

    const existingRegNumber: any = db.prepare("SELECT * FROM attendance WHERE session_id = ? AND reg_number = ?")
      .get(sessionId, normalizedRegNumber);
    if (existingRegNumber) {
      return res.status(400).json({ error: "Attendance already submitted for this registration number" });
    }

    const otherBrowserAttempt: any = db.prepare(
      `SELECT * FROM attendance_verifications
       WHERE session_id = ? AND reg_number = ? AND device_fingerprint != ? AND expires_at > ?
       ORDER BY last_attempt DESC LIMIT 1`
    ).get(sessionId, normalizedRegNumber, deviceHash, now);
    if (otherBrowserAttempt) {
      return res.status(403).json({ error: "Verification was started in another browser for this registration number" });
    }

    db.prepare(
      `INSERT INTO attendance_verifications (session_id, reg_number, device_fingerprint, status, attempts, last_attempt, expires_at)
       VALUES (?, ?, ?, 'pending', 0, ?, ?)
       ON CONFLICT(session_id, reg_number, device_fingerprint)
       DO UPDATE SET status = 'pending', last_attempt = excluded.last_attempt, expires_at = excluded.expires_at`
    ).run(sessionId, normalizedRegNumber, deviceHash, now, session.expires_at);

    const timestamp = Date.now();
    const safeRegNumber = String(regNumber || "student").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${timestamp}-${safeRegNumber}.jpg`;
    const storageObjectPath = `attendance/${sessionId}/${filename}`;
    let imagePath: string | null = null;
    let imageUrl = `/api/attendance-images/${sessionId}/${filename}`;
    let buffer: Buffer;

    try {
      const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");
      buffer = Buffer.from(base64Data, "base64");
      const storageUrl = await uploadSelfieToFirebaseStorage(storageObjectPath, buffer);
      if (storageUrl) {
        imageUrl = storageUrl;
      } else {
        const sessionDir = path.join(ATTENDANCE_DIR, sessionId);
        if (!fs.existsSync(sessionDir)) {
          fs.mkdirSync(sessionDir, { recursive: true });
        }
        imagePath = path.join(sessionDir, filename);
        fs.writeFileSync(imagePath, buffer);
      }
    } catch (err) {
      return res.status(500).json({ error: "Failed to save image" });
    }

    // Save record with image URL path
    let attendanceId: number | bigint;
    try {
      const result = db.prepare("INSERT INTO attendance (session_id, name, reg_number, image, lat, lng, device_fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(sessionId, name.trim(), normalizedRegNumber, imageUrl, lat, lng, deviceHash);
      attendanceId = result.lastInsertRowid;
    } catch (err: any) {
      if (imagePath && fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      if (isRemoteUrl(imageUrl)) {
        void deleteSelfieFromFirebaseStorage(imageUrl).catch((deleteErr) => console.error("Failed to delete uploaded selfie:", deleteErr));
      }
      if (String(err?.message || "").includes("UNIQUE")) {
        return res.status(409).json({ error: "Attendance already submitted" });
      }
      return res.status(500).json({ error: "Failed to save attendance" });
    }
    syncAttendanceToFirestore(attendanceId);

    db.prepare(
      `UPDATE attendance_verifications
       SET status = 'completed', attempts = attempts + 1, completed_at = ?, last_attempt = ?, expires_at = ?
       WHERE session_id = ? AND reg_number = ? AND device_fingerprint = ?`
    ).run(now, now, session.expires_at, sessionId, normalizedRegNumber, deviceHash);

    res.json({ success: true });
  });

  // Get Attendance Records (all or by session)
  app.get("/api/attendance", authenticate, (req, res) => {
    const { sessionId } = req.query;
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 25)));
    const offset = (page - 1) * pageSize;
    let records;
    let total = 0;
    if (sessionId) {
      const session: any = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      if (!canManageSession(req.admin, session)) {
        return res.status(403).json({ error: "You do not have permission to view this session" });
      }
      total = (db.prepare("SELECT COUNT(*) as count FROM attendance WHERE session_id = ?").get(sessionId) as { count: number }).count;
      records = db.prepare(`SELECT * FROM attendance WHERE session_id = ? ORDER BY submitted_at DESC LIMIT ? OFFSET ?`).all(sessionId, pageSize, offset);
    } else {
      total = (db.prepare(`
        SELECT COUNT(*) as count
        FROM attendance a
        JOIN sessions s ON a.session_id = s.id
        WHERE s.created_by_admin_id = ?
      `).get(req.admin.id) as { count: number }).count;
      records = db.prepare(`
        SELECT a.*, s.id as session_id
        FROM attendance a
        JOIN sessions s ON a.session_id = s.id
        WHERE s.created_by_admin_id = ?
        ORDER BY a.submitted_at DESC
        LIMIT ? OFFSET ?
      `).all(req.admin.id, pageSize, offset);
    }
    res.json({
      records,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });

  // Delete Attendance Record
  app.delete("/api/attendance/:id", authenticate, async (req, res) => {
    const { id } = req.params;
    const record: any = db.prepare("SELECT * FROM attendance WHERE id = ?").get(id);
    if (!record) {
      return res.status(404).json({ error: "Attendance record not found" });
    }
    const session: any = db.prepare("SELECT * FROM sessions WHERE id = ?").get(record.session_id);
    if (!session || !canManageSession(req.admin, session)) {
      return res.status(403).json({ error: "You do not have permission to delete this attendance record" });
    }

    if (record?.image) {
      try {
        if (isRemoteUrl(record.image)) {
          await deleteSelfieFromFirebaseStorage(record.image);
        } else {
          const urlParts = record.image.split("/api/attendance-images/");
          if (urlParts.length > 1) {
            const imagePath = path.join(ATTENDANCE_DIR, urlParts[1]);
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath);
            }
          }
        }
      } catch (err) {
        console.error("Failed to delete image file:", err);
      }
    }

    db.prepare("DELETE FROM attendance WHERE id = ?").run(id);
    void deleteFromFirestore("attendance", id).catch((err) => console.error("Failed to delete attendance mirror:", err));
    if (record?.session_id && record?.reg_number) {
      db.prepare("DELETE FROM attendance_verifications WHERE session_id = ? AND reg_number = ?").run(record.session_id, record.reg_number);
    }
    res.json({ success: true });
  });

  // Export Excel
  app.get("/api/export/excel", authenticate, async (req, res) => {
    const { sessionId } = req.query;
    let records: any[];

    if (sessionId) {
      const session: any = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      if (!canManageSession(req.admin, session)) {
        return res.status(403).json({ error: "You do not have permission to export this session" });
      }
      records = db.prepare("SELECT name, reg_number, session_id, lat, lng, image, submitted_at FROM attendance WHERE session_id = ? ORDER BY submitted_at DESC").all(sessionId);
    } else {
      records = db.prepare(`
        SELECT a.name, a.reg_number, a.session_id, a.lat, a.lng, a.image, a.submitted_at
        FROM attendance a
        JOIN sessions s ON a.session_id = s.id
        WHERE s.created_by_admin_id = ?
        ORDER BY a.submitted_at DESC
      `).all(req.admin.id);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance");

    sheet.columns = [
      { header: "No.", key: "index", width: 8 },
      { header: "Student Name", key: "name", width: 24 },
      { header: "Registration Number", key: "regNumber", width: 24 },
      { header: "Session", key: "sessionId", width: 16 },
      { header: "Latitude", key: "lat", width: 14 },
      { header: "Longitude", key: "lng", width: 14 },
      { header: "Submitted At", key: "submittedAt", width: 24 },
      { header: "Selfie", key: "selfie", width: 18 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "2563EB" },
    };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    for (const [index, record] of records.entries()) {
      const rowNumber = index + 2;
      sheet.getRow(rowNumber).values = [
        index + 1,
        record.name,
        record.reg_number,
        record.session_id,
        Number(record.lat).toFixed(6),
        Number(record.lng).toFixed(6),
        new Date(record.submitted_at).toLocaleString(),
        "",
      ];
      sheet.getRow(rowNumber).height = 90;
      sheet.getRow(rowNumber).alignment = { vertical: "middle", horizontal: "center", wrapText: true };

      const remoteImageBuffer = await fetchRemoteImageBuffer(record.image);
      const localImagePath = getImagePathFromUrl(record.image);
      const imageBuffer = remoteImageBuffer || (localImagePath && fs.existsSync(localImagePath) ? fs.readFileSync(localImagePath) : null);
      if (imageBuffer) {
        const imageId = workbook.addImage({
          buffer: imageBuffer,
          extension: "jpeg",
        });

        sheet.addImage(imageId, {
          tl: { col: 7.15, row: rowNumber - 1 + 0.15 },
          ext: { width: 82, height: 82 },
          editAs: "oneCell",
        });
      }
    }

    const filename = sessionId ? `attendance_${sessionId}.xlsx` : "attendance.xlsx";
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(Buffer.from(buffer));
  });

  // Export PDF (all or by session)
  app.get("/api/export/pdf", authenticate, async (req, res) => {
    const { sessionId } = req.query;
    let records: any[];
    if (sessionId) {
      const session: any = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      if (!canManageSession(req.admin, session)) {
        return res.status(403).json({ error: "You do not have permission to export this session" });
      }
      records = db.prepare("SELECT name, reg_number, session_id, lat, lng, image, submitted_at FROM attendance WHERE session_id = ? ORDER BY submitted_at DESC").all(sessionId);
    } else {
      records = db.prepare(`
        SELECT a.name, a.reg_number, a.session_id, a.lat, a.lng, a.image, a.submitted_at
        FROM attendance a
        JOIN sessions s ON a.session_id = s.id
        WHERE s.created_by_admin_id = ?
        ORDER BY a.submitted_at DESC
      `).all(req.admin.id);
    }

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    res.setHeader("Content-Disposition", `attachment; filename=attendance${sessionId ? `_${sessionId}` : ''}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text("Attendance Report", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#475569").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(1);

    for (const [i, r] of records.entries()) {
      if (doc.y > 650) {
        doc.addPage();
      }

      const startY = doc.y;
      doc.roundedRect(40, startY, 515, 120, 12).fillAndStroke("#F8FAFC", "#CBD5E1");
      doc.fillColor("#0F172A");
      doc.fontSize(14).text(`${i + 1}. ${r.name}`, 58, startY + 16);
      doc.fontSize(11).fillColor("#334155");
      doc.text(`Reg No: ${r.reg_number}`, 58, startY + 40);
      doc.text(`Session: ${r.session_id}`, 58, startY + 58);
      doc.text(`Time: ${new Date(r.submitted_at).toLocaleString()}`, 58, startY + 76, { width: 250 });
      doc.text(`Location: ${Number(r.lat).toFixed(6)}, ${Number(r.lng).toFixed(6)}`, 290, startY + 40, { width: 120 });

      const remoteImageBuffer = await fetchRemoteImageBuffer(r.image);
      const imagePath = getImagePathFromUrl(r.image);
      const imageInput = remoteImageBuffer || (imagePath && fs.existsSync(imagePath) ? imagePath : null);
      if (imageInput) {
        try {
          doc.image(imageInput, 430, startY + 14, { fit: [100, 92], align: "center", valign: "center" });
        } catch (err) {
          doc.fontSize(10).fillColor("#94A3B8").text("Selfie unavailable", 435, startY + 52);
        }
      } else {
        doc.fontSize(10).fillColor("#94A3B8").text("Selfie unavailable", 435, startY + 52);
      }

      doc.y = startY + 136;
    }
    doc.end();
  });

  // --- VITE MIDDLEWARE ---

  if (USE_VITE_DEV_SERVER) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: [
          "smart-attendance-demo.onrender.com",
        ],
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT} (${USE_VITE_DEV_SERVER ? "vite dev" : "static dist"})`);
  });
}

startServer();
type SnippePaymentStatus = "pending" | "completed" | "failed" | "voided" | "expired";

const SNIPPE_API_BASE_URL = "https://api.snippe.sh";
const SNIPPE_API_KEY = process.env.SNIPPE_API_KEY || "";
const SNIPPE_WEBHOOK_SECRET = process.env.SNIPPE_WEBHOOK_SECRET || "";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "";

const normalizeTanzanianPhone = (phoneNumber: unknown) => {
  const digits = String(phoneNumber ?? "").replace(/\D/g, "");
  if (digits.startsWith("255") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `255${digits.slice(1)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
};

const buildSnippeWebhookUrl = (req: any) => {
  if (PUBLIC_BASE_URL) return `${PUBLIC_BASE_URL.replace(/\/$/, "")}/webhooks/snippe`;
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}/webhooks/snippe`;
};

const savePaymentRecord = async (reference: string, record: Record<string, unknown>) => {
  try {
    const adminModule = await import("firebase-admin");
    const adminSdk: any = adminModule.default || adminModule;
    if (!adminSdk.apps?.length) return;

    await adminSdk.firestore().collection("payments").doc(reference).set(
      {
        ...record,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn("Payment record was not saved to Firestore:", error);
  }
};

const verifySnippeWebhook = async (rawPayload: string, headers: any) => {
  if (!SNIPPE_WEBHOOK_SECRET) return true;

  const timestamp = String(headers["x-webhook-timestamp"] || "");
  const signature = String(headers["x-webhook-signature"] || "");
  if (!timestamp || !signature) return false;

  const eventTime = Number.parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(eventTime) || Math.abs(now - eventTime) > 300) return false;

  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", SNIPPE_WEBHOOK_SECRET).update(`${timestamp}.${rawPayload}`).digest("hex");
  const received = Buffer.from(signature);
  const computed = Buffer.from(expected);
  return received.length === computed.length && timingSafeEqual(received, computed);
};

function registerSnippePaymentRoutes(app: any, authenticate: any) {
app.post("/api/payments/snippe/mobile", authenticate, async (req: any, res: any) => {
  try {
    if (!SNIPPE_API_KEY) {
      return res.status(500).json({ error: "Snippe payment is not configured on the server" });
    }

    const amount = Number(req.body?.amount);
    const phoneNumber = normalizeTanzanianPhone(req.body?.phoneNumber);
    const firstname = String(req.body?.firstname || req.body?.firstName || "Customer").trim();
    const lastname = String(req.body?.lastname || req.body?.lastName || "Account").trim();
    const email = String(req.body?.email || "").trim();
    const planId = getSubscriptionPlan(req.body?.planId, amount);
    const userId = String(req.admin?.id || "");

    if (!Number.isInteger(amount) || amount < 500) {
      return res.status(400).json({ error: "Amount must be at least 500 TZS" });
    }

    if (!/^255\d{9}$/.test(phoneNumber)) {
      return res.status(400).json({ error: "Phone number must be a valid Tanzania number, e.g. 255712345678" });
    }

    if (!email) {
      return res.status(400).json({ error: "Customer email is required" });
    }

    if (!planId) {
      return res.status(400).json({ error: "Choose a valid subscription package" });
    }

    const orderId = `ATT-${Date.now().toString(36).toUpperCase()}`;
    const idempotencyKey = orderId.slice(0, 30);
    const payload = {
      payment_type: "mobile",
      details: {
        amount,
        currency: "TZS",
      },
      phone_number: phoneNumber,
      customer: {
        firstname,
        lastname,
        email,
      },
      webhook_url: buildSnippeWebhookUrl(req),
      metadata: {
        order_id: orderId,
        user_id: userId,
        plan_id: planId,
        source: "smart-attendance-system",
      },
    };

    const snippeResponse = await fetch(`${SNIPPE_API_BASE_URL}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SNIPPE_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const result: any = await snippeResponse.json().catch(() => ({}));
    if (!snippeResponse.ok || result.status === "error") {
      return res.status(snippeResponse.status || 400).json({
        error: result.message || "Could not start mobile money payment",
        details: result,
      });
    }

    const reference = result.data?.reference;
    if (reference) {
      await savePaymentRecord(reference, {
        provider: "snippe",
        reference,
        orderId,
        status: result.data?.status || "pending",
        amount,
        currency: "TZS",
        phoneNumber,
        email,
        userId,
        planId,
        createdAt: new Date().toISOString(),
        snippe: result.data,
      });
    }

    return res.status(201).json({
      message: "Payment started. Check your phone and enter your mobile money PIN.",
      payment: result.data,
      orderId,
    });
  } catch (error) {
    console.error("Snippe payment error:", error);
    return res.status(500).json({ error: "Could not start mobile money payment" });
  }
});

app.get("/api/payments/snippe/:reference", authenticate, async (req: any, res: any) => {
  try {
    if (!SNIPPE_API_KEY) {
      return res.status(500).json({ error: "Snippe payment is not configured on the server" });
    }

    const reference = String(req.params.reference || "");
    const snippeResponse = await fetch(`${SNIPPE_API_BASE_URL}/v1/payments/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${SNIPPE_API_KEY}`,
      },
    });

    const result: any = await snippeResponse.json().catch(() => ({}));
    if (!snippeResponse.ok || result.status === "error") {
      return res.status(snippeResponse.status || 400).json({
        error: result.message || "Could not check payment status",
        details: result,
      });
    }

    const status = (result.data?.status || "pending") as SnippePaymentStatus;
    await savePaymentRecord(reference, {
      provider: "snippe",
      reference,
      status,
      snippe: result.data,
    });

    if (status === "completed") {
      await activateAdminSubscription(result.data?.metadata?.user_id || req.admin?.id, result.data?.metadata?.plan_id, reference);
    }

    return res.json({ payment: result.data });
  } catch (error) {
    console.error("Snippe status error:", error);
    return res.status(500).json({ error: "Could not check payment status" });
  }
});

app.post("/webhooks/snippe", async (req: any, res: any) => {
  try {
    const rawPayload = req.rawBody || (Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body || {}));
    const isVerified = await verifySnippeWebhook(rawPayload, req.headers);
    if (!isVerified) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const event = Buffer.isBuffer(req.body) ? JSON.parse(rawPayload) : req.body;
    const type = event?.type || event?.event;
    const data = event?.data || event;
    const reference = data?.reference;

    if (reference) {
      const status =
        type === "payment.completed"
          ? "completed"
          : type === "payment.failed"
            ? "failed"
            : type === "payment.voided"
              ? "voided"
              : type === "payment.expired"
                ? "expired"
                : data?.status || "pending";

      await savePaymentRecord(reference, {
        provider: "snippe",
        reference,
        status,
        webhookType: type,
        snippe: data,
        completedAt: data?.completed_at || null,
      });

      if (status === "completed") {
        await activateAdminSubscription(data?.metadata?.user_id, data?.metadata?.plan_id, reference);
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Snippe webhook error:", error);
    return res.status(500).json({ error: "Webhook handling failed" });
  }
});
};
