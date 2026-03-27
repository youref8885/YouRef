import "./loadEnv.js";
import cors from "cors";
import express from "express";
import { adminRequired, authRequired, createSession, withoutSensitiveUser } from "./auth.js";
import { BUYER_GOALS, REFERRAL_STATUSES, REFERRAL_STAGES, USER_ROLES } from "./constants.js";
import { readDb, getUserById, getUserByEmail, createReferral, updateReferral } from "./dataStore.js";
import { buildDashboard } from "./dashboardService.js";
import { sendMail } from "./emailService.js";
import {
  calculateAge,
  createId,
  createOtpCode,
  formatDate,
  hashPassword,
  normalizePhone,
  sanitizeRut,
  validateRut
} from "./utils.js";
import https from "https";
import adminRoutes from "./adminRoutes.js";
import { supabase } from "./supabaseClient.js";
import { logAction } from "./auditService.js";

// Validaciones básicas de conexión
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan variables de entorno para Supabase (SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY).");
  console.log("CWD:", process.cwd());
  process.exit(1);
}

// Bypass SSL issues for the government API if necessary
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const app = express();
const PORT = process.env.PORT || 4000;
const defaultClientUrls = ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"];
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((entry) => entry.trim())
  : defaultClientUrls;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
        callback(null, true);
        return;
      }

      console.warn(`CORS blocked for origin: ${origin}`);
      callback(null, false);
    },
    credentials: true
  })
);
app.use(express.json());

