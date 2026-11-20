import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import isEmail from "validator/lib/isEmail";

export const DEFAULT_PHONE_COUNTRY = "ZM";

export const SUPPORTED_PHONE_COUNTRIES = [
  { code: "ZM", name: "Zambia", dialCode: "+260", placeholder: "977 123 456" },
  { code: "ZA", name: "South Africa", dialCode: "+27", placeholder: "82 123 4567" },
  { code: "ZW", name: "Zimbabwe", dialCode: "+263", placeholder: "77 123 4567" },
  { code: "MW", name: "Malawi", dialCode: "+265", placeholder: "99 123 4567" },
  { code: "BW", name: "Botswana", dialCode: "+267", placeholder: "71 123 456" },
  { code: "TZ", name: "Tanzania", dialCode: "+255", placeholder: "712 123 456" },
  { code: "KE", name: "Kenya", dialCode: "+254", placeholder: "712 123 456" },
  { code: "NA", name: "Namibia", dialCode: "+264", placeholder: "81 123 4567" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", placeholder: "7911 123456" },
  { code: "US", name: "United States", dialCode: "+1", placeholder: "202 555 0143" },
];

export function getCountryOption(code) {
  return (
    SUPPORTED_PHONE_COUNTRIES.find((item) => item.code === code) ||
    SUPPORTED_PHONE_COUNTRIES[0]
  );
}

export function validateSupportPhone(rawPhone, countryCode = DEFAULT_PHONE_COUNTRY) {
  const input = typeof rawPhone === "string" ? rawPhone.trim() : "";
  if (!input) {
    return {
      valid: false,
      normalized: "",
      detectedCountry: countryCode,
      error: "Phone number is required.",
    };
  }

  if (/[a-zA-Z]/.test(input)) {
    return {
      valid: false,
      normalized: "",
      detectedCountry: countryCode,
      error: "Enter a valid phone number (e.g. 0977 123 456 or +260 977 123 456).",
    };
  }

  const parsed = parsePhoneNumberFromString(input, countryCode || DEFAULT_PHONE_COUNTRY);
  if (!parsed || !parsed.isValid()) {
    return {
      valid: false,
      normalized: "",
      detectedCountry: countryCode,
      error:
        countryCode === "ZM"
          ? "Enter a valid Zambian number (e.g. 0977 123 456 or +260 977 123 456)."
          : "Enter a valid phone number for the selected country or include the + country code.",
    };
  }

  return {
    valid: true,
    normalized: parsed.number, // E.164
    detectedCountry: parsed.country || countryCode,
    error: "",
  };
}

export function validateSupportEmail(rawEmail) {
  const trimmed = typeof rawEmail === "string" ? rawEmail.trim() : "";
  if (!trimmed) {
    return { valid: true, isEmpty: true, normalized: "", error: "" };
  }

  if (
    trimmed.length > 254 ||
    !isEmail(trimmed, {
      allow_utf8_local_part: false,
      require_tld: true,
    })
  ) {
    return {
      valid: false,
      isEmpty: false,
      normalized: trimmed,
      error: "Enter a valid email address (e.g. name@example.com).",
    };
  }

  return {
    valid: true,
    isEmpty: false,
    normalized: trimmed,
    error: "",
  };
}

export function validateSupportName(rawName) {
  const trimmed = typeof rawName === "string" ? rawName.trim() : "";
  if (!trimmed) {
    return { valid: false, normalized: "", error: "Your name is required." };
  }
  return { valid: true, normalized: trimmed, error: "" };
}

export function validateSupportMessage(rawMessage) {
  const trimmed = typeof rawMessage === "string" ? rawMessage.trim() : "";
  if (!trimmed) {
    return { valid: false, normalized: "", error: "Please enter a message." };
  }
  return { valid: true, normalized: trimmed, error: "" };
}
