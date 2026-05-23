"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { SeverityBadge, StatusBadge, RiskBar, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";

const STATUSES = ["New", "Investigating", "Resolved", "Escalated"];

export default function AnalystIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ status: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.incidents().then(setIncidents).catch(() => {}); }, []);

  const openModal = (inc) => {
    setSelected(inc);
    setForm({ status: inc.status, notes: inc.notes || "" });
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateIncident(selected.id, form);
      setIncidents((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
      setSelected(null);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout allowedRoles={["analyst"]}>
      <PageHeader title="Incidents" subtitle="Investigate and update incident status" />

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Risk</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {incidents.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No incidents found.</td></tr>
            )}
            {incidents.map((inc) => (
              <tr key={inc.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="px-4 py-3 text-white font-medium">{inc.alerts?.users?.name || "—"}</td>
                <td className="px-4 py-3 max-w-xs">
                  <ul className="space-y-0.5">
                    {inc.alerts?.reason?.split(" | ").map((r, i) => (
                      <li key={i} className="text-xs text-gray-300 flex items-start gap-1">
                        <span className="text-red-400 shrink-0">•</span>{r.trim()}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-3 w-32"><RiskBar score={inc.alerts?.risk_score || 0} /></td>
                <td className="px-4 py-3"><SeverityBadge severity={inc.alerts?.severity} /></td>
                <td className="px-4 py-3"><StatusBadge status={inc.status} /></td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => openModal(inc)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 px-3 py-1 rounded-lg transition"
                  >
                    Investigate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Update Incident</h3>
            <div>
              <p className="text-xs text-gray-400 mb-1">User</p>
              <p className="text-sm text-white">{selected.alerts?.users?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Detected Anomalies</p>
              <ul className="space-y-1">
                {selected.alerts?.reason?.split(" | ").map((r, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-red-400 shrink-0 mt-0.5">•</span>{r.trim()}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 resize-none"
                placeholder="Investigation notes..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setSelected(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
