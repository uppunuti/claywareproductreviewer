import { Routes, Route, Navigate } from "react-router-dom";

import ProductReviewerLogin from "../pages/ProductReviewerLogin";
import ProductReview from "../pages/ProductReview";
import Dashboard from "../pages/Dashboard";
 import ProductReview from "../pages/ProductReview";


function ProtectedReviewerRoute({ children }) {
    const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("auth_token");

    if (!token) {
        return <Navigate to="/product-reviewer/login" replace />;
    }

    return children;
}


function ProductReviewRoutes() {
    return (
        <Routes>

            {/* =========================
                PRODUCT REVIEWER LOGIN
            ========================= */}

            <Route
                path="/product-reviewer/login"
                element={<ProductReviewerLogin />}
            />


            {/* =========================
                PRODUCT REVIEWER DASHBOARD
            ========================= */}

            <Route
                path="/product-reviews"
                element={
                    <ProtectedReviewerRoute>
                        <Dashboard />
                    </ProtectedReviewerRoute>
                }
            />


            {/* =========================
                REVIEW PRODUCT
            ========================= */}

            <Route
                path="/product-reviews/:productId"
                element={
                    <ProtectedReviewerRoute>
                        <ProductReview />
                    </ProtectedReviewerRoute>
                }
            />


            {/* =========================
                FALLBACK
            ========================= */}

            <Route
                path="*"
                element={
                    <Navigate
                        to="/product-reviewer/login"
                        replace
                    />
                }
            />

           

<Route
    path="/product-reviews/:productId"
    element={<ProductReview />}
/>

        </Routes>
    );
}

export default ProductReviewRoutes;