import { Navigate } from "react-router-dom";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("access_token");

  console.log("PRIVATE ROUTE TOKEN:", token);

  if (!token) {
    console.log("NO TOKEN → LOGIN");
    return <Navigate to="/login" replace />;
  }

  console.log("TOKEN FOUND → ALLOW ACCESS");

  return children;
}

export default PrivateRoute;