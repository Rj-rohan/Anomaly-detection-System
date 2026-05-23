"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { ShieldAlert, Eye, EyeOff, AlertTriangle, XCircle } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [warning, setWarning] = useState(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  // Load persisted state after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const count = parseInt(sessionStorage.getItem("loginFailCount") || "0", 10);
    const until = parseInt(sessionStorage.getItem("loginCooldownUntil") || "0", 10);
    const remaining = Math.floor((until - Date.now()) / 1000);

    if (count > 0) {
      setFailCount(count);
      if (count >= 5) setWarning({ type: "danger", attempts: count, message: `${count} failed attempts detected. Your account may be flagged for suspicious activity.` });
      else if (count === 4) setWarning({ type: "warn", attempts: count, message: `${count} failed attempts. 1 more will trigger a security alert.` });
      else if (count === 3) setWarning({ type: "warn", attempts: count, message: `${count} failed attempts. 2 more will trigger a security alert.` });
    }

    if (remaining > 0) {
      setCooldown(remaining);
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            // Cooldown expired — reset fail counter so user can try again
            sessionStorage.removeItem("loginFailCount");
            sessionStorage.removeItem("loginCooldownUntil");
            setFailCount(0);
            setWarning(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  const startCooldown = (seconds) => {
    const until = Date.now() + seconds * 1000;
    sessionStorage.setItem("loginCooldownUntil", until.toString());
    setCooldown(seconds);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Cooldown expired — reset so user can try again with correct password
          sessionStorage.removeItem("loginFailCount");
          sessionStorage.removeItem("loginCooldownUntil");
          setFailCount(0);
          setWarning(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const updateFailCount = (count) => {
    sessionStorage.setItem("loginFailCount", count.toString());
    setFailCount(count);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setWarning(null);
    setLoading(true);
    try {
      const data = await api.login({
        ...form,
        device: navigator.platform || "Unknown",
        location: "Unknown",
      });
      sessionStorage.removeItem("loginFailCount");
      sessionStorage.removeItem("loginCooldownUntil");
      login(data.token, data.user);
      if (data.user.role === "admin") router.replace("/dashboard/admin");
      else if (data.user.role === "analyst") router.replace("/dashboard/analyst");
      else router.replace("/dashboard/user");
    } catch (err) {
      const msg = err.message;

      if (msg.includes("blocked")) {
        // Account is blocked
        setError(null);
        setWarning({
          type: "blocked",
          message: "Your account has been automatically blocked due to suspicious activity. Contact the administrator to unblock.",
        });
      } else if (msg.includes("Invalid credentials")) {
        const newCount = failCount + 1;
        updateFailCount(newCount);

        if (newCount >= 5) {
          setWarning({
            type: "danger",
            attempts: newCount,
            message: `${newCount} failed attempts detected. Your account may be flagged for suspicious activity.`,
          });
          startCooldown(300);
        } else if (newCount === 4) {
          setWarning({
            type: "warn",
            attempts: newCount,
            message: `${newCount} failed attempts. 1 more will trigger a security alert.`,
          });
        } else if (newCount === 3) {
          setWarning({
            type: "warn",
            attempts: newCount,
            message: `${newCount} failed attempts. ${5 - newCount} more will trigger a security alert.`,
          });
        } else {
          setError("Invalid email or password.");
        }
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-cyan-500/10 p-4 rounded-full mb-4">
            <ShieldAlert className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Threat Detection System</h1>
          <p className="text-gray-400 text-sm mt-1">AI-Assisted Behavioral Login Security</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5">
          <h2 className="text-lg font-semibold text-white">Sign In</h2>

          {/* Cooldown timer */}
          {cooldown > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/40 rounded-lg px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-400">Too Many Failed Attempts</p>
                <p className="text-xs text-orange-300 mt-0.5">
                  Login disabled. Try again in{" "}
                  <span className="font-bold text-white">
                    {Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, "0")}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Blocked warning */}
          {warning?.type === "blocked" && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-400">Account Blocked</p>
                <p className="text-xs text-red-300 mt-0.5">Your account has been blocked due to suspicious activity. Contact the administrator to unblock.</p>
              </div>
            </div>
          )}

          {/* Danger warning — 3+ attempts */}
          {warning?.type === "danger" && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-400">
                  🚨 Security Alert — {warning.attempts} Failed Attempts
                </p>
                <p className="text-xs text-red-300 mt-0.5">{warning.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  This activity has been reported to the security team.
                </p>
              </div>
            </div>
          )}

          {/* Caution — 2 attempts */}
          {warning?.type === "warn" && (
            <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-400">
                  ⚠ Warning — {warning.attempts} Failed Attempts
                </p>
                <p className="text-xs text-yellow-300 mt-0.5">{warning.message}</p>
              </div>
            </div>
          )}

          {/* Generic error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Attempt counter bar */}
          {failCount > 0 && failCount < 10 && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Failed attempts</span>
                <span className={failCount >= 5 ? "text-red-400 font-bold" : "text-yellow-400"}>{failCount} / 5 threshold</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${failCount >= 5 ? "bg-red-500" : failCount >= 3 ? "bg-yellow-500" : "bg-gray-500"}`}
                  style={{ width: `${Math.min((failCount / 5) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={`w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none transition pr-10 ${
                  failCount >= 3 ? "border-red-500/60 focus:border-red-500" : "border-gray-700 focus:border-cyan-500"
                }`}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-200">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || warning?.type === "blocked" || cooldown > 0}
            className={`w-full disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition ${
              cooldown > 0 ? "bg-gray-700" : failCount >= 5 ? "bg-red-700 hover:bg-red-600" : "bg-cyan-600 hover:bg-cyan-500"
            }`}
          >
            {loading ? "Signing in..." : cooldown > 0 ? `Try again in ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}` : "Sign In"}
          </button>

          <p className="text-center text-sm text-gray-400">
            No account?{" "}
            <Link href="/register" className="text-cyan-400 hover:underline">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
