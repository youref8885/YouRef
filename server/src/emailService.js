import nodemailer from "nodemailer";

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

export async function sendMail({ to, subject, html, templateParams, debugPayload }) {
  const { 
    EMAILJS_SERVICE_ID, 
    EMAILJS_TEMPLATE_ID, 
    EMAILJS_PUBLIC_KEY, 
    EMAILJS_PRIVATE_KEY 
  } = process.env;

  // Integración con EmailJS
  if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY && EMAILJS_PRIVATE_KEY) {
    const payload = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: {
        ...templateParams,
        to_email: to,
        email: to
      }
    };

    console.log("[EmailJS] Enviando correo a:", to);
    console.log("[EmailJS] template_params:", JSON.stringify(payload.template_params, null, 2));

    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log("[EmailJS] ✅ Correo enviado exitosamente a:", to);
        return { delivered: true, mode: "emailjs" };
      }
      
      const errText = await response.text();
      console.error(`[EmailJS] ❌ API Error ${response.status}: ${errText}`);
      console.error(`[EmailJS] service_id: ${EMAILJS_SERVICE_ID}, template_id: ${EMAILJS_TEMPLATE_ID}`);
    } catch (error) {
      console.error("[EmailJS] ❌ Fetch Error:", error.message);
    }
  } else {
    console.warn("[EmailJS] ⚠️  Variables de entorno faltantes:", {
      EMAILJS_SERVICE_ID: !!EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID: !!EMAILJS_TEMPLATE_ID,
      EMAILJS_PUBLIC_KEY: !!EMAILJS_PUBLIC_KEY,
      EMAILJS_PRIVATE_KEY: !!EMAILJS_PRIVATE_KEY,
    });
  }

  // Respaldo SMTP (NodeMailer)
  const transport = createTransport();
  const from = process.env.MAIL_FROM || "CRM YouRef <no-reply@youref.cl>";

  if (!transport) {
    console.warn("--- MAILBOX FALLBACK (No SMTP/EmailJS) ---");
    console.warn(`To: ${to}`);
    console.warn(`Subject: ${subject}`);
    console.warn(`Template Params:`, templateParams);
    return { delivered: false, mode: "local-mailbox" };
  }

  try {
    await transport.sendMail({ from, to, subject, html });
    return { delivered: true, mode: "smtp" };
  } catch (error) {
    console.error("SMTP Error:", error);
    return { delivered: false, error: error.message };
  }
}
