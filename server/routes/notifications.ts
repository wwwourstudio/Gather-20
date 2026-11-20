import { Express } from 'express';
import { verifyFirebaseIdToken } from '../auth.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function registerNotificationRoutes(app: Express) {
  app.post('/api/notifications/send-stream-alert', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
      if (bearer) {
        const verified = await verifyFirebaseIdToken(bearer);
        if (!verified) {
          res.status(401).json({ error: 'Invalid Firebase authentication token.' });
          return;
        }
      }

      const body = (req.body as Record<string, unknown>) || {};
      const hostName = String(body.hostName || 'Gather Host').trim().slice(0, 60);
      const title = String(body.title || body.streamTitle || 'Upcoming Live Broadcast')
        .trim()
        .slice(0, 100);
      const scheduledIso = String(
        body.scheduledIso || new Date(Date.now() + 3600000).toISOString()
      ).slice(0, 40);
      const roomCode = String(body.roomCode || 'LIVE01').slice(0, 20);
      const watchUrl = String(body.watchUrl || '').slice(0, 300);
      const rawSubs = Array.isArray(body.subscribers)
        ? (body.subscribers as Array<Record<string, unknown>>)
        : [];
      const validRecipients = rawSubs
        .map((s) => ({
          email: String(s.email || '').trim().toLowerCase(),
          name: String(s.name || 'Subscriber').trim().slice(0, 60),
        }))
        .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email))
        .slice(0, 200);

      let deliveredViaProvider = false;
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey && validRecipients.length > 0) {
        const emailResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Gather Live <alerts@resend.dev>',
            to: validRecipients.map((r) => r.email),
            subject: `Live Alert: ${hostName} scheduled "${title}"`,
            html: `<p><strong>${escapeHtml(hostName)}</strong> is going live on Gather:</p><h2>${escapeHtml(
              title
            )}</h2><p>Starts: ${escapeHtml(
              new Date(scheduledIso).toLocaleString()
            )}</p><p><a href="${escapeHtml(watchUrl)}">Join Watch Page (${escapeHtml(
              roomCode
            )})</a></p>`,
          }),
        });
        deliveredViaProvider = emailResp.ok;
      }

      res.json({
        sentCount: validRecipients.length,
        queuedCount: validRecipients.length,
        deliveredViaProvider,
        subject: `Live Alert: ${hostName} — "${title}"`,
        scheduledIso,
        recipientsPreview: validRecipients.slice(0, 5).map((r) => r.email),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to dispatch stream email alerts.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/notifications/calendar.ics', (req, res) => {
    const title = String(req.query.title || 'Gather Live Broadcast').slice(0, 100);
    const room = String(req.query.room || 'LIVE01').slice(0, 20);
    const iso = String(req.query.iso || new Date(Date.now() + 3600000).toISOString());
    const start = new Date(iso);
    const validStart = Number.isNaN(start.getTime()) ? new Date(Date.now() + 3600000) : start;
    const end = new Date(validStart.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
    const watchUrl = `${proto}://${req.get('host')}/?watch=${encodeURIComponent(room)}`;

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Gather Studio//Live Stream Reminder//EN',
      'BEGIN:VEVENT',
      `UID:gather-${room}-${validStart.getTime()}@gather.studio`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(validStart)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${title.replace(/[\r\n,]/g, ' ')}`,
      `DESCRIPTION:Watch live on Gather: ${watchUrl}`,
      `URL:${watchUrl}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gather-${room.toLowerCase()}.ics"`);
    res.send(ics);
  });
}
