import { useState, useEffect, useRef } from "react";
import { Plus, Search, X, Trash2, Upload, ArrowRight, RotateCcw, Clock, ImageOff } from "lucide-react";
import { supabase } from "./supabaseClient";

const STAGES = [
  { key: "cetak", label: "Cetak", accent: "#B5651D" },
  { key: "gunting", label: "Gunting", accent: "#55625F" },
  { key: "jahit", label: "Jahit", accent: "#8B2E3A" },
  { key: "packing", label: "Packing", accent: "#6B5637" },
];
const DONE_KEY = "selesai";
const COLUMNS = [...STAGES, { key: DONE_KEY, label: "Selesai", accent: "#3F6B4E" }];
const TABLE = "orders";

function newId() {
  return `pesanan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function stageMeta(key) {
  return COLUMNS.find((c) => c.key === key) || COLUMNS[0];
}
function nextStage(key) {
  const idx = STAGES.findIndex((s) => s.key === key);
  if (idx === -1) return key;
  return idx === STAGES.length - 1 ? DONE_KEY : STAGES[idx + 1].key;
}
function prevStage(key) {
  if (key === DONE_KEY) return STAGES[STAGES.length - 1].key;
  const idx = STAGES.findIndex((s) => s.key === key);
  return idx <= 0 ? key : STAGES[idx - 1].key;
}
function resizeImage(file, maxDim, cb) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h && w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
      else if (h >= w && h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => cb(null);
    img.src = e.target.result;
  };
  reader.onerror = () => cb(null);
  reader.readAsDataURL(file);
}
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// --- Mapping antara baris Supabase (snake_case) dan objek order di UI (camelCase) ---
function rowToOrder(row) {
  return {
    id: row.id,
    noResi: row.no_resi || "",
    deskripsi: row.deskripsi || "",
    image: row.image || null,
    stage: row.stage,
    createdAt: row.created_at,
    history: row.history || [],
  };
}

export default function App() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        setNotice("Gagal memuat data dari server. Periksa konfigurasi Supabase (.env) dan koneksi internet.");
        setOrders([]);
      } else {
        setOrders(data.map(rowToOrder));
      }
      setLoading(false);
    })();
  }, []);

  async function addOrder(formData) {
    const order = {
      id: newId(),
      noResi: formData.noResi.trim(),
      deskripsi: formData.deskripsi.trim(),
      image: formData.image || null,
      stage: "cetak",
      createdAt: new Date().toISOString(),
      history: [],
    };
    setOrders([order, ...orders]);
    setShowNew(false);
    const { error } = await supabase.from(TABLE).insert({
      id: order.id,
      no_resi: order.noResi,
      deskripsi: order.deskripsi,
      image: order.image,
      stage: order.stage,
      history: order.history,
      created_at: order.createdAt,
    });
    if (error) {
      setNotice("Gagal menyimpan pesanan baru ke server.");
      setOrders((cur) => cur.filter((o) => o.id !== order.id));
    }
  }

  async function persistUpdate(order, patch) {
    const updated = { ...order, ...patch };
    setOrders((cur) => cur.map((o) => (o.id === order.id ? updated : o)));
    const { error } = await supabase
      .from(TABLE)
      .update({ stage: updated.stage, history: updated.history })
      .eq("id", order.id);
    if (error) {
      setNotice("Gagal menyimpan perubahan ke server. Coba lagi.");
      setOrders((cur) => cur.map((o) => (o.id === order.id ? order : o)));
    }
  }

  function advance(order, nama) {
    const entry = { stage: order.stage, label: stageMeta(order.stage).label, nama: nama.trim(), at: new Date().toISOString() };
    persistUpdate(order, { stage: nextStage(order.stage), history: [...order.history, entry] });
  }

  function revert(order) {
    persistUpdate(order, { stage: prevStage(order.stage), history: order.history.slice(0, -1) });
  }

  async function removeOrder(id) {
    const prevOrders = orders;
    setOrders(orders.filter((o) => o.id !== id));
    setDetailId(null);
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      setNotice("Gagal menghapus pesanan di server.");
      setOrders(prevOrders);
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = orders.filter(
    (o) => !q || o.noResi.toLowerCase().includes(q) || o.deskripsi.toLowerCase().includes(q)
  );
  const detailOrder = orders.find((o) => o.id === detailId) || null;

  return (
    <div className="kpp">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Space+Grotesk:wght@400;500;600&display=swap');

        html, body, #root { height: 100%; margin: 0; }
        .kpp { font-family: 'Space Grotesk', sans-serif; background: #E7E3D6; color: #201E1B; min-height: 100vh; padding: 20px 16px 48px; box-sizing: border-box; }
        .kpp *, .kpp *::before, .kpp *::after { box-sizing: border-box; }
        .kpp button { font-family: inherit; cursor: pointer; }
        .kpp input, .kpp textarea { font-family: inherit; }
        .kpp :focus-visible { outline: 2px solid #2F4A73; outline-offset: 2px; }

        .kpp-header { max-width: 1180px; margin: 0 auto 18px; }
        .kpp-title { font-family: 'Fraunces', serif; font-weight: 600; font-size: 30px; letter-spacing: -0.01em; margin: 0 0 4px; color: #1B1917; }
        .kpp-sub { font-size: 14px; color: #6B6659; margin: 0 0 18px; max-width: 56ch; line-height: 1.5; }
        .kpp-toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .kpp-search { position: relative; flex: 1; min-width: 200px; max-width: 360px; }
        .kpp-search svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #8C8676; }
        .kpp-search input { width: 100%; padding: 9px 12px 9px 34px; border: 1px solid #C9C3B0; border-radius: 5px; background: #FBF9F3; font-size: 14px; color: #201E1B; }
        .kpp-search input::placeholder { color: #9C9686; }
        .kpp-add-btn { display: inline-flex; align-items: center; gap: 6px; background: #2F4A73; color: #F3F1E9; border: none; border-radius: 5px; padding: 10px 16px; font-size: 14px; font-weight: 500; }
        .kpp-add-btn:hover { background: #263C5E; }
        .kpp-notice { max-width: 1180px; margin: 0 auto 12px; background: #F4E4CF; border: 1px solid #C99A55; color: #6B4A16; padding: 9px 14px; border-radius: 5px; font-size: 13px; display: flex; justify-content: space-between; gap: 12px; }
        .kpp-notice button { background: none; border: none; color: inherit; text-decoration: underline; font-size: 13px; padding: 0; }

        .kpp-board { max-width: 1180px; margin: 0 auto; display: flex; gap: 14px; overflow-x: auto; padding-bottom: 8px; scroll-snap-type: x proximity; }
        @media (min-width: 920px) { .kpp-board { display: grid; grid-template-columns: repeat(5, 1fr); overflow: visible; } }

        .kpp-col { background: #E1DCCC; flex: 0 0 260px; scroll-snap-align: start; min-width: 0; border-radius: 7px; display: flex; flex-direction: column; max-height: calc(100vh - 200px); min-height: 220px; }
        @media (min-width: 920px) { .kpp-col { flex: 1 1 auto; } }

        .kpp-col-head { display: flex; align-items: center; gap: 8px; padding: 12px 12px 10px; border-bottom: 2px solid var(--accent); }
        .kpp-col-num { font-family: 'Fraunces', serif; font-weight: 600; font-size: 13px; width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: #FBF9F3; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .kpp-col-title { font-weight: 600; font-size: 14px; flex: 1; }
        .kpp-col-count { font-size: 12px; color: #6B6659; background: #F3F1E9; border-radius: 10px; padding: 1px 8px; }

        .kpp-col-body { padding: 10px; display: flex; flex-direction: column; gap: 9px; overflow-y: auto; }
        .kpp-empty { font-size: 12.5px; color: #918C7C; padding: 18px 6px; text-align: center; line-height: 1.5; }

        .kpp-card { background: #FBF9F3; border: 1px solid #D4CEBC; border-radius: 6px; overflow: hidden; text-align: left; padding: 0; display: block; width: 100%; }
        .kpp-card:hover { border-color: #A7A08A; }
        .kpp-card-img { width: 100%; height: 108px; object-fit: cover; display: block; background: #EDEADF; }
        .kpp-card-noimg { width: 100%; height: 108px; display: flex; align-items: center; justify-content: center; color: #B7B09B; background: #EDEADF; }
        .kpp-card-body { padding: 9px 10px 10px; }
        .kpp-card-resi { font-size: 11px; font-weight: 600; color: #6B6659; letter-spacing: 0.02em; margin-bottom: 3px; }
        .kpp-card-desc { font-size: 13px; line-height: 1.4; color: #262420; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px; min-height: 36px; }
        .kpp-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .kpp-card-name { font-size: 11.5px; color: #6B6659; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .kpp-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 10px; color: #FBF9F3; }

        .kpp-overlay { position: fixed; inset: 0; background: rgba(27, 25, 23, 0.55); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 50; }
        .kpp-modal { background: #F7F5EE; border-radius: 8px; width: 100%; max-width: 440px; max-height: 88vh; overflow-y: auto; padding: 20px; position: relative; }
        .kpp-modal-close { position: absolute; top: 14px; right: 14px; background: none; border: none; color: #6B6659; padding: 4px; border-radius: 4px; }
        .kpp-modal-close:hover { background: #E9E5D8; }
        .kpp-modal h2 { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 600; margin: 0 20px 16px 0; }

        .kpp-field { margin-bottom: 14px; }
        .kpp-field label { display: block; font-size: 12.5px; font-weight: 600; color: #4A473C; margin-bottom: 5px; }
        .kpp-field input[type=text], .kpp-field textarea { width: 100%; border: 1px solid #C9C3B0; border-radius: 5px; padding: 9px 11px; font-size: 14px; background: #FFFFFF; color: #201E1B; resize: vertical; }
        .kpp-field textarea { min-height: 72px; }
        .kpp-file-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px dashed #B7B09B; border-radius: 5px; padding: 9px 12px; font-size: 13px; color: #4A473C; background: #FFFFFF; }
        .kpp-file-btn:hover { border-color: #2F4A73; color: #2F4A73; }
        .kpp-preview { margin-top: 8px; width: 100%; max-height: 160px; object-fit: cover; border-radius: 5px; border: 1px solid #D4CEBC; }
        .kpp-submit-row { display: flex; gap: 8px; margin-top: 18px; }
        .kpp-btn-primary { flex: 1; background: #2F4A73; color: #F3F1E9; border: none; border-radius: 5px; padding: 11px; font-size: 14px; font-weight: 500; }
        .kpp-btn-primary:hover { background: #263C5E; }
        .kpp-btn-primary:disabled { background: #B7B09B; cursor: not-allowed; }
        .kpp-btn-ghost { background: none; border: 1px solid #C9C3B0; border-radius: 5px; padding: 11px 16px; font-size: 14px; color: #4A473C; }
        .kpp-btn-ghost:hover { background: #E9E5D8; }

        .kpp-detail-img { width: 100%; max-height: 220px; object-fit: cover; border-radius: 6px; margin-bottom: 14px; border: 1px solid #D4CEBC; }
        .kpp-detail-resi { font-size: 12px; font-weight: 600; color: #6B6659; margin-bottom: 6px; }
        .kpp-detail-desc { font-size: 14px; line-height: 1.55; color: #262420; margin-bottom: 16px; }
        .kpp-stage-row { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .kpp-advance-box { background: #EFEBDD; border-radius: 6px; padding: 12px; margin-bottom: 16px; }
        .kpp-advance-box label { display: block; font-size: 12.5px; font-weight: 600; color: #4A473C; margin-bottom: 6px; }
        .kpp-advance-box input { width: 100%; border: 1px solid #C9C3B0; border-radius: 5px; padding: 8px 10px; font-size: 14px; margin-bottom: 9px; }
        .kpp-advance-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--accent); color: #FBF9F3; border: none; border-radius: 5px; padding: 10px; font-size: 13.5px; font-weight: 600; }
        .kpp-revert-btn { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; color: #8C8676; font-size: 12px; margin-top: 8px; padding: 0; }
        .kpp-revert-btn:hover { color: #4A473C; text-decoration: underline; }
        .kpp-done-note { text-align: center; font-size: 13.5px; color: #3F6B4E; font-weight: 600; padding: 10px; background: #E2EDE3; border-radius: 6px; margin-bottom: 16px; }

        .kpp-history { border-top: 1px solid #D4CEBC; padding-top: 12px; }
        .kpp-history h3 { font-size: 12.5px; font-weight: 600; color: #4A473C; margin: 0 0 10px; display: flex; align-items: center; gap: 5px; }
        .kpp-history-item { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; padding: 6px 0; border-bottom: 1px solid #EAE6D9; }
        .kpp-history-item:last-child { border-bottom: none; }
        .kpp-history-stage { font-weight: 600; color: #262420; }
        .kpp-history-nama { color: #6B6659; }
        .kpp-history-at { color: #918C7C; white-space: nowrap; }
        .kpp-history-empty { font-size: 12.5px; color: #918C7C; }

        .kpp-delete-row { margin-top: 20px; padding-top: 14px; border-top: 1px solid #D4CEBC; }
        .kpp-delete-btn { display: inline-flex; align-items: center; gap: 6px; background: none; border: 1px solid #C4675A; color: #9A4438; border-radius: 5px; padding: 8px 13px; font-size: 13px; }
        .kpp-delete-btn:hover { background: #F5E4E1; }

        .kpp-loading { text-align: center; padding: 60px 0; color: #8C8676; font-size: 14px; }
      `}</style>

      <header className="kpp-header">
        <h1 className="kpp-title">Proses Pesanan</h1>
        <p className="kpp-sub">
          Lacak setiap pesanan dari cetak sampai packing. Setiap tahap mencatat nama orang yang mengerjakannya.
          Data tersimpan di server bersama — semua yang membuka aplikasi ini melihat dan mengubah data yang sama.
        </p>
        <div className="kpp-toolbar">
          <div className="kpp-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Cari no. resi atau deskripsi..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className="kpp-add-btn" onClick={() => setShowNew(true)}>
            <Plus size={16} /> Pesanan Baru
          </button>
        </div>
      </header>

      {notice && (
        <div className="kpp-notice">
          <span>{notice}</span>
          <button onClick={() => setNotice("")}>Tutup</button>
        </div>
      )}

      {loading ? (
        <div className="kpp-loading">Memuat pesanan...</div>
      ) : (
        <div className="kpp-board">
          {COLUMNS.map((col, i) => {
            const items = filtered.filter((o) => o.stage === col.key);
            return (
              <div className="kpp-col" key={col.key} style={{ "--accent": col.accent }}>
                <div className="kpp-col-head">
                  <span className="kpp-col-num">{i + 1}</span>
                  <span className="kpp-col-title">{col.label}</span>
                  <span className="kpp-col-count">{items.length}</span>
                </div>
                <div className="kpp-col-body">
                  {items.length === 0 && (
                    <div className="kpp-empty">Belum ada pesanan di tahap ini.</div>
                  )}
                  {items.map((o) => {
                    const lastEntry = o.history[o.history.length - 1];
                    return (
                      <button className="kpp-card" key={o.id} onClick={() => setDetailId(o.id)}>
                        {o.image ? (
                          <img className="kpp-card-img" src={o.image} alt={o.deskripsi || "Foto pesanan"} />
                        ) : (
                          <div className="kpp-card-noimg"><ImageOff size={22} /></div>
                        )}
                        <div className="kpp-card-body">
                          <div className="kpp-card-resi">No. {o.noResi || "-"}</div>
                          <div className="kpp-card-desc">{o.deskripsi || "Tanpa deskripsi"}</div>
                          <div className="kpp-card-foot">
                            <span className="kpp-card-name">
                              {lastEntry ? `Terakhir: ${lastEntry.nama}` : "Belum dikerjakan"}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewOrderModal onClose={() => setShowNew(false)} onSubmit={addOrder} />}

      {detailOrder && (
        <DetailModal
          order={detailOrder}
          onClose={() => setDetailId(null)}
          onAdvance={(nama) => advance(detailOrder, nama)}
          onRevert={() => revert(detailOrder)}
          onDelete={() => removeOrder(detailOrder.id)}
        />
      )}
    </div>
  );
}

function NewOrderModal({ onClose, onSubmit }) {
  const [noResi, setNoResi] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [image, setImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setProcessing(true);
    resizeImage(file, 640, (dataUrl) => {
      setImage(dataUrl);
      setProcessing(false);
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!noResi.trim() && !deskripsi.trim()) return;
    onSubmit({ noResi, deskripsi, image });
  }

  const canSubmit = (noResi.trim() || deskripsi.trim()) && !processing;

  return (
    <div className="kpp-overlay" onClick={onClose}>
      <div className="kpp-modal" onClick={(e) => e.stopPropagation()}>
        <button className="kpp-modal-close" onClick={onClose}><X size={18} /></button>
        <h2>Pesanan baru</h2>
        <form onSubmit={handleSubmit}>
          <div className="kpp-field">
            <label htmlFor="noResi">No. Resi</label>
            <input id="noResi" type="text" value={noResi} onChange={(e) => setNoResi(e.target.value)} placeholder="Contoh: JNE001234567" />
          </div>
          <div className="kpp-field">
            <label htmlFor="deskripsi">Deskripsi pesanan</label>
            <textarea id="deskripsi" value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="Contoh: Kaos polos hitam, ukuran L, sablon logo dada" />
          </div>
          <div className="kpp-field">
            <label>Foto</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
            <button type="button" className="kpp-file-btn" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> {processing ? "Memproses foto..." : image ? "Ganti foto" : "Unggah foto"}
            </button>
            {image && <img className="kpp-preview" src={image} alt="Pratinjau" />}
          </div>
          <div className="kpp-submit-row">
            <button type="button" className="kpp-btn-ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="kpp-btn-primary" disabled={!canSubmit}>Simpan pesanan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetailModal({ order, onClose, onAdvance, onRevert, onDelete }) {
  const [nama, setNama] = useState("");
  const isDone = order.stage === DONE_KEY;
  const meta = stageMeta(order.stage);

  function handleAdvance() {
    if (!nama.trim()) return;
    onAdvance(nama);
    setNama("");
  }

  return (
    <div className="kpp-overlay" onClick={onClose}>
      <div className="kpp-modal" onClick={(e) => e.stopPropagation()}>
        <button className="kpp-modal-close" onClick={onClose}><X size={18} /></button>
        <h2>Detail pesanan</h2>

        {order.image && <img className="kpp-detail-img" src={order.image} alt={order.deskripsi || "Foto pesanan"} />}
        <div className="kpp-detail-resi">No. {order.noResi || "-"}</div>
        <div className="kpp-detail-desc">{order.deskripsi || "Tanpa deskripsi"}</div>

        <div className="kpp-stage-row">
          <span className="kpp-pill" style={{ background: meta.accent }}>{meta.label}</span>
        </div>

        {isDone ? (
          <div className="kpp-done-note">Pesanan ini sudah selesai packing.</div>
        ) : (
          <div className="kpp-advance-box" style={{ "--accent": meta.accent }}>
            <label htmlFor="namaPemroses">Nama pemroses tahap {meta.label.toLowerCase()}</label>
            <input
              id="namaPemroses"
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama orang yang mengerjakan"
            />
            <button className="kpp-advance-btn" onClick={handleAdvance} disabled={!nama.trim()}>
              Tandai selesai {meta.label} <ArrowRight size={15} />
            </button>
          </div>
        )}

        {order.history.length > 0 && (
          <button className="kpp-revert-btn" onClick={onRevert}>
            <RotateCcw size={12} /> Kembalikan ke tahap sebelumnya
          </button>
        )}

        <div className="kpp-history">
          <h3><Clock size={13} /> Riwayat tahap</h3>
          {order.history.length === 0 ? (
            <div className="kpp-history-empty">Belum ada tahap yang diselesaikan.</div>
          ) : (
            order.history.map((h, i) => (
              <div className="kpp-history-item" key={i}>
                <span className="kpp-history-stage">{h.label}</span>
                <span className="kpp-history-nama">{h.nama}</span>
                <span className="kpp-history-at">{formatDate(h.at)}</span>
              </div>
            ))
          )}
        </div>

        <div className="kpp-delete-row">
          <button className="kpp-delete-btn" onClick={onDelete}>
            <Trash2 size={13} /> Hapus pesanan
          </button>
        </div>
      </div>
    </div>
  );
}
