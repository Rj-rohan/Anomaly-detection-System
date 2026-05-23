"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { MapPin, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";

const GeoMap = dynamic(() => import("@/components/GeoMap"), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-96 bg-gray-900 rounded-xl border border-gray-800">
    <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
  </div>
)});

export default function MapPage() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try { setPoints(await api.geoData()); }
    catch (e) {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? points : points.filter((p) => p.status === filter);
  const successCount = points.filter((p) => p.status === "success").length;
  const failedCount = points.filter((p) => p.status === "failed").length;

  return (
    <DashboardLayout allowedRoles={["admin", "analyst"]}>
      <PageHeader title="GeoIP Login Map" subtitle="Geographic visualization of login activity" />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{points.length}</p>
          <p className="text-xs text-gray-400 mt-1">Total Mapped Logins</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{successCount}</p>
          <p className="text-xs text-gray-400 mt-1">Successful</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{failedCount}</p>
          <p className="text-xs text-gray-400 mt-1">Failed</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Login Locations</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {["all", "success", "failed"].map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1 rounded-lg capitalize transition ${filter === f ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                  {f}
                </button>
              ))}
            </div>
            <button onClick={load} disabled={loading}
              className="text-gray-400 hover:text-white transition">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <GeoMap points={filtered} />

        {/* Legend */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-3 h-3 rounded-full bg-green-500" /> Successful login
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-3 h-3 rounded-full bg-red-500" /> Failed login
          </div>
        </div>
      </div>

      {/* Recent mapped logins table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-6">
        <div className="px-5 py-3 border-b border-gray-800">
          <p className="text-sm font-semibold text-white">Recent Mapped Events</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Location</th>
              <th className="px-4 py-3 text-left">Coordinates</th>
              <th className="px-4 py-3 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 15).map((p, i) => (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="px-4 py-2.5 text-white font-medium">{p.user}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-300">{p.location}</td>
                <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{p.lat?.toFixed(2)}, {p.lng?.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(p.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
