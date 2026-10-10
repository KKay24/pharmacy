import React, { useState } from "react";
import { Headphones, MessageCircle, Send, X } from "lucide-react";
import { useStore } from "../../context/StoreContext";

const INITIAL_FORM = {
  name: "",
  phone: "",
  email: "",
  inquiryType: "Help finding product",
  message: "",
};

export default function CustomerSupportChat() {
  const { apiFetch } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  };

  const submitMessage = async (event) => {
    event.preventDefault();
    const message = form.message.trim();
    if (!form.name.trim() || !form.phone.trim() || !message) {
      setError("Please enter your name, phone number, and message.");
      return;
    }

    setSending(true);
    setError("");
    try {
      await apiFetch("/api/support/inquiries", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          message,
        }),
      });
      setMessages((current) => [...current, {
        id: `${Date.now()}`,
        message,
        reply: "Your message has been sent to the pharmacy team. They will follow up using the contact details you provided.",
      }]);
      setForm((current) => ({ ...current, message: "" }));
    } catch (requestError) {
      setError(requestError.message || "Your message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="customer-support-chat">
      {open && (
        <section className="customer-support-chat__panel" role="dialog" aria-label="Pharmacy support chat">
          <header className="customer-support-chat__header">
            <span className="customer-support-chat__avatar" aria-hidden="true">
              <Headphones size={20} />
            </span>
            <span className="customer-support-chat__heading">
              <strong>Pharmacy support</strong>
              <small>Send a message to our team</small>
            </span>
            <button
              type="button"
              className="customer-support-chat__close"
              aria-label="Close support chat"
              onClick={() => setOpen(false)}
            >
              <X size={19} />
            </button>
          </header>

          <div className="customer-support-chat__body">
            <div className="customer-support-chat__bubble customer-support-chat__bubble--team">
              Hi! Leave a message for the pharmacy team and we’ll follow up using the contact details you provide.
            </div>
            {messages.map((item) => (
              <div className="customer-support-chat__exchange" key={item.id}>
                <div className="customer-support-chat__bubble customer-support-chat__bubble--customer">
                  {item.message}
                </div>
                <div className="customer-support-chat__bubble customer-support-chat__bubble--team">
                  {item.reply}
                </div>
              </div>
            ))}
            <p className="customer-support-chat__privacy-note">
              Please don’t include passwords, payment details, or private health information.
            </p>

            <form className="customer-support-chat__form" onSubmit={submitMessage}>
              <label>
                Your name
                <input
                  autoComplete="name"
                  maxLength={100}
                  required
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </label>
              <div className="customer-support-chat__contact-fields">
                <label>
                  Phone number
                  <input
                    type="tel"
                    autoComplete="tel"
                    maxLength={40}
                    required
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                  />
                </label>
                <label>
                  Email <span>(optional)</span>
                  <input
                    type="email"
                    autoComplete="email"
                    maxLength={160}
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                  />
                </label>
              </div>
              <label>
                What do you need help with?
                <select
                  value={form.inquiryType}
                  onChange={(event) => updateField("inquiryType", event.target.value)}
                >
                  <option>Help finding product</option>
                  <option>Order issue</option>
                  <option>Prescription query</option>
                  <option>Delivery question</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Message
                <textarea
                  maxLength={2000}
                  required
                  rows={3}
                  value={form.message}
                  onChange={(event) => updateField("message", event.target.value)}
                  placeholder="How can we help?"
                />
              </label>
              {error && <p className="customer-support-chat__error" role="alert">{error}</p>}
              <button type="submit" className="customer-support-chat__send" disabled={sending}>
                <Send size={16} />
                {sending ? "Sending..." : "Send message"}
              </button>
            </form>
          </div>
        </section>
      )}

      <button
        type="button"
        className={`customer-support-chat__launcher${open ? " is-open" : ""}`}
        aria-label={open ? "Close pharmacy support chat" : "Open pharmacy support chat"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={23} /> : <MessageCircle size={23} />}
        {!open && <span>Need help?</span>}
      </button>
    </div>
  );
}
