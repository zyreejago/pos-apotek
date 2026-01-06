"use client";

import { useEffect, useMemo, useState } from "react";

type Role = { id: number; name: string };
type PermItem = { module: string; create: boolean; edit: boolean; delete: boolean; show: boolean };

export default function Page() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [perms, setPerms] = useState<PermItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [query, setQuery] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const filteredPerms = useMemo(() => {
    if (!query) return perms;
    return perms.filter(p => p.module.toLowerCase().includes(query.toLowerCase()));
  }, [perms, query]);

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchRoles = async () => {
    const res = await fetch("http://localhost:5000/api/rbac/roles", { headers: authHeaders });
    if (res.ok) {
      const data: Role[] = await res.json();
      setRoles(data);
      if (!selectedRole && data.length > 0) setSelectedRole(data[0]);
    }
  };

  const fetchPerms = async (roleId: number) => {
    setLoading(true);
    const res = await fetch(`http://localhost:5000/api/rbac/permissions?roleId=${roleId}`, { headers: authHeaders });
    if (res.ok) {
      const data: PermItem[] = await res.json();
      setPerms(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    if (selectedRole) fetchPerms(selectedRole.id);
  }, [selectedRole?.id]);

  const togglePerm = async (m: string, a: keyof Omit<PermItem, "module">, val: boolean) => {
    if (!selectedRole) return;
    const res = await fetch("http://localhost:5000/api/rbac/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ roleId: selectedRole.id, module: m, action: a, allowed: val })
    });
    if (res.ok) {
      setPerms(prev => prev.map(x => x.module === m ? { ...x, [a]: val } : x));
    }
  };

  const addRole = async () => {
    const name = newRole.trim();
    if (!name) return;
    const res = await fetch("http://localhost:5000/api/rbac/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      const r: Role = await res.json();
      setRoles(prev => [...prev, r]);
      setSelectedRole(r);
      setShowAdd(false);
      setNewRole("");
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-gray-500">Role & Permissions</div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold">Add Role & Permissions</button>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 md:p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="like kasir" className="w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          {selectedRole && <div className="text-sm text-gray-500">Role: <span className="font-medium text-gray-700">{selectedRole.name}</span></div>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left font-medium px-3 py-2">Permissions</th>
                <th className="font-medium px-3 py-2 text-center">create</th>
                <th className="font-medium px-3 py-2 text-center">edit</th>
                <th className="font-medium px-3 py-2 text-center">delete</th>
                <th className="font-medium px-3 py-2 text-center">show</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className="px-3 py-4" colSpan={5}>Loading...</td></tr>
              )}
              {!loading && filteredPerms.map(row => (
                <tr key={row.module} className="border-t border-gray-100">
                  <td className="px-3 py-3 text-gray-800">{row.module}</td>
                  {(["create","edit","delete","show"] as const).map(a => (
                    <td key={a} className="px-3 py-3 text-center">
                      <label className="inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={row[a]} onChange={e => togglePerm(row.module, a, e.target.checked)} />
                        <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-blue-500 transition-colors relative">
                          <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full peer-checked:left-5 transition-all"></div>
                        </div>
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select className="border border-gray-200 rounded px-2 py-1">
              <option>10</option>
              <option>25</option>
            </select>
            <span>per page</span>
          </div>
          <div>1 of 1</div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 md:p-6">
        <div className="text-gray-800 font-semibold mb-3">List Role</div>
        <div className="overflow-hidden border border-gray-100 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left font-medium px-3 py-2">Name</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id} className={`border-t border-gray-100 ${selectedRole?.id === r.id ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-3">
                    <button className="text-left w-full" onClick={() => setSelectedRole(r)}>{r.name}</button>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr><td className="px-3 py-4 text-gray-500">No roles</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select className="border border-gray-200 rounded px-2 py-1">
              <option>10</option>
              <option>25</option>
            </select>
            <span>per page</span>
          </div>
          <div>1 of 1</div>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white w-[420px] max-w-[90vw] rounded-xl p-6">
            <div className="text-lg font-semibold mb-4">Add Role & Permissions</div>
            <input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Role name" className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-4" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-gray-200">Cancel</button>
              <button onClick={addRole} className="px-4 py-2 rounded-lg bg-blue-500 text-white">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
