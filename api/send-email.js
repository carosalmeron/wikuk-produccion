// Vercel Serverless Function — Envío de emails via Microsoft 365 SMTP
// Proyecto Create React App (CommonJS): se usa require, no import.
//
// Variables de entorno en Vercel → Settings → Environment Variables:
//   SMTP_HOST = smtp.office365.com
//   SMTP_PORT = 587
//   SMTP_USER = (el correo del CRM)
//   SMTP_PASS = (la contraseña del CRM)
//   SMTP_FROM = Wikuk Producción <el mismo correo>

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Comprobación rápida abriendo la URL en el navegador
  if (req.method === 'GET') {
    let libreria = 'ok';
    try { require('nodemailer'); } catch (e) { libreria = 'FALTA nodemailer en package.json'; }
    return res.status(200).json({
      ok: true,
      mensaje: 'La función responde. Envía un POST para mandar correo.',
      nodemailer: libreria,
      smtp_configurado: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      host: process.env.SMTP_HOST || 'sin definir',
      usuario: process.env.SMTP_USER ? 'definido' : 'SIN DEFINIR',
      remitente: process.env.SMTP_FROM || '(usará SMTP_USER)',
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, subject, html, text } = req.body || {};
  if (!to || !subject) return res.status(400).json({ error: 'Faltan: to, subject' });
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(503).json({ error: 'SMTP sin configurar en Vercel' });
  }

  try {
    // Se carga aquí dentro: si falta la librería, se ve el error en vez de crashear
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { ciphers: 'SSLv3', rejectUnauthorized: false },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html: html || undefined,
      text: text || (html ? undefined : subject),
    });

    console.log('[EMAIL] Enviado a', to, ':', subject);
    return res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (error) {
    console.error('[EMAIL] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
