"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { SeverityBadge, StatusBadge, RiskBar, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";

export default function AdminIncidents() {
  const [incidents, setIncidents] = useState([]);

  useEffect(() => { api.incidents().then(setIncidents).catch(() => {}); }, []);

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <PageHeader title="Incidents" subtitle="All security incidents" />
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Risk</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Updated</th>
            </tr>
          </thead>
          <tbody>
            {incidents.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No incidents found.</td></tr>
            )}
            {incidents.map((inc) => (
              <tr key={inc.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="px-4 py-3 text-white font-medium">{inc.alerts?.users?.name || "—"}</td>
                <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{inc.alerts?.reason}</td>
                <td className="px-4 py-3 w-32"><RiskBar score={inc.alerts?.risk_score || 0} /></td>
                <td className="px-4 py-3"><SeverityBadge severity={inc.alerts?.severity} /></td>
                <td className="px-4 py-3"><StatusBadge status={inc.status} /></td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(inc.updated_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
