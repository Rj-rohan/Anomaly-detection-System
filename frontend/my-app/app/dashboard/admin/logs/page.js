"use client";
import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { Search, Download, RefreshCw, Filter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function LogSearch() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    api.logStats().then(setStats).catch(() => {});
    doSearch();
  }, []);

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (query) params.q = query;
      if (status) params.status = status;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const data = await api.searchLogs(params);
      setLogs(data);
      setSearched(true);
    } catch (e) {}
    finally { setLoading(false); }
  }, [query, status, dateFrom, dateTo]);

  const handleExport = () => {
    const token = localStorage.getItem("token");
    window.open(`${api.exportLogs()}?token=${token}`, "_blank");
  };

  return (
    <DashboardLayout allowedRoles={["admin", "analyst"]}>
      <PageHeader title="Log Search" subtitle="Splunk-style search across all login events" />

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-gray-400 mt-1">Total Events</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.success}</p>
            <p className="text-xs text-gray-400 mt-1">Successful</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
            <p className="text-xs text-gray-400 mt-1">Failed</p>
          </div>
        </div>
      )}

      {/* Hourly Chart */}
      {stats?.hourly?.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <p className="text-sm font-semibold text-white mb-3">Events per Hour (Last 24h)</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={stats.hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="hour" tick={{ fill: "#6b7280", fontSize: 10 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }} />
              <Bar dataKey="count" fill="#06b6d4" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="Search by user, IP, location, device..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
          <button onClick={doSearch} disabled={loading}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Search
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Top IPs + Locations */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Top Source IPs</p>
            <div className="space-y-2">
              {stats.top_ips.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-300">{item.ip}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-800 rounded-full h-1.5">
                      <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${Math.min((item.count / stats.top_ips[0]?.count) * 100, 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-6 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Top Locations</p>
            <div className="space-y-2">
              {stats.top_locations.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-gray-300 truncate max-w-[160px]">{item.location}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-800 rounded-full h-1.5">
                      <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min((item.count / stats.top_locations[0]?.count) * 100, 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-6 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">
            {searched ? `${logs.length} results` : "All logs"}
          </p>
          <Filter className="w-4 h-4 text-gray-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">IP</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Device</th>
                <th className="px-4 py-3 text-left">Browser</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No results found.</td></tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition font-mono text-xs">
                  <td className="px-4 py-2.5 text-gray-400">{new Date(l.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-white">{l.users?.name || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${l.status === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-cyan-400">{l.ip_address}</td>
                  <td className="px-4 py-2.5 text-gray-300">{l.location}</td>
                  <td className="px-4 py-2.5 text-gray-300">{l.device}</td>
                  <td className="px-4 py-2.5 text-gray-400">{l.browser}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
