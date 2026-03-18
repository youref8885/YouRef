import { useEffect, useState } from "react";
import { apiRequest } from "../../api";
import { classNames, currency, profilePalette } from "../../utils";
import { ThemeToggle } from "./ThemeToggle";
import { Toast } from "../ui/Toast";
import { StatCard, AdminInsightCard } from "../dashboard/StatCard";
import { DashboardGroup, MiniBars } from "../dashboard/DashboardGroup";
import { SectionTitle, Field } from "../ui/Input";
import { DonutChart, StageTable, StatusGrid } from "../dashboard/DashboardCharts";
import { PipelineFunnel } from "../dashboard/PipelineFunnel";
import "./MobileApp.css";

const emptyReferral = {
  firstName: "",
  lastName: "",
  rut: "",
  phone: "",
  email: "",
  goals: [],
  region: "",
  commune: "",
  income: "",
  downPayment: "",
  description: ""
};

const stageLabels = {
  prospecto: "Prospecto",
  contacto: "Contacto",
  gestion: "Gestión",
  cierre: "Cierres"
};

const stageDefaults = {
  prospecto: ["Nuevo lead", "Intento de contacto", "Contacto fallido"],
  contacto: ["En proceso", "Propuesta enviada", "Reunión agendada"],
  gestion: ["Negociación", "Aprobación bancaria", "Reserva"],
  cierre: ["Promesa firmada", "Escritura", "Completado"]
};

function sumSeries(items = []) {
  return items.reduce((total, item) => total + Number(item.value || 0), 0);
}

function buildAdminSummary(dashboard) {
  const statusRows = [
    ...dashboard.prospect,
    ...dashboard.contact,
    ...dashboard.management,
    ...dashboard.closing
  ].map((item, index) => ({
    ...item,
    color: ["#c97957", "#d59773", "#e5c7a4", "#24486f", "#3b6e9f", "#6da4d8", "#87a08e", "#b1cab4", "#d8e4d9"][index % 9]
  }));
  const nonZeroStatusRows = statusRows.filter((item) => item.value > 0);
  const stageRows = [
    { label: "Prospectos", value: sumSeries(dashboard.prospect), color: "#d2a25a" },
    { label: "Contactos", value: sumSeries(dashboard.contact), color: "#c97957" },
    { label: "En gestion", value: sumSeries(dashboard.management), color: "#24486f" },
    { label: "Cierres", value: sumSeries(dashboard.closing), color: "#87a08e" }
  ];
  const total = dashboard.totalReferrals || 0;
  const closingTotal = stageRows[3].value;
  const managementTotal = stageRows[2].value;
  return {
    statusRows: nonZeroStatusRows.length > 0 ? nonZeroStatusRows : statusRows,
    stageRows,
    total,
    managementRate: total ? Math.round((managementTotal / total) * 100) : 0,
    closingRate: total ? Math.round((closingTotal / total) * 100) : 0,
    contactedRate: total ? Math.round((stageRows[1].value / total) * 100) : 0
  };
}

