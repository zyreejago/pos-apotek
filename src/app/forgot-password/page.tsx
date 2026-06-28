"use client";

import { API_URL } from '@/lib/api-config';
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { goeyToast } from "@/components/ui/goey-toaster";

type Step = "request" | "verify" | "reset" | "done";

function isValidEmail(email: string) {
  const s = email.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmitRequest = useMemo(() => isValidEmail(email) && !loading, [email, loading]);
  const canSubmitVerify = useMemo(() => isValidEmail(email) && /^\d{6}$/.test(code) && !loading, [email, code, loading]);
  const canSubmitReset = useMemo(() => {
    if (!isValidEmail(email)) return false;
    if (!resetToken) return false;
    if (!newPassword.trim() || newPassword.trim().length < 6) return false;
    if (newPassword !== confirmPassword) return false;
    return !loading;
  }, [email, resetToken, newPassword, confirmPassword, loading]);

  const requestCode = async () => {
    if (!isValidEmail(email)) {
      goeyToast.error("Email tidak valid", { description: "Masukkan email yang terdaftar." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        goeyToast.error("Gagal mengirim kode", {
          description: data?.message || "Terjadi kesalahan saat mengirim kode."
        });
        return;
      }

      setStep("verify");
      goeyToast.success("Kode terkirim", {
        description: "Cek inbox/spam email Anda. Kode berlaku 3 menit."
      });
    } catch {
      goeyToast.error("Terjadi kesalahan", { description: "Periksa koneksi internet Anda." });
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      goeyToast.error("Data tidak valid", { description: "Pastikan email dan kode 6 digit sudah benar." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-reset-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        goeyToast.error("Kode tidak valid", {
          description: data?.message || "Kode salah atau sudah kedaluwarsa."
        });
        return;
      }

      const token = typeof data?.resetToken === "string" ? data.resetToken : null;
      if (!token) {
        goeyToast.error("Gagal verifikasi", { description: "Token reset tidak ditemukan." });
        return;
      }

      setResetToken(token);
      setStep("reset");
      goeyToast.success("Kode terverifikasi", { description: "Sekarang Anda bisa membuat password baru." });
    } catch {
      goeyToast.error("Terjadi kesalahan", { description: "Periksa koneksi internet Anda." });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!canSubmitReset) {
      if (newPassword !== confirmPassword) {
        goeyToast.error("Password tidak sama", { description: "Konfirmasi password harus sama." });
      } else {
        goeyToast.error("Data belum lengkap", { description: "Pastikan semua field terisi benar." });
      }
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), resetToken, newPassword })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        goeyToast.error("Gagal mengganti password", {
          description: data?.message || "Terjadi kesalahan saat mengganti password."
        });
        return;
      }

      setStep("done");
      goeyToast.success("Password berhasil diganti", {
        description: "Silakan login kembali menggunakan password baru."
      });
    } catch {
      goeyToast.error("Terjadi kesalahan", { description: "Periksa koneksi internet Anda." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8F9FA] w-full">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-[520px] p-4 sm:p-8 md:p-10">
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft size={16} />
          Kembali ke Login
        </button>

        <div className="text-center mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Lupa Password</h1>
          <p className="text-sm text-gray-500">
            {step === "request" && "Masukkan email terdaftar untuk menerima kode verifikasi."}
            {step === "verify" && "Masukkan kode 6 digit yang dikirim ke email Anda."}
            {step === "reset" && "Buat password baru untuk akun Anda."}
            {step === "done" && "Selesai. Anda bisa login menggunakan password baru."}
          </p>
        </div>

        {step !== "done" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={step !== "request"}
                className="block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="email@email.com"
                required
              />
              {step !== "request" && (
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2"
                  onClick={() => {
                    setStep("request");
                    setCode("");
                    setResetToken(null);
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Ganti email
                </button>
              )}
            </div>

            {step === "request" && (
              <button
                type="button"
                disabled={!canSubmitRequest}
                onClick={requestCode}
                className="w-full bg-blue-500 text-white py-3.5 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm text-sm"
              >
                {loading ? "Mengirim..." : "Kirim Kode"}
              </button>
            )}

            {step === "verify" && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Kode Verifikasi</label>
                  <input
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                    className="block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all tracking-[0.35em] text-center font-bold"
                    placeholder="______"
                    required
                  />
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2"
                    onClick={requestCode}
                    disabled={loading}
                  >
                    Kirim ulang kode
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!canSubmitVerify}
                  onClick={verifyCode}
                  className="w-full bg-blue-500 text-white py-3.5 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm text-sm"
                >
                  {loading ? "Memverifikasi..." : "Verifikasi Kode"}
                </button>
              </>
            )}

            {step === "reset" && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Password Baru</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                      placeholder="Minimal 6 karakter"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Konfirmasi Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Ulangi password baru"
                    required
                  />
                </div>

                <button
                  type="button"
                  disabled={!canSubmitReset}
                  onClick={resetPassword}
                  className="w-full bg-blue-500 text-white py-3.5 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm text-sm"
                >
                  {loading ? "Menyimpan..." : "Simpan Password Baru"}
                </button>
              </>
            )}
          </div>
        )}

        {step === "done" && (
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full bg-blue-500 text-white py-3.5 rounded-lg font-semibold hover:bg-blue-600 transition-colors shadow-sm text-sm"
          >
            Kembali ke Login
          </button>
        )}
      </div>
    </div>
  );
}
