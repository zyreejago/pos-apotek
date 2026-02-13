"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import Header from "@/components/Header";
import { useRequirePermission } from "@/hooks/useRequirePermission";

export default function Page() {
  const { loading: permLoading, hasPermission, checkActionPermission } = useRequirePermission('System Settings');
  const { showToast } = useToast();
  const router = useRouter();
  
  const [settings, setSettings] = useState<{
    ppn_rate: number | string;
    discount_rate: number | string;
  }>({
    ppn_rate: 0,
    discount_rate: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch(`http://localhost:5000/api/settings?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      });
      
      if (!res.ok) throw new Error('Failed to fetch settings');
      
      const data = await res.json();
      setSettings({
        ppn_rate: Number(data.ppn_rate) || 0,
        discount_rate: Number(data.discount_rate) || 0
      });
    } catch (error) {
      console.error(error);
      showToast('Error loading settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!checkActionPermission('edit')) {
        showToast('You do not have permission to edit settings', 'error');
        return;
    }

    setSaving(true);
    const sanitizedSettings = {
      ppn_rate: settings.ppn_rate === '' ? 0 : Number(settings.ppn_rate),
      discount_rate: settings.discount_rate === '' ? 0 : Number(settings.discount_rate)
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/settings', {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(sanitizedSettings)
      });
      
      if (!res.ok) throw new Error('Failed to save settings');
      
      setSettings(sanitizedSettings);
      showToast('Settings saved successfully', 'success');
    } catch (error) {
      console.error(error);
      showToast('Error saving settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (permLoading || loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!hasPermission) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-6">You do not have permission to view this page.</p>
            <button 
                onClick={() => router.back()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
                Go Back
            </button>
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Transactions Settings" />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-6 text-gray-800">Transactions Settings</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PPN Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings.ppn_rate}
                  onChange={(e) => setSettings({ ...settings, ppn_rate: e.target.value === '' ? '' : Number(e.target.value) })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all ${!checkActionPermission('edit') ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="e.g., 11"
                  disabled={!checkActionPermission('edit')}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Value Added Tax (PPN) percentage applied to all transactions. Set to 0 to disable.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings.discount_rate}
                  onChange={(e) => setSettings({ ...settings, discount_rate: e.target.value === '' ? '' : Number(e.target.value) })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all ${!checkActionPermission('edit') ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="e.g., 5"
                  disabled={!checkActionPermission('edit')}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Global discount percentage applied to all transactions. Set to 0 to disable.
                </p>
              </div>

              {checkActionPermission('edit') && (
                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
