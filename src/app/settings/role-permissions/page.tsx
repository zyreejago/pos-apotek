"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { goeyToast } from "@/components/ui/goey-toaster";
import ConfirmModal from "@/components/ConfirmModal";
import OffCanvas from "@/components/OffCanvas";
import PageHeader from "@/components/PageHeader";
import { useRequirePermission } from "@/hooks/useRequirePermission";

type Role = { id: number; name: string };
type PermItem = { module: string; create: boolean; edit: boolean; delete: boolean; show: boolean };
type PermAction = keyof Omit<PermItem, 'module'>;
const ALL_PERM_ACTIONS: PermAction[] = ['create', 'edit', 'delete', 'show'];

const MODULE_CONFIG: Record<string, string[]> = {
  'Management Product': ['create', 'edit', 'delete', 'show'],
  'Transactions': ['create', 'show'],
  'Management Pengguna': ['create', 'edit', 'delete', 'show'],
  'Sales Report': ['show', 'create'],
  'Peramalan Stok': ['show'],
  'Substitutions': ['show'],
  'Suppliers': ['create', 'edit', 'delete', 'show'],
  'Stock Opname': ['create', 'show'],
  'Role & Permission': ['show', 'create', 'edit', 'delete'],
  'Transaction Setting': ['show', 'edit'],
  'Audit Trail': ['show'],
  'Approval Faktur': ['show', 'edit'],
  'Riwayat Pembelian': ['show'],
  'Resep Dokter': ['create', 'edit', 'delete', 'show'],
};

