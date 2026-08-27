// Vercel Serverless Function — Envío de emails via Microsoft 365 SMTP
// Mismo sistema que el CRM. Wikuk Producción lo usa para el informe de turno.
//
// CONFIGURACIÓN en Vercel → Settings → Environment Variables:
//   SMTP_HOST = smtp.office365.com
//   SMTP_PORT = 587
//   SMTP_USER = crm@grupoconsolidado.com
//   SMTP_PASS = (la misma contraseña que en el CRM)
//   SMTP_FROM = Wikuk Producción <crm@grupoconsolidado.com>
//
// Ojo: Microsoft 365 exige que el remitente sea la cuenta autenticada.
// Se puede cambiar el nombre que se ve, pero no la dirección.

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { ciphers: 'SSLv3', rejectUnauthorized: false },
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, subject, html, text, icsAttachment, icsFilename } = req.body || {};
  if (!to || !subject) return res.status(400).json({ error: 'Faltan: to, subject' });
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(503).json({ error: 'SMTP sin configurar en Vercel' });
  }

  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,                                  // admite string o lista separada por comas
      subject,
      html: html || undefined,
      text: text || (html ? undefined : subject),
    };

    // Adjuntar .ics — por si en el futuro se envían avisos de calendario
    if (icsAttachment) {
      mailOptions.attachments = [{
        filename: icsFilename || 'evento.ics',
        content: icsAttachment,
        contentType: 'text/calendar; method=REQUEST',
      }];
      mailOptions.alternatives = [{
        contentType: 'text/calendar; method=REQUEST',
        content: icsAttachment,
      }];
    }

    const info = await transporter.sendMail(mailOptions);
    console.log('[EMAIL] Enviado a', to, ':', subject);
    return res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (error) {
    console.error('[EMAIL] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
