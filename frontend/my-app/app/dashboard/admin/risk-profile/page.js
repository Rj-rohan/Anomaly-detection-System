"use client";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, SeverityBadge, RiskBar } from "@/components/ui";
import { api } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ShieldAlert, Monitor, MapPin, Clock, Download } from "lucide-react";

export default function RiskProfilePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <RiskProfileContent />
    </Suspense>
  );
}

function RiskProfileContent() {
  const params = useSearchParams();
  const uid = params.get("uid");
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUid, setSelectedUid] = useState(uid || "");

  useEffect(() => { api.users().then(setUsers).catch(() => {}); }, []);

  useEffect(() => {
    if (!selectedUid) return;
    api.userRiskProfile(selectedUid).then(setProfile).catch(() => {});
  }, [selectedUid]);

  const handleExportPDF = async () => {
    if (!profile) return;
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Risk Profile: ${profile.user.name}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Email: ${profile.user.email}  |  Role: ${profile.user.role}  |  Current Risk Score: ${profile.current_risk_score}`, 14, 30);
    autoTable(doc, {
      startY: 38,
      head: [["Date", "Risk Score", "Severity", "Reason"]],
      body: profile.alerts.map((a) => [a.created_at?.slice(0, 10), a.risk_score, a.severity, a.reason?.split(" | ")[0]]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [6, 182, 212] },
    });
    doc.save(`risk-profile-${profile.user.name}.pdf`);
  };

  return (
    <DashboardLayout allowedRoles={["admin", "analyst"]}>
      <PageHeader title="User Risk Profile" subtitle="Detailed behavioral risk analysis per user" />

      <div className="flex items-center gap-3 mb-6">
        <select
          value={selectedUid}
          onChange={(e) => setSelectedUid(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">Select a user...</option>
          {users.filter((u) => u.role === "user").map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
          ))}
        </select>
        {profile && (
          <button onClick={handleExportPDF}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
        )}
      </div>

      {!profile && selectedUid && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {profile && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${
                profile.current_risk_score >= 86 ? "text-purple-400" :
                profile.current_risk_score >= 61 ? "text-red-400" :
                profile.current_risk_score >= 31 ? "text-yellow-400" : "text-green-400"
              }`}>{profile.current_risk_score}</p>
              <p className="text-xs text-gray-400 mt-1">Current Risk Score</p>
              <p className="text-xs text-gray-500 mt-0.5">(max 100, decays over time)</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{profile.alert_count}</p>
              <p className="text-xs text-gray-400 mt-1">Total Alerts</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-orange-400">{profile.failed_logins}</p>
              <p className="text-xs text-gray-400 mt-1">Failed Logins</p>
            </div>
            <div className={`border rounded-xl p-4 text-center ${profile.user.is_blocked ? "bg-red-500/10 border-red-500/30" : "bg-green-500/10 border-green-500/30"}`}>
              <p className={`text-sm font-bold mt-1 ${profile.user.is_blocked ? "text-red-400" : "text-green-400"}`}>
                {profile.user.is_blocked ? "BLOCKED" : "ACTIVE"}
              </p>
              <p className="text-xs text-gray-400 mt-1">Account Status</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Risk Score History Chart */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-sm font-semibold text-white mb-4">Risk Score History</p>
              {profile.risk_history.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={profile.risk_history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="score" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-500 text-center py-8">No alert history.</p>}
            </div>

            {/* Behavior Baseline */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-sm font-semibold text-white mb-4">Behavior Baseline</p>
              {profile.profile ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Avg Login Hour</p>
                      <p className="text-sm text-white font-medium">{profile.profile.avg_login_hour?.toFixed(1) || "—"}:00</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Monitor className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400">Known Devices</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(profile.profile.known_devices || []).map((d, i) => (
                          <span key={i} className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">{d}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400">Known Locations</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(profile.profile.known_locations || []).map((l, i) => (
                          <span key={i} className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">{l}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : <p className="text-sm text-gray-500">No baseline profile yet.</p>}
            </div>
          </div>

          {/* Alert History */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-semibold text-white">Alert History</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Anomalies</th>
                  <th className="px-4 py-3 text-left">Risk</th>
                  <th className="px-4 py-3 text-left">Severity</th>
                </tr>
              </thead>
              <tbody>
                {profile.alerts.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No alerts.</td></tr>
                )}
                {profile.alerts.map((a) => (
                  <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(a.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 max-w-sm">
                      <ul className="space-y-0.5">
                        {a.reason?.split(" | ").map((r, i) => (
                          <li key={i} className="text-xs text-gray-300 flex items-start gap-1">
                            <span className="text-red-400 shrink-0">•</span>{r.trim()}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3 w-32"><RiskBar score={a.risk_score} /></td>
                    <td className="px-4 py-3"><SeverityBadge severity={a.severity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
