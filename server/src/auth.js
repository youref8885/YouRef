import { USER_ROLES } from "./constants.js";
import { supabase } from "./supabaseClient.js";
import { createToken } from "./utils.js";

// --- LÓGICA DE SESIONES Y SEGURIDAD ---
export async function createSession(userId) {
  const token = createToken(24); // Token más largo para Supabase
  const session = {
    id: createToken(8),
    token,
    user_id: userId,
    created_at: new Date().toISOString()
  };

  const { error } = await supabase.from("sessions").insert([session]);
  if (error) throw error;
  
  return token;
}

// Recuperación de Usuario desde Token
export async function getUserFromToken(token) {
  if (!token) {
    return null;
  }

  // Buscar sesión en Supabase e incluir datos del usuario (Join)
  const { data: session, error } = await supabase
    .from("sessions")
    .select("*, users(*)")
    .eq("token", token)
    .single();

  if (!session || error || !session.users) {
    return null;
  }

  // Normalizar el retorno para que sea compatible
  const user = session.users;
  // Convertir snake_case a camelCase si es necesario para el resto del app
  // Pero como server.js ya usa snake_case para Supabase, lo dejamos estable.
  return {
      ...user,
      firstName: user.first_name,
      lastName: user.last_name
  };
}

export function withoutSensitiveUser(user) {
  if (!user) return null;
  const { password_hash, otp_code, ...safeUser } = user;
  return {
      ...safeUser,
      firstName: user.first_name || safeUser.firstName,
      lastName: user.last_name || safeUser.lastName
  };
}

// MIDDLEWARES DE PROTECCIÓN DE RUTAS
export function authRequired() {
  return async (req, res, next) => {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const user = await getUserFromToken(token);

    if (!user) {
      res.status(401).json({ message: "Sesion invalida o expirada." });
      return;
    }

    req.user = user;
    req.token = token;
    next();
  };
}

export function adminRequired() {
  return (req, res, next) => {
    if (req.user?.role !== USER_ROLES.ADMIN) {
      res.status(403).json({ message: "Acceso restringido a administradores." });
      return;
    }
    next();
  };
}
