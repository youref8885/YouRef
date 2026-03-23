import { useEffect, useState } from "react";
import { apiRequest } from "./api";
import { LoginPanel } from "./components/auth/LoginPanel";
import { AuthenticatedApp } from "./components/layout/AuthenticatedApp";

export default function App() {
  const [auth, setAuth] = useState(() => {
    const saved = sessionStorage.getItem("crm-youref-auth");
    return saved ? JSON.parse(saved) : null;
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("crm-youref-theme") || "light");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [invitation, setInvitation] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    const otp = params.get("otp");
    if (email && otp) {
      setInvitation({ email, otp });
      // Limpiar la URL sin recargar la página
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (auth) sessionStorage.setItem("crm-youref-auth", JSON.stringify(auth));
    else sessionStorage.removeItem("crm-youref-auth");
  }, [auth]);

  useEffect(() => {
    localStorage.setItem("crm-youref-theme", theme);
  }, [theme]);

  async function handleLogin(payload) {
    setLoading(true);
    try {
      const data = await apiRequest("/auth/login", { method: "POST", body: payload });
      setAuth(data);
      setNotice("");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(payload) {
    setLoading(true);
    try {
      const data = await apiRequest("/auth/register", { method: "POST", body: payload });
      setNotice(`${data.message}`);
      return { ok: true };
    } catch (error) {
      setNotice(error.message);
      return { ok: false };
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(payload) {
    setLoading(true);
    try {
      const data = await apiRequest("/auth/verify-2fa", { method: "POST", body: payload });
      setAuth(data);
      setNotice("");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(payload) {
    setLoading(true);
    try {
      const data = await apiRequest("/auth/forgot-password", { method: "POST", body: payload });
      setNotice(data.message);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(payload) {
    setLoading(true);
    try {
      const data = await apiRequest("/auth/reset-password", { method: "POST", body: payload });
      setNotice(data.message);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileSave(payload) {
    const data = await apiRequest("/users/profile", { method: "PATCH", token: auth.token, body: payload });
    setAuth((prev) => ({ ...prev, user: data.user }));
  }

  if (!auth) {
    return (
      <LoginPanel 
        onLogin={handleLogin} 
        onRegister={handleRegister} 
        onVerify={handleVerify} 
        onForgot={handleForgot} 
        onReset={handleReset} 
        loading={loading} 
        notice={notice} 
        theme={theme} 
        onToggleTheme={() => setTheme((current) => current === "light" ? "dark" : "light")} 
        invitation={invitation}
      />
    );
  }

  return (
    <AuthenticatedApp 
      auth={auth} 
      onLogout={() => setAuth(null)} 
      onProfileSave={handleProfileSave} 
      setAuthNotice={setNotice} 
      theme={theme} 
      onToggleTheme={() => setTheme((current) => current === "light" ? "dark" : "light")} 
    />
  );
}
