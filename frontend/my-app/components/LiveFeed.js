"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { SeverityBadge } from "@/components/ui";
import { Radio, ShieldAlert, LogIn } from "lucide-react";

export default function LiveFeed() {
  const [feed, setFeed] = useState([]);
  const [live, setLive] = useState(true);
  const intervalRef = useRef(null);

  const fetchFeed = async () => {
    try { setFeed(await api.latestFeed()); }
    catch (e) {}
  };

  useEffect(() => {
    fetchFeed();
    if (live) {
      intervalRef.current = setInterval(fetchFeed, 5000);
    }
    return () => clearInterval(intervalRef.current);
  }, [live]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-green-400" />
          <h2 className="text-sm font-semibold text-white">Live Event Feed</h2>
          {live && <span className="flex items-center gap-1 text-xs text-green-400"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />LIVE</span>}
        </div>
        <button onClick={() => setLive(!live)}
          className={`text-xs px-3 py-1 rounded-lg border transition ${live ? "border-green-500/30 text-green-400 hover:bg-green-500/10" : "border-gray-700 text-gray-400 hover:text-white"}`}>
          {live ? "Pause" : "Resume"}
        </button>
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {feed.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No events yet.</p>}
        {feed.map((item, i) => (
          <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition ${
            item.type === "alert" ? "bg-red-500/5 border-red-500/20" : "bg-gray-800/40 border-gray-700/40"
          }`}>
            <div className="mt-0.5 shrink-0">
              {item.type === "alert"
                ? <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                : <LogIn className="w-3.5 h-3.5 text-gray-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white">{item.user}</span>
                {item.type === "alert" && <SeverityBadge severity={item.severity} />}
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">{item.message}</p>
            </div>
            <span className="text-xs text-gray-600 shrink-0">{new Date(item.time).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
