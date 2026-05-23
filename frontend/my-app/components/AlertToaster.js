"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { ShieldAlert, X, AlertTriangle, XCircle } from "lucide-react";

const severityStyles = {
  Critical: "border-purple-500/50 bg-purple-500/10",
  High:     "border-red-500/50 bg-red-500/10",
  Medium:   "border-yellow-500/50 bg-yellow-500/10",
  Low:      "border-green-500/50 bg-green-500/10",
};

const severityIcon = {
  Critical: <XCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />,
  High:     <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />,
  Medium:   <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />,
  Low:      <AlertTriangle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />,
};

export default function AlertToaster() {
  const { user } = useAuth();
  const [toasts, setToasts] = useState([]);
  const baselineTimeRef = useRef(null);  // ISO string — alerts older than this are ignored
  const shownIdsRef = useRef(new Set()); // prevent duplicate toasts

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  useEffect(() => {
    if (!user || user.role === "user") return;

    const poll = async () => {
      try {
        const data = await api.alerts();
        if (!data.length) return;

        // First load — set baseline to NOW so only future alerts trigger toasts
        if (baselineTimeRef.current === null) {
          baselineTimeRef.current = new Date().toISOString();
          return;
        }

        // Find alerts created after baseline that haven't been shown yet
        const newAlerts = data.filter((a) => {
          if (shownIdsRef.current.has(a.id)) return false;
          return new Date(a.created_at) > new Date(baselineTimeRef.current);
        });

        if (newAlerts.length === 0) return;

        // Update baseline to latest alert time
        baselineTimeRef.current = data[0].created_at;

        newAlerts.forEach((a) => {
          shownIdsRef.current.add(a.id);
          const toast = {
            id: a.id,
            user: a.users?.name || "Unknown",
            severity: a.severity,
            risk_score: a.risk_score,
            reasons: a.reason?.split(" | ") || [],
          };
          setToasts((prev) => [toast, ...prev].slice(0, 5));
          setTimeout(() => dismiss(a.id), 8000);
        });
      } catch (e) {}
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [user?.role]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-80">
      {toasts.map((t) => (
        <div key={t.id}
          className={`border rounded-xl p-4 shadow-2xl backdrop-blur-sm ${severityStyles[t.severity] || severityStyles.Medium}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              {severityIcon[t.severity]}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-white">🚨 Security Alert</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    t.severity === "Critical" ? "bg-purple-500/30 text-purple-300" :
                    t.severity === "High"     ? "bg-red-500/30 text-red-300" :
                    t.severity === "Medium"   ? "bg-yellow-500/30 text-yellow-300" :
                                                "bg-green-500/30 text-green-300"
                  }`}>{t.severity}</span>
                </div>
                <p className="text-xs text-gray-300 mb-1">
                  <span className="font-medium text-white">{t.user}</span>
                  {" — "}Risk Score: <span className="font-bold text-white">{t.risk_score}</span>
                  {t.severity === "Critical" && (
                    <span className="ml-2 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-bold">AUTO-BLOCKED</span>
                  )}
                </p>
                <ul className="space-y-0.5">
                  {t.reasons.slice(0, 3).map((r, i) => (
                    <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                      <span className="text-red-400 shrink-0">•</span>
                      <span className="truncate">{r.trim()}</span>
                    </li>
                  ))}
                  {t.reasons.length > 3 && (
                    <li className="text-xs text-gray-500">+{t.reasons.length - 3} more anomalies</li>
                  )}
                </ul>
              </div>
            </div>
            <button onClick={() => dismiss(t.id)} className="text-gray-500 hover:text-white transition shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