export function AuthenticatedApp({ auth, onLogout, onProfileSave, setAuthNotice, theme, onToggleTheme }) {
  const [tab, setTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [adminData, setAdminData] = useState({ dashboard: null, userOptions: [] });
  const [selectedUser, setSelectedUser] = useState("all");
  const [referrals, setReferrals] = useState([]);
  const [referralForm, setReferralForm] = useState(emptyReferral);
  const [profileForm, setProfileForm] = useState({
    title: auth.user.profile?.title || "",
    bio: auth.user.profile?.bio || "",
    focus: auth.user.profile?.focus || "",
    preferredCommune: auth.user.profile?.preferredCommune || "",
    themeColor: auth.user.profile?.themeColor || profilePalette[0]
  });
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [regiones, setRegiones] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  
  // Scroll to top when changing tabs
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  useEffect(() => {
    async function fetchRegiones() {
      try {
        const response = await fetch("http://localhost:4000/api/external/locations/regiones");
        const data = await response.json();
        const regionList = Array.isArray(data) ? data : [];
        setRegiones(regionList);

        // Set default region to Metropolitana (13) if it exists
        const metropolitana = regionList.find(r => r.codigo === "13");
        if (metropolitana && !referralForm.region && !editingId) {
          handleRegionChange("13");
        }
      } catch (error) {
        console.error("Error fetching regiones:", error);
        setRegiones([]);
      }
    }
    fetchRegiones();
  }, [editingId]); // Re-run when editingId changes to ensure default is set properly

  const handleRegionChange = async (regionCode) => {
    setReferralForm(prev => ({ ...prev, region: regionCode, commune: "" }));
    if (!regionCode) {
      setComunas([]);
      return;
    }
    setIsLoadingLocations(true);
    try {
      const response = await fetch(`http://localhost:4000/api/external/locations/regiones/${regionCode}/comunas`);
      const data = await response.json();
      setComunas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching comunas:", error);
      setComunas([]);
    } finally {
      setIsLoadingLocations(false);
    }
  };

  const mapReferral = (item) => ({
    ...item,
    firstName: item.firstName || item.first_name || "",
    lastName: item.lastName || item.last_name || "",
    downPayment: item.downPayment || item.down_payment || 0,
    income: item.income || item.income_level || 0, // Adding extra fallbacks
    description: item.description || item.notes || "",
    statusNote: item.statusNote || item.status_note || ""
  });

  const startEditing = (item) => {
    const mapped = mapReferral(item);
    setEditingId(mapped.id);
    setReferralForm({
      ...mapped,
      income: (mapped.income ?? 0).toString(),
      downPayment: (mapped.downPayment ?? 0).toString()
    });
    setTab("referrals");
    // If it has a region, fetch comunas
    if (mapped.region) {
      handleRegionChange(mapped.region);
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setReferralForm(emptyReferral);
  };

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 2800);
    return () => clearTimeout(timer);
  }, [message]);

  async function loadReferrals() {
    const data = await apiRequest("/referrals", { token: auth.token });
    setReferrals((data.referrals || []).map(mapReferral));
  }

  async function loadDashboard() {
    const data = await apiRequest("/dashboard/user", { token: auth.token });
    setDashboard(data.dashboard);
  }

  async function loadAdminDashboard(userId = selectedUser) {
    if (auth.user.role !== "admin") return;
    const data = await apiRequest(`/dashboard/admin?userId=${userId}`, { token: auth.token });
    setAdminData(data);
  }

  useEffect(() => {
    loadReferrals();
    loadDashboard();
    if (auth.user.role === "admin") {
      loadAdminDashboard(selectedUser);
    }

    const timer = setInterval(() => {
      loadReferrals();
      loadDashboard();
      if (auth.user.role === "admin") {
        loadAdminDashboard(selectedUser);
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [selectedUser]);

  async function submitReferral(event) {
    event.preventDefault();
    try {
      if (editingId) {
        const data = await apiRequest(`/referrals/${editingId}`, { method: "PUT", token: auth.token, body: referralForm });
        setReferrals((prev) => prev.map(item => item.id === editingId ? data.referral : item));
        setMessage("Referido actualizado correctamente.");
        setEditingId(null);
      } else {
        const data = await apiRequest("/referrals", { method: "POST", token: auth.token, body: referralForm });
        setReferrals((prev) => [data.referral, ...prev]);
        setMessage("Referido creado correctamente.");
      }
      setReferralForm(emptyReferral);
      loadDashboard();
      loadAdminDashboard(selectedUser);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateStatus(id, stage, status, statusNote = "") {
    try {
      const data = await apiRequest(`/referrals/${id}/status`, { method: "PATCH", token: auth.token, body: { stage, status, statusNote } });
      setReferrals((prev) => prev.map((item) => (item.id === id ? mapReferral(data.referral) : item)));
      loadDashboard();
      loadAdminDashboard(selectedUser);
      setMessage("Estado actualizado con éxito.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteReferral(id) {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este referido?")) return;
    try {
      await apiRequest(`/referrals/${id}`, { method: "DELETE", token: auth.token });
      setReferrals((prev) => prev.filter((item) => item.id !== id));
      setMessage("Referido eliminado correctamente.");
      loadDashboard();
      loadAdminDashboard(selectedUser);
    } catch (error) {
      setMessage(error.message);
    }
  }

  const [inviteForm, setInviteForm] = useState({ firstName: "", lastName: "", email: "" });
  const [isInviting, setIsInviting] = useState(false);

  async function handleInvite(e) {
    e.preventDefault();
    setIsInviting(true);
    try {
      const data = await apiRequest("/admin/users/invite", {
        method: "POST",
        token: auth.token,
        body: inviteForm
      });
      setMessage(data.message || "Invitación enviada con éxito.");
      setInviteForm({ firstName: "", lastName: "", email: "" });
      loadAdminDashboard(selectedUser);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsInviting(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    try {
      await onProfileSave(profileForm);
      setMessage("Perfil actualizado correctamente.");
    } catch (error) {
      setAuthNotice(error.message);
    }
  }

  const navItems = [
    ["dashboard", "Dashboard"],
    ["referrals", "Referidos"],
    ["tracking", "Seguimiento Activo"],
    ...(auth.user.role === "admin" ? [["admin", "Equipo"], ["management", "Gestión"]] : []),
    ["profile", "Perfil"]
  ];

  return (
    <div className={classNames("theme-shell min-h-screen", theme === "dark" ? "theme-dark" : "theme-light")}>
      {/* Mobile Top Bar */}
      <header className="mobile-top-bar lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0f172a_0%,#223d61_100%)] text-sm font-black text-white">YR</div>
          <span className="font-display text-xl font-bold text-slate-950">YouRef</span>
        </div>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 p-4 md:p-6 lg:grid-cols-[280px_1fr] lg:pt-6 mobile-app-container">
        {/* Sidebar - Desktop Only */}
        <aside className="premium-dark-panel h-fit lg:sticky lg:top-6 p-6 lg:p-8 flex flex-col overflow-hidden transition-all duration-300 mobile-hide-sidebar">
          <div className="premium-orb premium-orb-gold !top-[-110px] !right-[-50px] !h-[220px] !w-[220px]" />
          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/7 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-white/75">
                <span className="h-2 w-2 rounded-full bg-[#d2a25a]" />
                YouRef
              </div>
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            </div>

            <div className="mt-8 rounded-[1.6rem] border border-white/10 bg-white/6 p-5 backdrop-blur-md advisor-card">
              <div className="text-[10px] font-bold uppercase tracking-[0.26em] text-white/40 truncate">
                {auth.user.role === "admin" ? "Administrador" : "Advisor"}
              </div>
              <div className="mt-2 font-display text-[1.8rem] leading-tight tracking-[-0.04em] text-white break-words">
                {auth.user.firstName} {auth.user.lastName}
              </div>
            </div>

            <nav className="mt-10 flex-1 space-y-2">
              {navItems.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={classNames(
                    "w-full rounded-[1.25rem] px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.2em] transition-all duration-300",
                    tab === id ? "bg-white text-slate-950 shadow-[0_12px_24px_rgba(0,0,0,0.2)]" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {label}
                </button>
              ))}
            </nav>

            <button type="button" onClick={onLogout} className="mt-8 w-full rounded-[1.25rem] border border-white/10 bg-white/5 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-white/50 transition hover:bg-white/10 hover:text-red-300">
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="min-h-0">
          {tab === "management" && auth.user.role === "admin" && (
            <div className="space-y-6 pb-10">
              <div className="premium-surface px-8 py-8">
                <SectionTitle eyebrow="Administración" title="Gestión de Referidos" description="Control total sobre todos los leads del sistema." />
                <div className="mt-8 space-y-4">
                  {referrals.map((item) => (
                    <article key={item.id} className="referral-entry rounded-[1.8rem] border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="font-display text-2xl font-bold tracking-tight text-slate-950">{item.firstName} {item.lastName}</h3>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-slate-900 text-white px-3 py-1 text-[9px] font-black uppercase tracking-widest">Socio: {item.ownerName}</span>
                              <span className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 text-[9px] font-black uppercase tracking-widest">{stageLabels[item.stage] || item.stage}</span>
                            </div>
                          </div>
                          <p className="mt-2 text-sm font-medium text-slate-500">{item.email} · {item.phone}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-emerald/5 px-2.5 py-1 text-[9px] font-bold uppercase text-emerald border border-emerald/10">Renta {currency(item.income)}</span>
                            <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[9px] font-bold uppercase text-slate-600 border border-slate-100">{item.commune}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => startEditing(item)} className="rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all border border-slate-100">Editar</button>
                          <button onClick={() => deleteReferral(item.id)} className="rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-red-50 text-red-600 hover:bg-red-100 transition-all border border-red-100">Eliminar</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}
          {message && <Toast message={message} />}

          {tab === "dashboard" && dashboard && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-6">
              {/* Header / Hero - Tightened */}
              <div className="md:col-span-12 premium-surface px-6 py-5 lg:px-8 lg:py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden relative">
                <div className="premium-orb premium-orb-gold !-top-10 !-right-10" />
                <div className="relative z-10">
                  <div className="premium-eyebrow">Perspectiva Comercial</div>
                  <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-slate-950">Tu pipeline en tiempo real</h1>
                  <p className="mt-2 max-w-xl text-sm text-slate-600">Gestión ejecutiva de referidos y desempeño de equipo.</p>
                </div>
                <div className="relative z-10 flex gap-4">
                  <div className="px-5 py-3 rounded-2xl bg-[#0d2a4a] text-white shadow-xl">
                    <div className="text-[10px] uppercase tracking-widest opacity-60 font-bold">Total Leads</div>
                    <div className="text-2xl font-display font-bold">{dashboard.totalReferrals}</div>
                  </div>
                </div>
              </div>

              {/* Bento - Funnel (Main Visual) */}
              <div className="md:col-span-8 md:row-span-2 h-full">
                <PipelineFunnel data={dashboard} />
              </div>

              {/* Bento - Quick Stats */}
              <div className="md:col-span-4">
                <StatCard label="Usuarios Activos" value={dashboard.activeUsers} accent="from-[#d4af37] to-[#f4cf6d]" />
              </div>

              <div className="md:col-span-4">
                <StatCard label="Renta Promedio" value={currency(dashboard.averageTicket)} accent="from-[#0d5d56] to-[#2a8b81]" />
              </div>

              {/* Bento - Analytics (MiniBars) */}
              <div className="md:col-span-6 h-full">
                <MiniBars title="Objetivos" data={dashboard.goals} accent="linear-gradient(90deg,#0d2a4a 0%,#1e4d7d 100%)" tone="#e1e7f0" />
              </div>

              <div className="md:col-span-6 h-full">
                <MiniBars title="Zonas Críticas" data={dashboard.topCommunes} accent="linear-gradient(90deg,#ae684f 0%,#d1987f 100%)" tone="#f4e7e1" />
              </div>

              {/* Small details footer or additional bento bits */}
              <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="premium-card p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Prospecto</div>
                    <div className="text-xl font-display font-bold text-slate-900">{sumSeries(dashboard.prospect)}</div>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-[#d4af37]" />
                </div>
                <div className="premium-card p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Contacto</div>
                    <div className="text-xl font-display font-bold text-slate-900">{sumSeries(dashboard.contact)}</div>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-[#b66549]" />
                </div>
                <div className="premium-card p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Gestión</div>
                    <div className="text-xl font-display font-bold text-slate-900">{sumSeries(dashboard.management)}</div>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-[#183153]" />
                </div>
                <div className="premium-card p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Cierre</div>
                    <div className="text-xl font-display font-bold text-slate-900">{sumSeries(dashboard.closing)}</div>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-[#0d5d56]" />
                </div>
              </div>
            </div>
          )}

          {tab === "referrals" && (
            <section className="max-w-2xl mx-auto">
              <form onSubmit={submitReferral} className="premium-surface px-6 py-8">
                <div className="flex items-center justify-between mb-2">
                  <SectionTitle eyebrow={editingId ? "Actualización" : "Registro"} title={editingId ? "Editar Lead" : "Nuevo Lead"} />
                  {editingId && (
                    <button type="button" onClick={cancelEditing} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
                  )}
                </div>
                <div className="mt-8 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nombre" value={referralForm.firstName} onChange={(value) => setReferralForm((prev) => ({ ...prev, firstName: value }))} />
                    <Field label="Apellido" value={referralForm.lastName} onChange={(value) => setReferralForm((prev) => ({ ...prev, lastName: value }))} />
                  </div>
                  <Field label="RUT" value={referralForm.rut} onChange={(value) => setReferralForm((prev) => ({ ...prev, rut: value }))} />
                  <Field label="Teléfono" value={referralForm.phone} onChange={(value) => setReferralForm((prev) => ({ ...prev, phone: value }))} />
                  <Field label="Email" type="email" value={referralForm.email} onChange={(value) => setReferralForm((prev) => ({ ...prev, email: value }))} />
                  <div>
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Objetivo de compra</span>
                    <div className="flex flex-wrap gap-2">
                      {["Vivir", "Invertir"].map((goal) => {
                        const active = referralForm.goals.includes(goal);
                        return (
                          <button key={goal} type="button" onClick={() => setReferralForm((prev) => ({ ...prev, goals: active ? prev.goals.filter((item) => item !== goal) : [...prev.goals, goal] }))} className={classNames("rounded-full px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all", active ? "bg-slate-950 text-white shadow-xl" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                            {goal}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Región</span>
                      <select value={referralForm.region} onChange={(e) => handleRegionChange(e.target.value)} className="premium-input w-full text-xs">
                        <option value="">Seleccione...</option>
                        {(Array.isArray(regiones) ? regiones : []).map(reg => <option key={reg.codigo} value={reg.codigo}>{reg.nombre}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Comuna</span>
                      <select value={referralForm.commune} onChange={(e) => setReferralForm(prev => ({ ...prev, commune: e.target.value }))} className="premium-input w-full text-xs" disabled={!referralForm.region || isLoadingLocations}>
                        <option value="">{isLoadingLocations ? "Cargando..." : "Seleccione..."}</option>
                        {comunas.map(com => <option key={com.codigo} value={com.nombre}>{com.nombre}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Renta (CLP)" value={referralForm.income} onChange={(value) => setReferralForm((prev) => ({ ...prev, income: value }))} />
                    <Field label="Pie (CLP)" value={referralForm.downPayment} onChange={(value) => setReferralForm((prev) => ({ ...prev, downPayment: value }))} />
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Notas Adicionales</span>
                    <textarea rows="4" value={referralForm.description} onChange={(event) => setReferralForm((prev) => ({ ...prev, description: event.target.value }))} className="premium-input resize-none" placeholder="Contexto sobre el lead..." />
                  </label>
                  <button className="premium-button w-full mt-4">{editingId ? "Actualizar Referido" : "Registrar Referido"}</button>
                </div>
              </form>
            </section>
          )}

          {tab === "tracking" && (
            <div className="premium-surface px-6 py-8">
              <SectionTitle eyebrow="Gestión" title="Seguimiento Activo" description="Control granular de estados comerciales." />
              <div className="mt-8 space-y-4">
                {referrals.map((item) => (
                  <article key={item.id} className="referral-entry rounded-[1.8rem] border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="font-display text-2xl font-bold tracking-tight text-slate-950">{item.firstName} {item.lastName}</h3>
                          <span className="rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-[9px] font-black uppercase tracking-widest border border-indigo-100">{stageLabels[item.stage]}</span>
                          <span className="rounded-full bg-slate-900 text-white px-3 py-1 text-[9px] font-black uppercase tracking-widest">{item.status}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-500">{item.email} · {item.phone}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(item.goals || []).map((goal) => <span key={goal} className="rounded-full bg-primary/5 px-2.5 py-1 text-[9px] font-bold uppercase text-primary border border-primary/10">{goal}</span>)}
                          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[9px] font-bold uppercase text-slate-600 border border-slate-100">{item.commune}</span>
                        </div>

                        {item.description && (
                          <p className="mt-4 text-sm leading-relaxed text-slate-600 italic">"{item.description}"</p>
                        )}

                        {item.statusNote && (
                          <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-100 border-l-4 border-l-indigo-500">
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Nota de Seguimiento (Admin)</div>
                            <p className="text-sm text-slate-700 font-medium italic">"{item.statusNote}"</p>
                          </div>
                        )}

                        {auth.user.role === "admin" && (
                          <button
                            type="button"
                            onClick={() => startEditing(item)}
                            className="mt-6 text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-2"
                          >
                            <span className="h-4 w-4 rounded-full bg-indigo-50 flex items-center justify-center">✎</span>
                            Editar Información
                          </button>
                        )}
                      </div>

                      {auth.user.role === "admin" && (
                        <div className="flex flex-col gap-3 min-w-[240px] xl:mt-0 mt-6 pt-6 border-t xl:border-t-0 xl:pt-0 border-slate-100">
                          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Control Administrativo</div>
                          <select value={item.stage} title="Cambiar Etapa" onChange={(e) => updateStatus(item.id, e.target.value, (stageDefaults[e.target.value] || [])[0], item.statusNote)} className="premium-input text-xs font-bold uppercase tracking-wider">
                            {Object.entries(stageLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          <select value={item.status} title="Cambiar Estado" onChange={(e) => updateStatus(item.id, item.stage, e.target.value, item.statusNote)} className="premium-input text-xs">
                            {(stageDefaults[item.stage] || []).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <textarea
                            placeholder="Agregar nota de estado..."
                            className="premium-input text-xs h-20 resize-none"
                            defaultValue={item.statusNote || ""}
                            onBlur={(e) => updateStatus(item.id, item.stage, item.status, e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </article>
                ))}
                {referrals.length === 0 && <div className="rounded-[2rem] border-2 border-dashed border-slate-100 p-12 text-center text-slate-400 font-medium">No hay referidos registrados bajo este criterio.</div>}
              </div>
            </div>
          )}

          {tab === "profile" && (
            <section className="grid gap-6 xl:grid-cols-[1fr_400px]">
              <form className="premium-surface px-6 py-8" onSubmit={saveProfile}>
                <SectionTitle eyebrow="Identidad" title="Tu Perfil Profesional" description="Personaliza cómo te ven tus prospectos y colegas." />
                <div className="mt-8 grid gap-6 md:grid-cols-2">
                  <Field
                    label="Cargo / Título"
                    value={auth.user.role === "admin" ? profileForm.title : "Advisor"}
                    onChange={(value) => auth.user.role === "admin" && setProfileForm((prev) => ({ ...prev, title: value }))}
                    disabled={auth.user.role !== "admin"}
                  />
                  <Field label="Zona de Foco" value={profileForm.preferredCommune} onChange={(value) => setProfileForm((prev) => ({ ...prev, preferredCommune: value }))} />
                  <Field label="Especialidad" value={profileForm.focus} onChange={(value) => setProfileForm((prev) => ({ ...prev, focus: value }))} />
                  <div>
                    <span className="mb-3 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Tema de Marca</span>
                    <div className="flex flex-wrap gap-3">
                      {profilePalette.map((color) => (
                        <button key={color} type="button" onClick={() => setProfileForm((prev) => ({ ...prev, themeColor: color }))} className={classNames("h-10 w-10 rounded-full ring-offset-2 ring-2 transition-all", profileForm.themeColor === color ? "ring-slate-400 scale-110" : "ring-transparent hover:scale-105")} style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  </div>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Biografía Ejecutiva</span>
                    <textarea rows="6" value={profileForm.bio} onChange={(event) => setProfileForm((prev) => ({ ...prev, bio: event.target.value }))} className="premium-input resize-none" placeholder="Describe tu experiencia..." />
                  </label>
                </div>
                <button className="premium-button mt-8 px-12">Guardar Perfil</button>
              </form>

              <div className="premium-dark-panel overflow-hidden p-10 flex flex-col justify-between min-h-[500px]" style={{ background: `linear-gradient(165deg, ${profileForm.themeColor} 0%, #020617 100%)` }}>
                <div className="premium-grid absolute inset-0 opacity-10" />
                <div className="relative z-10">
                  <div className="premium-eyebrow !text-white/40">Business Card Preview</div>
                  <div className="mt-6 font-display text-5xl tracking-tight text-white">{auth.user.firstName} <br /> {auth.user.lastName}</div>
                  <div className="mt-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-md">
                    {auth.user.role === "admin" ? (profileForm.title || "Administrador") : "Advisor"}
                  </div>
                  <p className="mt-8 text-lg leading-relaxed text-white/70 italic font-light">"{profileForm.bio || "Tu propuesta de valor aparecerá aquí."}"</p>
                </div>
                <div className="relative z-10 grid gap-3">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">Foco Comercial</div>
                    <div className="mt-1 text-sm font-semibold text-white">{profileForm.focus || "Multipropósito"}</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">Ubicación Preferente</div>
                    <div className="mt-1 text-sm font-semibold text-white">{profileForm.preferredCommune || "Nacional"}</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {tab === "admin" && auth.user.role === "admin" && (
            <div className="space-y-6 pb-10">
              {/* Admin Header */}
              <div className="premium-surface px-8 py-8 flex flex-col xl:flex-row xl:items-center justify-between gap-8 overflow-hidden relative">
                <div className="premium-orb premium-orb-blue !-top-20 !-left-20" />
                <div className="relative z-10 flex-1">
                  <SectionTitle eyebrow="Administración" title="Control de Mando" description="Vista corporativa y equipo." />
                </div>
                <div className="relative z-10 grid gap-4 sm:grid-cols-2 lg:min-w-[480px]">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Filtrar por Socio</span>
                    <select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)} className="premium-input !py-2.5 font-bold uppercase tracking-wider text-[10px]">
                      <option value="all">Socio: Todos</option>
                      {adminData.userOptions.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                  </label>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 flex flex-col justify-center">
                    <div className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Foco Actual</div>
                    <div className="font-display text-lg font-bold text-slate-900 truncate">
                      {selectedUser === "all" ? "Corporativo" : adminData.userOptions.find((user) => user.id === selectedUser)?.name}
                    </div>
                  </div>
                </div>
              </div>

              {/* Invitation Form for Admins */}
              <div className="premium-surface px-8 py-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="max-w-md">
                    <SectionTitle title="Invitar Nuevo Socio" description="Envía una invitación por correo para que un nuevo socio se una al equipo." />
                  </div>
                  <form onSubmit={handleInvite} className="flex-1 grid gap-4 sm:grid-cols-3 items-end">
                    <Field label="Nombre" value={inviteForm.firstName} onChange={(v) => setInviteForm(p => ({ ...p, firstName: v }))} />
                    <Field label="Apellido" value={inviteForm.lastName} onChange={(v) => setInviteForm(p => ({ ...p, lastName: v }))} />
                    <Field label="Email" type="email" value={inviteForm.email} onChange={(v) => setInviteForm(p => ({ ...p, email: v }))} />
                    <div className="sm:col-span-3 mt-2">
                      <button className="premium-button w-full lg:w-auto px-10" disabled={isInviting}>
                        {isInviting ? "Enviando..." : "Enviar Invitación"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {adminData.dashboard && (() => {
                const summary = buildAdminSummary(adminData.dashboard);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Top Insights Row */}
                    <div className="md:col-span-3">
                      <AdminInsightCard label="Capacidad" value={summary.total} hint="Leads totales" accent="#d4af37" />
                    </div>
                    <div className="md:col-span-3">
                      <AdminInsightCard label="Activos" value={adminData.dashboard.activeUsers} hint="Socios hoy" accent="#0d5d56" />
                    </div>
                    <div className="md:col-span-3">
                      <AdminInsightCard label="Selección" value={`${summary.managementRate}%`} hint="Conv. a Gestión" accent="#c97957" />
                    </div>
                    <div className="md:col-span-3">
                      <AdminInsightCard label="Éxito" value={`${summary.closingRate}%`} hint="Conv. a Cierre" accent="#183153" />
                    </div>

                    {/* Funnel & Distribution (Major Visuals) */}
                    <div className="md:col-span-8 md:row-span-2">
                      <PipelineFunnel data={adminData.dashboard} />
                    </div>

                    <div className="md:col-span-4 h-full">
                      <StageTable rows={summary.stageRows} />
                    </div>

                    {/* Geographical & Goals (Analytics) */}
                    <div className="md:col-span-6">
                      <MiniBars title="Deseo de Compra" data={adminData.dashboard.goals} accent="linear-gradient(90deg,#d4af37 0%,#a98b2c 100%)" tone="#f9f2e1" />
                    </div>
                    <div className="md:col-span-6">
                      <MiniBars title="Zonas Críticas" data={adminData.dashboard.topCommunes} accent="linear-gradient(90deg,#0f5f58 0%,#2a8b81 100%)" tone="#e1f2f0" />
                    </div>

                    {/* Distribution detailed - Full width bottom */}
                    <div className="md:col-span-12">
                      <StatusGrid rows={summary.statusRows} />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav lg:hidden">
        {navItems.map(([id, label]) => {
          const navIcons = {
            dashboard: "🏠",
            referrals: "📝",
            tracking: "📋",
            admin: "👥",
            management: "⚙️",
            profile: "👤"
          };
          // Shorten labels for mobile if they are too long
          const displayLabel = label.length > 8 ? label.substring(0, 7) + "." : label;

          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={classNames("mobile-nav-item", tab === id && "active")}
            >
              <span className="mobile-nav-icon">{navIcons[id] || "❓"}</span>
              <span className="truncate w-full">{displayLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
