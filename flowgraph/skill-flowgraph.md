# Skill Flowgraph Analysis — Standar Penulisan

## Format Baku (Wajib)

Setiap file flowgraph (`*.txt`) WAJIB memiliki **6 seksi** dengan format berikut:

---

### SEKSI 1: KODE YANG DIUJI (Source Code)

```
KODE YANG DIUJI (Source Code):
===============================

No. | Node | Kode
----|------|-----
 1  |  1   | const functionName = async (...) => {
 2  |  1   |     e.preventDefault();
 3  |  2   |     if (condition) {
...
```

**Aturan:**
- Gunakan tabel dengan 3 kolom: `No.`, `Node`, `Kode`
- Kolom `Node` menunjukkan nomor node yang sesuai (dari seksi 2)
- Baris kode yang termasuk node yang sama boleh memiliki nomor node yang sama
- Fungsi multi-baris ditulis ringkas, tidak perlu persis source asli

---

### SEKSI 2: PENJELASAN NODE

```
1. PENJELASAN NODE
==================
Node 1  : e.preventDefault() - Mencegah reload form
Node 2  : Cek apakah mode add && !permission
Node 3  : Jika true: toast error, return
...
```

**Aturan:**
- Setiap node punya 1 baris dengan format: `Node N : deskripsi`
- Nomor node harus URUT dari 1 sampai N
- Deskripsi jelas dan sesuai dengan kode

---

### SEKSI 3: FLOWGRAPH (Edges)

```
2. FLOWGRAPH
=============
1 -> 2 -> 3 (T) -> 10
1 -> 2 -> 3 (F) -> 4 -> 5 -> 6
...
```

**Aturan:**
- Gunakan `->` untuk menunjukkan alur
- Tambahkan `(T)` untuk branch true, `(F)` untuk false
- Setiap baris mewakili satu jalur alur

---

### SEKSI 4: GAMBAR FLOWGRAPH (Visual)

```
3. GAMBAR FLOWGRAPH (VISUAL)
=============================
    ┌──────┐
    │  1   │
    └──┬───┘
       │
    ┌──▼───┐
    │  2   │
    └──┬───┘
       │
   ┌───┴───┐
   │ T     │ F
   │       │
┌──▼───┐ ┌──▼───┐
...
```

**Aturan:**
- Gunakan karakter ASCII box: `┌ ─ ┐ │ └ ┘ ┴ ┬ ├ ┤ ┼ ▼ ▶`
- Setiap node dalam kotak: `┌──┐`, `│1 │`, `└──┘`
- Percabangan dengan `┌───┴───┐` dan label `T` / `F`
- Node 30 (Selesai) hanya SATU di paling bawah

---

### SEKSI 5: MENGHITUNG CC (Cyclomatic Complexity)

```
4. MENGHITUNG CC (CYCLOMATIC COMPLEXITY)
==========================================
Rumus 1: V(G) = E - N + 2
E = ..., N = ...
V(G) = ... - ... + 2 = ...

Rumus 2: V(G) = P + 1
Predicate Nodes: ..., ..., ... = ... node
V(G) = ... + 1 = ...

Rumus 3: V(G) = R = ...
```

**Aturan:**
- Hitung E (Edge), N (Node), P (Predicate Node), R (Region)
- Tuliskan 3 rumus: `E - N + 2`, `P + 1`, `R`
- V(G) harus SAMA dari ketiga rumus

---

### SEKSI 6: IDENTIFIKASI PATH

```
5. IDENTIFIKASI PATH
=====================
CC = ..., terdapat ... jalur independen:

PATH 1: Nama path
1 -> 2 -> 3 -> 4 -> ... -> N

PATH 2: Nama path
1 -> 2 -> ... -> N
```

**Aturan:**
- Jumlah path minimal = CC
- Setiap path punya NAMA (deskripsi skenario)
- Path ditulis lengkap dari node 1 ke node akhir

---

### SEKSI 7: RINGKASAN

```
6. RINGKASAN
=============
N (Node)             : ...
E (Edge)             : ...
P (Predicate Node)   : ...
V(G) = E - N + 2     : ...
V(G) = P + 1         : ...
Jumlah Path          : ...
Interpretasi         : RENDAH (<=10) / SEDANG (11-20) / KOMPLEKS (>20)
```

---

## Contoh Lengkap

Lihat file: `produk.txt`, `login.txt`, `register.txt`

## Daftar File Flowgraph

| File | Fungsi |
|------|--------|
| `produk.txt` | handleSubmit (Products) |
| `login.txt` | handleLogin |
| `register.txt` | handleRegister |
| `approvals.txt` | handleApprove, handleReject, submitRevision |
| `financial-transactions.txt` | handlePostTransaction |
| `forgot-password.txt` | requestCode, verifyCode, resetPassword |
| `general-journal.txt` | handleSubmit (Journal) |
| `peramalan.txt` | fetchLatestForecasts |
| `prescriptions.txt` | handleSubmit, handlePaymentAndCreatePrescription |
| `profile.txt` | handleUpdateProfile, handleChangePassword |
| `purchase-returns.txt` | handleLookup, handleSubmit, handleConfirmSubmit |
| `role-permissions.txt` | handleSavePermissions, addRole |
| `sale-returns.txt` | handleLookup, handleSubmit, handleConfirmSubmit |
| `stock-opname.txt` | handleSubmitOpname |
| `suppliers.txt` | handleSubmit (Suppliers) |
| `transactions.txt` | handlePayment |
| `users.txt` | handleSubmit (Users) |
