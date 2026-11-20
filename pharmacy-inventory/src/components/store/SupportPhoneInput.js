import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  DEFAULT_PHONE_COUNTRY,
  SUPPORTED_PHONE_COUNTRIES,
  getCountryOption,
} from "../../utils/contactValidation";

function ZambiaFlagSvg() {
  return (
    <svg
      className="support-phone__flag-svg"
      viewBox="0 0 24 16"
      width="20"
      height="14"
      aria-hidden="true"
    >
      <rect width="24" height="16" rx="2" fill="#198A00" />
      <rect x="15" y="6" width="3" height="10" fill="#DE2010" />
      <rect x="18" y="6" width="3" height="10" fill="#111827" />
      <rect x="21" y="6" width="3" height="10" fill="#EF7D00" />
      <path d="M16.5 4.2 L19.5 2.5 L22.5 4.2 L20.8 4.8 L19.5 4.1 L18.2 4.8 Z" fill="#EF7D00" />
    </svg>
  );
}

function CountryBadge({ code }) {
  if (code === "ZM") {
    return <ZambiaFlagSvg />;
  }
  return (
    <span className="support-phone__iso-badge" aria-hidden="true">
      {code}
    </span>
  );
}

export default function SupportPhoneInput({
  id = "support-phone",
  label = "Phone number",
  required = true,
  countryCode = DEFAULT_PHONE_COUNTRY,
  onCountryChange,
  value,
  onChange,
  onBlur,
  touched = false,
  validation,
  compact = false,
}) {
  const selectedCountry = getCountryOption(countryCode);
  const showError = touched && validation && !validation.valid;
  const showValid = touched && validation && validation.valid;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={`support-field${compact ? " support-field--compact" : ""}`}>
      <div className="support-field__label-row">
        <label className="support-field__label" htmlFor={id}>
          {label}
        </label>
        {required && <span className="support-field__req" aria-hidden="true">*</span>}
      </div>
      <div
        className={`support-phone__control${showError ? " is-invalid" : ""}${showValid ? " is-valid" : ""}`}
      >
        <div className="support-phone__country">
          <CountryBadge code={selectedCountry.code} />
          <select
            aria-label="Country code"
            className="support-phone__select"
            value={selectedCountry.code}
            onChange={(event) => onCountryChange?.(event.target.value)}
          >
            {SUPPORTED_PHONE_COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.code} ({country.dialCode})
              </option>
            ))}
          </select>
        </div>

        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={32}
          required={required}
          className="support-phone__input"
          placeholder={selectedCountry.placeholder}
          value={value}
          aria-invalid={showError ? "true" : "false"}
          aria-describedby={showError ? errorId : hintId}
          onChange={(event) => onChange?.(event.target.value)}
          onBlur={() => onBlur?.()}
        />

        {showValid && (
          <span className="support-field__status-icon support-field__status-icon--valid" aria-label="Valid phone number">
            <CheckCircle2 size={16} aria-hidden="true" />
          </span>
        )}
        {showError && (
          <span className="support-field__status-icon support-field__status-icon--invalid" aria-hidden="true">
            <AlertCircle size={16} />
          </span>
        )}
      </div>

      {showError ? (
        <span id={errorId} className="support-field__error" role="alert">
          {validation.error}
        </span>
      ) : showValid ? (
        <span id={hintId} className="support-field__valid-hint">
          Verified format: {validation.normalized}
        </span>
      ) : (
        <span id={hintId} className="support-field__hint">
          {selectedCountry.code === "ZM"
            ? "Zambia (+260) · e.g. 0977 123 456 or +260 977 123 456"
            : `${selectedCountry.name} (${selectedCountry.dialCode})`}
        </span>
      )}
    </div>
  );
}
