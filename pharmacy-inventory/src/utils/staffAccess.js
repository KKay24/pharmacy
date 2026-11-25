export const STAFF_ROLES = ["admin", "manager", "user"];

export const isStaffRole = (role) => STAFF_ROLES.includes(role);

export const getStaffWorkspacePath = (role) => {
  if (role === "admin" || role === "manager") return "/dashboard";
  if (role === "user") return "/pos";
  return null;
};

export const getAccessTokenExpiration = (token) => {
  if (typeof token !== "string") return null;

  try {
    const [header, encodedPayload, signature] = token.split(".");
    if (!header || !encodedPayload || !signature) return null;
    const base64Payload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = base64Payload + "=".repeat((4 - (base64Payload.length % 4)) % 4);
    const payload = JSON.parse(atob(paddedPayload));
    return Number.isFinite(payload.exp) ? payload.exp : null;
  } catch {
    return null;
  }
};

export const isAccessTokenExpired = (token, nowSeconds = Date.now() / 1000) => {
  const expiration = getAccessTokenExpiration(token);
  return expiration === null || expiration <= nowSeconds;
};
