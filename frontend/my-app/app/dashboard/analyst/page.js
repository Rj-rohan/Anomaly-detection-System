"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { StatCard, SeverityBadge, StatusBadge, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { Activity, AlertTriangle, CheckCircle } from "lucide-react";

export default function AnalystDashboard() {
  const [incidents, setIncidents] = useState([]);

  useEffect(() => { api.incidents().then(setIncidents).catch(() => {}); }, []);

  const counts = incidents.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {});

  return (
    <DashboardLayout allowedRoles={["analyst"]}>
      <PageHeader title="Analyst Dashboard" subtitle="Incident investigation overview" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Incidents" value={incidents.length} icon={Activity} color="cyan" />
        <StatCard label="New" value={counts.New || 0} icon={AlertTriangle} color="yellow" />
        <StatCard label="Investigating" value={counts.Investigating || 0} icon={Activity} color="yellow" />
        <StatCard label="Resolved" value={counts.Resolved || 0} icon={CheckCircle} color="green" />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Recent Incidents</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {incidents.slice(0, 10).map((inc) => (
              <tr key={inc.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="px-4 py-3 text-white font-medium">{inc.alerts?.users?.name || "—"}</td>
                <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{inc.alerts?.reason}</td>
                <td className="px-4 py-3"><SeverityBadge severity={inc.alerts?.severity} /></td>
                <td className="px-4 py-3"><StatusBadge status={inc.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
