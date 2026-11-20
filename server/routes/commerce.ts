import dns from 'dns/promises';
import net from 'net';
import { Express } from 'express';
import { rooms } from '../roomStore.js';

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fe80:') ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('::ffff:127.') ||
      lower.startsWith('::ffff:10.') ||
      lower.startsWith('::ffff:169.254.') ||
      lower.startsWith('::ffff:192.168.')
    ) {
      return true;
    }
    return false;
  }
  return true;
}

async function assertPublicStoreUrl(parsed: URL): Promise<void> {
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    throw new Error('Blocked private or internal host URL.');
  }
  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('Blocked non-public IP address.');
    }
    return;
  }
  const records = await dns.lookup(host, { all: true });
  if (!records.length || records.some((r) => isPrivateOrReservedIp(r.address))) {
    throw new Error('Store domain resolved to a non-public IP address.');
  }
}

export function registerCommerceRoutes(app: Express) {
  app.get('/api/rooms/:code', (req, res) => {
    const code = String(req.params.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ exists: false });
      return;
    }
    res.json({
      exists: true,
      title: room.title,
      isLocked: room.isLocked,
      isLive: room.isLive,
      watchMode: room.watchMode,
      participantCount: room.participants.length,
      viewerCount: room.viewerCount,
    });
  });

  app.post('/api/commerce/shopify-import', async (req, res) => {
    try {
      let rawUrl = String(req.body?.storeUrl || '').trim();
      if (!rawUrl) {
        res.status(400).json({ error: 'Please provide a Shopify store URL or domain.' });
        return;
      }
      if (!/^https?:\/\//i.test(rawUrl)) {
        rawUrl = `https://${rawUrl}`;
      }
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        res.status(400).json({ error: 'Invalid store URL protocol.' });
        return;
      }

      await assertPublicStoreUrl(parsed);

      const endpoint = `${parsed.origin}/products.json?limit=12`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const upstream = await fetch(endpoint, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'gather-studio-commerce' },
      });
      clearTimeout(timer);

      if (!upstream.ok) {
        res.status(502).json({
          error: `Storefront responded with status ${upstream.status}. Ensure the store exposes public /products.json.`,
        });
        return;
      }

      const json = (await upstream.json()) as {
        products?: Array<{
          id: number | string;
          title: string;
          handle: string;
          body_html?: string;
          variants?: Array<{ title?: string; price?: string; available?: boolean }>;
          images?: Array<{ src?: string }>;
        }>;
      };

      const items = (json.products || []).slice(0, 12).map((p) => {
        const firstPrice = Number(p.variants?.[0]?.price || 0);
        const variants = (p.variants || [])
          .map((v) => v.title || 'Default')
          .filter((v) => v !== 'Default Title')
          .slice(0, 5);
        const cleanDesc = (p.body_html || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 140);
        return {
          id: `shop-${p.id}`,
          source: 'shopify' as const,
          title: p.title,
          price: Number.isFinite(firstPrice) && firstPrice > 0 ? firstPrice : 29,
          currency: 'USD',
          imageUrl: p.images?.[0]?.src || '/src/assets/images/product_ceramic_mug_1794839256911.jpg',
          url: `${parsed.origin}/products/${p.handle}`,
          stock: p.variants?.some((v) => v.available === false) ? 3 : 12,
          variants: variants.length > 0 ? variants : ['Standard'],
          description: cleanDesc || undefined,
        };
      });

      res.json({ storeOrigin: parsed.origin, products: items });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reach Shopify store.';
      res.status(400).json({ error: message });
    }
  });
}
