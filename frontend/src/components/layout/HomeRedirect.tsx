import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { NAV_CONFIG } from "./navConfig";

export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const firstItem = NAV_CONFIG[user.role][0];
  return <Navigate to={firstItem.path} replace />;
}
