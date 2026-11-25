import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import useStaffSession from "../hooks/useStaffSession";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { role, isStaff } = useStaffSession();
  const location = useLocation();

  if (!isStaff) {
    if (role === "customer") {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/staff/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/pos" replace />;
  }

  return children;
};

export default ProtectedRoute;
