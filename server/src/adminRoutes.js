import express from "express";
import { adminRequired, authRequired } from "./auth.js";
import { supabase } from "./supabaseClient.js";
import { createId, createOtpCode } from "./utils.js";
import { sendMail } from "./emailService.js";
import { logAction } from "./auditService.js";

const router = express.Router();

/**
 * GESTIÓN DE INVITACIONES DE SOCIOS
 */
router.post("/users/invite", authRequired(), adminRequired(), async (req, res) => {
  const { firstName, lastName, email, role } = req.body;

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ message: "Nombre, apellido y correo son obligatorios." });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Verificación de duplicidad
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, is_verified")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingUser && existingUser.is_verified) {
      return res.status(409).json({ message: "Ya existe un usuario verificado con este correo electrónico." });
    }

    const otpCode = createOtpCode();
    const newUser = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: normalizedEmail,
      role: role || "advisor",
      is_verified: false,
      otp_code: otpCode,
      otp_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas para invitaciones
      invited_by_userid: req.user.id,
    };

    if (existingUser) {
      // Actualización de registro invitado (re-invitación)
      const { error: updateError } = await supabase
        .from("users")
        .update(newUser)
        .eq("id", existingUser.id);
      
      if (updateError) throw updateError;
      newUser.id = existingUser.id; // Para el log posterior
    } else {
      // Si no existe, lo creamos
      newUser.id = createId("usr_");
      newUser.created_at = new Date().toISOString();

      const { error: insertError } = await supabase.from("users").insert([newUser]);
      if (insertError) throw insertError;
    }

    // Trazabilidad
    await logAction({
      entityType: "user",
      entityId: newUser.id,
      action: "invite",
      performedByUserId: req.user.id,
      newData: { email: normalizedEmail, role: newUser.role }
    });

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const registrationUrl = `${clientUrl}?email=${encodeURIComponent(normalizedEmail)}&otp=${otpCode}`;

    // Enviar correo
    await sendMail({
      to: normalizedEmail,
      subject: "Invitación a YouRef CRM — Activa tu cuenta",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e6ed; border-radius: 12px; overflow: hidden; background-color: #ffffff; color: #1e293b;">
          <div style="background-color: #0d2a4a; padding: 30px; text-align: center;">
            <a href="https://youref.onrender.com/" target="_blank">
              <img src="https://youref.vercel.app//LOGOYourRef.png" alt="YouRef Logo" style="height: 60px; width: auto;" />
            </a>
          </div>

          <div style="padding: 40px 30px; line-height: 1.6;">
            <h2 style="color: #0d2a4a; margin-top: 0; font-size: 22px;">¡Hola ${firstName}!</h2>
            <p>Has sido invitado a unirte al equipo de <strong>YouRef CRM</strong> como nuevo socio.</p>
            <p>Para activar tu cuenta y comenzar a referir, por favor utiliza el siguiente código de seguridad:</p>

            <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0d2a4a;">${otpCode}</span>
            </div>

            <p style="margin-bottom: 30px;">También puedes completar tu registro haciendo clic directamente en el siguiente botón:</p>

            <div style="text-align: center;">
              <a href="${registrationUrl}" style="background-color: #0d2a4a; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Activar mi Cuenta</a>
            </div>

            <p style="margin-top: 40px; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
              <span style="color: #0d2a4a; word-break: break-all;">${registrationUrl}</span>
            </p>
          </div>

          <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
            © 2026 YouRef CRM. Todos los derechos reservados.<br />
            Este es un correo automático generado para tu seguridad.
          </div>
        </div>
      `
    });

    res.status(201).json({ message: "Invitación enviada correctamente." });
  } catch (err) {
    console.error("Error en invite:", err);
    res.status(500).json({ message: "Error interno al procesar la invitación." });
  }
});

/**
 * REPORTES DE DESEMPEÑO Y EXPORTACIÓN EXCEL
 */
router.get("/reports/partners", authRequired(), adminRequired(), async (req, res) => {
  try {
    const { data: users, error: usersError } = await supabase.from("users").select("id, first_name, last_name, role").eq("role", "advisor");
    const { data: referrals, error: referralsError } = await supabase.from("referrals").select("*");

    if (usersError || referralsError) throw new Error("Error fetching data for report.");

    const report = users.map(user => {
      const userReferrals = referrals.filter(r => r.owner_user_id === user.id);
      
      const communes = userReferrals.reduce((acc, r) => {
        const c = r.commune || "N/A";
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {});
      const topCommunes = Object.entries(communes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]).join(", ");

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

export default router;
