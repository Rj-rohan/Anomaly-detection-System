"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { SeverityBadge, RiskBar, PageHeader, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";

export default function AdminAlerts() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => { api.alerts().then(setAlerts).catch(() => {}); }, []);

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <PageHeader title="Security Alerts" subtitle="All generated alerts from the risk engine" />
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Risk Score</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No alerts found.</td></tr>
            )}
            {alerts.map((a) => (
              <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="px-4 py-3 text-white font-medium">{a.users?.name || "—"}</td>
                <td className="px-4 py-3 max-w-xs">
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
                <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
