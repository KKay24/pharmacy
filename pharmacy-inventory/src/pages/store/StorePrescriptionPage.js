import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Upload, FileText, CheckCircle, Search } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { showToast } from "../../components/store/StoreToast";

export default function StorePrescriptionPage() {
  const { apiFetch, storeUser } = useStore();
  const [tab, setTab] = useState("upload"); // upload | track
  const [form, setForm] = useState({
    patientName: storeUser?.username || "",
    patientPhone: "",
    doctorName: "",
    medications: "",
    deliveryPreference: "delivery",
    deliveryAddress: "",
    notes: "",
    fileData: "",
    fileName: "",
  });
  const [trackRef, setTrackRef] = useState("");
  const [trackResult, setTrackResult] = useState(null);
  const [trackError, setTrackError] = useState("");
  const [submitResult, setSubmitResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("File must be under 5 MB"); return; }
    const reader = new FileReader();
    reader.onload = (e) => { set("fileData", e.target.result); set("fileName", file.name); };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.patientName || !form.patientPhone) return setError("Please fill in your name and phone number.");
    setLoading(true);
    try {
      const result = await apiFetch("/api/prescriptions/upload", { method: "POST", body: JSON.stringify(form) });
      setSubmitResult(result);
      showToast("Prescription submitted successfully!", "success");
    } catch (err) {
      setError(err.message || "Failed to submit prescription");
    } finally {
      setLoading(false);
    }
  };

  const handleTrack = async (e) => {
    e.preventDefault();
    setTrackError(""); setTrackResult(null);
    if (!trackRef.trim()) return setTrackError("Please enter your prescription reference number");
    setLoading(true);
    try {
      const result = await apiFetch(`/api/prescriptions/track/${trackRef.trim()}`);
      setTrackResult(result);
    } catch (err) {
      setTrackError(err.message || "Prescription not found");
    } finally {
      setLoading(false);
    }
  };

  const STATUS_COLORS = {
    "Pending": { bg: "#fffbeb", color: "#92400e" },
    "Under Review": { bg: "#dbeafe", color: "#1d4ed8" },
    "Approved": { bg: "#dcfce7", color: "#16a34a" },
    "Ready for Pickup": { bg: "#f0fdf4", color: "#15803d" },
    "Dispatched": { bg: "#ede9fe", color: "#6d28d9" },
    "Completed": { bg: "#dcfce7", color: "#15803d" },
    "Rejected": { bg: "#fee2e2", color: "#dc2626" },
  };

  return (
    <div className="store-section">
      <div className="store-container" style={{ maxWidth: 760 }}>
        <div className="store-breadcrumb">
          <Link to="/">Home</Link>
          <span className="store-breadcrumb__sep">›</span>
          <span>Prescriptions</span>
        </div>

        <h1 style={{ fontSize: "1.5rem", fontWeight: "900", marginBottom: "0.4rem" }}>Prescription Services</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "1.75rem" }}>
          Upload your prescription and we'll dispense the right medicines for you.
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0", borderBottom: "2px solid var(--border)", marginBottom: "1.75rem" }}>
          {[
            { key: "upload", label: "Upload Prescription" },
            { key: "track", label: "Track Prescription" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "0.75rem 1.25rem", border: "none", background: "none", cursor: "pointer",
              fontSize: "0.9rem", fontWeight: 700, fontFamily: "inherit",
              color: tab === t.key ? "var(--brand-blue)" : "var(--text-secondary)",
              borderBottom: `2px solid ${tab === t.key ? "var(--brand-blue)" : "transparent"}`,
              marginBottom: "-2px",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Upload Tab */}
        {tab === "upload" && !submitResult && (
          <div>
            {/* Steps */}
            <div className="store-rx-steps" style={{ marginBottom: "2rem" }}>
              {[
                { num: "1", title: "Fill Details", sub: "Your info & doctor details" },
                { num: "2", title: "Upload File", sub: "Photo or scan of prescription" },
                { num: "3", title: "We Dispense", sub: "Pharmacist reviews & prepares" },
              ].map(s => (
                <div key={s.num} className="store-rx-step">
                  <div className="store-rx-step__num">{s.num}</div>
                  <div className="store-rx-step__title">{s.title}</div>
                  <div className="store-rx-step__sub">{s.sub}</div>
                </div>
              ))}
            </div>

            {error && <div className="store-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "1.5rem", marginBottom: "1.25rem" }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "1.25rem" }}>Patient Information</h3>
                <div className="store-form-grid store-form-grid--2">
                  <div className="store-form-group">
                    <label>Patient Name *</label>
                    <input type="text" value={form.patientName} onChange={e => set("patientName", e.target.value)} required placeholder="Full name" />
                  </div>
                  <div className="store-form-group">
                    <label>Phone Number *</label>
                    <input type="tel" value={form.patientPhone} onChange={e => set("patientPhone", e.target.value)} required placeholder="+260 97 XXXXXXX" />
                  </div>
                  <div className="store-form-group">
                    <label>Doctor / Prescriber Name</label>
                    <input type="text" value={form.doctorName} onChange={e => set("doctorName", e.target.value)} placeholder="Dr. Smith" />
                  </div>
                  <div className="store-form-group">
                    <label>Medications Listed (if known)</label>
                    <input type="text" value={form.medications} onChange={e => set("medications", e.target.value)} placeholder="e.g. Amoxicillin 500mg" />
                  </div>
                </div>
              </div>

              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "1.5rem", marginBottom: "1.25rem" }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "1.25rem" }}>Upload Prescription Image</h3>
                <div
                  className={`store-rx-upload-zone ${dragging ? "dragover" : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                  onClick={() => document.getElementById("rx-file-input").click()}
                >
                  {form.fileName ? (
                    <div>
                      <div className="store-rx-upload-zone__icon">✅</div>
                      <p>{form.fileName}</p>
                      <span>Click to change file</span>
                    </div>
                  ) : (
                    <div>
                      <div className="store-rx-upload-zone__icon"><Upload size={32} /></div>
                      <p>Drag & drop or click to upload</p>
                      <span>JPG, PNG, PDF — Max 5 MB</span>
                    </div>
                  )}
                  <input id="rx-file-input" type="file" accept="image/jpeg,image/png,application/pdf" hidden onChange={e => handleFile(e.target.files[0])} />
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.75rem" }}>
                  💡 No file? No problem — describe the prescription in the notes below and we'll contact you.
                </p>
              </div>

              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "1.5rem", marginBottom: "1.25rem" }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "1.25rem" }}>Delivery Preference</h3>
                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
                  {[
                    { value: "delivery", label: "Home Delivery" },
                    { value: "pickup", label: "In-Store Pickup" },
                  ].map(opt => (
                    <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1rem", border: `2px solid ${form.deliveryPreference === opt.value ? "var(--brand-blue)" : "var(--border)"}`, borderRadius: "var(--radius-sm)", cursor: "pointer", flex: 1, background: form.deliveryPreference === opt.value ? "var(--brand-blue-light)" : "white", fontWeight: 600, fontSize: "0.88rem" }}>
                      <input type="radio" name="rx-delivery" value={opt.value} checked={form.deliveryPreference === opt.value} onChange={e => set("deliveryPreference", e.target.value)} style={{ accentColor: "var(--brand-blue)" }} />
                      {opt.label}
                    </label>
                  ))}
                </div>
                {form.deliveryPreference === "delivery" && (
                  <div className="store-form-group">
                    <label>Delivery Address</label>
                    <input type="text" value={form.deliveryAddress} onChange={e => set("deliveryAddress", e.target.value)} placeholder="Your delivery address" />
                  </div>
                )}
                <div className="store-form-group" style={{ marginTop: "0.75rem" }}>
                  <label>Additional Notes</label>
                  <textarea rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any allergies, special instructions, or questions..." style={{ resize: "vertical" }} />
                </div>
              </div>

              <button type="submit" disabled={loading} style={{ width: "100%", padding: "0.95rem", background: "var(--brand-blue)", color: "white", border: "none", borderRadius: "var(--radius)", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                {loading ? "Submitting..." : <><FileText size={18} /> Submit Prescription</>}
              </button>
            </form>
          </div>
        )}

        {/* Success */}
        {tab === "upload" && submitResult && (
          <div style={{ textAlign: "center", padding: "3rem 1.5rem", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)" }}>
            <CheckCircle size={56} color="var(--green)" style={{ margin: "0 auto 1.25rem" }} />
            <h2 style={{ fontSize: "1.3rem", fontWeight: "900", marginBottom: "0.5rem" }}>Prescription Submitted!</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>Our pharmacist will review your prescription and contact you shortly.</p>
            <div style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: "1rem 1.5rem", display: "inline-block", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Your Reference Number</p>
              <p style={{ fontSize: "1.4rem", fontWeight: "900", color: "var(--brand-blue)" }}>{submitResult.prescriptionNumber || submitResult.referenceNumber}</p>
            </div>
            <br />
            <button onClick={() => { setSubmitResult(null); setForm({ patientName: storeUser?.username || "", patientPhone: "", doctorName: "", medications: "", deliveryPreference: "delivery", deliveryAddress: "", notes: "", fileData: "", fileName: "" }); }}
              style={{ padding: "0.75rem 1.5rem", background: "var(--brand-blue)", color: "white", border: "none", borderRadius: "var(--radius)", fontWeight: 700, cursor: "pointer" }}>
              Submit Another
            </button>
          </div>
        )}

        {/* Track Tab */}
        {tab === "track" && (
          <div>
            <form onSubmit={handleTrack} style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <input
                type="text" placeholder="Enter reference number (e.g. RX-123456)"
                value={trackRef} onChange={e => setTrackRef(e.target.value)}
                style={{ flex: 1, padding: "0.75rem 1rem", border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.9rem", fontFamily: "inherit", outline: "none" }}
              />
              <button type="submit" disabled={loading} style={{ padding: "0.75rem 1.5rem", background: "var(--brand-blue)", color: "white", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Search size={16} /> Track
              </button>
            </form>

            {trackError && <div className="store-error">{trackError}</div>}

            {trackResult && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                  <div>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Reference</p>
                    <p style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--brand-blue)" }}>{trackResult.prescriptionNumber}</p>
                  </div>
                  <span style={{
                    padding: "0.35rem 0.85rem", borderRadius: "999px", fontSize: "0.8rem", fontWeight: 700,
                    ...(STATUS_COLORS[trackResult.status] || { bg: "var(--bg)", color: "var(--text-secondary)" }),
                    background: (STATUS_COLORS[trackResult.status] || {}).bg,
                    color: (STATUS_COLORS[trackResult.status] || {}).color,
                  }}>
                    {trackResult.status}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.88rem" }}>
                  <div><span style={{ color: "var(--text-muted)" }}>Submitted</span><br /><strong>{new Date(trackResult.date).toLocaleDateString()}</strong></div>
                  {trackResult.deliveryPreference && <div><span style={{ color: "var(--text-muted)" }}>Fulfilment</span><br /><strong>{trackResult.deliveryPreference}</strong></div>}
                  {trackResult.dueDate && <div><span style={{ color: "var(--text-muted)" }}>Expected date</span><br /><strong>{trackResult.dueDate}</strong></div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
