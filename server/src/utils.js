// --- UTILIDADES GENERALES DEL SISTEMA ---
import crypto from "crypto";

// Generación de Identificadores Únicos
export function createId(prefix = "") {
  return `${prefix}${crypto.randomUUID()}`;
}

export function createToken(size = 24) {
  return crypto.randomBytes(size).toString("hex");
}

export function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Seguridad y Encriptación (Passwords y OTP)
export function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Formateo y Normalización de Datos (Chile)
export function sanitizeRut(value = "") {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

export function normalizePhone(value = "") {
  return value.replace(/[^\d+]/g, "");
}

export function validateRut(rut = "") {
  const cleanRut = sanitizeRut(rut);
  if (cleanRut.length < 8) {
    return false;
  }

  const body = cleanRut.slice(0, -1);
  const verifier = cleanRut.slice(-1);
  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expected = 11 - (sum % 11);
  const expectedVerifier = expected === 11 ? "0" : expected === 10 ? "K" : String(expected);
  return verifier === expectedVerifier;
}

export function formatDate(date = new Date()) {
  return new Date(date).toISOString();
}

// Utilidades de Tiempo
export function calculateAge(dateOfBirth) {
  const birthDate = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}
