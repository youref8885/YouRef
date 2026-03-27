import express from "express";
import { adminRequired, authRequired } from "./auth.js";
import { supabase } from "./supabaseClient.js";
import { createId, createOtpCode } from "./utils.js";
import { sendMail } from "./emailService.js";
import { logAction } from "./auditService.js";

const router = express.Router();

/**
 * Invitación de nuevo usuario por parte del Admin.
 * Flujo: Admin -> Solo email/nombre -> Sistema -> OTP -> Usuario.
 */
router.post("/users/invite", authRequired(), adminRequired(), async (req, res) => {
  const { firstName, lastName, email, role } = req.body;

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ message: "Nombre, apellido y correo son obligatorios." });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Verificar si el usuario ya existe
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    if (existingUser) {
      return res.status(409).json({ message: "Ya existe un usuario con este correo electrónico." });
    }

    const otpCode = createOtpCode();
    const newUser = {
      id: createId("usr_"),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: normalizedEmail,
      role: role || "advisor",
      is_verified: false,
      otp_code: otpCode,
      otp_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas para invitaciones
      invited_by_userid: req.user.id,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from("users").insert([newUser]);
    if (error) throw error;

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
      subject: "Invitación a YouRef CRM",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #0d2a4a;">Hola ${firstName},</h2>
          <p>Has sido invitado a unirte al equipo de <strong>YouRef CRM</strong> como ${newUser.role}.</p>
          <p>Para completar tu registro, por favor haz clic en el siguiente enlace e ingresa tu código de activación:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationUrl}" style="background-color: #0d2a4a; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ir al Registro</a>
          </div>
          <p style="text-align: center; font-size: 1.2em;">Tu código de activación es: <strong>${otpCode}</strong></p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 0.8em; color: #666;">Si el botón no funciona, copia y pega este enlace en tu navegador: ${registrationUrl}</p>
        </div>
      `,
      templateParams: {
        user_name: firstName,
        otp_code: otpCode,
        registration_url: registrationUrl
      }
    });

    res.status(201).json({ message: "Invitación enviada correctamente." });
  } catch (err) {
    console.error("Error en invite:", err);
    res.status(500).json({ message: "Error interno al procesar la invitación." });
  }
});

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
