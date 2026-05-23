"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { Ban, Unlock } from "lucide-react";

const roleColors = { admin: "text-red-400", analyst: "text-yellow-400", user: "text-cyan-400" };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState("");

  const load = () => api.users().then(setUsers).catch(() => {});
  useEffect(() => { load(); }, []);

  const notify = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const handleBlock = async (uid, isBlocked) => {
    try {
      await (isBlocked ? api.unblockUser(uid) : api.blockUser(uid));
      notify(isBlocked ? "User unblocked." : "User blocked.");
      load();
    } catch (e) { notify(e.message); }
  };

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <PageHeader title="Users" subtitle="All registered users" />

      {msg && (
        <div className="mb-4 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm px-4 py-2.5 rounded-lg">
          {msg}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Registered</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No users found.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition ${u.is_blocked ? "bg-red-500/5" : ""}`}>
                <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-300">{u.email}</td>
                <td className={`px-4 py-3 font-medium capitalize ${roleColors[u.role]}`}>{u.role}</td>
                <td className="px-4 py-3">
                  {u.is_blocked ? (
                    <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full w-fit">
                      <Ban className="w-3 h-3" /> Blocked
                    </span>
                  ) : (
                    <span className="text-xs text-green-400 bg-green-500/20 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  {u.role !== "admin" && (
                    <button
                      onClick={() => handleBlock(u.id, u.is_blocked)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition ${
                        u.is_blocked
                          ? "border-green-500/30 text-green-400 hover:bg-green-500/10"
                          : "border-red-500/30 text-red-400 hover:bg-red-500/10"
                      }`}
                    >
                      {u.is_blocked ? <><Unlock className="w-3 h-3" /> Unblock</> : <><Ban className="w-3 h-3" /> Block</>}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
