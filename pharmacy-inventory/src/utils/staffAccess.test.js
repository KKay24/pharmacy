import {
  getAccessTokenExpiration,
  getStaffWorkspacePath,
  isAccessTokenExpired,
  isStaffRole,
} from "./staffAccess";

const createToken = (payload) => {
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${encodedPayload}.signature`;
};

describe("staff workspace access helpers", () => {
  it.each([
    ["admin", "/dashboard"],
    ["manager", "/dashboard"],
    ["user", "/pos"],
  ])("maps staff role %s to its workspace", (role, path) => {
    expect(isStaffRole(role)).toBe(true);
    expect(getStaffWorkspacePath(role)).toBe(path);
  });

  it("does not grant staff access to customer roles", () => {
    expect(isStaffRole("customer")).toBe(false);
    expect(getStaffWorkspacePath("customer")).toBeNull();
  });

  it("rejects missing, malformed, and expired staff tokens", () => {
    expect(isAccessTokenExpired(null)).toBe(true);
    expect(isAccessTokenExpired("not-a-jwt")).toBe(true);
    expect(isAccessTokenExpired(createToken({ exp: 100 }), 100)).toBe(true);
    expect(isAccessTokenExpired(createToken({ exp: 101 }), 100)).toBe(false);
    expect(getAccessTokenExpiration(createToken({ sub: "staff" }))).toBeNull();
  });
});
