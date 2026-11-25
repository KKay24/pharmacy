import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Phone,
  RefreshCw,
  Search,
  User,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { apiFetch, getApiErrorMessage } from "../utils/api";

const GENDER_OPTIONS = ["Female", "Male", "Other", "Prefer not to say"];

export function formatPatientId(customer) {
  if (!customer) return "";
  return customer.patientCode || `MQP-${String(customer.id).padStart(6, "0")}`;
}

function matchesPatientQuery(customer, rawQuery) {
  const q = String(rawQuery || "").trim().toLowerCase();
  if (!q) return true;
  const code = formatPatientId(customer).toLowerCase();
  const numericId = String(customer.id);
  const digitsQuery = q.replace(/\D/g, "");
  const phoneDigits = String(customer.phone || "").replace(/\D/g, "");

  return (
    String(customer.name || "").toLowerCase().includes(q)
    || String(customer.firstName || "").toLowerCase().includes(q)
    || String(customer.lastName || "").toLowerCase().includes(q)
    || String(customer.phone || "").toLowerCase().includes(q)
    || code.includes(q)
    || numericId === q.replace(/^#/, "")
    || (digitsQuery.length >= 3 && phoneDigits.includes(digitsQuery))
  );
}

function validateDobInput(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return "Use YYYY-MM-DD format (e.g. 1994-08-21).";
  }
  const [year, month, day] = trimmed.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime())
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day
  ) {
    return "Enter a valid calendar date.";
  }
  if (trimmed > new Date().toISOString().slice(0, 10)) {
    return "Date of birth cannot be in the future.";
  }
  return null;
}

