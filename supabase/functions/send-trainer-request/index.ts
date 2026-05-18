import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const ADMIN_EMAIL = 'evolabsstudio@gmail.com';
const FROM_EMAIL = 'EvoMetrics <noreply@evometrics.app>';

interface RequestBody {
  email: string;
}

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error: ${text}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { email } = (await req.json()) as RequestBody;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Email inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Notificación al administrador
    await sendEmail(
      ADMIN_EMAIL,
      '🆕 Nueva solicitud de cuenta de entrenador — EvoMetrics',
      `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#208AEF">Nueva solicitud de entrenador</h2>
          <p>Un profesional ha solicitado acceso como entrenador en EvoMetrics.</p>
          <p><strong>Correo electrónico:</strong> <a href="mailto:${email}">${email}</a></p>
          <p>Ponte en contacto con esta persona para validar su perfil y activar su cuenta.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="color:#999;font-size:12px">EvoMetrics · Plataforma de gestión profesional</p>
        </div>
      `
    );

    // 2. Confirmación al solicitante
    await sendEmail(
      email,
      'Hemos recibido tu solicitud — EvoMetrics',
      `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#208AEF">¡Solicitud recibida!</h2>
          <p>Gracias por tu interés en unirte a EvoMetrics como entrenador.</p>
          <p>Hemos recibido tu solicitud y nos pondremos en contacto contigo lo más brevemente posible para verificar tu perfil y activar tu acceso.</p>
          <p>Si tienes cualquier duda puedes responder directamente a este correo.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="color:#999;font-size:12px">EvoMetrics · Plataforma de gestión profesional</p>
        </div>
      `
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
