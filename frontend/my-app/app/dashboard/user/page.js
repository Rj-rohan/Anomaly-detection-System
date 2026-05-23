"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, SeverityBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { ShieldCheck, AlertTriangle, Flag, KeyRound, CheckCircle } from "lucide-react";

export default function UserDashboard() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [myAlerts, setMyAlerts] = useState([]);
  const [reportModal, setReportModal] = useState(false);
  const [secureModal, setSecureModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.myLogs().then(setLogs).catch(() => {});
    api.myAlerts().then(setMyAlerts).catch(() => {});
  }, []);

  const notify = (m) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const successCount = logs.filter((l) => l.status === "success").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    setLoading(true);
    try {
      await api.reportSuspicious({ reason: reportReason });
      notify("Report submitted. Security team has been notified.");
      setReportModal(false);
      setReportReason("");
      api.myAlerts().then(setMyAlerts).catch(() => {});
    } catch (e) { notify(e.message); }
    finally { setLoading(false); }
  };

  const handleSecure = async () => {
    if (newPassword.length < 6) return;
    setLoading(true);
    try {
      await api.secureAccount({ password: newPassword });
      notify("Password updated successfully. Your account is now secured.");
      setSecureModal(false);
      setNewPassword("");
    } catch (e) { notify(e.message); }
    finally { setLoading(false); }
  };

  return (
    <DashboardLayout allowedRoles={["user"]}>
      <PageHeader title={`Welcome, ${user?.name}`} subtitle="Your account security overview" />

      {msg && (
        <div className="mb-4 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" /> {msg}
        </div>
      )}

      {/* Stats + Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{successCount}</p>
          <p className="text-xs text-gray-400 mt-1">Successful Logins</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{failedCount}</p>
          <p className="text-xs text-gray-400 mt-1">Failed Attempts</p>
        </div>
        <button
          onClick={() => setReportModal(true)}
          className="bg-gray-900 border border-yellow-500/30 hover:border-yellow-500/60 hover:bg-yellow-500/5 rounded-xl p-4 text-center transition group"
        >
          <Flag className="w-6 h-6 text-yellow-400 mx-auto mb-1 group-hover:scale-110 transition" />
          <p className="text-xs text-gray-400">Report Suspicious Activity</p>
        </button>
        <button
          onClick={() => setSecureModal(true)}
          className="bg-gray-900 border border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/5 rounded-xl p-4 text-center transition group"
        >
          <KeyRound className="w-6 h-6 text-cyan-400 mx-auto mb-1 group-hover:scale-110 transition" />
          <p className="text-xs text-gray-400">Change Password</p>
        </button>
      </div>

      {/* Security Alerts for this user */}
      {myAlerts.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-semibold text-red-400">Security Alerts on Your Account</h2>
          </div>
          <div className="space-y-3">
            {myAlerts.map((a) => (
              <div key={a.id} className="bg-gray-900/60 rounded-lg px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={a.severity} />
                    <span className="text-xs text-gray-400">Risk Score: <span className="text-white font-semibold">{a.risk_score}</span></span>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <ul className="space-y-1">
                  {a.reason?.split(" | ").map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                      <span className="text-red-400 mt-0.5 shrink-0">&#x2022;</span>
                      {r.trim()}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">If you don't recognise this activity, change your password immediately.</p>
        </div>
      )}

      {myAlerts.length === 0 && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-green-400 shrink-0" />
          <p className="text-sm text-green-400">No security alerts on your account. You're all good!</p>
        </div>
      )}

      {/* Login History */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Login History</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">IP Address</th>
              <th className="px-4 py-3 text-left">Device</th>
              <th className="px-4 py-3 text-left">Location</th>
              <th className="px-4 py-3 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No login history yet.</td></tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    l.status === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300 font-mono text-xs">{l.ip_address}</td>
                <td className="px-4 py-3 text-gray-300">{l.device}</td>
                <td className="px-4 py-3 text-gray-300">{l.location}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(l.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Report Modal */}
      {reportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-bold text-white">Report Suspicious Activity</h3>
            </div>
            <p className="text-sm text-gray-400">Describe what you noticed. The security team will investigate.</p>
            <textarea
              rows={3}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="e.g. I received a login alert but didn't attempt to log in..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={handleReport}
                disabled={loading || !reportReason.trim()}
                className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition"
              >
                {loading ? "Submitting..." : "Submit Report"}
              </button>
              <button onClick={() => setReportModal(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secure Account Modal */}
      {secureModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">Change Password</h3>
            </div>
            <p className="text-sm text-gray-400">Set a new strong password to secure your account.</p>
            <input
              type="password"
              placeholder="New password (min 6 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
            />
            <div className="flex gap-3">
              <button
                onClick={handleSecure}
                disabled={loading || newPassword.length < 6}
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
              <button onClick={() => setSecureModal(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
