export function StatCard({ label, value, icon: Icon, color = "cyan" }) {
  const colors = {
    cyan: "text-cyan-400 bg-cyan-500/10",
    red: "text-red-400 bg-red-500/10",
    yellow: "text-yellow-400 bg-yellow-500/10",
    green: "text-green-400 bg-green-500/10",
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colors[color]}`}>
        <Icon className={`w-5 h-5 ${colors[color].split(" ")[0]}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value ?? "—"}</p>
        <p className="text-sm text-gray-400">{label}</p>
      </div>
    </div>
  );
}

export function SeverityBadge({ severity }) {
  const map = {
    Critical: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    High: "bg-red-500/20 text-red-400 border-red-500/30",
    Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    Low: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[severity] || map.Low}`}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    New: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Investigating: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    Resolved: "bg-green-500/20 text-green-400 border-green-500/30",
    Escalated: "bg-red-500/20 text-red-400 border-red-500/30",
    open: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    closed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[status] || map.New}`}>
      {status}
    </span>
  );
}

export function RiskBar({ score }) {
  const color = score >= 61 ? "bg-red-500" : score >= 31 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{score}</span>
    </div>
  );
}

export function PageHeader({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-white">{title}</h1>
      {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
