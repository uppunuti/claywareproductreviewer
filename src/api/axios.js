import axios from "axios";

console.log("VITE_API_URL:", import.meta.env.VITE_API_URL);
console.log("MODE:", import.meta.env.MODE);

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(
    (config) => {
        const accessToken =
            localStorage.getItem("access_token");

        if (accessToken) {
            config.headers.Authorization =
                `Bearer ${accessToken}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

export default api;