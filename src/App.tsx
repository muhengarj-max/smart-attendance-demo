import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, 
  MapPin, 
  User, 
  IdCard, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  Download, 
  Link as LinkIcon,
  Eye,
  EyeOff,
  RefreshCw
} from "lucide-react";

// --- Types ---
interface Session {
  id: string;
  name?: string;
  lat: number;
  lng: number;
  radius: number;
  expires_at: string;
  is_active: number;
  deleted_at?: string | null;
  created_at: string;
}

interface AttendanceRecord {
  id: number;
  session_id: string;
  name: string;
  reg_number: string;
  image: string;
  lat: number;
  lng: number;
  submitted_at: string;
}

interface CurrentAdmin {
  id: number;
  username: string;
  role: "admin" | "super_admin";
  approved: number;
  is_locked: number;
  locked_until?: string | null;
}

interface AdminUser {
  id: number;
  username: string;
  role: "admin" | "super_admin";
  approved: number;
  is_locked: number;
  locked_until?: string | null;
  created_at: string;
}

const AppFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-8 text-center text-sm text-slate-500">
      <p>Copyright © {currentYear} Designed By Narj Muhenga. All rights reserved.</p>
    </footer>
  );
};

class SecureDeviceFingerprint {
  static getWebGLInfo() {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") ||
        (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

      if (!gl) return { vendor: "unavailable", renderer: "unavailable" };

      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info") as {
        UNMASKED_VENDOR_WEBGL: number;
        UNMASKED_RENDERER_WEBGL: number;
      } | null;

      return debugInfo
        ? {
            vendor: String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)),
            renderer: String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)),
          }
        : {
            vendor: String(gl.getParameter(gl.VENDOR) || "unknown"),
            renderer: String(gl.getParameter(gl.RENDERER) || "unknown"),
          };
    } catch {
      return { vendor: "unavailable", renderer: "unavailable" };
    }
  }

  static async sha256Hash(value: string) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  static async generateFingerprint() {
    const webgl = this.getWebGLInfo();
    const fingerprintData = {
      // Keep this browser-independent so Chrome/Firefox on the same phone match.
      language: navigator.language,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory || "unknown",
      maxTouchPoints: navigator.maxTouchPoints,
      screenResolution: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      availableScreen: `${screen.availWidth}x${screen.availHeight}`,
      pixelRatio: window.devicePixelRatio || 1,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      webglVendor: webgl.vendor,
      webglRenderer: webgl.renderer,
    };

    return this.sha256Hash(JSON.stringify(fingerprintData));
  }

  static async getDeviceId() {
    return this.generateFingerprint();
  }
}

// --- Components ---