export default function Page() {
  const { loading: permLoading, hasPermission, currentUserRole } =
    useRequirePermission("Role & Permission");
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
  const authHeaders = useMemo<Record<string, string>>(() => {
    if (!token) return {} as Record<string, string>;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const filteredPerms = useMemo(() => {
    if (!query) return perms;
    return perms.filter(p => p.module.toLowerCase().includes(query.toLowerCase()));
  }, [perms, query]);

  const canManage = currentUserRole === "superadmin";

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/rbac/roles?t=${Date.now()}`, { headers: authHeaders });
      
      if (res.status === 401) {
        goeyToast.error("Sesi berakhir. Silakan login kembali.", {
            description: "Token akses Anda sudah tidak valid."
        });
        router.push("/login");
        return;
      }

      if (res.ok) {
        const data: Role[] = await res.json();
        setRoles(data);
        setSelectedRole((prev) => prev ?? (data.length > 0 ? data[0] : null));
      } else {
        console.error("Failed to fetch roles:", res.statusText);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  }, [authHeaders, router]);

  const fetchPerms = useCallback(async (roleId: number) => {
    setLoading(true);
    setHasChanges(false);
    try {
      const res = await fetch(`http://localhost:5000/api/rbac/permissions?roleId=${roleId}&t=${Date.now()}`, { headers: authHeaders });
      
      if (res.status === 401) {
        goeyToast.error("Sesi berakhir. Silakan login kembali.", {
            description: "Token akses Anda sudah tidak valid."
        });
        router.push("/login");
        return;
      }

      if (res.ok) {
        const data: PermItem[] = await res.json();
        const cleanedData = data.map(p => {
             const config = MODULE_CONFIG[p.module];
             if (config) {
                 return {
                     ...p,
                     create: config.includes('create') ? p.create : false,
                     edit: config.includes('edit') ? p.edit : false,
                     delete: config.includes('delete') ? p.delete : false,
                     show: config.includes('show') ? p.show : false,
                 };
             }
             return p;
        });
        setPerms(cleanedData);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, router]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (selectedRole) fetchPerms(selectedRole.id);
  }, [selectedRole, fetchPerms]);

  const togglePerm = (m: string, a: keyof Omit<PermItem, "module">, val: boolean) => {
    if (!selectedRole) return;
    if (!canManage) return;
    setPerms((prev) =>
      prev.map((x) => {
        if (x.module !== m) return x;

        const config = MODULE_CONFIG[x.module] ?? ["create", "edit", "delete", "show"];
        const next: PermItem = { ...x, [a]: val } as PermItem;

        for (const act of ["create", "edit", "delete", "show"] as const) {
          if (!config.includes(act)) next[act] = false;
        }

        if (a !== "show" && val && config.includes("show")) {
          next.show = true;
        }

        if (a === "show" && !val) {
          next.create = false;
          next.edit = false;
          next.delete = false;
        }

        return next;
      })
    );
    setHasChanges(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    if (!canManage) return;
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
        goeyToast.error("Sesi berakhir. Silakan login kembali.", {
            description: "Token akses Anda sudah tidak valid."
        });
        router.push("/login");
        return;
      }

      if (res.ok) {
        goeyToast.success("Hak akses berhasil disimpan", {
          description: `Izin akses untuk role ${selectedRole.name} telah diperbarui.`
        });
        setHasChanges(false);
      } else {
        const data = await res.json();
        goeyToast.error(data.message || "Gagal menyimpan hak akses", {
            description: "Terjadi kesalahan saat menyimpan perubahan hak akses."
        });
      }
    } catch (error) {
      console.error("Error saving permissions:", error);
      goeyToast.error("Terjadi kesalahan saat menyimpan hak akses", {
          description: "Periksa koneksi internet Anda dan coba lagi."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = (role: Role) => {
    if (!canManage) return;
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Role',
      message: `Apakah Anda yakin ingin menghapus role "${role.name}"? Tindakan ini tidak dapat dibatalkan.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/rbac/roles/${role.id}`, {
            method: "DELETE",
            headers: authHeaders
          });

          if (res.status === 401) {
            goeyToast.error("Sesi berakhir. Silakan login kembali.", {
                description: "Token akses Anda sudah tidak valid."
            });
            router.push("/login");
            return;
          }

          if (res.ok) {
            setRoles(prev => prev.filter(r => r.id !== role.id));
            if (selectedRole?.id === role.id) {
              setSelectedRole(null);
              setPerms([]);
            }
            goeyToast.success("Role berhasil dihapus", {
              description: `Role ${role.name} telah dihapus dari sistem.`
            });
          } else {
            const data = await res.json();
            goeyToast.error(data.message || "Gagal menghapus role", {
                description: "Terjadi kesalahan saat menghapus role."
            });
          }
        } catch (error) {
          console.error("Error deleting role:", error);
          goeyToast.error("Terjadi kesalahan saat menghapus role", {
              description: "Periksa koneksi internet Anda dan coba lagi."
          });
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const addRole = async () => {
    if (!canManage) return;
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
        goeyToast.error("Sesi Berakhir", {
            description: "Silakan login kembali untuk melanjutkan."
        });
        router.push("/login");
        return;
      }

      const data = await res.json();

      if (res.ok) {
        setRoles(prev => [...prev, data]);
        setSelectedRole(data);
        setShowAdd(false);
        setNewRole("");
        goeyToast.success("Role berhasil ditambahkan", {
          description: `Role baru ${data.name} telah berhasil dibuat.`
        });
      } else {
        goeyToast.error(data.message || "Gagal menambahkan role", {
            description: "Terjadi kesalahan saat menambahkan role baru."
        });
      }
    } catch (error) {
      console.error("Error adding role:", error);
      goeyToast.error("Terjadi kesalahan saat menambahkan role", {
          description: "Periksa koneksi internet Anda dan coba lagi."
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (permLoading || !hasPermission) ? (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">Loading...</div>
  ) : (
    <div className="bg-gray-50 min-h-screen relative">
      <PageHeader 
        title="Role Permissions"
        subtitle="Manage roles and permissions"
        breadcrumbs={[{ label: 'Settings' }, { label: 'Role Permissions' }]}
        rightContent={
          canManage && (
            <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors">
              Add Role & Permissions
            </button>
          )
        }
      />
      <div className="p-8 pt-0">
        {!canManage ? (
          <div className="bg-amber-50 border border-amber-100 text-amber-800 rounded-xl px-4 py-3 mb-6 text-sm">
            Halaman ini hanya bisa dikelola oleh superadmin.
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white border border-gray-100 rounded-xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-gray-800 font-semibold">List Role</div>
              <div className="text-xs text-gray-500">{roles.length} role</div>
            </div>
            <div className="overflow-hidden border border-gray-100 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left font-medium px-3 py-2">Name</th>
                    <th className="text-right font-medium px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-t border-gray-100 transition-colors group ${
                        selectedRole?.id === r.id ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedRole(r)}
                      role="button"
                      tabIndex={0}
                    >
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-800">{r.name}</div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canManage ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRole(r);
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {roles.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-gray-500" colSpan={2}>
                        No roles
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-8 bg-white border border-gray-100 rounded-xl p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <div className="text-gray-800 font-semibold">Permissions</div>
                <div className="text-xs text-gray-500">
                  {selectedRole ? (
                    <>
                      Role: <span className="font-medium text-gray-700">{selectedRole.name}</span>
                    </>
                  ) : (
                    "Pilih role untuk mulai mengatur hak akses"
                  )}
                </div>
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari module"
                className="w-full md:w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                disabled={!selectedRole}
              />
            </div>

            {!selectedRole ? (
              <div className="border border-dashed border-gray-200 rounded-lg p-6 text-sm text-gray-500">
                Pilih role di sebelah kiri untuk melihat dan mengubah permissions.
              </div>
            ) : (
              <>
                {(() => {
                  const usedActions = ALL_PERM_ACTIONS.filter(a =>
                    Object.values(MODULE_CONFIG).some(actions => actions.includes(a))
                  );
                  const colCount = 1 + usedActions.length;

                  return (
                <div className="overflow-x-auto border border-gray-100 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 bg-gray-50">
                        <th className="text-left font-medium px-3 py-2">Module</th>
                        {usedActions.map(a => (
                          <th key={a} className="font-medium px-3 py-2 text-center capitalize">{a}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td className="px-3 py-4 text-gray-500" colSpan={colCount}>
                            Loading...
                          </td>
                        </tr>
                      ) : (
                        filteredPerms.map((row) => (
                          <tr key={row.module} className="border-t border-gray-100">
                            <td className="px-3 py-3 text-gray-800">{row.module}</td>
                            {usedActions.map((a) => {
                              const isAllowed = MODULE_CONFIG[row.module]
                                ? MODULE_CONFIG[row.module].includes(a)
                                : true;
                              if (!isAllowed) {
                                return (
                                  <td key={a} className="px-3 py-3 text-center text-gray-300">
                                    -
                                  </td>
                                );
                              }
                              return (
                                <td key={a} className="px-3 py-3 text-center">
                                  <label className="inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="sr-only peer"
                                      checked={row[a]}
                                      onChange={(e) => togglePerm(row.module, a, e.target.checked)}
                                      disabled={!canManage}
                                    />
                                    <div
                                      className={`w-11 h-6 bg-gray-200 rounded-full peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:bg-blue-600 relative transition-colors duration-300 ${
                                        !canManage ? "opacity-50 cursor-not-allowed" : ""
                                      }`}
                                    ></div>
                                  </label>
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                  );
                })()}

                {canManage ? (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={handleSavePermissions}
                      disabled={!hasChanges || isSaving}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                        hasChanges && !isSaving
                          ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Role OffCanvas */}
      <OffCanvas
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Role & Permissions"
      >
        <input 
          value={newRole} 
          onChange={e => setNewRole(e.target.value)} 
          placeholder="Role name" 
          className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-6" 
        />
        <div className="flex justify-end gap-3">
          <button 
            onClick={() => setShowAdd(false)} 
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700" 
            disabled={isSaving}
          >
            Cancel
          </button>
          <button 
            onClick={addRole} 
            className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:bg-blue-300 disabled:cursor-not-allowed"
            disabled={isSaving || !newRole.trim()}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </OffCanvas>

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
