"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Edit } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";
import Header from "@/components/Header";
import { useRequirePermission } from "@/hooks/useRequirePermission";

type Role = { id: number; name: string };
type PermItem = { module: string; create: boolean; edit: boolean; delete: boolean; show: boolean };

export default function Page() {
  const { loading: permLoading, hasPermission } = useRequirePermission('System Settings');
  const { showToast } = useToast();
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [perms, setPerms] = useState<PermItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [query, setQuery] = useState("");
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info',
    onConfirm: async () => {},
  });
  const [hasChanges, setHasChanges] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const filteredPerms = useMemo(() => {
    if (!query) return perms;
    return perms.filter(p => p.module.toLowerCase().includes(query.toLowerCase()));
  }, [perms, query]);

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchRoles = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/rbac/roles?t=${Date.now()}`, { headers: authHeaders });
      
      if (res.status === 401) {
        showToast("Session expired. Please login again.", "error");
        router.push("/login");
        return;
      }

      if (res.ok) {
        const data: Role[] = await res.json();
        setRoles(data);
        if (!selectedRole && data.length > 0) setSelectedRole(data[0]);
      } else {
        console.error("Failed to fetch roles:", res.statusText);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const fetchPerms = async (roleId: number) => {
    setLoading(true);
    setHasChanges(false);
    try {
      const res = await fetch(`http://localhost:5000/api/rbac/permissions?roleId=${roleId}&t=${Date.now()}`, { headers: authHeaders });
      
      if (res.status === 401) {
        showToast("Session expired. Please login again.", "error");
        router.push("/login");
        return;
      }

      if (res.ok) {
        const data: PermItem[] = await res.json();
        setPerms(data);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    if (selectedRole) fetchPerms(selectedRole.id);
  }, [selectedRole?.id]);

  const togglePerm = (m: string, a: keyof Omit<PermItem, "module">, val: boolean) => {
    if (!selectedRole) return;
    setPerms(prev => prev.map(x => x.module === m ? { ...x, [a]: val } : x));
    setHasChanges(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setIsSaving(true);
    try {
      const res = await fetch("http://localhost:5000/api/rbac/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ 
          roleId: selectedRole.id, 
          permissions: perms 
        })
      });

      if (res.status === 401) {
        showToast("Session expired. Please login again.", "error");
        router.push("/login");
        return;
      }

      if (res.ok) {
        showToast("Permissions saved successfully", "success");
        setHasChanges(false);
      } else {
        const data = await res.json();
        showToast(data.message || "Failed to save permissions", "error");
      }
    } catch (error) {
      console.error("Error saving permissions:", error);
      showToast("Error saving permissions", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = (role: Role) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Role',
      message: `Are you sure you want to delete role "${role.name}"? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/rbac/roles/${role.id}`, {
            method: "DELETE",
            headers: authHeaders
          });

          if (res.status === 401) {
            showToast("Session expired. Please login again.", "error");
            router.push("/login");
            return;
          }

          if (res.ok) {
            setRoles(prev => prev.filter(r => r.id !== role.id));
            if (selectedRole?.id === role.id) {
              setSelectedRole(null);
              setPerms([]);
            }
            showToast("Role deleted successfully", "success");
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          } else {
            const data = await res.json();
            showToast(data.message || "Failed to delete role", "error");
          }
        } catch (error) {
          console.error("Error deleting role:", error);
          showToast("Error deleting role", "error");
        }
      }
    });
  };

  const addRole = async () => {
    const name = newRole.trim();
    if (!name) return;

    setIsSaving(true);
    try {
      const res = await fetch("http://localhost:5000/api/rbac/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ name })
      });
      
      if (res.status === 401) {
        showToast("Session expired. Please login again.", "error");
        router.push("/login");
        return;
      }

      const data = await res.json();

      if (res.ok) {
        setRoles(prev => [...prev, data]);
        setSelectedRole(data);
        setShowAdd(false);
        setNewRole("");
        showToast("Role added successfully", "success");
      } else {
        showToast(data.message || "Failed to add role", "error");
      }
    } catch (error) {
      console.error("Error adding role:", error);
      showToast("Error adding role", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (permLoading || !hasPermission) ? (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">Loading...</div>
  ) : (
    <div className="bg-gray-50 min-h-screen relative">
      <Header 
        title="Role Permissions"
        subtitle="Manage roles and permissions"
        breadcrumbs={[{ label: 'Settings' }, { label: 'Role Permissions' }]}
        rightContent={
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors">
            Add Role & Permissions
          </button>
        }
      />

      <div className="p-8 pt-0">
      <div className="bg-white border border-gray-100 rounded-xl p-4 md:p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari Permissions" className="w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
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
                        <div className={`w-11 h-6 bg-gray-200 rounded-full peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:bg-blue-600 relative transition-colors duration-300`}></div>
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
        
        {selectedRole && (
          <div className="mt-6 flex justify-end">
            <button 
              onClick={handleSavePermissions}
              disabled={!hasChanges || isSaving}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                hasChanges && !isSaving
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 md:p-6">
        <div className="text-gray-800 font-semibold mb-3">List Role</div>
        <div className="overflow-hidden border border-gray-100 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left font-medium px-3 py-2">Name</th>
                <th className="text-right font-medium px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id} className={`border-t border-gray-100 transition-colors group ${selectedRole?.id === r.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-3 py-3">
                    <button className="text-left w-full" onClick={() => setSelectedRole(r)}>{r.name}</button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedRole(r); }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit Permissions"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteRole(r); }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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
      </div>

      {/* Add Role Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white w-[420px] max-w-[90vw] rounded-xl p-6">
            <div className="text-lg font-semibold mb-4">Add Role & Permissions</div>
            <input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Role name" className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-4" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-gray-200" disabled={isSaving}>Cancel</button>
              <button 
                onClick={addRole} 
                className="px-4 py-2 rounded-lg bg-blue-500 text-white disabled:bg-blue-300 disabled:cursor-not-allowed"
                disabled={isSaving || !newRole.trim()}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />
    </div>
  );
}