const AdminLogin = ({
  onLogin,
  sessionMessage,
  onDismissSessionMessage,
}: {
  onLogin: (admin: CurrentAdmin) => void;
  sessionMessage: string | null;
  onDismissSessionMessage: () => void;
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(isSignup ? "/api/admin/register" : "/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && isSignup) {
        setSuccess(data.message || "Wait for Aproval");
        setUsername("");
        setPassword("");
        setIsSignup(false);
      } else if (res.ok) {
        onLogin(data.admin);
      } else {
        setError(data.error || (isSignup ? "Signup failed" : "Login failed"));
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/20"
      >
        <div className="text-center mb-8">
          <div className="bg-blue-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/50">
            <LayoutDashboard className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
          <p className="text-blue-200/60">{isSignup ? "Create account and wait for Super Admin approval" : "Secure access to Smart Attendance"}</p>
        </div>

        <AnimatePresence>
          {sessionMessage && (
            <motion.div
              key="session-expired"
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="mb-6 overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-300/20 via-orange-400/15 to-rose-400/20 p-4 shadow-lg shadow-amber-900/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100">Session Ended</p>
                  <h2 className="mt-1 text-lg font-bold text-white">Login again to continue</h2>
                  <p className="mt-1 text-sm leading-5 text-amber-50/80">{sessionMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={onDismissSessionMessage}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                  Close
                </button>
              </div>
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 5, ease: "linear" }}
                className="mt-4 h-1 origin-left rounded-full bg-gradient-to-r from-amber-200 via-orange-300 to-rose-300"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-blue-100 mb-2">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300 w-5 h-5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-blue-300/30 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Enter username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-100 mb-2">Password</label>
            <div className="relative">
              <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300 w-5 h-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-blue-300/30 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Enter password"
                required
              />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-500/20 border border-red-500/50 p-3 rounded-xl flex items-center gap-2 text-red-200 text-sm"
            >
              <AlertCircle className="w-4 h-4" />
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-emerald-500/20 border border-emerald-400/50 p-3 rounded-xl flex items-center gap-2 text-emerald-100 text-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              {success}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isSignup ? "Create Account" : "Sign In"}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignup((value) => !value);
              setError("");
              setSuccess("");
            }}
            className="w-full text-sm font-semibold text-blue-100/80 hover:text-white"
          >
            {isSignup ? "Already approved? Sign in" : "Need an account? Register for approval"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const AdminDashboard = ({
  currentAdmin,
  onLogout,
  welcomeName,
  onWelcomeSeen,
}: {
  currentAdmin: CurrentAdmin;
  onLogout: () => void;
  welcomeName: string | null;
  onWelcomeSeen: () => void;
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [newSession, setNewSession] = useState({ name: "", lat: "", lng: "", radius: "50", minutes: "60" });
  const [newAdmin, setNewAdmin] = useState({ username: "", password: "", role: "admin" as "admin" });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [activeTab, setActiveTab] = useState<"sessions" | "records" | "admins" | "account">("sessions");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchAdmins = async () => {
    if (currentAdmin.role !== "super_admin") {
      return;
    }

    const res = await fetch("/api/admin/users", { credentials: "include" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Failed to load admin users");
    }

    const data = await res.json();
    setAdminUsers(data);
  };

  const handleDeleteSession = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this session?")) return;
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to delete session");
        return;
      }

      if (selectedSession?.id === id) {
        setSelectedSession((current) => current ? { ...current, is_active: 0, deleted_at: new Date().toISOString() } : current);
      }
      fetchData(selectedSession?.id, page);
    } catch {
      alert("Failed to delete session");
    }
  };

  const downloadExport = async (format: "pdf" | "excel", sessionId?: string) => {
    try {
      const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
      const res = await fetch(`/api/export/${format}${query}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || `Failed to download ${format.toUpperCase()}`);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const extension = format === "excel" ? "xlsx" : "pdf";
      link.href = url;
      link.download = sessionId ? `attendance_${sessionId}.${extension}` : `attendance.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Failed to download ${format.toUpperCase()}`);
    }
  };

  const fetchData = async (sessionId?: string, nextPage = page) => {
    try {
      const sRes = await fetch("/api/sessions", { credentials: "include" });
      if (!sRes.ok) {
        throw new Error("Failed to load sessions");
      }
      const sData = await sRes.json();
      setSessions(sData);
      const allSessionsRes = await fetch("/api/sessions?includeDeleted=1", { credentials: "include" });
      if (!allSessionsRes.ok) {
        throw new Error("Failed to load session archive");
      }
      const allSessionsData = await allSessionsRes.json();
      setAllSessions(allSessionsData);
      if (!sessionId) {
        setRecords([]);
        setPage(1);
        setTotalPages(1);
        setTotalRecords(0);
        await fetchAdmins();
        return;
      }
      let rUrl = "/api/attendance";
      const query = new URLSearchParams({
        page: String(nextPage),
        pageSize: "25",
      });
      query.set("sessionId", sessionId);
      rUrl += `?${query.toString()}`;
      const rRes = await fetch(rUrl, { credentials: "include" });
      if (!rRes.ok) {
        throw new Error("Failed to load attendance records");
      }
      const rData = await rRes.json();
      setRecords(rData.records || []);
      setPage(rData.page || 1);
      setTotalPages(rData.totalPages || 1);
      setTotalRecords(rData.total || 0);
      await fetchAdmins();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedSession?.id, page);
  }, [currentAdmin.id, currentAdmin.role, selectedSession, page]);

  useEffect(() => {
    if (!welcomeName) return;

    const timer = window.setTimeout(() => {
      onWelcomeSeen();
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [welcomeName, onWelcomeSeen]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newSession.name,
          lat: parseFloat(newSession.lat),
          lng: parseFloat(newSession.lng),
          radius: parseFloat(newSession.radius),
          minutes: parseInt(newSession.minutes)
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowCreate(false);
        setCreatedSessionId(data.id);
        setPage(1);
        fetchData(selectedSession?.id, 1);
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to create session");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create session");
    }
  };

  const toggleSession = async (id: string, current: number) => {
    try {
      const res = await fetch(`/api/sessions/${id}/toggle`, {
        method: "PATCH",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: !current }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to update session");
        return;
      }
      fetchData(selectedSession?.id, page);
    } catch (err) {
      console.error(err);
      alert("Failed to update session");
    }
  };

  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setNewSession(prev => ({ ...prev, lat: pos.coords.latitude.toString(), lng: pos.coords.longitude.toString() }));
    }, () => {
      alert("Unable to get current location");
    });
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAdmin),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to create admin user");
        return;
      }

      setNewAdmin({ username: "", password: "", role: "admin" });
      fetchAdmins();
    } catch {
      alert("Failed to create admin user");
    }
  };

  const handleDeleteAdmin = async (id: number) => {
    if (!window.confirm("Delete this admin account?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to delete admin user");
        return;
      }
      fetchAdmins();
    } catch {
      alert("Failed to delete admin user");
    }
  };

  const handleLockAdmin = async (id: number) => {
    if (!window.confirm("Lock this admin account until you manually unlock it?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}/lock`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to lock admin user");
        return;
      }
      fetchAdmins();
    } catch {
      alert("Failed to lock admin user");
    }
  };

  const handleUnlockAdmin = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/unlock`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to unlock admin user");
        return;
      }
      fetchAdmins();
    } catch {
      alert("Failed to unlock admin user");
    }
  };

  const handleApproveAdmin = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/approve`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to approve admin user");
        return;
      }
      fetchAdmins();
    } catch {
      alert("Failed to approve admin user");
    }
  };

  const handleResetAdminPassword = async (id: number, username: string) => {
    const newPassword = window.prompt(`Enter a new password for ${username}`);
    if (!newPassword) return;

    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${id}/password`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to reset admin password");
        return;
      }
      alert(`Password updated for ${username}`);
    } catch {
      alert("Failed to reset admin password");
    }
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      alert("New password and confirm password do not match.");
      return;
    }

    try {
      const res = await fetch("/api/admin/change-password", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || "Failed to change password");
        return;
      }
      alert(data?.message || "Password changed successfully. Please log in again.");
      onLogout();
    } catch {
      alert("Failed to change password");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar / Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <LayoutDashboard className="text-white w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-slate-900 hidden sm:block">Smart Attendance</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 px-4 py-2 text-right shadow-sm sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">Signed In As</p>
              <p className="text-sm font-bold text-slate-900">{currentAdmin.username}</p>
            </div>
            <button 
              onClick={() => setShowCreate(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              New Session
            </button>
            <button 
              onClick={onLogout}
              className="text-slate-500 hover:text-red-600 p-2 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <AnimatePresence>
          {welcomeName && (
            <motion.div
              key="welcome-banner"
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="mb-6 overflow-hidden rounded-3xl border border-blue-100 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.2),_transparent_38%),linear-gradient(135deg,#eff6ff_0%,#ffffff_45%,#ecfeff_100%)] p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">Welcome Back</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">{welcomeName}</h2>
                  <p className="mt-1 text-sm text-slate-600">Your dashboard is ready. Continue managing sessions and attendance smoothly.</p>
                </div>
                <button
                  onClick={onWelcomeSeen}
                  className="rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-500 transition-colors hover:text-blue-600"
                >
                  Close
                </button>
              </div>
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 4, ease: "linear" }}
                className="mt-4 h-1 origin-left rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-200">
          <button 
            onClick={() => setActiveTab("sessions")}
            className={`pb-3 px-2 text-sm font-medium transition-all relative ${activeTab === "sessions" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            Sessions
            {activeTab === "sessions" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
          <button 
            onClick={() => setActiveTab("records")}
            className={`pb-3 px-2 text-sm font-medium transition-all relative ${activeTab === "records" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            Attendance Records
            {activeTab === "records" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
          <button 
            onClick={() => setActiveTab("account")}
            className={`pb-3 px-2 text-sm font-medium transition-all relative ${activeTab === "account" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            My Account
            {activeTab === "account" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
          {currentAdmin.role === "super_admin" && (
            <button 
              onClick={() => setActiveTab("admins")}
              className={`pb-3 px-2 text-sm font-medium transition-all relative ${activeTab === "admins" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              Admin Users
              {activeTab === "admins" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
            </button>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          <label className="font-medium">Session:</label>
          <select
            value={selectedSession?.id || ""}
            onChange={e => {
              const sid = e.target.value;
              setPage(1);
              setSelectedSession(allSessions.find(s => s.id === sid) || null);
            }}
            className="border rounded px-2 py-1"
          >
            <option value="">Choose Session</option>
            {allSessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.name || s.id}{s.deleted_at ? " (deleted - records only)" : ""}
              </option>
            ))}
          </select>
          {selectedSession && (
            <button
              onClick={() => downloadExport("pdf", selectedSession.id)}
              className="ml-2 p-2 text-red-600 hover:text-red-800 border border-red-200 rounded transition-colors"
              title="Download PDF for this session"
            >
              <Download className="w-5 h-5" /> PDF
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === "sessions" ? (
              <motion.div 
                key="sessions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {sessions.map((s) => (
                  <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{s.name || `Session ${s.id}`}</h3>
                        <p className="text-xs text-slate-500">Created {new Date(s.created_at).toLocaleString()}</p>
                      </div>
                      <button 
                        onClick={() => toggleSession(s.id, s.is_active)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {s.is_active ? "Active" : "Disabled"}
                      </button>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                        <span>Radius: {s.radius * 1000}m</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <AlertCircle className="w-4 h-4 text-slate-400" />
                        <span>Expires: {new Date(s.expires_at).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedSession(s);
                          setPage(1);
                          setActiveTab("records");
                        }}
                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        View Records
                      </button>
                      <button 
                        onClick={() => {
                          // Use current domain for link
                          const url = `${window.location.origin}/attendance/${s.id}`;
                          navigator.clipboard.writeText(url);
                          alert("Link copied to clipboard!");
                        }}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <LinkIcon className="w-4 h-4" />
                        Copy
                      </button>
                      <button
                        onClick={() => handleDeleteSession(s.id)}
                        className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : activeTab === "records" ? (
              <motion.div 
                key="records"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
              >
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-900">
                    {selectedSession ? `${selectedSession.name || selectedSession.id}${selectedSession.deleted_at ? " (deleted session)" : ""} Records (${totalRecords})` : "Choose a session to view records"}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadExport("excel", selectedSession?.id)}
                      disabled={!selectedSession}
                      className="p-2 text-slate-600 hover:text-blue-600 transition-colors"
                      title="Export Excel"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => downloadExport("pdf", selectedSession?.id)}
                      disabled={!selectedSession}
                      className="p-2 text-slate-600 hover:text-red-600 transition-colors"
                      title="Export PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {!selectedSession ? (
                  <div className="p-10 text-center text-slate-500">
                    Select a session from the dropdown above or click View Records on a session card.
                  </div>
                ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 font-semibold">Student</th>
                        <th className="px-6 py-4 font-semibold">Reg Number</th>
                        <th className="px-6 py-4 font-semibold">Session</th>
                        <th className="px-6 py-4 font-semibold">Time</th>
                        <th className="px-6 py-4 font-semibold">Location</th>
                        <th className="px-6 py-4 font-semibold">Selfie</th>
                        <th className="px-6 py-4 font-semibold">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">{r.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{r.reg_number}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{r.session_id}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{new Date(r.submitted_at).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{r.lat.toFixed(4)}, {r.lng.toFixed(4)}</td>
                          <td className="px-6 py-4">
                            <img src={r.image} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={async () => {
                                if (!window.confirm("Delete this attendance record?")) return;
                                const res = await fetch(`/api/attendance/${r.id}`, {
                                  method: "DELETE",
                                  credentials: "include",
                                });
                                if (!res.ok) {
                                  const data = await res.json().catch(() => null);
                                  alert(data?.error || "Failed to delete attendance record");
                                  return;
                                }
                                fetchData(selectedSession?.id, page);
                              }}
                              className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-xs font-bold"
                            >Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
                  <p className="text-sm text-slate-500">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page <= 1}
                      className="rounded border border-slate-200 px-3 py-1 text-sm text-slate-600 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page >= totalPages}
                      className="rounded border border-slate-200 px-3 py-1 text-sm text-slate-600 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === "admins" ? (
              <motion.div
                key="admins"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-bold text-slate-900">Create Admin User</h3>
                  <form onSubmit={handleCreateAdmin} className="grid gap-4 md:grid-cols-3">
                    <input
                      type="email"
                      value={newAdmin.username}
                      onChange={(e) => setNewAdmin((prev) => ({ ...prev, username: e.target.value }))}
                      placeholder="Email / username"
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      required
                    />
                    <input
                      type="password"
                      value={newAdmin.password}
                      onChange={(e) => setNewAdmin((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Password"
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      required
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"
                    >
                      Create Admin
                    </button>
                  </form>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                    <h3 className="font-bold text-slate-900">Admin Accounts ({adminUsers.length})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">Username</th>
                          <th className="px-6 py-4 font-semibold">Role</th>
                          <th className="px-6 py-4 font-semibold">Approval</th>
                          <th className="px-6 py-4 font-semibold">Status</th>
                          <th className="px-6 py-4 font-semibold">Locked Until</th>
                          <th className="px-6 py-4 font-semibold">Created</th>
                          <th className="px-6 py-4 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {adminUsers.map((adminUser) => (
                          <tr key={adminUser.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">{adminUser.username}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">{adminUser.role === "super_admin" ? "Super Admin" : "Admin"}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">{adminUser.approved ? "Approved" : "Pending"}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">{adminUser.is_locked ? "Locked" : "Active"}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{adminUser.is_locked ? "Manual unlock required" : "-"}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{new Date(adminUser.created_at).toLocaleString()}</td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                {adminUser.role !== "super_admin" && (
                                  <>
                                    {!adminUser.approved && (
                                      <button
                                        onClick={() => handleApproveAdmin(adminUser.id)}
                                        className="rounded bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                                      >
                                        Approve
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleResetAdminPassword(adminUser.id, adminUser.username)}
                                      className="rounded bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                                    >
                                      Reset Password
                                    </button>
                                    {adminUser.is_locked ? (
                                      <button
                                        onClick={() => handleUnlockAdmin(adminUser.id)}
                                        className="rounded bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                                      >
                                        Unlock
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleLockAdmin(adminUser.id)}
                                        className="rounded bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700"
                                      >
                                        Lock
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteAdmin(adminUser.id)}
                                      className="rounded bg-red-100 px-3 py-1 text-xs font-bold text-red-700"
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl"
              >
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="mb-2 text-lg font-bold text-slate-900">Change Password</h3>
                  <p className="mb-6 text-sm text-slate-500">
                    Username: {currentAdmin.username}
                  </p>
                  <form onSubmit={handleChangeOwnPassword} className="space-y-4">
                    <input
                      type="password"
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, oldPassword: e.target.value }))}
                      placeholder="Old password"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      required
                    />
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="New password"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      required
                    />
                    <input
                      type="password"
                      value={passwordForm.confirmNewPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmNewPassword: e.target.value }))}
                      placeholder="Confirm new password"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      required
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white"
                    >
                      Update Password
                    </button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
      <div className="max-w-7xl mx-auto px-4 pb-6 sm:px-6">
        <AppFooter />
      </div>

      {/* Create Session Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md relative shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Create Session</h2>
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Session Name</label>
                    <input 
                      type="text" required
                      value={newSession.name}
                      onChange={(e) => setNewSession(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Latitude</label>
                    <input 
                      type="number" step="any" required
                      value={newSession.lat}
                      onChange={(e) => setNewSession(prev => ({ ...prev, lat: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Longitude</label>
                    <input 
                      type="number" step="any" required
                      value={newSession.lng}
                      onChange={(e) => setNewSession(prev => ({ ...prev, lng: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm"
                    />
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={getCurrentLocation}
                  className="w-full text-blue-600 text-sm font-bold flex items-center justify-center gap-2 py-2 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  Use Current Location
                </button>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Radius (meters)</label>
                  <input 
                    type="number" required
                    value={newSession.radius}
                    onChange={(e) => setNewSession(prev => ({ ...prev, radius: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expiry (minutes)</label>
                  <input 
                    type="number" required
                    value={newSession.minutes}
                    onChange={(e) => setNewSession(prev => ({ ...prev, minutes: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all active:scale-95"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Show generated link after creation */}
      <AnimatePresence>
        {createdSessionId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreatedSessionId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md relative shadow-2xl text-center"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Session Link</h2>
              <div className="mb-4 break-all text-blue-700 font-mono text-sm">
                {`${window.location.origin}/attendance/${createdSessionId}`}
              </div>
              <button
                className="bg-blue-600 text-white font-bold py-2 px-6 rounded-xl hover:bg-blue-700 transition-all mb-2"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/attendance/${createdSessionId}`);
                  alert('Link copied to clipboard!');
                }}
              >
                Copy Link
              </button>
              <button
                className="block w-full mt-2 bg-slate-100 text-slate-700 font-bold py-2 rounded-xl hover:bg-slate-200 transition-colors"
                onClick={() => setCreatedSessionId(null)}
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AttendancePage = ({ sessionId }: { sessionId: string }) => {
  const [step, setStep] = useState<"info" | "camera" | "submitting" | "success" | "error">("info");
  const [sessionData, setSessionData] = useState<any>(null);
  const [name, setName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "ready">("idle");
  const [fingerprintReady, setFingerprintReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraStartAttemptRef = useRef(0);
  const deviceFingerprintRef = useRef<string>("");

  const getVerificationLockKey = (normalizedRegNumber: string) => `__ATTENDANCE_LOCK_${sessionId}_${normalizedRegNumber}__`;

  const normalizeRegNumber = (value: string) => value.trim().toUpperCase();

  const setTemporaryVerificationLock = (normalizedRegNumber: string, deviceId: string) => {
    sessionStorage.setItem(
      getVerificationLockKey(normalizedRegNumber),
      JSON.stringify({
        deviceId,
        locked: true,
        permanent: false,
        timestamp: Date.now(),
      }),
    );
  };

  const setPermanentVerificationLock = (normalizedRegNumber: string, deviceId: string) => {
    const payload = JSON.stringify({
      deviceId,
      locked: true,
      permanent: true,
      verifiedAt: Date.now(),
    });
    sessionStorage.setItem(getVerificationLockKey(normalizedRegNumber), payload);
    localStorage.setItem(getVerificationLockKey(normalizedRegNumber), payload);
  };

  const isLocallyLocked = (normalizedRegNumber: string, deviceId: string) => {
    const localLock = localStorage.getItem(getVerificationLockKey(normalizedRegNumber));
    if (!localLock) return false;

    try {
      const parsed = JSON.parse(localLock);
      return parsed.deviceId === deviceId && parsed.locked === true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/public/sessions/${sessionId}`);
        const data = await res.json();
        if (res.ok) {
          setSessionData(data);
        } else {
          setError(data.error);
          setStep("error");
        }
      } catch (err) {
        setError("Network error");
        setStep("error");
      }
    };
    fetchSession();

    SecureDeviceFingerprint.getDeviceId()
      .then((deviceId) => {
        deviceFingerprintRef.current = deviceId;
        setFingerprintReady(true);
      })
      .catch(() => {
        setError("Could not initialize secure device verification.");
        setStep("error");
      });

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setError("Session timed out. Please refresh.");
          setStep("error");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionId]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraState("idle");
  };

  const waitForVideoElement = async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (videoRef.current) {
        return videoRef.current;
      }

      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    }

    return null;
  };

  // Start camera when step changes to 'camera'
  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      const attemptId = ++cameraStartAttemptRef.current;

      try {
        setCameraState("starting");
        setError("");

        const video = await waitForVideoElement();
        if (!video || cancelled || attemptId !== cameraStartAttemptRef.current) {
          return;
        }

        stopCamera();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 1280 },
            aspectRatio: { ideal: 1 }
          }
        });

        if (cancelled || step !== "camera" || attemptId !== cameraStartAttemptRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        video.srcObject = stream;

        await new Promise<void>((resolve, reject) => {
          if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            resolve();
            return;
          }

          const onLoadedMetadata = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error("Video metadata failed to load"));
          };
          const cleanup = () => {
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            video.removeEventListener("error", onError);
          };

          video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
          video.addEventListener("error", onError, { once: true });
        });

        try {
          await video.play();
        } catch {
          // Ignore autoplay failures on mobile; user interaction already exists.
        }
        if (!cancelled && attemptId === cameraStartAttemptRef.current) {
          setCameraState("ready");
        }
      } catch (err) {
        if (!cancelled && attemptId === cameraStartAttemptRef.current) {
          setError("Camera access denied or not supported on this device/browser.");
          setStep("error");
        }
      }
    };

    if (step === "camera") {
      startCamera();
    } else {
      stopCamera();
    }

    // Cleanup: stop camera when leaving camera step
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [step]);

  const captureImage = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (!context) {
        alert("Canvas context not available!");
        return;
      }
      if (cameraState !== "ready" || !videoRef.current.videoWidth || !videoRef.current.videoHeight) {
        setError("Camera is still initializing. Please wait a moment and try again.");
        return;
      }

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      const capturedImage = canvasRef.current.toDataURL("image/jpeg", 0.92);
      setImage(capturedImage);
      // Stop stream
      stopCamera();
      // Pass the captured image to handleSubmit
      await handleSubmitWithImage(capturedImage);
    } else {
      setError("Camera not ready. Please reopen camera and try again.");
    }
  };

  const handleSubmitWithImage = async (capturedImage: string) => {
    setStep("submitting");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const normalizedRegNumber = normalizeRegNumber(regNumber);

        if (isLocallyLocked(normalizedRegNumber, deviceFingerprintRef.current)) {
          setError("This device has already completed attendance for this registration number.");
          setStep("error");
          return;
        }

        const res = await fetch("/api/public/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            name,
            regNumber,
            image: capturedImage,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            deviceFingerprint: deviceFingerprintRef.current
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok) {
          setPermanentVerificationLock(normalizedRegNumber, deviceFingerprintRef.current);
          setStep("success");
        } else {
          setError(data?.error || "Submission failed");
          setStep("error");
        }
      } catch (err) {
        setError("Submission failed");
        setStep("error");
      }
    }, (err) => {
      setError("Location access required for attendance");
      setStep("error");
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  };

  const handleSubmit = async () => {
    // This is now handled by handleSubmitWithImage
  };

  const handleContinueToCamera = async () => {
    try {
      setError("");
      const normalizedRegNumber = normalizeRegNumber(regNumber);
      const deviceId = deviceFingerprintRef.current || await SecureDeviceFingerprint.getDeviceId();
      deviceFingerprintRef.current = deviceId;

      if (isLocallyLocked(normalizedRegNumber, deviceId)) {
        setError("This device has already completed attendance for this registration number.");
        setStep("error");
        return;
      }

      const res = await fetch("/api/public/check-submission-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          regNumber: normalizedRegNumber,
          deviceFingerprint: deviceId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.canVerify) {
        setError(data?.reason || data?.error || "Verification cannot continue in this browser");
        setStep("error");
        return;
      }

      setTemporaryVerificationLock(normalizedRegNumber, deviceId);
      setStep("camera");
    } catch (err) {
      setError("Could not verify this device. Please try again.");
      setStep("error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-xl w-full overflow-hidden border border-slate-200"
        >
          {/* Header */}
          <div className="bg-blue-600 p-6 text-white">
            <h1 className="text-xl font-bold">Attendance Check-in</h1>
            <p className="text-blue-100 text-sm opacity-80">Session: {sessionId}</p>
            <div className="mt-2 inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")} remaining
            </div>
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
              {step === "info" && (
                <motion.div 
                  key="info"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input 
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder="John Doe"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Registration Number</label>
                      <div className="relative">
                        <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input 
                          type="text"
                          value={regNumber}
                          onChange={(e) => setRegNumber(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder="REG/2024/001"
                        />
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={handleContinueToCamera}
                    disabled={!name || !regNumber || !fingerprintReady}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    {fingerprintReady ? "Continue to Selfie" : "Preparing secure device check..."}
                  </button>
                </motion.div>
              )}

              {step === "camera" && (
                <motion.div
                  key="camera"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="relative aspect-square bg-black rounded-2xl overflow-hidden shadow-inner">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-2 border-white/30 rounded-2xl pointer-events-none" />
                  </div>
                  <p className="text-center text-sm text-slate-500">
                    {cameraState === "ready" ? "Camera ready. Take your selfie." : "Starting camera..."}
                  </p>
                  <canvas ref={canvasRef} className="hidden" />
                  <button
                    onClick={captureImage}
                    disabled={cameraState !== "ready"}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    Capture & Submit
                  </button>
                  <button
                    onClick={() => {
                      stopCamera();
                      setError("");
                      setStep("info");
                      window.setTimeout(() => setStep("camera"), 0);
                    }}
                    className="w-full text-slate-600 font-medium py-2 hover:text-blue-600 transition-colors"
                  >
                    Reopen Camera
                  </button>
                </motion.div>
              )}

              {step === "submitting" && (
                <motion.div 
                  key="submitting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-12 text-center space-y-4"
                >
                  <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
                  <p className="text-slate-600 font-medium">Verifying location and submitting...</p>
                </motion.div>
              )}

              {step === "success" && (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-8 text-center space-y-4"
                >
                  <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="text-green-600 w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">Attendance Recorded!</h2>
                  <p className="text-slate-600">Your attendance has been successfully submitted. You can close this window.</p>
                </motion.div>
              )}

              {step === "error" && (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-8 text-center space-y-4"
                >
                  <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="text-red-600 w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">Error Occurred</h2>
                  <p className="text-red-600 font-medium">{error}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-4 text-blue-600 font-bold hover:underline"
                  >
                    Try Again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        <AppFooter />
      </div>
    </div>
  );
};

export default function App() {
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const path = window.location.pathname;

  useEffect(() => {
    if (path.startsWith("/attendance/")) {
      setAuthReady(true);
      return;
    }

    fetch("/api/admin/me", { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          setCurrentAdmin(null);
        return null;
      }
      return res.json();
    })
      .then((data) => {
        if (data) {
          setCurrentAdmin(data);
        }
      })
      .finally(() => {
        setAuthReady(true);
      });
  }, [path]);

  const handleLogin = (admin: CurrentAdmin) => {
    setCurrentAdmin(admin);
    setWelcomeName(admin.username);
    setSessionMessage(null);
    window.history.pushState({}, "", "/dashboard");
  };

  const handleLogout = () => {
    fetch("/api/admin/logout", { method: "POST", credentials: "include" })
      .finally(() => {
        setCurrentAdmin(null);
        setWelcomeName(null);
        window.history.pushState({}, "", "/");
      });
  };

  useEffect(() => {
    if (!currentAdmin || path.startsWith("/attendance/")) return;

    const timer = window.setTimeout(() => {
      fetch("/api/admin/logout", { method: "POST", credentials: "include" })
        .finally(() => {
          setCurrentAdmin(null);
          setWelcomeName(null);
          setSessionMessage("Your secure admin session expired after 10 minutes of access. Please log in again to protect attendance data.");
          window.history.pushState({}, "", "/");
        });
    }, 10 * 60 * 1000);

    return () => window.clearTimeout(timer);
  }, [currentAdmin?.id, path]);

  // Simple Routing
  if (path.startsWith("/attendance/")) {
    const sessionId = path.split("/")[2];
    return <AttendancePage sessionId={sessionId} />;
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (currentAdmin) {
    if (path === "/dashboard") {
      return <AdminDashboard currentAdmin={currentAdmin} onLogout={handleLogout} welcomeName={welcomeName} onWelcomeSeen={() => setWelcomeName(null)} />;
    }
    // Redirect to dashboard if logged in
    window.history.replaceState({}, "", "/dashboard");
    return <AdminDashboard currentAdmin={currentAdmin} onLogout={handleLogout} welcomeName={welcomeName} onWelcomeSeen={() => setWelcomeName(null)} />;
  }

  return (
    <AdminLogin
      onLogin={handleLogin}
      sessionMessage={sessionMessage}
      onDismissSessionMessage={() => setSessionMessage(null)}
    />
  );
}
