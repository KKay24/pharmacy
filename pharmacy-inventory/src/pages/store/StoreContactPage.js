import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Phone, Mail, MapPin, Clock, MessageSquare, Send } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { showToast } from "../../components/store/StoreToast";
import SupportPhoneInput from "../../components/store/SupportPhoneInput";
import {
  DEFAULT_PHONE_COUNTRY,
  SUPPORTED_PHONE_COUNTRIES,
  validateSupportEmail,
  validateSupportMessage,
  validateSupportName,
  validateSupportPhone,
} from "../../utils/contactValidation";

const INITIAL_CONTACT_FORM = {
  name: "",
  phone: "",
  email: "",
  inquiryType: "Help finding product",
  message: "",
};

export default function StoreContactPage() {
  const { apiFetch } = useStore();
  const [form, setForm] = useState(INITIAL_CONTACT_FORM);
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [touched, setTouched] = useState({
    name: false,
    phone: false,
    email: false,
    message: false,
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const nameValidation = validateSupportName(form.name);
  const phoneValidation = validateSupportPhone(form.phone, phoneCountry);
  const emailValidation = validateSupportEmail(form.email);
  const messageValidation = validateSupportMessage(form.message);
  const isFormValid =
    nameValidation.valid &&
    phoneValidation.valid &&
    emailValidation.valid &&
    messageValidation.valid;

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "phone" && typeof value === "string" && value.trim().startsWith("+")) {
      const detected = validateSupportPhone(value, phoneCountry).detectedCountry;
      if (detected && SUPPORTED_PHONE_COUNTRIES.some((c) => c.code === detected)) {
        setPhoneCountry(detected);
      }
    }
  };

  const markTouched = (field) => {
    setTouched((current) => ({ ...current, [field]: true }));
    if (field === "email") {
      setForm((current) => ({ ...current, email: current.email.trim() }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, phone: true, email: true, message: true });
    if (!isFormValid) {
      return showToast(
        nameValidation.error ||
          phoneValidation.error ||
          emailValidation.error ||
          messageValidation.error ||
          "Please fill all required fields accurately",
        "error"
      );
    }

    setLoading(true);
    try {
      await apiFetch("/api/support/inquiries", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          countryCode: phoneCountry,
          name: nameValidation.normalized,
          phone: phoneValidation.normalized,
          email: emailValidation.normalized,
          message: messageValidation.normalized,
        }),
      });
      setSent(true);
      showToast("Message sent! We'll get back to you soon.", "success");
    } catch (err) {
      showToast(err.message || "Failed to send message", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSent(false);
    setForm(INITIAL_CONTACT_FORM);
    setPhoneCountry(DEFAULT_PHONE_COUNTRY);
    setTouched({ name: false, phone: false, email: false, message: false });
  };

  return (
    <div className="store-section">
      <div className="store-container">
        <div className="store-breadcrumb">
          <Link to="/">Home</Link>
          <span className="store-breadcrumb__sep">›</span>
          <span>Contact Us</span>
        </div>

        <div className="store-contact-layout">
          {/* Left info */}
          <div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: "900", marginBottom: "0.5rem" }}>Get In Touch</h1>
            <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", marginBottom: "2rem" }}>
              Have questions about your order, a product, or prescription? Our friendly team is here to help.
            </p>

            {[
              { icon: <Phone size={20} />, title: "Phone / WhatsApp", info: "+260974392925", sub: "Mon–Sat, 8 AM – 8 PM" },
              { icon: <Mail size={20} />, title: "Email", info: "mediquick85@gmail.com", sub: "We reply within 2–4 hours" },
              { icon: <MapPin size={20} />, title: "Store Location", info: "Nationalist Road, 25147", sub: "Mon–Sat 8 AM – 8 PM · Sun 9 AM – 5 PM" },
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
                <button
                  type="button"
                  onClick={handleReset}
                  style={{ padding: "0.7rem 1.5rem", background: "var(--brand-blue)", color: "white", border: "none", borderRadius: "var(--radius)", fontWeight: 700, cursor: "pointer" }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: "1rem", fontWeight: "800", marginBottom: "1.25rem" }}>Send Us a Message</h2>
                <form onSubmit={handleSubmit} noValidate>
                  <div className="support-field" style={{ marginBottom: "1rem" }}>
                    <div className="support-field__label-row">
                      <label className="support-field__label" htmlFor="contact-name">
                        Your Name
                      </label>
                      <span className="support-field__req" aria-hidden="true">*</span>
                    </div>
                    <div
                      className={`support-field__input-wrap${
                        touched.name && !nameValidation.valid
                          ? " is-invalid"
                          : touched.name && nameValidation.valid
                            ? " is-valid"
                            : ""
                      }`}
                    >
                      <input
                        id="contact-name"
                        type="text"
                        autoComplete="name"
                        maxLength={120}
                        required
                        placeholder="John Banda"
                        value={form.name}
                        aria-invalid={touched.name && !nameValidation.valid ? "true" : "false"}
                        onChange={(e) => set("name", e.target.value)}
                        onBlur={() => markTouched("name")}
                      />
                      {touched.name && nameValidation.valid && (
                        <span className="support-field__status-icon support-field__status-icon--valid" aria-label="Valid name">
                          <CheckCircle2 size={16} aria-hidden="true" />
                        </span>
                      )}
                      {touched.name && !nameValidation.valid && (
                        <span className="support-field__status-icon support-field__status-icon--invalid" aria-hidden="true">
                          <AlertCircle size={16} />
                        </span>
                      )}
                    </div>
                    {touched.name && !nameValidation.valid && (
                      <span className="support-field__error" role="alert">{nameValidation.error}</span>
                    )}
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <SupportPhoneInput
                      id="contact-phone"
                      label="Phone Number"
                      countryCode={phoneCountry}
                      onCountryChange={setPhoneCountry}
                      value={form.phone}
                      onChange={(value) => set("phone", value)}
                      onBlur={() => markTouched("phone")}
                      touched={touched.phone}
                      validation={phoneValidation}
                    />
                  </div>

                  <div className="support-field" style={{ marginBottom: "1rem" }}>
                    <label className="support-field__label" htmlFor="contact-email">
                      <span>Email Address <span className="support-field__opt">(optional)</span></span>
                    </label>
                    <div
                      className={`support-field__input-wrap${
                        touched.email && !emailValidation.isEmpty && !emailValidation.valid
                          ? " is-invalid"
                          : touched.email && !emailValidation.isEmpty && emailValidation.valid
                            ? " is-valid"
                            : ""
                      }`}
                    >
                      <input
                        id="contact-email"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        placeholder="john@email.com"
                        value={form.email}
                        aria-invalid={touched.email && !emailValidation.valid ? "true" : "false"}
                        onChange={(e) => set("email", e.target.value)}
                        onBlur={() => markTouched("email")}
                      />
                      {touched.email && !emailValidation.isEmpty && emailValidation.valid && (
                        <span className="support-field__status-icon support-field__status-icon--valid" aria-label="Valid email">
                          <CheckCircle2 size={16} aria-hidden="true" />
                        </span>
                      )}
                      {touched.email && !emailValidation.valid && (
                        <span className="support-field__status-icon support-field__status-icon--invalid" aria-hidden="true">
                          <AlertCircle size={16} />
                        </span>
                      )}
                    </div>
                    {touched.email && !emailValidation.valid && (
                      <span className="support-field__error" role="alert">{emailValidation.error}</span>
                    )}
                  </div>

                  <div className="store-form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="contact-inquiry-type">Inquiry Type</label>
                    <select
                      id="contact-inquiry-type"
                      value={form.inquiryType}
                      onChange={(e) => set("inquiryType", e.target.value)}
                    >
                      <option>Help finding product</option>
                      <option>Order issue</option>
                      <option>Prescription query</option>
                      <option>Delivery question</option>
                      <option>Return/refund</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div className="support-field" style={{ marginBottom: "1.25rem" }}>
                    <div className="support-field__label-row">
                      <label className="support-field__label" htmlFor="contact-message">
                        Message
                      </label>
                      <span className="support-field__req" aria-hidden="true">*</span>
                    </div>
                    <textarea
                      id="contact-message"
                      rows={4}
                      maxLength={2000}
                      required
                      className={
                        touched.message && !messageValidation.valid
                          ? "support-field__textarea is-invalid"
                          : touched.message && messageValidation.valid
                            ? "support-field__textarea is-valid"
                            : "support-field__textarea"
                      }
                      value={form.message}
                      aria-invalid={touched.message && !messageValidation.valid ? "true" : "false"}
                      onChange={(e) => set("message", e.target.value)}
                      onBlur={() => markTouched("message")}
                      placeholder="How can we help you?"
                    />
                    {touched.message && !messageValidation.valid && (
                      <span className="support-field__error" role="alert">{messageValidation.error}</span>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="support-contact__submit"
                    disabled={loading || !isFormValid}
                  >
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
