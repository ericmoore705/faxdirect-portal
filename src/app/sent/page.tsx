"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SentFax {
  id: string;
  toNumber: string;
  fromNumber: string;
  faxSid: string;
  status: string;
  fileName: string;
  fileUrl: string;
  sentAt: string;
  completedAt: string | null;
  duration: number | null;
  numPages: number | null;
  errorMessage: string | null;
  retryCount: number;
  sentBy: { name: string; email: string };
}

const STATUS_OPTIONS = ["", "queued", "sending", "delivered", "failed", "retrying", "canceled"];

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "delivered" ? "badge-delivered" :
    status === "sending" ? "badge-sending" :
    status === "queued" ? "badge-queued" :
    status === "failed" ? "badge-failed" :
    status === "retrying" ? "badge-retrying" :
    "badge-queued";
  return <span className={`badge ${cls}`}>{status}</span>;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function SentFaxesPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [faxes, setFaxes] = useState<SentFax[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/");
  }, [authStatus, router]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    const params = new URLSearchParams({ type: "sent", page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/fax/history?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setFaxes(d.faxes || []);
        setTotal(d.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session, page, search, statusFilter]);

  if (authStatus === "loading" || !session) {
    return <div className="p-8"><div className="animate-pulse h-8 w-48 bg-surface-200 rounded" /></div>;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-surface-800 mb-6">Sent Faxes</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          className="input sm:max-w-xs"
          placeholder="Search number or filename..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="input sm:max-w-[160px]"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="flex-1" />
        <span className="text-sm text-surface-400 self-center">{total} faxes</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 text-left">
                <th className="px-5 py-3 font-medium text-surface-400">To</th>
                <th className="px-5 py-3 font-medium text-surface-400">Files</th>
                <th className="px-5 py-3 font-medium text-surface-400">Status</th>
                <th className="px-5 py-3 font-medium text-surface-400">Pages</th>
                <th className="px-5 py-3 font-medium text-surface-400">Duration</th>
                <th className="px-5 py-3 font-medium text-surface-400">Sent By</th>
                <th className="px-5 py-3 font-medium text-surface-400">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-surface-400">Loading...</td></tr>
              ) : faxes.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-surface-400">No faxes found</td></tr>
              ) : (
                faxes.map((fax) => (
                  <tr key={fax.id} className="hover:bg-surface-50">
                    <td className="px-5 py-3 font-mono text-xs">{fax.toNumber}</td>
                    <td className="px-5 py-3 max-w-[200px]">
                      <p className="truncate text-surface-600" title={fax.fileName}>{fax.fileName || "—"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={fax.status} />
                      {fax.retryCount > 0 && (
                        <span className="ml-1 text-xs text-surface-400">({fax.retryCount}x)</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-surface-500">{fax.numPages ?? "—"}</td>
                    <td className="px-5 py-3 text-surface-500">{formatDuration(fax.duration)}</td>
                    <td className="px-5 py-3 text-surface-500 text-xs">{fax.sentBy?.name || fax.sentBy?.email || "—"}</td>
                    <td className="px-5 py-3 text-surface-400 text-xs whitespace-nowrap">
                      {new Date(fax.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                      {new Date(fax.sentAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-between">
            <button
              className="btn-secondary text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span className="text-xs text-surface-400">Page {page} of {totalPages}</span>
            <button
              className="btn-secondary text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
