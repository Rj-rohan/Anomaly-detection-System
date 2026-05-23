"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ui";
import { api } from "@/lib/api";

export default function AnalystLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => { api.logs().then(setLogs).catch(() => {}); }, []);

  return (
    <DashboardLayout allowedRoles={["analyst"]}>
      <PageHeader title="Login Logs" subtitle="All user login activity" />
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">IP Address</th>
              <th className="px-4 py-3 text-left">Device</th>
              <th className="px-4 py-3 text-left">Location</th>
              <th className="px-4 py-3 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No logs found.</td></tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="px-4 py-3 text-white font-medium">{l.users?.name || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    l.status === "success"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
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
    </DashboardLayout>
  );
}
