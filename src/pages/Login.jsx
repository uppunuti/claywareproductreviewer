import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const navigate = useNavigate();

    const login = async (e) => {
        e.preventDefault();

        setLoading(true);
        setError("");

        // ==========================================================
        // CLEAR OLD TOKENS
        // ==========================================================

        localStorage.removeItem("auth_token");
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("current_user");

        try {
            // ==========================================================
            // 1. LOGIN
            // ==========================================================

            console.log(
                "LOGIN API:",
                api.defaults.baseURL + "/accounts/login/"
            );

            const response = await api.post(
                "/accounts/login/",
                {
                    email: email.trim(),
                    password: password,
                }
            );

            console.log(
                "LOGIN RESPONSE:",
                response.data
            );

            // ==========================================================
            // 2. GET JWT TOKENS
            // ==========================================================

            const accessToken =
                response.data.access;

            const refreshToken =
                response.data.refresh;

            if (!accessToken) {
                throw new Error(
                    "Access token was not received from server."
                );
            }

            // ==========================================================
            // 3. SAVE TOKENS
            // ==========================================================

            localStorage.setItem(
                "auth_token",
                accessToken
            );

            localStorage.setItem(
                "access_token",
                accessToken
            );

            if (refreshToken) {
                localStorage.setItem(
                    "refresh_token",
                    refreshToken
                );
            }

            console.log(
                "JWT token saved successfully"
            );

            // ==========================================================
            // 4. GET CURRENT USER
            // ==========================================================

            // IMPORTANT:
            // The token is already saved above.
            // axios.js interceptor will automatically
            // add Authorization: Bearer <token>

            const userResponse = await api.get(
                "/accounts/me/"
            );

            const user = userResponse.data;

            console.log(
                "CURRENT USER:",
                user
            );

            // ==========================================================
            // 5. CHECK PRODUCT REVIEWER
            // ==========================================================

            if (
                user.role !== "product_reviewer" ||
                user.account_status !== "active"
            ) {
                localStorage.removeItem(
                    "auth_token"
                );

                localStorage.removeItem(
                    "access_token"
                );

                localStorage.removeItem(
                    "refresh_token"
                );

                localStorage.removeItem(
                    "current_user"
                );

                setError(
                    "Access denied. You are not an active Product Review Team member."
                );

                return;
            }

            // ==========================================================
            // 6. SAVE CURRENT USER
            // ==========================================================

            localStorage.setItem(
                "current_user",
                JSON.stringify(user)
            );

            // ==========================================================
            // 7. LOGIN SUCCESS
            // ==========================================================

            console.log(
                "Product Review Team login successful"
            );

            navigate("/dashboard", {
                replace: true,
            });

        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            console.error(
                "STATUS:",
                error.response?.status
            );

            console.error(
                "RESPONSE:",
                error.response?.data
            );

            // ==========================================================
            // CLEAR TOKENS
            // ==========================================================

            localStorage.removeItem(
                "auth_token"
            );

            localStorage.removeItem(
                "access_token"
            );

            localStorage.removeItem(
                "refresh_token"
            );

            localStorage.removeItem(
                "current_user"
            );

            // ==========================================================
            // BACKEND ERROR
            // ==========================================================

            const backendError =
                error.response?.data?.message ||
                error.response?.data?.detail ||
                error.response?.data?.error;

            setError(
                backendError ||
                "Unable to login. Please check your credentials."
            );

        } finally {

            setLoading(false);

        }
    };

    return (
        <div style={styles.page}>

            <div style={styles.card}>

                <h1 style={styles.title}>
                    ClayWare
                </h1>

                <p style={styles.subtitle}>
                    Product Review Team
                </p>

                <form onSubmit={login}>

                    {/* EMAIL */}

                    <input
                        type="email"
                        placeholder="Employee Email"
                        value={email}
                        onChange={(e) =>
                            setEmail(e.target.value)
                        }
                        style={styles.input}
                        autoComplete="username"
                        required
                    />

                    {/* PASSWORD */}

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) =>
                            setPassword(e.target.value)
                        }
                        style={styles.input}
                        autoComplete="current-password"
                        required
                    />

                    {/* ERROR */}

                    {error && (
                        <p style={styles.error}>
                            {error}
                        </p>
                    )}

                    {/* LOGIN BUTTON */}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            ...styles.button,
                            ...(loading
                                ? styles.buttonDisabled
                                : {}),
                        }}
                    >
                        {loading
                            ? "Signing in..."
                            : "Sign In"}
                    </button>

                </form>

                <p style={styles.footer}>
                    Internal Company Portal
                </p>

            </div>

        </div>
    );
}


// ==========================================================
// STYLES
// ==========================================================

const styles = {

    page: {
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f4f6f8",
        padding: "20px",
        boxSizing: "border-box",
    },

    card: {
        width: "380px",
        maxWidth: "100%",
        padding: "40px",
        background: "#ffffff",
        borderRadius: "12px",
        boxShadow:
            "0 8px 30px rgba(0,0,0,0.08)",
        boxSizing: "border-box",
    },

    title: {
        textAlign: "center",
        margin: "0 0 5px 0",
        fontSize: "32px",
        color: "#222",
    },

    subtitle: {
        textAlign: "center",
        color: "#666",
        margin: "0 0 30px 0",
        fontSize: "16px",
    },

    input: {
        width: "100%",
        boxSizing: "border-box",
        padding: "13px",
        marginBottom: "15px",
        border: "1px solid #ddd",
        borderRadius: "6px",
        fontSize: "15px",
        outline: "none",
        background: "#ffffff",
    },

    button: {
        width: "100%",
        padding: "13px",
        border: "none",
        borderRadius: "6px",
        background: "#1f6f54",
        color: "#ffffff",
        fontSize: "16px",
        fontWeight: "600",
        cursor: "pointer",
    },

    buttonDisabled: {
        opacity: 0.7,
        cursor: "not-allowed",
    },

    error: {
        color: "#d32f2f",
        fontSize: "14px",
        marginTop: "0",
        marginBottom: "15px",
    },

    footer: {
        textAlign: "center",
        color: "#888",
        fontSize: "13px",
        marginTop: "25px",
        marginBottom: 0,
    },
};

export default Login;