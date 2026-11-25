import { useContext, useEffect, useState } from "react";
import { DataContext } from "../context/DataContext";
import { getAccessToken } from "../utils/authStorage";
import {
  getAccessTokenExpiration,
  isAccessTokenExpired,
  isStaffRole,
} from "../utils/staffAccess";

export default function useStaffSession() {
  const { userRole } = useContext(DataContext);
  const token = getAccessToken();
  const tokenExpired = isAccessTokenExpired(token);
  const [expirationReached, setExpirationReached] = useState(false);

  useEffect(() => {
    setExpirationReached(false);
    if (tokenExpired) return undefined;

    const expiration = getAccessTokenExpiration(token);
    const timeout = setTimeout(
      () => setExpirationReached(true),
      Math.max(0, expiration * 1000 - Date.now())
    );
    return () => clearTimeout(timeout);
  }, [token, tokenExpired]);

  return {
    role: userRole,
    isStaff: isStaffRole(userRole) && Boolean(token) && !tokenExpired && !expirationReached,
  };
}
