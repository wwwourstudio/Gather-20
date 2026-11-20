import { Express } from 'express';
import { ServerPodcastEpisode, ServerPodcastShow } from '../types.js';

const podcastShows = new Map<string, ServerPodcastShow>();
const podcastAudioBuffers = new Map<string, { buffer: Buffer; mimeType: string }>();

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createServerSilentOrChordWavBuffer(durationSec = 4): Buffer {
  const sampleRate = 22050;
  const numChannels = 1;
  const frameCount = sampleRate * durationSec;
  const dataByteLength = frameCount * 2;
  const buf = Buffer.alloc(44 + dataByteLength);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataByteLength, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataByteLength, 40);
  const freqs = [261.63, 329.63, 392.0, 523.25];
  for (let i = 0; i < frameCount; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t / 0.15) * Math.exp(-t * 0.55);
    let sample = 0;
    for (let f = 0; f < freqs.length; f++) {
      sample += Math.sin(2 * Math.PI * freqs[f] * t) * 0.16;
    }
    const pcm = Math.max(-1, Math.min(1, sample * env));
    buf.writeInt16LE(Math.round(pcm * 32767), 44 + i * 2);
  }
  return buf;
}

function ensurePodcastShow(rawSlug: string, origin = 'http://localhost:3000'): ServerPodcastShow {
  const slug =
    rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'gather-live';
  let show = podcastShows.get(slug);
  if (!show) {
    const seedEpId = `ep-seed-${slug}`;
    if (!podcastAudioBuffers.has(seedEpId)) {
      podcastAudioBuffers.set(seedEpId, {
        buffer: createServerSilentOrChordWavBuffer(5),
        mimeType: 'audio/wav',
      });
    }
    const seedBuf = podcastAudioBuffers.get(seedEpId)!;
    show = {
      slug,
      title: 'The Gather Live Broadcast',
      author: 'Gather Studio Creators',
      email: 'podcasts@gather.studio',
      description:
        'Zero-fee live broadcasts recorded in uncompressed 16-bit WAV directly from the Gather Master Audio Bus and syndicated automatically via RSS.',
      category: 'Technology',
      language: 'en-us',
      coverArtUrl: `${origin}/icon.png`,
      directories: [
        { platform: 'spotify', connected: true, directoryUrl: 'https://creators.spotify.com' },
        { platform: 'apple', connected: true, directoryUrl: 'https://podcastsconnect.apple.com' },
        { platform: 'amazon', connected: false, directoryUrl: 'https://podcasters.amazon.com' },
        { platform: 'youtube', connected: false, directoryUrl: 'https://studio.youtube.com' },
      ],
      episodes: [
        {
          id: seedEpId,
          title: 'Episode 01 · Zero-Fee Live Broadcast & Audio Architecture',
          summary:
            'Recorded live on Gather Studio with isolated WebAudio tracks, AI chapters, and direct creator tipping.',
          durationSec: 5,
          publishedAt: new Date(Date.now() - 3600 * 1000).toUTCString(),
          audioUrl: `${origin}/api/podcast/audio/${seedEpId}.wav`,
          audioFormat: 'audio/wav',
          fileSizeBytes: seedBuf.buffer.byteLength,
          seasonNumber: 1,
          episodeNumber: 1,
          chapters: ['00:00 Studio Intro', '00:02 Master Audio Bus Check'],
        },
      ],
    };
    podcastShows.set(slug, show);
  }
  return show;
}

