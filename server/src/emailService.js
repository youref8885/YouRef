import { Resend } from "resend";

// ─── Resend Client ───────────────────────────────────────────────────────────
let resendClient = null;

function getResendClient() {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// ─── Dirección remitente ─────────────────────────────────────────────────────
// Usar dominio propio una vez verificado en Resend (youref.cl).
// Mientras se verifica: "onboarding@resend.dev"
function getFromAddress() {
  const domain = process.env.RESEND_FROM_DOMAIN;
  if (domain) {
    return `YouRef CRM <no-reply@${domain}>`;
  }
  return "YouRef CRM <onboarding@resend.dev>";
}

// ─── Función principal ───────────────────────────────────────────────────────
export async function sendMail({ to, subject, html }) {
  const resend = getResendClient();

  if (!resend) {
    console.warn("[Email] ⚠️  RESEND_API_KEY no configurada. Correo NO enviado.");
    console.warn("[Email] Para:", to, "| Asunto:", subject);
    return { delivered: false, mode: "no-config" };
  }

  const from = getFromAddress();

  console.log(`[Resend] Enviando correo a: ${to}`);
  console.log(`[Resend] Desde: ${from} | Asunto: ${subject}`);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[Resend] ❌ Error al enviar:", error);
      return { delivered: false, error: error.message };
    }

    console.log(`[Resend] ✅ Correo enviado exitosamente. ID: ${data.id}`);
    return { delivered: true, mode: "resend", id: data.id };

  } catch (err) {
    console.error("[Resend] ❌ Excepción:", err.message);
    return { delivered: false, error: err.message };
  }
}
