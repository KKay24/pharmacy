import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Headphones,
  Info,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useStore } from "../../context/StoreContext";
import SupportPhoneInput from "./SupportPhoneInput";
import {
  DEFAULT_PHONE_COUNTRY,
  SUPPORTED_PHONE_COUNTRIES,
  validateSupportEmail,
  validateSupportMessage,
  validateSupportName,
  validateSupportPhone,
} from "../../utils/contactValidation";

const SESSION_STORAGE_KEY = "mediquick_smart_assistant_session_v1";

const INITIAL_SUPPORT_FORM = {
  name: "",
  phone: "",
  email: "",
  inquiryType: "Help finding product",
  message: "",
};

const SUGGESTED_QUESTIONS = [
  "Do you have Paracetamol in stock?",
  "What vitamins help support daily immunity?",
  "How do I upload a prescription?",
  "What is the difference between brand and generic medicines?",
];

function loadSavedAiState() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return { sessionId: "", messages: [] };
    const parsed = JSON.parse(raw);
    return {
      sessionId: typeof parsed?.sessionId === "string" ? parsed.sessionId : "",
      messages: Array.isArray(parsed?.messages) ? parsed.messages.slice(-20) : [],
    };
  } catch (error) {
    return { sessionId: "", messages: [] };
  }
}

function buildEscalationSummary(aiMessages) {
  const recent = aiMessages.slice(-4);
  if (recent.length === 0) return "";
  const lines = recent.map((entry) => {
    const prefix = entry.role === "user" ? "Customer" : "Medical AI";
    const snippet = String(entry.content || "").replace(/\s+/g, " ").trim().slice(0, 180);
    return `${prefix}: ${snippet}`;
  });
  return `Context from MediQuick Medical AI:\n${lines.join("\n")}\n\nMy question for the pharmacist: `;
}

