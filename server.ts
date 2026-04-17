import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
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
// import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("attendance.db");
const NODE_ENV = process.env.NODE_ENV || "development";
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "Mikanu";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME || "narjabdul@gmail.com";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "narj@2003";
const PORT = Number(process.env.PORT || 3001);
const IS_PRODUCTION = NODE_ENV === "production";
const ADMIN_COOKIE_NAME = "admin_token";

if (!JWT_SECRET) {
  if (IS_PRODUCTION) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }
  console.warn("JWT_SECRET is not set. Using an insecure development fallback.");
}

if (!ADMIN_PASSWORD) {
  if (IS_PRODUCTION) {
    throw new Error("Missing required environment variable: ADMIN_PASSWORD");
  }
  console.warn("ADMIN_PASSWORD is not set. Using insecure development bootstrap credentials.");
}

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
  const columns: Array<{ name: string }> = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

ensureColumn("admins", "role", "TEXT NOT NULL DEFAULT 'admin'");
ensureColumn("admins", "approved", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("admins", "is_locked", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("admins", "locked_until", "DATETIME");
ensureColumn("admins", "created_at", "DATETIME");
ensureColumn("sessions", "created_by_admin_id", "INTEGER");
ensureColumn("sessions", "deleted_at", "DATETIME");
db.prepare("UPDATE admins SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)").run();
db.prepare("UPDATE admins SET approved = 1 WHERE role = 'super_admin' OR username = ?").run(ADMIN_USERNAME);

// Seed Admin if not exists
const bootstrapAdminPassword = ADMIN_PASSWORD || "Mikanu@2026";
const adminExists = db.prepare("SELECT * FROM admins WHERE username = ?").get(ADMIN_USERNAME);
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync(bootstrapAdminPassword, 10);
  db.prepare("INSERT INTO admins (username, password, role, approved) VALUES (?, ?, 'admin', 1)").run(ADMIN_USERNAME, hashedPassword);
}
const superAdminExists = db.prepare("SELECT * FROM admins WHERE username = ?").get(SUPER_ADMIN_USERNAME);
if (!superAdminExists) {
  const hashedPassword = bcrypt.hashSync(SUPER_ADMIN_PASSWORD, 10);
  db.prepare("INSERT INTO admins (username, password, role, approved) VALUES (?, ?, 'super_admin', 1)").run(SUPER_ADMIN_USERNAME, hashedPassword);
} else if (superAdminExists.role !== "super_admin") {
  db.prepare("UPDATE admins SET role = 'super_admin', approved = 1 WHERE username = ?").run(SUPER_ADMIN_USERNAME);
}

async function startServer() {
  const app = express();
  // const options = {
  //   key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  //   cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
  // };
  const ATTENDANCE_DIR = path.join(process.cwd(), "attendance");
  const loginAttempts = new Map<string, { count: number; firstAttemptAt: number }>();
  const publicRateLimits = new Map<string, { count: number; firstRequestAt: number }>();

  // Create attendance directory if it doesn't exist
  if (!fs.existsSync(ATTENDANCE_DIR)) {
    fs.mkdirSync(ATTENDANCE_DIR, { recursive: true });
  }

  app.use(express.json({ limit: "6mb" }));

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
      `Max-Age=${10 * 60}`,
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
      return jwt.verify(token, JWT_SECRET || "dev-only-jwt-secret");
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

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const decoded = authenticateFromRequest(req);
    if (!decoded) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    const admin: any = db.prepare("SELECT id, username, role, approved, is_locked, locked_until FROM admins WHERE id = ?").get((decoded as any).id);
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
    if (admin.approved !== 1) {
      clearAuthCookie(res);
      res.status(403).json({ error: "Account not yet approved. Please contact 0694 128 543" });
      return;
    }
    req.admin = admin;
    next();
  };

  const requireSuperAdmin = (req: any, res: any, next: any) => {
    if (req.admin?.role !== "super_admin") {
      return res.status(403).json({ error: "Super admin access required" });
    }
    next();
  };

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
    if (admin && admin.approved !== 1) {
      return res.status(403).json({ error: "Account not yet approved. Please contact 0694 128 543" });
    }
    if (admin && bcrypt.compareSync(password, admin.password)) {
      loginAttempts.delete(clientIp);
      const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, JWT_SECRET || "dev-only-jwt-secret", { expiresIn: "10m" });
      setAuthCookie(res, token);
      res.json({
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          role: admin.role,
          approved: admin.approved,
          is_locked: admin.is_locked,
          locked_until: admin.locked_until,
        },
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
    db.prepare("INSERT INTO admins (username, password, role, approved) VALUES (?, ?, 'admin', 0)").run(username.trim(), hashedPassword);
    res.json({ success: true, message: "Wait for Aproval" });
  });

  app.get("/api/admin/me", authenticate, (req: any, res) => {
    res.json({ id: req.admin.id, username: req.admin.username, role: req.admin.role, approved: req.admin.approved, is_locked: req.admin.is_locked, locked_until: req.admin.locked_until });
  });

  app.post("/api/admin/logout", (_req, res) => {
    clearAuthCookie(res);
    res.json({ success: true });
  });

  app.get("/api/admin/users", authenticate, requireSuperAdmin, (_req, res) => {
    const admins = db.prepare("SELECT id, username, role, approved, is_locked, locked_until, created_at FROM admins ORDER BY approved ASC, role DESC, created_at ASC").all();
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
    db.prepare("INSERT INTO admins (username, password, role, approved) VALUES (?, ?, ?, 1)").run(username.trim(), hashedPassword, role);
    res.json({ success: true });
  });

  app.patch("/api/admin/users/:id/approve", authenticate, requireSuperAdmin, (req: any, res) => {
    const { id } = req.params;
    const target: any = db.prepare("SELECT id, role FROM admins WHERE id = ?").get(id);
    if (!target) {
      return res.status(404).json({ error: "Admin user not found" });
    }
    if (target.role === "super_admin") {
      return res.status(403).json({ error: "Super admin accounts are already approved" });
    }
    db.prepare("UPDATE admins SET approved = 1 WHERE id = ?").run(id);
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
    clearAuthCookie(res);
    res.json({ success: true, message: "Password changed successfully. Please log in again." });
  });

  // Create Session
  app.post("/api/sessions", authenticate, (req, res) => {
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
    res.json({ id });
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
  app.post("/api/public/submit", (req, res) => {
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

    // Create session folder if it doesn't exist
    const sessionDir = path.join(ATTENDANCE_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Save image to session folder
    const timestamp = Date.now();
    const safeRegNumber = String(regNumber || "student").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${timestamp}-${safeRegNumber}.jpg`;
    const imagePath = path.join(sessionDir, filename);
    const imageUrl = `/api/attendance-images/${sessionId}/${filename}`;

    try {
      // Convert base64 to buffer and save
      const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(imagePath, buffer);
    } catch (err) {
      return res.status(500).json({ error: "Failed to save image" });
    }

    // Save record with image URL path
    try {
      db.prepare("INSERT INTO attendance (session_id, name, reg_number, image, lat, lng, device_fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(sessionId, name.trim(), normalizedRegNumber, imageUrl, lat, lng, deviceHash);
    } catch (err: any) {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      if (String(err?.message || "").includes("UNIQUE")) {
        return res.status(409).json({ error: "Attendance already submitted" });
      }
      return res.status(500).json({ error: "Failed to save attendance" });
    }

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
      total = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE session_id = ?").get(sessionId).count;
      records = db.prepare(`SELECT * FROM attendance WHERE session_id = ? ORDER BY submitted_at DESC LIMIT ? OFFSET ?`).all(sessionId, pageSize, offset);
    } else {
      total = db.prepare(`
        SELECT COUNT(*) as count
        FROM attendance a
        JOIN sessions s ON a.session_id = s.id
        WHERE s.created_by_admin_id = ?
      `).get(req.admin.id).count;
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
  app.delete("/api/attendance/:id", authenticate, (req, res) => {
    const { id } = req.params;
    const record: any = db.prepare("SELECT * FROM attendance WHERE id = ?").get(id);
    if (!record) {
      return res.status(404).json({ error: "Attendance record not found" });
    }
    const session: any = db.prepare("SELECT * FROM sessions WHERE id = ?").get(record.session_id);
    if (!session || !canManageSession(req.admin, session)) {
      return res.status(403).json({ error: "You do not have permission to delete this attendance record" });
    }

    if (record && record.image) {
      // Delete image file if it exists
      try {
        // Extract filename from URL path
        const urlParts = record.image.split("/api/attendance-images/");
        if (urlParts.length > 1) {
          const imagePath = path.join(ATTENDANCE_DIR, urlParts[1]);
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        }
      } catch (err) {
        console.error("Failed to delete image file:", err);
      }
    }

    db.prepare("DELETE FROM attendance WHERE id = ?").run(id);
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

    records.forEach((record, index) => {
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

      const imagePath = getImagePathFromUrl(record.image);
      if (imagePath && fs.existsSync(imagePath)) {
        const extension = path.extname(imagePath).replace(".", "").toLowerCase() || "jpeg";
        const imageId = workbook.addImage({
          filename: imagePath,
          extension: extension === "jpg" ? "jpeg" : extension as "jpeg" | "png" | "gif",
        });

        sheet.addImage(imageId, {
          tl: { col: 7.15, row: rowNumber - 1 + 0.15 },
          ext: { width: 82, height: 82 },
          editAs: "oneCell",
        });
      }
    });

    const filename = sessionId ? `attendance_${sessionId}.xlsx` : "attendance.xlsx";
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(Buffer.from(buffer));
  });

  // Export PDF (all or by session)
  app.get("/api/export/pdf", authenticate, (req, res) => {
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

    records.forEach((r, i) => {
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

      const imagePath = getImagePathFromUrl(r.image);
      if (imagePath && fs.existsSync(imagePath)) {
        try {
          doc.image(imagePath, 430, startY + 14, { fit: [100, 92], align: "center", valign: "center" });
        } catch (err) {
          doc.fontSize(10).fillColor("#94A3B8").text("Selfie unavailable", 435, startY + 52);
        }
      } else {
        doc.fontSize(10).fillColor("#94A3B8").text("Selfie unavailable", 435, startY + 52);
      }

      doc.y = startY + 136;
    });
    doc.end();
  });

  // --- VITE MIDDLEWARE ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