// Nuevas rutas de administración
app.use("/api/admin", adminRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/**
 * Registro Público (AHORA DESHABILITADO EN FAVOR DE INVITACIONES ADMIN)
 */
app.post("/api/auth/register", async (req, res) => {
  res.status(403).json({ message: "El registro público está deshabilitado. Solicita una invitación a un administrador." });
});

/**
 * Verificación de 2FA / Registro de Invitados
 * Ahora maneja la actualización de datos completos para usuarios invitados.
 */
app.post("/api/auth/verify-2fa", async (req, res) => {
  const { email, otpCode, firstName, lastName, rut, dateOfBirth, phone, password } = req.body;

  const normalizedEmail = email?.trim().toLowerCase();

  // Buscar usuario por email y código
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", normalizedEmail)
    .eq("otp_code", otpCode)
    .single();

  if (!user || error) {
    res.status(404).json({ message: "Código de verificación incorrecto o expirado." });
    return;
  }

  if (new Date(user.otp_expires_at).getTime() < Date.now()) {
    res.status(400).json({ message: "El código ha expirado." });
    return;
  }

  // Si vienen datos adicionales (es el registro real post-invitación)
  const updates = {
    is_verified: true,
    otp_code: null,
    otp_expires_at: null,
    updated_at: new Date().toISOString()
  };

  if (password) {
    updates.first_name = firstName || user.first_name;
    updates.last_name = lastName || user.last_name;
    updates.rut = sanitizeRut(rut);
    updates.date_of_birth = dateOfBirth;
    updates.phone = normalizePhone(phone);
    updates.password_hash = hashPassword(password);
  }

  const { data: verifiedUser, error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (updateError) {
    return res.status(500).json({ message: "Error al activar el usuario." });
  }

  // Trazabilidad
  await logAction({
    entityType: "user",
    entityId: verifiedUser.id,
    action: "verify",
    performedByUserId: verifiedUser.id,
    newData: { is_verified: true }
  });

  const token = await createSession(verifiedUser.id);
  res.json({ token, user: withoutSensitiveUser(verifiedUser) });
});

/**
 * Pre-verificación (Valida OTP y retorna datos de invitación)
 */
app.post("/api/auth/pre-verify", async (req, res) => {
  const { email, otpCode } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();

  const { data: user, error } = await supabase
    .from("users")
    .select("first_name, last_name, email, otp_expires_at")
    .eq("email", normalizedEmail)
    .eq("otp_code", otpCode)
    .single();

  if (!user || error) {
    res.status(404).json({ message: "Código de activación incorrecto o correo no válido." });
    return;
  }

  if (new Date(user.otp_expires_at).getTime() < Date.now()) {
    res.status(400).json({ message: "El código de activación ha expirado." });
    return;
  }

  res.json({
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  const passwordHash = hashPassword(password || "");

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", normalizedEmail)
    .eq("password_hash", passwordHash)
    .single();

  if (!user || error) {
    res.status(401).json({ message: "Correo o contraseña incorrectos." });
    return;
  }

  if (!user.is_verified) {
    return res.status(403).json({ message: "Tu cuenta aún no ha sido verificada." });
  }

  // Trazabilidad de Login
  await logAction({
    entityType: "auth",
    entityId: user.id,
    action: "login",
    performedByUserId: user.id,
    metadata: { userAgent: req.headers["user-agent"] }
  });

  const token = await createSession(user.id);
  res.json({ token, user: withoutSensitiveUser(user) });
});

/**
 * Perfil de Usuario
 */
app.get("/api/users/profile", authRequired(), async (req, res) => {
  // El middleware authRequired ya carga al usuario en req.user
  res.json({ user: withoutSensitiveUser(req.user) });
});

app.patch("/api/users/profile", authRequired(), async (req, res) => {
  const profile = req.body; // Se asume que el body es el objeto profile completo o parcial

  const { data: updatedUser, error } = await supabase
    .from("users")
    .update({
      profile,
      updated_at: new Date().toISOString()
    })
    .eq("id", req.user.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ message: "Error al actualizar el perfil." });
  }

  // Trazabilidad
  await logAction({
    entityType: "user",
    entityId: req.user.id,
    action: "update_profile",
    performedByUserId: req.user.id,
    newData: { profile }
  });

  res.json({ user: withoutSensitiveUser(updatedUser) });
});

// El resto de las rutas de auth (forgot-password, reset-password) 
// se deberían migrar similarmente usando supabase.from("password_resets") etc.
// Por brevedad y foco en lo solicitado, saltamos a Referidos.

app.get("/api/referrals", authRequired(), async (req, res) => {
  const query = supabase.from("referrals").select("*").order("created_at", { ascending: false });

  if (req.user.role !== USER_ROLES.ADMIN) {
    query.eq("owner_user_id", req.user.id);
  }

  const { data: referrals, error } = await query;

  if (error) return res.status(500).json({ message: "Error al cargar referidos." });

  res.json({ referrals: referrals || [] });
});

app.post("/api/referrals", authRequired(), async (req, res) => {
  const { firstName, lastName, rut, phone, email, goals, commune, income, downPayment, description } = req.body;

  if (!firstName || !lastName || !rut || !phone || !email || !Array.isArray(goals) || goals.length === 0 || !commune) {
    res.status(400).json({ message: "Completa los campos requeridos del referido." });
    return;
  }

  const sanitizedRut = sanitizeRut(rut);

  // Verificación de RUT duplicado
  const { data: existingReferral, error: checkError } = await supabase
    .from("referrals")
    .select("id")
    .eq("rut", sanitizedRut)
    .maybeSingle();

  if (checkError) {
    console.error("Error al verificar RUT:", checkError);
    return res.status(500).json({ message: "Error al verificar duplicidad de RUT." });
  }

  if (existingReferral) {
    return res.status(400).json({ message: "RUT ya ingresado" });
  }

  const referral = {
    id: createId("ref_"),
    owner_user_id: req.user.id,
    owner_name: `${req.user.firstName} ${req.user.lastName}`,
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    rut: sanitizeRut(rut),
    phone: normalizePhone(phone),
    email: email.trim().toLowerCase(),
    goals,
    commune: commune.trim(),
    income: Number(income || 0),
    down_payment: Number(downPayment || 0),
    description: description?.trim() || "",
    stage: REFERRAL_STAGES.CONTACT,
    status: REFERRAL_STATUSES.contacto[0],
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from("referrals").insert([referral]).select().single();

  if (error) return res.status(500).json({ message: "Error al crear referido." });

  // Trazabilidad
  await logAction({
    entityType: "referral",
    entityId: data.id,
    action: "create",
    performedByUserId: req.user.id,
    newData: referral
  });

  res.status(201).json({ referral: data });
});

app.get("/api/referrals/check-rut/:rut", authRequired(), async (req, res) => {
  const sanitizedRut = sanitizeRut(req.params.rut);
  const { data, error } = await supabase
    .from("referrals")
    .select("id, first_name, last_name")
    .eq("rut", sanitizedRut)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ message: "Error al verificar RUT." });
  }

  res.json({ exists: !!data, referral: data });
});

