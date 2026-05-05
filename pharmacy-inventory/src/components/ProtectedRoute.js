import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { DataContext } from "../context/DataContext";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { userRole } = useContext(DataContext);

  // If there's no role yet (or they are completely logged out/session expired)
  if (!userRole) {
    return <Navigate to="/" replace />;
  }

  // If their role is not in the allowed list, send them to POS (or a generic safe page)
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/pos" replace />;
  }

  // Otherwise, render the requested component
  return children;
};

export default ProtectedRoute;
