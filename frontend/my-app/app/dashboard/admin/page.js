"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { StatCard, SeverityBadge, RiskBar, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { Users, Bell, ShieldAlert, AlertTriangle, TrendingUp, Ban, RotateCcw, Unlock, Brain, CheckCircle2, XCircle, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import LiveFeed from "@/components/LiveFeed";
import Link from "next/link";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [failedByUser, setFailedByUser] = useState([]);
  const [mlStatus, setMlStatus] = useState([]);
  const [retraining, setRetraining] = useState(false);
  const [resetModal, setResetModal] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const load = () => {
    api.stats().then(setStats).catch(() => {});
    api.riskTrend().then((d) =>
      setTrend(d.map((r) => ({ date: r.created_at?.slice(0, 10), score: r.risk_score })))
    ).catch(() => {});
    api.alerts().then((d) => setAlerts(d.slice(0, 6))).catch(() => {});
    api.failedByUser().then(setFailedByUser).catch(() => {});
    api.mlStatus().then(setMlStatus).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const notify = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(""), 3000); };

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const results = await api.mlRetrain();
      const trained = results.filter((r) => r.trained).length;
      notify(`ML models retrained: ${trained}/${results.length} users`);
      api.mlStatus().then(setMlStatus).catch(() => {});
    } catch (e) { notify(e.message); }
    finally { setRetraining(false); }
  };

  const handleBlock = async (uid, isBlocked) => {
    try {
      await (isBlocked ? api.unblockUser(uid) : api.blockUser(uid));
      notify(isBlocked ? "User unblocked." : "User blocked.");
      load();
    } catch (e) { notify(e.message); }
  };

  const handleReset = async () => {
    try {
      await api.resetPassword(resetModal.user_id, { password: newPassword });
      notify("Password reset successfully.");
      setResetModal(null);
      setNewPassword("");
    } catch (e) { notify(e.message); }
  };

  const handleExport = (type) => {
    const token = localStorage.getItem("token");
    const url = type === "alerts" ? api.exportAlerts() : api.exportLogs();
    window.open(`${url}?token=${token}`, "_blank");
  };

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <PageHeader title="Admin Dashboard" subtitle="Real-time security overview" />

      {actionMsg && (
        <div className="mb-4 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm px-4 py-2.5 rounded-lg">
          {actionMsg}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value={stats?.total_users} icon={Users} color="cyan" />
        <StatCard label="Total Alerts" value={stats?.total_alerts} icon={Bell} color="yellow" />
        <StatCard label="High Risk Alerts" value={stats?.high_risk_alerts} icon={ShieldAlert} color="red" />
        <StatCard label="Failed Logins" value={stats?.failed_logins} icon={AlertTriangle} color="red" />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <button onClick={() => handleExport("alerts")}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-2 rounded-lg border border-gray-700 transition">
          <Download className="w-3.5 h-3.5" /> Export Alerts CSV
        </button>
        <button onClick={() => handleExport("logs")}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-2 rounded-lg border border-gray-700 transition">
          <Download className="w-3.5 h-3.5" /> Export Logs CSV
        </button>
        <Link href="/dashboard/admin/risk-profile"
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-2 rounded-lg border border-gray-700 transition">
          <ShieldAlert className="w-3.5 h-3.5" /> User Risk Profiles
        </Link>
        <Link href="/dashboard/admin/map"
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-2 rounded-lg border border-gray-700 transition">
          <AlertTriangle className="w-3.5 h-3.5" /> GeoIP Map
        </Link>
      </div>

      {/* Failed Attempts by User */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h2 className="text-sm font-semibold text-white">Failed Login Attempts by User</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Failed Attempts</th>
              <th className="px-4 py-3 text-left">Last Attempt</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {failedByUser.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No failed attempts recorded.</td></tr>
            )}
            {failedByUser.map((u) => (
              <tr key={u.user_id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-400">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`font-bold text-sm ${u.failed_count >= 5 ? "text-red-400" : u.failed_count >= 3 ? "text-yellow-400" : "text-gray-300"}`}>
                    {u.failed_count}
                    {u.failed_count >= 5 && <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Brute-force risk</span>}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(u.last_attempt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleBlock(u.user_id, u.is_blocked)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition ${
                        u.is_blocked ? "border-green-500/30 text-green-400 hover:bg-green-500/10" : "border-red-500/30 text-red-400 hover:bg-red-500/10"
                      }`}>
                      {u.is_blocked ? <><Unlock className="w-3 h-3" /> Unblock</> : <><Ban className="w-3 h-3" /> Block</>}
                    </button>
                    <button onClick={() => { setResetModal(u); setNewPassword(""); }}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition">
                      <RotateCcw className="w-3 h-3" /> Reset Password
                    </button>
                    <Link href={`/dashboard/admin/risk-profile?uid=${u.user_id}`}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition">
                      <ShieldAlert className="w-3 h-3" /> Profile
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ML Status + Risk Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-white">ML Model Status</h2>
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">Isolation Forest</span>
            </div>
            <button onClick={handleRetrain} disabled={retraining}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 transition disabled:opacity-50">
              <RotateCcw className={`w-3 h-3 ${retraining ? "animate-spin" : ""}`} />
              {retraining ? "Retraining..." : "Retrain All"}
            </button>
          </div>
          <div className="space-y-2">
            {mlStatus.length === 0 && <p className="text-sm text-gray-500">Loading ML status...</p>}
            {mlStatus.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-sm text-white font-medium">{m.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{m.role} &bull; {m.log_count} logs</p>
                </div>
                {m.model_trained ? (
                  <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Trained
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                    <XCircle className="w-3 h-3" /> Not trained
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Risk Score Trend</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} domain={[0, 150]} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }} />
              <Line type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live Feed + Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LiveFeed />
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-yellow-400" />
            <h2 className="text-sm font-semibold text-white">Recent Alerts</h2>
          </div>
          <div className="space-y-3">
            {alerts.length === 0 && <p className="text-sm text-gray-500">No alerts yet.</p>}
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-sm text-white font-medium">{a.users?.name || "Unknown"}</p>
                  <p className="text-xs text-gray-400 truncate max-w-[200px]">{a.reason?.split(" | ")[0]}</p>
                </div>
                <div className="flex items-center gap-3">
                  <RiskBar score={a.risk_score} />
                  <SeverityBadge severity={a.severity} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-white">Reset Password</h3>
            <p className="text-sm text-gray-400">Set a new password for <span className="text-white font-medium">{resetModal.name}</span></p>
            <input type="password" placeholder="New password (min 6 chars)" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500" />
            <div className="flex gap-3">
              <button onClick={handleReset} disabled={newPassword.length < 6}
                className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition">
                Reset
              </button>
              <button onClick={() => setResetModal(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