export default function CustomerSupportChat() {
  const { apiFetch, storeUser } = useStore();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("ai"); // "ai" | "support"

  // Medical AI state
  const [aiSessionId, setAiSessionId] = useState(() => loadSavedAiState().sessionId);
  const [aiMessages, setAiMessages] = useState(() => loadSavedAiState().messages);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showEscalationPrompt, setShowEscalationPrompt] = useState(false);
  const [consentShareContext, setConsentShareContext] = useState(false);

  // Pharmacy Support state (preserves existing inquiry workflow)
  const [form, setForm] = useState(() => ({
    ...INITIAL_SUPPORT_FORM,
    name: storeUser?.name || storeUser?.username || "",
    email: storeUser?.email || "",
  }));
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [touched, setTouched] = useState({
    name: false,
    phone: false,
    email: false,
    message: false,
  });
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportError, setSupportError] = useState("");
  const [supportSending, setSupportSending] = useState(false);
  const [transferredNotice, setTransferredNotice] = useState(false);

  const aiScrollRef = useRef(null);

  // Sync user info gently if user signs in while form is empty
  useEffect(() => {
    if (!storeUser) return;
    setForm((current) => ({
      ...current,
      name: current.name || storeUser.name || storeUser.username || "",
      email: current.email || storeUser.email || "",
    }));
  }, [storeUser]);

  // Persist ephemeral AI session history in sessionStorage only (cleared when tab closes)
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          sessionId: aiSessionId,
          messages: aiMessages.slice(-20),
        })
      );
    } catch (error) {
      // Ignore storage quota / private mode errors
    }
  }, [aiSessionId, aiMessages]);

  // Auto-scroll AI chat to latest message
  useEffect(() => {
    if (open && activeTab === "ai" && aiScrollRef.current) {
      aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
    }
  }, [open, activeTab, aiMessages, aiLoading, showEscalationPrompt]);

  const sendAiMessage = async (rawText) => {
    const text = String(rawText !== undefined ? rawText : aiInput).trim();
    if (!text || aiLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    setAiMessages((current) => [...current, userMsg]);
    setAiInput("");
    setAiError("");
    setShowEscalationPrompt(false);
    setAiLoading(true);

    try {
      const data = await apiFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          ...(aiSessionId ? { sessionId: aiSessionId } : {}),
        }),
      });

      if (data?.sessionId) {
        setAiSessionId(data.sessionId);
      }

      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data?.reply || "I could not generate a response. Please contact our Pharmacy Support team.",
        emergency: Boolean(data?.emergency),
        recommendPharmacist: Boolean(data?.recommendPharmacist),
        products: Array.isArray(data?.products) ? data.products : [],
        verifiedAlternatives: Array.isArray(data?.verifiedAlternatives) ? data.verifiedAlternatives : [],
        sources: Array.isArray(data?.sources) ? data.sources : [],
      };

      setAiMessages((current) => [...current, assistantMsg]);
    } catch (requestError) {
      setAiError(
        requestError?.message ||
          "Medical AI is temporarily unavailable. You can switch to Pharmacy Support to message a pharmacist."
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiSubmit = (event) => {
    event.preventDefault();
    sendAiMessage();
  };

  const handleClearAiChat = () => {
    const oldSessionId = aiSessionId;
    setAiMessages([]);
    setAiSessionId("");
    setAiError("");
    setShowEscalationPrompt(false);
    setConsentShareContext(false);
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      // Ignore storage errors
    }
    if (oldSessionId) {
      try {
        apiFetch?.(`/api/ai/sessions/${encodeURIComponent(oldSessionId)}`, {
          method: "DELETE",
        })?.catch?.(() => {});
      } catch (error) {
        // Non-blocking cleanup
      }
    }
  };

  const handleOpenEscalation = () => {
    if (aiMessages.length === 0) {
      setActiveTab("support");
      return;
    }
    setConsentShareContext(false);
    setShowEscalationPrompt(true);
  };

  const handleConfirmEscalation = () => {
    const lastAssistant = [...aiMessages].reverse().find((m) => m.role === "assistant");
    if (consentShareContext) {
      const summary = buildEscalationSummary(aiMessages);
      setForm((current) => ({
        ...current,
        inquiryType: lastAssistant?.recommendPharmacist ? "Prescription query" : current.inquiryType,
        message: summary.slice(0, 2000),
      }));
      setTransferredNotice(true);
    } else {
      setTransferredNotice(false);
    }
    setShowEscalationPrompt(false);
    setActiveTab("support");
  };

  const nameValidation = validateSupportName(form.name);
  const phoneValidation = validateSupportPhone(form.phone, phoneCountry);
  const emailValidation = validateSupportEmail(form.email);
  const messageValidation = validateSupportMessage(form.message);
  const isSupportFormValid =
    nameValidation.valid &&
    phoneValidation.valid &&
    emailValidation.valid &&
    messageValidation.valid;

  const markSupportTouched = (field) => {
    setTouched((current) => ({ ...current, [field]: true }));
    if (field === "email") {
      setForm((current) => ({ ...current, email: current.email.trim() }));
    }
  };

  const updateSupportField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "phone" && typeof value === "string" && value.trim().startsWith("+")) {
      const detected = validateSupportPhone(value, phoneCountry).detectedCountry;
      if (detected && SUPPORTED_PHONE_COUNTRIES.some((c) => c.code === detected)) {
        setPhoneCountry(detected);
      }
    }
    if (supportError) setSupportError("");
  };

  const submitSupportMessage = async (event) => {
    event.preventDefault();
    setTouched({ name: true, phone: true, email: true, message: true });

    if (!isSupportFormValid) {
      setSupportError(
        nameValidation.error ||
          phoneValidation.error ||
          emailValidation.error ||
          messageValidation.error ||
          "Please fix the highlighted fields before sending."
      );
      return;
    }

    setSupportSending(true);
    setSupportError("");
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
      setSupportMessages((current) => [
        ...current,
        {
          id: `${Date.now()}`,
          message: messageValidation.normalized,
          reply:
            "Your message has been sent to the pharmacy team. They will follow up using the contact details you provided.",
        },
      ]);
      setForm((current) => ({ ...current, message: "" }));
      setTouched((current) => ({ ...current, message: false }));
      setTransferredNotice(false);
    } catch (requestError) {
      setSupportError(requestError.message || "Your message could not be sent. Please try again.");
    } finally {
      setSupportSending(false);
    }
  };

  return (
    <div className="customer-support-chat">
      {open && (
        <section
          className="customer-support-chat__panel smart-assistant__panel"
          role="dialog"
          aria-label="MediQuick Smart Assistant"
        >
          {/* Header */}
          <header className="customer-support-chat__header smart-assistant__header">
            <span className="customer-support-chat__avatar smart-assistant__avatar" aria-hidden="true">
              {activeTab === "ai" ? <Sparkles size={19} /> : <Headphones size={19} />}
            </span>
            <span className="customer-support-chat__heading">
              <strong>MediQuick Smart Assistant</strong>
              <small>
                {activeTab === "ai"
                  ? "Educational Medical AI · Live Catalogue"
                  : "Direct message to our pharmacy team"}
              </small>
            </span>
            {activeTab === "ai" && aiMessages.length > 0 && (
              <button
                type="button"
                className="smart-assistant__header-btn"
                aria-label="Start new AI conversation"
                title="New chat"
                onClick={handleClearAiChat}
              >
                <RotateCcw size={16} />
              </button>
            )}
            <button
              type="button"
              className="customer-support-chat__close"
              aria-label="Close MediQuick Smart Assistant"
              onClick={() => setOpen(false)}
            >
              <X size={19} />
            </button>
          </header>

          {/* Segmented Two-Tab Switcher */}
          <div className="smart-assistant__tabs" role="tablist" aria-label="Assistant mode">
            <button
              type="button"
              role="tab"
              id="smart-assistant-tab-ai"
              aria-selected={activeTab === "ai"}
              aria-controls="smart-assistant-panel-ai"
              className={`smart-assistant__tab${activeTab === "ai" ? " is-active" : ""}`}
              onClick={() => setActiveTab("ai")}
            >
              <Sparkles size={14} aria-hidden="true" />
              <span>Medical AI</span>
            </button>
            <button
              type="button"
              role="tab"
              id="smart-assistant-tab-support"
              aria-selected={activeTab === "support"}
              aria-controls="smart-assistant-panel-support"
              className={`smart-assistant__tab${activeTab === "support" ? " is-active" : ""}`}
              onClick={() => setActiveTab("support")}
            >
              <Headphones size={14} aria-hidden="true" />
              <span>Pharmacy Support</span>
            </button>
          </div>

          {/* TAB 1: MEDICAL AI */}
          {activeTab === "ai" && (
            <div
              id="smart-assistant-panel-ai"
              role="tabpanel"
              aria-labelledby="smart-assistant-tab-ai"
              className="smart-assistant__ai-view"
            >
              <div className="smart-assistant__disclaimer">
                <Info size={14} aria-hidden="true" />
                <span>
                  Educational information only — not a substitute for professional medical advice, diagnosis, or treatment.
                </span>
              </div>

              <div className="smart-assistant__messages" ref={aiScrollRef}>
                {aiMessages.length === 0 && (
                  <div className="smart-assistant__welcome">
                    <div className="smart-assistant__bubble smart-assistant__bubble--ai">
                      Hi! I’m the MediQuick Medical AI assistant. Ask about products in our catalogue, general health topics, or how prescriptions work.
                    </div>
                    <div className="smart-assistant__suggestions" aria-label="Suggested questions">
                      {SUGGESTED_QUESTIONS.map((question) => (
                        <button
                          key={question}
                          type="button"
                          className="smart-assistant__chip"
                          disabled={aiLoading}
                          onClick={() => sendAiMessage(question)}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {aiMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`smart-assistant__msg-row smart-assistant__msg-row--${msg.role}`}
                  >
                    {msg.emergency ? (
                      <div className="smart-assistant__emergency" role="alert">
                        <div className="smart-assistant__emergency-head">
                          <AlertTriangle size={16} aria-hidden="true" />
                          <strong>Urgent Medical Safety Notice</strong>
                        </div>
                        <p>{msg.content}</p>
                      </div>
                    ) : (
                      <div
                        className={`smart-assistant__bubble smart-assistant__bubble--${
                          msg.role === "user" ? "user" : "ai"
                        }`}
                      >
                        <p className="smart-assistant__bubble-text">{msg.content}</p>
                      </div>
                    )}

                    {/* Verified MediQuick Catalogue Products */}
                    {msg.products && msg.products.length > 0 && (
                      <div className="smart-assistant__product-list" aria-label="Verified pharmacy products">
                        {msg.products.map((product) => (
                          <Link
                            key={product.id}
                            to={product.url || `/product/${product.id}`}
                            className="smart-assistant__product-card"
                            onClick={() => setOpen(false)}
                          >
                            <div className="smart-assistant__product-main">
                              <span className="smart-assistant__product-name">{product.name}</span>
                              <span className="smart-assistant__product-meta">
                                {[product.strength, product.dosage].filter(Boolean).join(" · ")}
                              </span>
                            </div>
                            <div className="smart-assistant__product-right">
                              <strong className="smart-assistant__product-price">
                                ZMW {Number(product.price || 0).toFixed(2)}
                              </strong>
                              <div className="smart-assistant__product-badges">
                                <span
                                  className={`smart-assistant__stock-pill ${
                                    product.inStock ? "is-in" : "is-out"
                                  }`}
                                >
                                  {product.inStock ? "In Stock" : "Out of Stock"}
                                </span>
                                {product.prescriptionRequired && (
                                  <span className="smart-assistant__rx-pill">Rx</span>
                                )}
                                <ExternalLink size={11} aria-hidden="true" />
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* Strictly Verified Direct Equivalents (only when exact item is out of stock) */}
                    {msg.verifiedAlternatives && msg.verifiedAlternatives.length > 0 && (
                      <div className="smart-assistant__alts">
                        <div className="smart-assistant__alts-head">
                          <ShieldCheck size={13} aria-hidden="true" />
                          <span>Verified Direct Equivalent (Pharmacist Review Recommended)</span>
                        </div>
                        {msg.verifiedAlternatives.map((alt) => (
                          <Link
                            key={alt.product.id}
                            to={alt.product.url || `/product/${alt.product.id}`}
                            className="smart-assistant__product-card smart-assistant__product-card--alt"
                            onClick={() => setOpen(false)}
                          >
                            <div className="smart-assistant__product-main">
                              <span className="smart-assistant__product-name">{alt.product.name}</span>
                              <span className="smart-assistant__product-meta">
                                Same active ingredient &amp; formulation
                              </span>
                            </div>
                            <div className="smart-assistant__product-right">
                              <strong className="smart-assistant__product-price">
                                ZMW {Number(alt.product.price || 0).toFixed(2)}
                              </strong>
                              <span className="smart-assistant__stock-pill is-in">In Stock</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* Pharmacist Escalation Prompt for Clinical / Dosing / Uncertain Questions */}
                    {msg.recommendPharmacist && !msg.emergency && (
                      <button
                        type="button"
                        className="smart-assistant__escalate-inline"
                        onClick={handleOpenEscalation}
                      >
                        <UserRoundCheck size={14} aria-hidden="true" />
                        <span>Speak with a MediQuick Pharmacist</span>
                        <ArrowRight size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}

                {aiLoading && (
                  <div className="smart-assistant__typing" role="status" aria-live="polite">
                    <span className="smart-assistant__dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>MediQuick AI is typing…</span>
                  </div>
                )}

                {aiError && (
                  <div className="smart-assistant__error-card" role="alert">
                    <p>{aiError}</p>
                    <button
                      type="button"
                      className="smart-assistant__error-action"
                      onClick={() => setActiveTab("support")}
                    >
                      Message Pharmacy Support <ArrowRight size={13} aria-hidden="true" />
                    </button>
                  </div>
                )}

                {/* Human Escalation Consent Card */}
                {showEscalationPrompt && (
                  <div className="smart-assistant__consent-card" role="region" aria-label="Transfer to Pharmacy Support">
                    <strong>Transfer to a MediQuick Pharmacist</strong>
                    <p>
                      Continue in the Pharmacy Support tab so our team can assist you personally.
                    </p>
                    <label className="smart-assistant__consent-check">
                      <input
                        type="checkbox"
                        checked={consentShareContext}
                        onChange={(event) => setConsentShareContext(event.target.checked)}
                      />
                      <span>
                        I consent to include a brief summary of my recent AI chat for context (avoid sharing private health details).
                      </span>
                    </label>
                    <div className="smart-assistant__consent-actions">
                      <button
                        type="button"
                        className="smart-assistant__consent-confirm"
                        onClick={handleConfirmEscalation}
                      >
                        Continue to Support
                      </button>
                      <button
                        type="button"
                        className="smart-assistant__consent-cancel"
                        onClick={() => setShowEscalationPrompt(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="smart-assistant__footer">
                <form className="smart-assistant__composer" onSubmit={handleAiSubmit}>
                  <input
                    type="text"
                    aria-label="Ask Medical AI"
                    maxLength={1000}
                    placeholder="Ask about medicines, stock, or health..."
                    value={aiInput}
                    disabled={aiLoading}
                    onChange={(event) => setAiInput(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="smart-assistant__send-icon"
                    aria-label="Send AI message"
                    disabled={aiLoading || !aiInput.trim()}
                  >
                    <Send size={15} />
                  </button>
                </form>
                <div className="smart-assistant__footer-bar">
                  <span className="smart-assistant__privacy-mini">Avoid sharing sensitive personal data</span>
                  <button
                    type="button"
                    className="smart-assistant__transfer-link"
                    onClick={handleOpenEscalation}
                  >
                    Talk to a Pharmacist
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PHARMACY SUPPORT (PRESERVED EXISTING WORKFLOW) */}
          {activeTab === "support" && (
            <div
              id="smart-assistant-panel-support"
              role="tabpanel"
              aria-labelledby="smart-assistant-tab-support"
              className="customer-support-chat__body smart-assistant__support-body"
            >
              <div className="customer-support-chat__bubble customer-support-chat__bubble--team">
                Hi! Leave a message for the pharmacy team and we’ll follow up using the contact details you provide.
              </div>
              {transferredNotice && (
                <div className="smart-assistant__transfer-banner">
                  <ShieldCheck size={14} aria-hidden="true" />
                  <span>Conversation summary attached with your consent. Feel free to edit it before sending.</span>
                </div>
              )}
              {supportMessages.map((item) => (
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

              <form className="customer-support-chat__form smart-assistant__support-form" onSubmit={submitSupportMessage} noValidate>
                <div className="support-field support-field--compact">
                  <div className="support-field__label-row">
                    <label className="support-field__label" htmlFor="widget-support-name">
                      Your name
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
                      id="widget-support-name"
                      autoComplete="name"
                      maxLength={100}
                      required
                      placeholder="John Banda"
                      value={form.name}
                      aria-invalid={touched.name && !nameValidation.valid ? "true" : "false"}
                      onChange={(event) => updateSupportField("name", event.target.value)}
                      onBlur={() => markSupportTouched("name")}
                    />
                    {touched.name && nameValidation.valid && (
                      <span className="support-field__status-icon support-field__status-icon--valid" aria-label="Valid name">
                        <CheckCircle2 size={15} aria-hidden="true" />
                      </span>
                    )}
                    {touched.name && !nameValidation.valid && (
                      <span className="support-field__status-icon support-field__status-icon--invalid" aria-hidden="true">
                        <AlertCircle size={15} />
                      </span>
                    )}
                  </div>
                  {touched.name && !nameValidation.valid && (
                    <span className="support-field__error" role="alert">{nameValidation.error}</span>
                  )}
                </div>

                <SupportPhoneInput
                  id="widget-support-phone"
                  label="Phone number"
                  countryCode={phoneCountry}
                  onCountryChange={(code) => {
                    setPhoneCountry(code);
                    if (supportError) setSupportError("");
                  }}
                  value={form.phone}
                  onChange={(value) => updateSupportField("phone", value)}
                  onBlur={() => markSupportTouched("phone")}
                  touched={touched.phone}
                  validation={phoneValidation}
                  compact
                />

                <div className="customer-support-chat__contact-fields">
                  <div className="support-field support-field--compact">
                    <label className="support-field__label" htmlFor="widget-support-email">
                      <span>Email <span className="support-field__opt">(optional)</span></span>
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
                        id="widget-support-email"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        placeholder="name@example.com"
                        value={form.email}
                        aria-invalid={touched.email && !emailValidation.valid ? "true" : "false"}
                        onChange={(event) => updateSupportField("email", event.target.value)}
                        onBlur={() => markSupportTouched("email")}
                      />
                      {touched.email && !emailValidation.isEmpty && emailValidation.valid && (
                        <span className="support-field__status-icon support-field__status-icon--valid" aria-label="Valid email">
                          <CheckCircle2 size={15} aria-hidden="true" />
                        </span>
                      )}
                      {touched.email && !emailValidation.valid && (
                        <span className="support-field__status-icon support-field__status-icon--invalid" aria-hidden="true">
                          <AlertCircle size={15} />
                        </span>
                      )}
                    </div>
                    {touched.email && !emailValidation.valid && (
                      <span className="support-field__error" role="alert">{emailValidation.error}</span>
                    )}
                  </div>

                  <label>
                    What do you need help with?
                    <select
                      value={form.inquiryType}
                      onChange={(event) => updateSupportField("inquiryType", event.target.value)}
                    >
                      <option>Help finding product</option>
                      <option>Order issue</option>
                      <option>Prescription query</option>
                      <option>Delivery question</option>
                      <option>Other</option>
                    </select>
                  </label>
                </div>

                <div className="support-field support-field--compact">
                  <div className="support-field__label-row">
                    <label className="support-field__label" htmlFor="widget-support-message">
                      Message
                    </label>
                    <span className="support-field__req" aria-hidden="true">*</span>
                  </div>
                  <textarea
                    id="widget-support-message"
                    maxLength={2000}
                    required
                    rows={3}
                    className={
                      touched.message && !messageValidation.valid
                        ? "support-field__textarea is-invalid"
                        : touched.message && messageValidation.valid
                          ? "support-field__textarea is-valid"
                          : "support-field__textarea"
                    }
                    value={form.message}
                    aria-invalid={touched.message && !messageValidation.valid ? "true" : "false"}
                    onChange={(event) => updateSupportField("message", event.target.value)}
                    onBlur={() => markSupportTouched("message")}
                    placeholder="How can we help?"
                  />
                  {touched.message && !messageValidation.valid && (
                    <span className="support-field__error" role="alert">{messageValidation.error}</span>
                  )}
                </div>

                {supportError && (
                  <p className="customer-support-chat__error" role="alert">
                    {supportError}
                  </p>
                )}
                <button
                  type="submit"
                  className="customer-support-chat__send"
                  disabled={supportSending || !isSupportFormValid}
                >
                  <Send size={15} />
                  {supportSending ? "Sending..." : "Send message"}
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        className={`customer-support-chat__launcher smart-assistant__launcher${open ? " is-open" : ""}`}
        aria-label={open ? "Close pharmacy support chat" : "Open pharmacy support chat"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={22} /> : <Sparkles size={20} />}
        {!open && <span>Smart Assistant</span>}
      </button>
    </div>
  );
}
