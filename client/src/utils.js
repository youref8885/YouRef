export const profilePalette = ["#0d2a4a", "#0d5d56", "#d4af37", "#4e2f3f", "#1e293b"];

export function currency(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function validateRUT(rut) {
  if (!rut || typeof rut !== "string") return false;
  const clean = rut.replace(/[^0-9kK]/g, "");
  if (clean.length < 8) return false;
  
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();
  
  let sum = 0;
  let multiplier = 2;
  
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const expectedDv = 11 - (sum % 11);
  const dvChar = expectedDv === 11 ? "0" : expectedDv === 10 ? "K" : expectedDv.toString();
  
  return dv === dvChar;
}

export function formatRUT(value) {
  const clean = value.replace(/[^0-9kK]/g, "");
  if (!clean) return "";
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  
  let formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (dv) {
    formatted += (formatted ? "-" : "") + dv;
  }
  return formatted;
}

export function formatPhone(value) {
  // Always start with +56 9
  let digits = value.replace(/\D/g, "");
  
  // Strip 569 if it's already there to handle only the underlying 8 digits
  if (digits.startsWith("569")) {
    digits = digits.slice(3);
  }
  
  // Only keep 8 digits
  digits = digits.slice(0, 8);
  
  let formatted = "+56 9";
  if (digits.length > 0) {
    formatted += " " + digits.slice(0, 4);
  }
  if (digits.length > 4) {
    formatted += " " + digits.slice(4, 8);
  }
  
  return formatted;
}
