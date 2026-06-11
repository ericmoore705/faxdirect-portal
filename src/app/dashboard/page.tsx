"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  sentToday: number;
  receivedToday: number;
  failedToday: number;
  sentThisWeek: number;
}

interface RecentFax {
  id: string;
  type: "sent" | "received";
  number: string;
  status: string;
  fileName?: string;
  time: string;
  sentBy?: { name: string; email: string };
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "delivered" ? "badge-delivered" :
    status === "sending" ? "badge-sending" :
    status === "queued" ? "badge-queued" :
    status === "failed" ? "badge-failed" :
    status === "received" ? "badge-received" :
    status === "retrying" ? "badge-retrying" :
    "badge-queued";

  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [recent, setRecent] = useState<RecentFax[]>([]);
  const [stats, setStats] = useState<Stats>({ sentToday: 0, receivedToday: 0, failedToday: 0, sentThisWeek: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/");
  }, [authStatus, router]);

  useEffect(() => {
    if (!session) return;
    async function load() {
      try {
        const [sentRes, recvRes] = await Promise.all([
          fetch("/api/fax/history?type=sent&limit=10"),
          fetch("/api/fax/history?type=received&limit=5"),
        ]);
        const sentData = await sentRes.json();
        const recvData = await recvRes.json();

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        const allSent = sentData.faxes || [];
        const allRecv = recvData.faxes || [];

        setStats({
          sentToday: allSent.filter((f: any) => new Date(f.sentAt) >= todayStart).length,
          receivedToday: allRecv.filter((f: any) => new Date(f.receivedAt) >= todayStart).length,
          failedToday: allSent.filter((f: any) => f.status === "failed" && new Date(f.sentAt) >= todayStart).length,
          sentThisWeek: allSent.filter((f: any) => new Date(f.sentAt) >= weekStart).length,
        });

        const combined: RecentFax[] = [
          ...allSent.map((f: any) => ({
            id: f.id, type: "sent" as const, number: f.toNumber, status: f.status,
            fileName: f.fileName, time: f.sentAt, sentBy: f.sentBy,
          })),
          ...allRecv.map((f: any) => ({
            id: f.id, type: "received" as const, number: f.fromNumber, status: f.status,
            time: f.receivedAt,
          })),
        ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);

        setRecent(combined);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  if (authStatus === "loading" || !session) {
    return <div className="p-8"><div className="animate-pulse h-8 w-48 bg-surface-200 rounded" /></div>;
  }

  const firstName = session.user?.name?.split(" ")[0] || "there";

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-800">Hey {firstName}</h1>
        <p className="text-surface-500 mt-1">Here&apos;s your fax activity overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Sent Today", value: stats.sentToday, color: "text-brand-500" },
          { label: "Received Today", value: stats.receivedToday, color: "text-status-received" },
          { label: "Failed Today", value: stats.failedToday, color: "text-status-failed" },
          { label: "This Week", value: stats.sentThisWeek, color: "text-surface-600" },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{loading ? "—" : stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-8">
        <Link href="/send" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
          Send a Fax
        </Link>
        <Link href="/contacts" className="btn-secondary">Address Book</Link>
      </div>

      {/* Recent activity */}
      <div className="card">
        <div className="px-5 py-4 border-b border-surface-100">
          <h2 className="font-semibold text-surface-700">Recent Activity</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-surface-400">Loading...</div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-center text-surface-400">No fax activity yet</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {recent.map((fax) => (
              <div key={fax.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                  fax.type === "sent" ? "bg-blue-50 text-blue-600" : "bg-cyan-50 text-cyan-600"
                }`}>
                  {fax.type === "sent" ? "↑" : "↓"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-700 truncate">
                    {fax.type === "sent" ? `To: ${fax.number}` : `From: ${fax.number}`}
                  </p>
                  <p className="text-xs text-surface-400 truncate">
                    {fax.fileName || "—"}
                    {fax.sentBy && ` · ${fax.sentBy.name || fax.sentBy.email}`}
                  </p>
                </div>
                <StatusBadge status={fax.status} />
                <span className="text-xs text-surface-400 whitespace-nowrap">
                  {new Date(fax.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