export function registerPodcastRoutes(app: Express) {
  app.get('/api/podcast/audio/:fileName', (req, res) => {
    const raw = String(req.params.fileName || '').replace(/\.(wav|webm|mp3)$/i, '');
    const audio = podcastAudioBuffers.get(raw);
    if (!audio) {
      res.status(404).send('Audio episode not found');
      return;
    }
    res.setHeader('Content-Type', audio.mimeType);
    res.setHeader('Content-Length', String(audio.buffer.byteLength));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(audio.buffer);
  });

  app.get('/api/podcast/:slug/rss.xml', (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
    const origin = `${proto}://${req.get('host')}`;
    const show = ensurePodcastShow(String(req.params.slug || 'gather-live'), origin);
    const feedUrl = `${origin}/api/podcast/${show.slug}/rss.xml`;
    const coverUrl = show.coverArtUrl.startsWith('http')
      ? show.coverArtUrl
      : `${origin}${show.coverArtUrl.startsWith('/') ? '' : '/'}${show.coverArtUrl}`;

    const itemsXml = show.episodes
      .map((ep, idx) => {
        const epUrl = ep.audioUrl.startsWith('http')
          ? ep.audioUrl
          : `${origin}${ep.audioUrl.startsWith('/') ? '' : '/'}${ep.audioUrl}`;
        const chapterNotes =
          ep.chapters && ep.chapters.length > 0
            ? `\n\nChapters:\n${ep.chapters.join('\n')}`
            : '';
        return `    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.summary + chapterNotes)}</description>
      <pubDate>${escapeXml(ep.publishedAt)}</pubDate>
      <guid isPermaLink="false">${escapeXml(ep.id)}</guid>
      <enclosure url="${escapeXml(epUrl)}" length="${ep.fileSizeBytes}" type="${escapeXml(ep.audioFormat)}" />
      <itunes:duration>${Math.max(1, Math.round(ep.durationSec))}</itunes:duration>
      <itunes:episode>${ep.episodeNumber ?? show.episodes.length - idx}</itunes:episode>
      <itunes:season>${ep.seasonNumber ?? 1}</itunes:season>
      <itunes:explicit>false</itunes:explicit>
    </item>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(show.title)}</title>
    <link>${escapeXml(origin)}</link>
    <language>${escapeXml(show.language)}</language>
    <copyright>&#169; ${new Date().getFullYear()} ${escapeXml(show.author)}</copyright>
    <itunes:author>${escapeXml(show.author)}</itunes:author>
    <description>${escapeXml(show.description)}</description>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>${escapeXml(show.author)}</itunes:name>
      <itunes:email>${escapeXml(show.email)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${escapeXml(coverUrl)}" />
    <itunes:category text="${escapeXml(show.category)}" />
    <itunes:explicit>false</itunes:explicit>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(xml);
  });

  app.get('/api/podcast/:slug', (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
    const origin = `${proto}://${req.get('host')}`;
    const show = ensurePodcastShow(String(req.params.slug || 'gather-live'), origin);
    res.json({
      show,
      rssUrl: `${origin}/api/podcast/${show.slug}/rss.xml`,
    });
  });

  app.post('/api/podcast/:slug/config', (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
    const origin = `${proto}://${req.get('host')}`;
    const show = ensurePodcastShow(String(req.params.slug || 'gather-live'), origin);
    const body = (req.body as Record<string, unknown>) || {};
    if (typeof body.title === 'string' && body.title.trim()) show.title = body.title.trim().slice(0, 100);
    if (typeof body.author === 'string' && body.author.trim()) show.author = body.author.trim().slice(0, 80);
    if (typeof body.email === 'string' && body.email.trim()) show.email = body.email.trim().slice(0, 120);
    if (typeof body.description === 'string') show.description = body.description.trim().slice(0, 800);
    if (typeof body.category === 'string' && body.category.trim()) show.category = body.category.trim().slice(0, 60);
    if (typeof body.coverArtUrl === 'string' && body.coverArtUrl.trim()) {
      show.coverArtUrl = body.coverArtUrl.trim();
    }
    if (Array.isArray(body.directories)) {
      show.directories = body.directories as ServerPodcastShow['directories'];
    }
    res.json({
      show,
      rssUrl: `${origin}/api/podcast/${show.slug}/rss.xml`,
    });
  });

  app.post('/api/podcast/:slug/episodes', (req, res) => {
    try {
      const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
      const origin = `${proto}://${req.get('host')}`;
      const show = ensurePodcastShow(String(req.params.slug || 'gather-live'), origin);
      const body = (req.body as Record<string, unknown>) || {};
      const title = String(body.title || `Episode ${show.episodes.length + 1} · Live Broadcast`)
        .trim()
        .slice(0, 120);
      const summary = String(body.summary || 'Recorded live in Gather Studio and distributed via RSS.')
        .trim()
        .slice(0, 1500);
      const durationSec = Math.max(1, Math.round(Number(body.durationSec || 60)));
      const audioFormat: 'audio/wav' | 'audio/webm' =
        body.audioFormat === 'audio/webm' ? 'audio/webm' : 'audio/wav';
      const ext = audioFormat === 'audio/webm' ? 'webm' : 'wav';
      const epId = `ep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      let buffer: Buffer;
      if (typeof body.audioBase64 === 'string' && body.audioBase64.length > 20) {
        buffer = Buffer.from(body.audioBase64, 'base64');
      } else {
        buffer = createServerSilentOrChordWavBuffer(5);
      }

      podcastAudioBuffers.set(epId, { buffer, mimeType: audioFormat });
      const episode: ServerPodcastEpisode = {
        id: epId,
        title,
        summary,
        durationSec,
        publishedAt: new Date().toUTCString(),
        audioUrl: `${origin}/api/podcast/audio/${epId}.${ext}`,
        audioFormat,
        fileSizeBytes: buffer.byteLength,
        seasonNumber: 1,
        episodeNumber: show.episodes.length + 1,
        chapters: Array.isArray(body.chapters)
          ? (body.chapters as unknown[]).map((c) => String(c).slice(0, 100)).slice(0, 20)
          : undefined,
      };
      show.episodes = [episode, ...show.episodes.slice(0, 49)];
      res.json({
        episode,
        show,
        rssUrl: `${origin}/api/podcast/${show.slug}/rss.xml`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish podcast episode.';
      res.status(500).json({ error: message });
    }
  });
}
