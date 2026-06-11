"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ReceivedFax {
  id: string;
  fromNumber: string;
  toNumber: string;
  faxSid: string;
  status: string;
  numPages: number | null;
  mediaUrl: string | null;
  localUrl: string | null;
  receivedAt: string;
}

export default function ReceivedFaxesPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [faxes, setFaxes] = useState<ReceivedFax[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/");
  }, [authStatus, router]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    const params = new URLSearchParams({ type: "received", page: String(page), limit: String(limit) });
    if (search) params.set("search", search);

    fetch(`/api/fax/history?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setFaxes(d.faxes || []);
        setTotal(d.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session, page, search]);

  if (authStatus === "loading" || !session) {
    return <div className="p-8"><div className="animate-pulse h-8 w-48 bg-surface-200 rounded" /></div>;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-surface-800 mb-6">Received Faxes</h1>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          className="input sm:max-w-xs"
          placeholder="Search by sender number..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <div className="flex-1" />
        <span className="text-sm text-surface-400 self-center">{total} faxes</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 text-left">
                <th className="px-5 py-3 font-medium text-surface-400">From</th>
                <th className="px-5 py-3 font-medium text-surface-400">Pages</th>
                <th className="px-5 py-3 font-medium text-surface-400">Status</th>
                <th className="px-5 py-3 font-medium text-surface-400">Received</th>
                <th className="px-5 py-3 font-medium text-surface-400">Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-surface-400">Loading...</td></tr>
              ) : faxes.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-surface-400">No received faxes found</td></tr>
              ) : (
                faxes.map((fax) => (
                  <tr key={fax.id} className="hover:bg-surface-50">
                    <td className="px-5 py-3 font-mono text-xs">{fax.fromNumber}</td>
                    <td className="px-5 py-3 text-surface-500">{fax.numPages ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className="badge badge-received">{fax.status}</span>
                    </td>
                    <td className="px-5 py-3 text-surface-400 text-xs whitespace-nowrap">
                      {new Date(fax.receivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                      {new Date(fax.receivedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </td>
                    <td className="px-5 py-3">
                      {(fax.localUrl || fax.mediaUrl) ? (
                        <a
                          href={fax.localUrl || fax.mediaUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-500 hover:text-brand-600 text-xs font-medium"
                        >
                          View PDF ↗
                        </a>
                      ) : (
                        <span className="text-surface-300 text-xs">unavailable</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-between">
            <button className="btn-secondary text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span className="text-xs text-surface-400">Page {page} of {totalPages}</span>
            <button className="btn-secondary text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
