"use client";

import { useMemo, useState } from "react";
import { useRequirePermission } from '@/hooks/useRequirePermission';
import Header from '@/components/Header';

export default function Page() {
  useRequirePermission('Substitutions');

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ recommendations: { name: string; source?: string }[]; advice?: string; sources?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const items = data?.recommendations || [];
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const search = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/substitutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal memuat rekomendasi");
      setData(json);
      setPage(1);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Terjadi kesalahan";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <Header 
        title="Substitutions"
        subtitle="Subtitusi Products"
        breadcrumbs={[{ label: 'Products' }, { label: 'Substitutions' }]}
      />

      <div className="p-8 pt-0">
      <div className="bg-white border border-gray-100 rounded-xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-gray-600">Showing {Math.min(pageSize, total)} of {total} Products</div>
          <div className="flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Input Keluhan"
              className="w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <button onClick={search} disabled={loading || !input.trim()} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50">
              {loading ? "Mencari..." : "Cari"}
            </button>
          </div>
        </div>

        {error && <div className="text-red-600 mb-4 text-sm">{error}</div>}

        <div className="overflow-hidden border border-gray-100 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left font-medium px-3 py-2">Name</th>
                <th className="font-medium px-3 py-2">Sumber</th>
                <th className="font-medium px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {current.map((r, i) => {
                const isOnDb = !!r.source;
                const src = r.source ? (() => { try { return new URL(r.source).hostname; } catch { return r.source; } })() : "-";
                return (
                  <tr key={`${r.name}-${i}`} className="border-t border-gray-100">
                    <td className="px-3 py-3 text-gray-800">{r.name}</td>
                    <td className="px-3 py-3 text-gray-600">
                      {r.source ? <a href={r.source} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{src}</a> : "-"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${isOnDb ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnDb ? 'bg-green-600' : 'bg-red-600'}`}></span>
                        {isOnDb ? 'On Database' : 'Tidak Terdaftar'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {current.length === 0 && (
                <tr><td className="px-3 py-4 text-gray-500" colSpan={3}>Tidak ada rekomendasi</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select className="border border-gray-200 rounded px-2 py-1" value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(1); }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
            <span>per page</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{(page-1)*pageSize+1}-{Math.min(page*pageSize, total)} of {total}</span>
            <button className="px-2 py-1 border rounded" onClick={() => setPage(Math.max(1, page-1))} disabled={page===1}>{"<"}</button>
            <span>{page}</span>
            <button className="px-2 py-1 border rounded" onClick={() => setPage(Math.min(totalPages, page+1))} disabled={page===totalPages}>{">"}</button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
