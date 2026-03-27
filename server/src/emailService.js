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

  // 1. Try EmailJS if all keys are present
  if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY && EMAILJS_PRIVATE_KEY) {
    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          accessToken: EMAILJS_PRIVATE_KEY,
          template_params: {
            ...templateParams,
            to_email: to,
            email: to
          }
        })
      });

      if (response.ok) {
        return { delivered: true, mode: "emailjs" };
      }
      
      const errText = await response.text();
      console.error(`EmailJS API Error: ${response.status} - ${errText}`);
    } catch (error) {
      console.error("EmailJS Fetch Error:", error);
    }
  }

  // 2. Fallback to NodeMailer (SMTP)
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
