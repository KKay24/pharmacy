import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Clock, MessageSquare, Send } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { showToast } from "../../components/store/StoreToast";

export default function StoreContactPage() {
  const { apiFetch } = useStore();
  const [form, setForm] = useState({ name: "", phone: "", email: "", inquiryType: "Help finding product", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.message) return showToast("Please fill all required fields", "error");
    setLoading(true);
    try {
      await apiFetch("/api/support/inquiries", { method: "POST", body: JSON.stringify(form) });
      setSent(true);
      showToast("Message sent! We'll get back to you soon.", "success");
    } catch (err) {
      showToast(err.message || "Failed to send message", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="store-section">
      <div className="store-container">
        <div className="store-breadcrumb">
          <Link to="/">Home</Link>
          <span className="store-breadcrumb__sep">›</span>
          <span>Contact Us</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "3rem", maxWidth: 960, alignItems: "start" }}>
          {/* Left info */}
          <div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: "900", marginBottom: "0.5rem" }}>Get In Touch</h1>
            <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", marginBottom: "2rem" }}>
              Have questions about your order, a product, or prescription? Our friendly team is here to help.
            </p>

            {[
              { icon: <Phone size={20} />, title: "Phone / WhatsApp", info: "+260 97 700 0000", sub: "Mon–Sat, 8 AM – 8 PM" },
              { icon: <Mail size={20} />, title: "Email", info: "pharmacy@mediquick.co.zm", sub: "We reply within 2–4 hours" },
              { icon: <MapPin size={20} />, title: "Store Location", info: "Cairo Road, Lusaka", sub: "Mon–Sat 8 AM – 8 PM · Sun 9 AM – 5 PM" },
              { icon: <Clock size={20} />, title: "Online Support", info: "24/7 via WhatsApp", sub: "Leave a message any time" },
            ].map(({ icon, title, info, sub }) => (
              <div key={title} style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--brand-blue-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-blue)", flexShrink: 0 }}>
                  {icon}
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "0.9rem" }}>{title}</strong>
                  <span style={{ display: "block", fontSize: "0.95rem", color: "var(--brand-blue)", fontWeight: 600 }}>{info}</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Contact form */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "2rem" }}>
            {sent ? (
              <div style={{ textAlign: "center", padding: "2rem 0" }}>
                <MessageSquare size={48} color="var(--green)" style={{ margin: "0 auto 1rem" }} />
                <h2 style={{ fontSize: "1.2rem", fontWeight: "800", marginBottom: "0.5rem" }}>Message Sent!</h2>
                <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>We'll get back to you within 2–4 hours.</p>
                <button onClick={() => { setSent(false); setForm({ name: "", phone: "", email: "", inquiryType: "Help finding product", message: "" }); }}
                  style={{ padding: "0.7rem 1.5rem", background: "var(--brand-blue)", color: "white", border: "none", borderRadius: "var(--radius)", fontWeight: 700, cursor: "pointer" }}>
                  Send Another Message
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: "1rem", fontWeight: "800", marginBottom: "1.25rem" }}>Send Us a Message</h2>
                <form onSubmit={handleSubmit}>
                  <div className="store-form-grid store-form-grid--2" style={{ marginBottom: "1rem" }}>
                    <div className="store-form-group">
                      <label>Your Name *</label>
                      <input type="text" value={form.name} onChange={e => set("name", e.target.value)} required placeholder="John Banda" />
                    </div>
                    <div className="store-form-group">
                      <label>Phone Number *</label>
                      <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} required placeholder="+260 97 XXXXXXX" />
                    </div>
                  </div>
                  <div className="store-form-group" style={{ marginBottom: "1rem" }}>
                    <label>Email Address</label>
                    <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="john@email.com" />
                  </div>
                  <div className="store-form-group" style={{ marginBottom: "1rem" }}>
                    <label>Inquiry Type</label>
                    <select value={form.inquiryType} onChange={e => set("inquiryType", e.target.value)}>
                      <option>Help finding product</option>
                      <option>Order issue</option>
                      <option>Prescription query</option>
                      <option>Delivery question</option>
                      <option>Return/refund</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="store-form-group" style={{ marginBottom: "1.25rem" }}>
                    <label>Message *</label>
                    <textarea rows={4} value={form.message} onChange={e => set("message", e.target.value)} required placeholder="How can we help you?" style={{ resize: "vertical" }} />
                  </div>
                  <button type="submit" disabled={loading} style={{ width: "100%", padding: "0.9rem", background: "var(--brand-blue)", color: "white", border: "none", borderRadius: "var(--radius)", fontWeight: 700, cursor: "pointer", fontSize: "0.95rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    {loading ? "Sending..." : <><Send size={16} /> Send Message</>}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