export default function PosCustomerModal({
  isOpen,
  selectedCustomer,
  customers = [],
  onClose,
  onSelectWalkIn,
  onSelectPatient,
  onRegisterPatient,
}) {
  const [mode, setMode] = useState("select");
  const [searchQuery, setSearchQuery] = useState("");
  const [listItems, setListItems] = useState(customers);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [duplicateCustomer, setDuplicateCustomer] = useState(null);

  const reqSeqRef = useRef(0);

  useEffect(() => {
    setListItems(Array.isArray(customers) ? customers : []);
  }, [customers]);

  const fetchPatients = async (queryText = "") => {
    const seq = ++reqSeqRef.current;
    setLoading(true);
    setFetchError("");
    try {
      const trimmed = queryText.trim();
      const url = trimmed
        ? `/api/customers?q=${encodeURIComponent(trimmed)}&limit=50`
        : "/api/customers?limit=100";
      const response = await apiFetch(url);
      if (seq !== reqSeqRef.current) return;
      if (!response.ok) {
        setFetchError(await getApiErrorMessage(response, "Unable to load registered patients."));
        return;
      }
      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
      setListItems(rows);
    } catch (error) {
      if (seq !== reqSeqRef.current) return;
      setFetchError("Unable to reach the patient registry.");
    } finally {
      if (seq === reqSeqRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setMode("select");
      setSearchQuery("");
      setFormError("");
      setDuplicateCustomer(null);
      return;
    }
    fetchPatients("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || mode !== "select") return undefined;
    const timer = setTimeout(() => {
      fetchPatients(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, mode]);

  const filteredCustomers = useMemo(
    () => listItems.filter((item) => matchesPatientQuery(item, searchQuery)),
    [listItems, searchQuery]
  );

  if (!isOpen) return null;

  const isWalkInSelected = !selectedCustomer;

  const openRegister = (prefillFromSearch = false) => {
    setFormError("");
    setDuplicateCustomer(null);
    if (prefillFromSearch && searchQuery.trim()) {
      const trimmed = searchQuery.trim();
      const digitsOnly = trimmed.replace(/\D/g, "");
      if (digitsOnly.length >= 6 && /^[\d\s+\-()]+$/.test(trimmed)) {
        setPhone(trimmed);
        setFirstName("");
        setLastName("");
      } else {
        const parts = trimmed.split(/\s+/);
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" "));
        setPhone("");
      }
    } else {
      setFirstName("");
      setLastName("");
      setPhone("");
    }
    setGender("");
    setDateOfBirth("");
    setAddress("");
    setMode("register");
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setFormError("");
    setDuplicateCustomer(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanPhone = phone.trim();
    const cleanDob = dateOfBirth.trim();
    const cleanAddress = address.trim();

    if (!cleanFirst || !cleanLast) {
      setFormError("First name and last name are required.");
      return;
    }
    if (cleanPhone && cleanPhone.replace(/\D/g, "").length < 6) {
      setFormError("Phone number must contain at least 6 digits.");
      return;
    }
    const dobErr = validateDobInput(cleanDob);
    if (dobErr) {
      setFormError(dobErr);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        firstName: cleanFirst,
        lastName: cleanLast,
        name: `${cleanFirst} ${cleanLast}`,
        phone: cleanPhone || undefined,
        gender: gender || undefined,
        dateOfBirth: cleanDob || undefined,
        address: cleanAddress || undefined,
      };

      let result;
      if (onRegisterPatient) {
        result = await onRegisterPatient(payload);
      } else {
        const res = await apiFetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          result = {
            success: false,
            error: data?.message || data?.error || "Failed to register patient.",
            existingCustomer: data?.existingCustomer || null,
          };
        } else {
          result = { success: true, customer: data };
        }
      }

      if (!result?.success || !result?.customer) {
        if (result?.existingCustomer) setDuplicateCustomer(result.existingCustomer);
        setFormError(result?.error || "Failed to register patient.");
        return;
      }

      setListItems((prev) => [
        result.customer,
        ...prev.filter((item) => item.id !== result.customer.id),
      ]);
      onSelectPatient?.(result.customer);
      onClose?.();
    } catch (error) {
      setFormError("Unable to reach the patient registry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="pos-payment-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose?.();
      }}
    >
      <section
        className="pos-customer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-customer-modal-title"
      >
        <div className="pos-customer-dialog-header">
          <div className="pos-customer-dialog-title-wrap">
            {mode === "register" && (
              <button
                type="button"
                className="pos-customer-icon-btn"
                aria-label="Back to customer list"
                onClick={() => {
                  setFormError("");
                  setDuplicateCustomer(null);
                  setMode("select");
                }}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <h3 id="pos-customer-modal-title">
                {mode === "register" ? "Register New Patient" : "Assign Patient / Customer"}
              </h3>
              <p className="pos-customer-current">
                Current:{" "}
                <strong>
                  {selectedCustomer
                    ? `${selectedCustomer.name} (${formatPatientId(selectedCustomer)})`
                    : "Walking Customer"}
                </strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="pos-customer-icon-btn"
            aria-label="Close customer modal"
            disabled={submitting}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {mode === "select" ? (
          <div className="pos-customer-body">
            <div className="pos-customer-search">
              <Search size={16} color="#64748b" aria-hidden="true" />
              <input
                type="text"
                aria-label="Search registered patients"
                placeholder="Search by name, phone number, or patient ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="pos-customer-clear-btn"
                  aria-label="Clear patient search"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="pos-customer-quick-actions">
              <button
                type="button"
                className={`pos-walkin-card ${isWalkInSelected ? "is-selected" : ""}`}
                onClick={() => {
                  onSelectWalkIn?.();
                  onClose?.();
                }}
              >
                <span className="pos-walkin-icon">
                  <UserCheck size={18} />
                </span>
                <span className="pos-walkin-copy">
                  <strong>Walking Customer</strong>
                  <span>Checkout without patient record or registration</span>
                </span>
                {isWalkInSelected && (
                  <span className="pos-customer-selected-badge">
                    <Check size={12} /> Selected
                  </span>
                )}
              </button>

              <button
                type="button"
                className="pos-register-patient-btn"
                onClick={() => openRegister(false)}
              >
                <UserPlus size={16} />
                Register New Patient
              </button>
            </div>

            <div className="pos-customer-list-header">
              <span>Registered Patients ({filteredCustomers.length})</span>
              <button
                type="button"
                className="pos-customer-refresh-btn"
                disabled={loading}
                onClick={() => fetchPatients(searchQuery)}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {fetchError && (
              <div className="pos-customer-alert" role="alert">
                <AlertCircle size={15} />
                <span>{fetchError}</span>
                <button type="button" onClick={() => fetchPatients(searchQuery)}>
                  Retry
                </button>
              </div>
            )}

            <div className="pos-customer-list">
              {loading && filteredCustomers.length === 0 ? (
                <div className="pos-customer-empty">Loading registered patients…</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="pos-customer-empty">
                  <User size={24} color="#94a3b8" />
                  <strong>
                    {searchQuery.trim() ? "No matching patients found" : "No registered patients yet"}
                  </strong>
                  <p>
                    {searchQuery.trim()
                      ? `No patient matched "${searchQuery.trim()}". Register them or select Walking Customer.`
                      : "Register a patient to track prescriptions and purchase history, or continue with Walking Customer."}
                  </p>
                  <button
                    type="button"
                    className="pos-customer-empty-cta"
                    onClick={() => openRegister(Boolean(searchQuery.trim()))}
                  >
                    <UserPlus size={14} />{" "}
                    {searchQuery.trim() ? `Register "${searchQuery.trim()}"` : "Register First Patient"}
                  </button>
                </div>
              ) : (
                filteredCustomers.map((patient) => {
                  const isSelected = selectedCustomer && Number(selectedCustomer.id) === Number(patient.id);
                  return (
                    <button
                      type="button"
                      key={patient.id}
                      className={`pos-customer-row ${isSelected ? "is-selected" : ""}`}
                      onClick={() => {
                        onSelectPatient?.(patient);
                        onClose?.();
                      }}
                    >
                      <span className="pos-customer-avatar">
                        {String(patient.name || "?").charAt(0).toUpperCase()}
                      </span>
                      <span className="pos-customer-row-copy">
                        <strong>{patient.name}</strong>
                        <span className="pos-customer-row-meta">
                          <code>{formatPatientId(patient)}</code>
                          <span>
                            <Phone size={11} /> {patient.phone || "No phone"}
                          </span>
                        </span>
                      </span>
                      {isSelected && <CheckCircle2 size={18} color="#00966d" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <form className="pos-customer-form" onSubmit={handleRegisterSubmit}>
            <div className="pos-customer-autoid">
              Patient ID is generated automatically on save (e.g. <code>MQP-000123</code>). Your current cart items will be preserved.
            </div>

            {formError && (
              <div className="pos-customer-alert is-column" role="alert">
                <div className="pos-customer-alert-line">
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
                {duplicateCustomer && (
                  <button
                    type="button"
                    className="pos-use-existing-btn"
                    onClick={() => {
                      onSelectPatient?.(duplicateCustomer);
                      onClose?.();
                    }}
                  >
                    <Check size={14} /> Select Existing: {duplicateCustomer.name} ({formatPatientId(duplicateCustomer)})
                  </button>
                )}
              </div>
            )}

            <div className="pos-customer-form-grid">
              <label>
                First Name *
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Chanda"
                />
              </label>
              <label>
                Last Name *
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Banda"
                />
              </label>
              <label>
                Phone Number
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0971234567"
                />
              </label>
              <label>
                Gender
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Select gender (optional)</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date of Birth
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </label>
              <label>
                Address
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, area, or town"
                />
              </label>
            </div>

            <div className="pos-customer-form-actions">
              <button
                type="button"
                className="pos-customer-cancel-btn"
                disabled={submitting}
                onClick={() => setMode("select")}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="pos-register-patient-btn"
                disabled={submitting}
              >
                <UserPlus size={16} />
                {submitting ? "Registering…" : "Register & Assign to Sale"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