app.get("/api/admin/reports/partners", authRequired(), adminRequired(), async (req, res) => {
  try {
    const { data: users, error: usersError } = await supabase.from("users").select("id, first_name, last_name, role").eq("role", "advisor");
    const { data: referrals, error: referralsError } = await supabase.from("referrals").select("*");

    if (usersError || referralsError) throw new Error("Error fetching data for report.");

    const report = users.map(user => {
      const userReferrals = referrals.filter(r => r.owner_user_id === user.id);
      
      // Regions/Communes
      const communes = userReferrals.reduce((acc, r) => {
        const c = r.commune || "N/A";
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {});
      const topCommunes = Object.entries(communes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]).join(", ");

      // Monthly breakdown
      const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const monthlyData = userReferrals.reduce((acc, r) => {
        const d = new Date(r.created_at);
        const m = months[d.getMonth()];
        acc[m] = (acc[m] || 0) + 1;
        return acc;
      }, {});

      return {
        Socio: `${user.first_name} ${user.last_name}`,
        Total_Referidos: userReferrals.length,
        Zonas_Criticas: topCommunes || "N/A",
        Renta_Promedio: userReferrals.length ? Math.round(userReferrals.reduce((sum, r) => sum + Number(r.income || 0), 0) / userReferrals.length) : 0,
        Pie_Promedio: userReferrals.length ? Math.round(userReferrals.reduce((sum, r) => sum + Number(r.down_payment || 0), 0) / userReferrals.length) : 0,
        ...monthlyData
      };
    });

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch("/api/referrals/:id/status", authRequired(), async (req, res) => {
  const { stage, status, statusNote } = req.body;

  const { data: referral, error: fetchError } = await supabase
    .from("referrals")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (!referral || fetchError) {
    res.status(404).json({ message: "Referido no encontrado." });
    return;
  }

  if (req.user.role !== USER_ROLES.ADMIN && referral.owner_user_id !== req.user.id) {
    res.status(403).json({ message: "No puedes editar este referido." });
    return;
  }

  const oldData = { stage: referral.stage, status: referral.status, status_note: referral.status_note };

  const { data: updatedReferral, error: updateError } = await supabase
    .from("referrals")
    .update({
      stage,
      status,
      status_note: statusNote,
      updated_at: new Date().toISOString(),
      updated_by_userid: req.user.id
    })
    .eq("id", req.params.id)
    .select()
    .single();

  if (updateError) return res.status(500).json({ message: "Error al actualizar estado." });

  // Trazabilidad de cambio de estado
  await logAction({
    entityType: "referral",
    entityId: referral.id,
    action: "status_change",
    performedByUserId: req.user.id,
    oldData: oldData,
    newData: { stage, status, status_note: statusNote }
  });

  res.json({ referral: updatedReferral });
});

app.delete("/api/referrals/:id", authRequired(), adminRequired(), async (req, res) => {
  const { data: referral } = await supabase.from("referrals").select("*").eq("id", req.params.id).single();

  const { error } = await supabase.from("referrals").delete().eq("id", req.params.id);

  if (error) return res.status(500).json({ message: "Error al eliminar referido." });

  // Trazabilidad
  await logAction({
    entityType: "referral",
    entityId: req.params.id,
    action: "delete",
    performedByUserId: req.user.id,
    oldData: referral
  });

  res.json({ message: "Referido eliminado correctamente." });
});

app.get("/api/dashboard/user", authRequired(), async (req, res) => {
  const { data: referrals } = await supabase.from("referrals").select("*");
  const { data: users } = await supabase.from("users").select("*");
  const dashboard = buildDashboard(referrals || [], users || [], req.user.id);
  res.json({ dashboard });
});

app.get("/api/dashboard/admin", authRequired(), adminRequired(), async (req, res) => {
  const { data: referrals } = await supabase.from("referrals").select("*");
  const { data: users } = await supabase.from("users").select("*");

  const selectedUserId = req.query.userId || "all";
  const dashboard = buildDashboard(referrals || [], users || [], selectedUserId);
  const userOptions = (users || []).map((entry) => ({
    id: entry.id,
    name: `${entry.first_name} ${entry.last_name}`
  }));

  res.json({ dashboard, userOptions });
});

// Proxy para ubicaciones de Chile con Fallback (Se mantiene igual)
const FALLBACK_REGIONES = [
  { codigo: "15", nombre: "Arica y Parinacota" },
  { codigo: "01", nombre: "Tarapacá" },
  { codigo: "02", nombre: "Antofagasta" },
  { codigo: "03", nombre: "Atacama" },
  { codigo: "04", nombre: "Coquimbo" },
  { codigo: "05", nombre: "Valparaíso" },
  { codigo: "13", nombre: "Metropolitana de Santiago" },
  { codigo: "06", nombre: "O'Higgins" },
  { codigo: "07", nombre: "Maule" },
  { codigo: "16", nombre: "Ñuble" },
  { codigo: "08", nombre: "Biobío" },
  { codigo: "09", nombre: "La Araucanía" },
  { codigo: "14", nombre: "Los Ríos" },
  { codigo: "10", nombre: "Los Lagos" },
  { codigo: "11", nombre: "Aysén" },
  { codigo: "12", nombre: "Magallanes" }
];

app.get("/api/external/locations/regiones", async (req, res) => {
  try {
    const response = await fetch("https://apis.digital.gob.cl/dpa/regiones");
    if (!response.ok) throw new Error("API DPA fuera de servicio");
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.warn("Usando fallback de regiones por error en API DPA:", error.message);
    res.json(FALLBACK_REGIONES);
  }
});

app.get("/api/external/locations/regiones/:codigo/comunas", async (req, res) => {
  try {
    const response = await fetch(`https://apis.digital.gob.cl/dpa/regiones/${req.params.codigo}/comunas`);
    if (!response.ok) throw new Error("API DPA fuera de servicio");
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.warn("Falla en comunas, retornando vacio para entrada manual:", error.message);
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`CRM YouRef API running on http://localhost:${PORT}`);
});
