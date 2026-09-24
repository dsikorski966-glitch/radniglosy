// lib/email.cjs
// Wysyłka maili przez Brevo (transactional API v3). Bez zewnętrznych bibliotek — zwykły fetch.

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

async function sendEmail({ to, toName, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('Brak BREVO_API_KEY w zmiennych środowiskowych')
  const from = process.env.EMAIL_FROM
  if (!from) throw new Error('Brak EMAIL_FROM w zmiennych środowiskowych')

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: from, name: process.env.EMAIL_FROM_NAME || 'DSM Głosowanie' },
      to: [{ email: to, name: toName || undefined }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Brevo: wysyłka nie powiodła się (HTTP ${res.status}) ${body.slice(0, 300)}`)
  }
  return res.json()
}

// Wspólna "ramka" maila: ciemny granat + złoty akcent, jak w aplikacji.
// Layout tabelowy dla zgodności z Outlookiem/Gmailem.
function emailShell({ preheader, bodyHtml }) {
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DSM Głosowanie</title>
</head>
<body style="margin:0;padding:0;background:#EEF0F6;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0F6;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;background:#171B2E;border-radius:20px;overflow:hidden;">
  <tr>
    <td style="padding:28px 32px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:36px;height:36px;border-radius:10px;background:#F2C14E;text-align:center;vertical-align:middle;font:800 14px Arial,sans-serif;color:#171B2E;">DSM</td>
        <td style="padding-left:10px;font:700 17px Arial,sans-serif;color:#F3F0E6;">Głosowanie</td>
      </tr></table>
    </td>
  </tr>
  <tr><td style="padding:8px 32px 32px;">
    ${bodyHtml}
  </td></tr>
  <tr><td style="padding:20px 32px 28px;border-top:1px solid #2A3052;">
    <p style="margin:0;font:400 12.5px/1.6 Arial,sans-serif;color:#8A90B3;">
      Ta wiadomość została wysłana automatycznie przez system głosowania Dolnośląskiego Sejmiku Młodzieży.
      Jeśli nie prosiłeś(-aś) o tę wiadomość, możesz ją zignorować.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function resetPasswordEmail({ name, url }) {
  const safeName = escapeHtml(name || '')
  const bodyHtml = `
    <h1 style="margin:0 0 14px;font:800 22px/1.3 Arial,sans-serif;color:#F3F0E6;">Resetowanie hasła</h1>
    <p style="margin:0 0 20px;font:400 15px/1.6 Arial,sans-serif;color:#C7CBE3;">
      Cześć${safeName ? ' ' + safeName : ''}, dostaliśmy prośbę o zresetowanie hasła do konta
      w systemie głosowania DSM. Kliknij przycisk poniżej, aby ustawić nowe hasło.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr><td style="border-radius:14px;background:#F2C14E;">
        <a href="${url}" style="display:inline-block;padding:14px 28px;font:800 15px Arial,sans-serif;color:#171B2E;text-decoration:none;border-radius:14px;">
          Ustaw nowe hasło
        </a>
      </td></tr>
    </table>
    <p style="margin:0 0 6px;font:400 13.5px/1.6 Arial,sans-serif;color:#8A90B3;">
      Link jest ważny przez 30 minut i zadziała tylko raz.
    </p>
    <p style="margin:0;font:400 13.5px/1.6 Arial,sans-serif;color:#8A90B3;">
      Jeśli przycisk nie działa, skopiuj ten adres do przeglądarki:<br>
      <a href="${url}" style="color:#F2C14E;word-break:break-all;">${url}</a>
    </p>
    <p style="margin:20px 0 0;font:400 13.5px/1.6 Arial,sans-serif;color:#8A90B3;">
      Nie prosiłeś(-aś) o reset? Zignoruj tę wiadomość — Twoje obecne hasło nadal działa.
    </p>`
  return {
    subject: 'Reset hasła — DSM Głosowanie',
    html: emailShell({ preheader: 'Kliknij, aby ustawić nowe hasło do konta w systemie głosowania DSM.', bodyHtml }),
    text: `Resetowanie hasła — DSM Głosowanie\n\nKliknij w link, aby ustawić nowe hasło (ważny 30 minut, jednorazowy):\n${url}\n\nJeśli nie prosiłeś(-aś) o reset, zignoruj tę wiadomość.`,
  }
}

async function sendPasswordResetEmail({ to, name, url }) {
  const { subject, html, text } = resetPasswordEmail({ name, url })
  return sendEmail({ to, toName: name, subject, html, text })
}

module.exports = { sendEmail, sendPasswordResetEmail, resetPasswordEmail, emailShell }
