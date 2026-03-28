import { useState, useEffect } from "react";
import { classNames, validateRUT, formatRUT, formatPhone } from "../../utils";
import { ThemeToggle } from "../layout/ThemeToggle";
import { Field } from "../ui/Input";
import { apiRequest } from "../../api";
import "./LoginMobile.css";
import { TermsModal } from "./TermsModal";

const emptyRegister = {
  firstName: "",
  lastName: "",
  rut: "",
  dateOfBirth: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: ""
};

export function LoginPanel({
  onLogin,
  onRegister,
  onVerify,
  onForgot,
  onReset,
  loading,
  notice,
  theme,
  onToggleTheme,
  invitation
}) {
  const [mode, setMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState(emptyRegister);
  const [verifyForm, setVerifyForm] = useState({ email: "", otpCode: "" });
  const [preVerifiedData, setPreVerifiedData] = useState(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localRUTError, setLocalRUTError] = useState("");

  const [forgotForm, setForgotForm] = useState({ email: "" });
  const [resetForm, setResetForm] = useState({ email: "", code: "", password: "", confirmPassword: "" });
  
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (invitation) {
      setVerifyForm({ email: invitation.email, otpCode: invitation.otp });
      setMode("verify");
    }
  }, [invitation]);

  const updateRegister = (field, value) => {
    setRegisterForm((prev) => ({ ...prev, [field]: value }));
    if (preVerifiedData) {
      setPreVerifiedData(prev => ({ ...prev, [field]: value }));
    }
  };

  async function handlePreVerify(e) {
    e.preventDefault();
    setInternalLoading(true);
    setLocalError("");
    try {
      const data = await apiRequest("/auth/pre-verify", {
        method: "POST",
        body: { email: verifyForm.email, otpCode: verifyForm.otpCode }
      });
      setPreVerifiedData({
        ...emptyRegister,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email
      });
      setShowTermsModal(true);
    } catch (error) {
      setLocalError(error.message);
    } finally {
      setInternalLoading(false);
    }
  }

  async function handleFinalVerify(e) {
    e.preventDefault();
    if (localRUTError) {
      setLocalError("Por favor, ingrese un RUT válido.");
      return;
    }
    if (preVerifiedData.password !== preVerifiedData.confirmPassword) {
      setLocalError("Las contraseñas no coinciden.");
      return;
    }
    onVerify({
      ...preVerifiedData,
      otpCode: verifyForm.otpCode,
      termsAccepted: true // Ya validado por el modal
    });
  }

  return (
    <div className={classNames("theme-shell min-h-screen px-0 py-0 lg:px-6 lg:py-6 login-mobile-container", theme === "dark" ? "theme-dark" : "theme-light")}>
      <div className="mx-auto grid min-h-screen lg:min-h-[calc(100vh-2rem)] max-w-[1560px] overflow-hidden rounded-none lg:rounded-[2.5rem] border-0 lg:border border-white/60 bg-white/55 shadow-none lg:shadow-[0_35px_120px_rgba(15,23,42,0.18)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr] login-mobile-shell">
        {/* Item Izquierdo: Sistema y Branding */}
        <section className="hidden lg:flex lg:flex-col lg:justify-between premium-dark-panel relative overflow-hidden px-8 py-10 lg:px-14 lg:py-14 login-mobile-system-info">
          <div className="premium-orb premium-orb-gold" />
          <div className="premium-orb premium-orb-blue" />
          <div className="premium-grid absolute inset-0 opacity-40" />
          <div className="relative z-10 flex h-full flex-col justify-between gap-12">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">
                <span className="h-2 w-2 rounded-full bg-[#d2a25a]" />
                YouRef CRM
              </div>
              <h1 className="mt-8 max-w-2xl font-display text-4xl leading-[0.95] tracking-[-0.05em] text-white lg:text-6xl">
                El primer CRM de referidos inmobiliarios diseñado para maximizar cada oportunidad.
              </h1> 
              <p className="mt-6 max-w-xl text-base leading-7 text-white/72 lg:text-lg">
                Organiza, controla y monetiza cada referido desde una plataforma simple, diseñada para el mundo inmobiliario.
              </p>
            </div>

            {/* Módulos Destacados */}
            <div className="grid gap-4 md:grid-cols-3">
              {[["2FA", "Acceso protegido y verificación"], ["CRM", "Gestión Comercial"], ["LIVE", "Indicadores en tiempo real"]].map(([value, label]) => (
                <div key={label} className="rounded-[1.75rem] border border-white/12 bg-white/8 p-5 backdrop-blur-md">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55">Módulo</div>
                  <div className="mt-3 font-display text-4xl tracking-[-0.05em] text-white">{value}</div>
                  <div className="mt-2 text-sm leading-6 text-white/68">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Item Derecho: Autenticación */}
        <section className="flex items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(246,246,244,0.88))] px-6 py-8 lg:px-10 login-mobile-auth-section">
          <div className="w-full max-w-2xl rounded-none lg:rounded-[2rem] border-0 lg:border border-white/70 bg-transparent lg:bg-white/88 p-0 lg:p-8 shadow-none lg:shadow-[0_25px_90px_rgba(15,23,42,0.12)] backdrop-blur-none lg:backdrop-blur-xl login-mobile-form-card">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} className="theme-toggle-floating" />
            <div className="mx-auto max-w-lg">
              {/* Logo y Título */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-white p-2.5 shadow-[0_18px_34px_rgba(15,23,42,0.16)] overflow-hidden">
                    <img src="/LOGOYourRef.png" alt="YouRef Logo" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <div className="font-display text-4xl font-semibold tracking-[-0.05em] text-slate-950">YouRef</div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">CRM Inmobiliario</div>
                  </div>
                </div>
              </div>

              {/* Encabezado Dinámico */}
              <div className="mt-10">
                <div className="premium-eyebrow">Acceso</div>
                <h2 className="font-display text-4xl font-semibold tracking-[-0.04em] text-slate-950">
                  {mode === "login" ? "Iniciar sesión" : mode === "verify" ? (preVerifiedData ? "Completar perfil" : "Validar invitación") : "Continuar"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {mode === "login"
                    ? "Ingresa con tu correo y contraseña para acceder a tu panel de gestión."
                    : mode === "verify" && preVerifiedData
                      ? "Completa tus datos personales para activar tu cuenta definitiva."
                      : "Ingresa el código enviado a tu correo electrónico."}
                </p>
              </div>
            </div>

            {showTermsModal && (
              <TermsModal 
                theme={theme}
                onAccept={() => {
                  setTermsAccepted(true);
                  setShowTermsModal(false);
                }}
                onCancel={() => {
                  setMode("login");
                  setPreVerifiedData(null);
                  setShowTermsModal(false);
                }}
              />
            )}

            {notice || localError ? (
              <div className="mx-auto mt-6 max-w-lg rounded-[1.5rem] border border-[#e3d4ba] bg-[#f6eddc] px-4 py-3 text-sm text-[#5f4c29]">
                {notice || localError}
              </div>
            ) : null}

            <div className="mx-auto max-w-lg">
              {/* Formulario: Inicio de Sesión */}
              {mode === "login" && (
                <form className="mt-8 space-y-4" onSubmit={(event) => { event.preventDefault(); onLogin(loginForm); }}>
                  <Field label="Correo Electrónico" value={loginForm.email} onChange={(value) => setLoginForm((prev) => ({ ...prev, email: value }))} type="email" />
                  {/* Password / Contraseña */}
                  <Field label="Contraseña" value={loginForm.password} onChange={(value) => setLoginForm((prev) => ({ ...prev, password: value }))} type="password" />
                  <button className="premium-button w-full">{loading ? "Ingresando..." : "Ingresar"}</button>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button type="button" onClick={() => setMode("forgot")} className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-950">
                      ¿Olvidaste tu contraseña?
                    </button>
                    <button type="button" onClick={() => setMode("verify")} className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-950">
                      Tengo un código de invitación
                    </button>
                  </div>
                </form>
              )}

              {/* Formulario: Validación de Invitación (OTP) */}
              {mode === "verify" && !preVerifiedData && (
                <form className="mt-8 space-y-4" onSubmit={handlePreVerify}>
                  <Field label="Correo" type="email" value={verifyForm.email} onChange={(value) => setVerifyForm((prev) => ({ ...prev, email: value }))} />
                  <Field label="Código de activación" value={verifyForm.otpCode} onChange={(value) => setVerifyForm((prev) => ({ ...prev, otpCode: value }))} />
                  <button className="premium-button w-full">{internalLoading ? "Validando..." : "Comprobar código"}</button>
                  <button type="button" onClick={() => setMode("login")} className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-950 w-full text-center">
                    Volver al login
                  </button>
                </form>
              )}

              {/* Formulario: Registro Completo de Socio */}
              {mode === "verify" && preVerifiedData && (
                <form className="mt-8 grid gap-4 md:grid-cols-2" onSubmit={handleFinalVerify}>
                  <Field label="Nombre" value={preVerifiedData.firstName} disabled />
                  <Field label="Apellido" value={preVerifiedData.lastName} disabled />
                  <div className="md:col-span-2">
                    <Field label="Correo electrónico" value={preVerifiedData.email} disabled />
                  </div>
                  <Field 
                    label="RUT" 
                    value={preVerifiedData.rut} 
                    error={localRUTError}
                    onChange={(v) => {
                      const formatted = formatRUT(v);
                      updateRegister("rut", formatted);
                      if (formatted && !validateRUT(formatted)) {
                        setLocalRUTError("RUT inválido");
                      } else {
                        setLocalRUTError("");
                      }
                    }} 
                  />
                  <Field label="Fecha de nacimiento" type="date" value={preVerifiedData.dateOfBirth} onChange={(v) => updateRegister("dateOfBirth", v)} />
                  <Field 
                    label="Teléfono" 
                    value={preVerifiedData.phone} 
                    onChange={(v) => updateRegister("phone", formatPhone(v))} 
                  />
                  <div className="hidden"><Field label="Password" type="password" value={preVerifiedData.password} /></div> {/* Spacer or hidden helper */}
                  <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                    <Field label="Nueva contraseña" type="password" value={preVerifiedData.password} onChange={(v) => updateRegister("password", v)} />
                    <Field label="Confirmar contraseña" type="password" value={preVerifiedData.confirmPassword} onChange={(v) => updateRegister("confirmPassword", v)} />
                  </div>

                  <button className="premium-button md:col-span-2" disabled={loading}>
                    {loading ? "Activando cuenta..." : "Completar Registro"}
                  </button>
                  <button type="button" onClick={() => setPreVerifiedData(null)} className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-950 text-center">
                    Volver atrás
                  </button>
                </form>
              )}

              {/* Formulario: Recuperar Contraseña (Email) */}
              {mode === "forgot" && (
                <form className="mt-8 space-y-4" onSubmit={(event) => { event.preventDefault(); onForgot(forgotForm); setResetForm((prev) => ({ ...prev, email: forgotForm.email })); }}>
                  <Field label="Correo" type="email" value={forgotForm.email} onChange={(value) => setForgotForm({ email: value })} />
                  <button className="premium-button w-full">{loading ? "Enviando..." : "Enviar código de recuperación"}</button>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button type="button" onClick={() => setMode("reset")} className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-950">
                      Ya tengo código
                    </button>
                    <button type="button" onClick={() => setMode("login")} className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-950">
                      Volver al login
                    </button>
                  </div>
                </form>
              )}

              {/* Formulario: Cambio de Contraseña (Código) */}
              {mode === "reset" && (
                <form className="mt-8 space-y-4" onSubmit={(event) => { event.preventDefault(); onReset(resetForm); }}>
                  <Field label="Correo" type="email" value={resetForm.email} onChange={(value) => setResetForm((prev) => ({ ...prev, email: value }))} />
                  <Field label="Código" value={resetForm.code} onChange={(value) => setResetForm((prev) => ({ ...prev, code: value }))} />
                  <Field label="Nueva contraseña" type="password" value={resetForm.password} onChange={(value) => setResetForm((prev) => ({ ...prev, password: value }))} />
                  <Field label="Confirmar" type="password" value={resetForm.confirmPassword} onChange={(value) => setResetForm((prev) => ({ ...prev, confirmPassword: value }))} />
                  <button className="premium-button w-full">{loading ? "Actualizando..." : "Actualizar contraseña"}</button>
                  <button type="button" onClick={() => setMode("login")} className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-950 w-full text-center">
                    Volver al login
                  </button>
                </form>
              )}
            </div>
            
            {/* Footer / Powered by Lloyd Higgs */}
            <div className="mt-12 pt-8 border-t border-slate-100/60 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400 transition-opacity hover:opacity-80">
                Powered by <a href="https://portafoliolloydhiggs.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-950 transition-colors border-b border-slate-200 hover:border-slate-950 pb-0.5">Lloyd Higgs</a>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
