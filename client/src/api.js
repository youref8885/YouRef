export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
console.log("DEBUG: Using API URL:", API_URL);

export async function apiRequest(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Ocurrio un error inesperado.");
  }
  return data;
}
