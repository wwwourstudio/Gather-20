import { Express } from 'express';
import { GoogleGenAI, Type, ThinkingLevel, FunctionDeclaration } from '@google/genai';

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractUpstreamError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || 'Gemini request failed.');
  let status = 500;
  let message = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: { code?: number; message?: string; status?: string } };
    if (parsed?.error?.code && Number.isFinite(parsed.error.code)) {
      status = parsed.error.code;
    }
    if (parsed?.error?.message) {
      message = parsed.error.message;
    }
  } catch {
    if (raw.includes('503') || raw.includes('UNAVAILABLE')) status = 503;
    else if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) status = 429;
  }
  return { status, message };
}

async function withGeminiRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const { status } = extractUpstreamError(err);
      const retryable = status === 503 || status === 429;
      if (!retryable || attempt === maxAttempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export function registerAiRoutes(app: Express) {
  // Gemini AI Producer Endpoint (Function Calling + Custom Persona + Web Research)
  app.post('/api/ai/producer', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Gemini API key is not configured in server secrets. Please add GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    try {
      const prompt = String(req.body?.prompt || '').trim();
      const context = (req.body?.context as Record<string, unknown>) || {};
      const aiName = String(req.body?.aiName || 'Cue AI').trim().slice(0, 40) || 'Cue AI';
      const persona = String(req.body?.persona || 'showrunner');
      const brief = String(req.body?.brief || '').trim().slice(0, 500);
      const researchMode = Boolean(req.body?.researchMode);
      const noteOnly = Boolean(req.body?.noteOnly);

      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required.' });
        return;
      }

      const personaMap: Record<string, string> = {
        showrunner: 'decisive, creative live television showrunner who keeps energy crisp and segments moving cleanly',
        cohost: 'charismatic, high-energy broadcast co-host with sharp punchlines and strong audience rapport',
        executive: 'concise, high-signal executive producer focused on retention, conversion, and clear structure',
        anchor: 'calm, authoritative broadcast news & documentary anchor',
        director: 'technical broadcast director focused on pacing, framing, audio cues, and smooth scene cuts',
        closer: 'high-converting live commerce host who frames product scarcity and benefits naturally',
      };

      const tools: FunctionDeclaration[] = [
        {
          name: 'switch_scene',
          description: 'Switch the broadcast stage scene layout.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              templateId: {
                type: Type.STRING,
                description:
                  'One of: solo, duo, spotlight, grid4, grid6, screen-cam, slides-cam, pip, full-media, v-solo, v-duo, v-screen, v-slides',
              },
            },
            required: ['templateId'],
          },
        },
        {
          name: 'show_banner',
          description: 'Show a lower-third headline and subtitle banner on the broadcast stage.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Short punchy lower-third headline (max 45 chars).' },
              subtitle: { type: Type.STRING, description: 'Supporting subline (max 70 chars).' },
            },
            required: ['title'],
          },
        },
        {
          name: 'hide_banner',
          description: 'Hide the current lower-third banner from the stage.',
          parameters: {
            type: Type.OBJECT,
            properties: { confirm: { type: Type.BOOLEAN } },
          },
        },
        {
          name: 'push_ai_card',
          description: 'Push a structured AI takeaway/fact card directly onto the stage layout.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Card header (max 40 chars).' },
              body: { type: Type.STRING, description: 'Crisp key takeaway or bullet summary (max 140 chars).' },
            },
            required: ['title', 'body'],
          },
        },
        {
          name: 'set_ticker',
          description: 'Show or update the scrolling ticker along the bottom of the stage.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              visible: { type: Type.BOOLEAN },
              text: { type: Type.STRING, description: 'Concise ticker copy.' },
            },
            required: ['visible'],
          },
        },
        {
          name: 'toggle_captions',
          description: 'Enable or disable live stage captions.',
          parameters: {
            type: Type.OBJECT,
            properties: { enabled: { type: Type.BOOLEAN } },
            required: ['enabled'],
          },
        },
        {
          name: 'pin_product',
          description:
            'Pin a product from the live commerce catalog onto the broadcast stage and Watch Page.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              productId: {
                type: Type.STRING,
                description: 'ID of the product to pin, matching one from context.products.',
              },
            },
            required: ['productId'],
          },
        },
        {
          name: 'unpin_product',
          description: 'Remove the currently pinned product overlay from the stage.',
          parameters: {
            type: Type.OBJECT,
            properties: { confirm: { type: Type.BOOLEAN } },
          },
        },
        {
          name: 'launch_poll',
          description: 'Launch a live interactive poll for Watch Page viewers.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: 'Poll question for viewers.' },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 to 4 short poll options.',
              },
            },
            required: ['question', 'options'],
          },
        },
        {
          name: 'feature_question',
          description: 'Spotlight an audience Q&A question on stage using its ID from context.questions.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              questionId: { type: Type.STRING, description: 'Question id to feature, or empty string to clear.' },
            },
            required: ['questionId'],
          },
        },
        {
          name: 'trigger_sound',
          description: 'Play a soundboard stinger cue into the studio mix.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              pad: {
                type: Type.STRING,
                description: 'One of: intro, order, applause, whoosh, hype, drumroll, alert',
              },
            },
            required: ['pad'],
          },
        },
        {
          name: 'next_rundown_step',
          description: 'Advance the show rundown to the next scheduled segment cue.',
          parameters: {
            type: Type.OBJECT,
            properties: { confirm: { type: Type.BOOLEAN } },
          },
        },
        {
          name: 'start_countdown',
          description: 'Start, customize, or clear an animated pre-stream or on-stage broadcast countdown timer.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              minutes: { type: Type.NUMBER, description: 'Minutes for countdown (0 to clear).' },
              label: { type: Type.STRING, description: 'Short timer label e.g. Starting Soon, Drop Ends.' },
              headline: { type: Type.STRING, description: 'Optional headline on the countdown slate.' },
              animationStyle: {
                type: Type.STRING,
                description: 'Optional style: aurora-rings, kinetic-grid, orbital-eq, neon-slash, editorial-swiss, ai-motion',
              },
              mode: { type: Type.STRING, description: 'takeover, slate, or hud' },
            },
            required: ['minutes'],
          },
        },
        {
          name: 'switch_watch_mode',
          description: 'Switch Watch Page experience mode between standard, shop, or gamer.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              watchMode: { type: Type.STRING, description: 'standard, shop, or gamer' },
            },
            required: ['watchMode'],
          },
        },
      ];

      const systemInstruction = `You are "${aiName}", the live AI Producer & Copilot inside Gather Studio.
Persona style: ${personaMap[persona] || personaMap.showrunner}.
${brief ? `Custom Show Brief / Guardrails: ${brief}` : ''}
Keep spoken/text responses crisp, broadcast-ready, and high-signal (1-3 sentences unless deeper analysis is asked).
${
  noteOnly
    ? 'PRIVATE RESEARCH NOTE MODE: Do NOT call any stage modification tools; answer only for the host.'
    : 'Whenever the host directs scene switches, banners, AI stage cards, ticker, captions, products, polls, Q&A spotlights, countdowns, watch modes, or sound cues, call the corresponding tool(s) immediately.'
}`;

      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Live Studio Context:\n${JSON.stringify(context)}\n\nHost / Producer Request:\n${prompt}`,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            tools: researchMode
              ? [{ googleSearch: {} }]
              : noteOnly
                ? undefined
                : [{ functionDeclarations: tools }],
          },
        })
      );

      const actions = noteOnly
        ? []
        : (response.functionCalls || []).map((fc) => ({
            name: fc.name || '',
            args: (fc.args as Record<string, unknown>) || {},
          }));

      const rawChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks as
          | Array<{ web?: { title?: string; uri?: string } }>
          | undefined;
      const sources = (rawChunks || [])
        .map((c) => c.web)
        .filter((w): w is { title?: string; uri?: string } => Boolean(w?.uri))
        .slice(0, 4)
        .map((w) => ({
          title: (w.title || w.uri || 'Source').slice(0, 80),
          uri: w.uri || '',
        }));

      let replyText = (response.text || '').trim();
      if (!replyText && actions.length > 0) {
        replyText = `Executed ${actions.map((a) => a.name.replace(/_/g, ' ')).join(', ')}.`;
      }

      res.json({ text: replyText, actions, sources });
    } catch (err) {
      console.error('Gemini AI Producer error:', err);
      const { status, message } = extractUpstreamError(err);
      res.status(status).json({ error: message });
    }
  });

  // Gemini Neural Speech TTS Endpoint (for Cue AI Voice Lightbox & Auditions)
  app.post('/api/ai/tts', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const text = String(req.body?.text || '').trim().slice(0, 600);
      const voiceName = String(req.body?.voiceName || 'Kore').trim();
      const style = String(
        req.body?.style || 'Crisp, charismatic, natural broadcast producer voice'
      ).slice(0, 140);
      if (!text) {
        res.status(400).json({ error: 'Text is required for TTS.' });
        return;
      }

      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text,
                  speechMetadata: {
                    style,
                  },
                } as unknown as { text: string },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        })
      );

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Voice model returned empty audio.' });
        return;
      }

      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
    } catch (err) {
      console.error('Gemini TTS error:', err);
      const { status, message } = extractUpstreamError(err);
      res.status(status).json({ error: message });
    }
  });

  // AI Pre-Stream Countdown Theme & Animation Recipe Generator
  app.post('/api/ai/countdown-theme', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({ error: 'Gemini API key is not configured in server secrets.' });
      return;
    }

    try {
      const prompt = String(req.body?.prompt || 'Modern sleek broadcast doors open countdown').trim();
      const title = String(req.body?.title || 'Gather Live').trim();
      const watchMode = String(req.body?.watchMode || 'standard');

      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Design an animated pre-stream broadcast countdown slate for "${title}" (watch mode: ${watchMode}).
Creative direction: "${prompt}"`,
          config: {
            systemInstruction: `Return a cohesive broadcast pre-stream countdown design JSON.
Pick high-contrast readable dark or atmospheric palette hexes (#RRGGBB).
animationStyle must be one of: aurora-rings, kinetic-grid, orbital-eq, neon-slash, editorial-swiss, ai-motion.
typography must be one of: mono, display, editorial.
Provide 3 crisp agenda items (max 34 chars each).`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                eyebrow: { type: Type.STRING },
                headline: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                agendaItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                primaryHex: { type: Type.STRING },
                secondaryHex: { type: Type.STRING },
                surfaceHex: { type: Type.STRING },
                animationStyle: { type: Type.STRING },
                typography: { type: Type.STRING },
                particleDensity: { type: Type.NUMBER },
              },
              required: [
                'eyebrow',
                'headline',
                'subtitle',
                'agendaItems',
                'primaryHex',
                'secondaryHex',
                'surfaceHex',
                'animationStyle',
                'typography',
                'particleDensity',
              ],
            },
          },
        })
      );

      const spec = JSON.parse((response.text || '{}').trim()) as Record<string, unknown>;
      res.json({ theme: spec });
    } catch (err) {
      console.error('Gemini Countdown theme error:', err);
      const { status, message } = extractUpstreamError(err);
      res.status(status).json({ error: message });
    }
  });

  // Autonomous Cue AI Auto-Director Endpoint
  app.post('/api/ai/auto-director', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const payload = (req.body as Record<string, unknown>) || {};
      const sensitivity = String(payload.sensitivity || 'balanced');

      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Analyze this live broadcast telemetry & recent transcript/chat context (director sensitivity: ${sensitivity}) and decide whether an editorial camera cut, lower-third banner, product pin, clip bookmark, or subtle cue should fire now:\n${JSON.stringify(
            payload
          )}`,
          config: {
            systemInstruction: `You are an Emmy-caliber live television Auto-Director inside Gather Studio.
Avoid jittery over-cutting: only set shouldAct=true when telemetry shows a meaningful beat (e.g., speaker explicitly mentions a product/price/discount, screen/media needs spotlighting, chat hype spikes, or a clean topic shift warrants a lower-third banner).
Allowed action names: switch_scene (args: {templateId}), show_banner (args: {title, subtitle}), hide_banner (args: {}), pin_product (args: {productId}), trigger_sound (args: {pad}), create_clip (args: {label}), next_rundown_step (args: {}).
Keep argsJson as a compact valid JSON string.`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                shouldAct: { type: Type.BOOLEAN },
                reason: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                actions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      argsJson: { type: Type.STRING },
                    },
                    required: ['name', 'argsJson'],
                  },
                },
              },
              required: ['shouldAct', 'reason', 'confidence', 'actions'],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text || '{}').trim()) as {
        shouldAct?: boolean;
        reason?: string;
        confidence?: number;
        actions?: Array<{ name: string; argsJson: string }>;
      };

      const normalizedActions = (parsed.actions || []).slice(0, 3).map((a) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(a.argsJson || '{}') as Record<string, unknown>;
        } catch {
          args = {};
        }
        return { name: a.name, args };
      });

      res.json({
        shouldAct: Boolean(parsed.shouldAct) && normalizedActions.length > 0,
        reason: String(parsed.reason || 'Monitoring program audio and scene pacing.'),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0.5))),
        actions: normalizedActions,
      });
    } catch (err) {
      const { status, message } = extractUpstreamError(err);
      res.status(status).json({ error: message });
    }
  });

  // Gemini Post-Show Notes & Chapters Generator
  app.post('/api/ai/summary', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const studioData = req.body || {};
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Generate clean, publish-ready Show Notes, Key Takeaways, YouTube Chapter Timestamps (starting from 00:00), and Featured Products/Clips summary in Markdown from this live session:\n${JSON.stringify(
          studioData
        )}`,
        config: {
          systemInstruction:
            'You are a broadcast show notes editor. Output structured Markdown with crisp headings: Overview, Chapter Timestamps, Key Highlights, and Featured Links/Products.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({ markdown: (response.text || '').trim() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate show notes.';
      res.status(500).json({ error: message });
    }
  });

  // Gemini AI PDF Slide Deck Analyzer -> Per-Slide Teleprompter Cues & Banners
  app.post('/api/ai/pdf-analyze', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const deckName = String(req.body?.deckName || 'Presentation').slice(0, 100);
      const rawSlides = Array.isArray(req.body?.slideTexts)
        ? (req.body.slideTexts as unknown[])
        : Array.isArray(req.body?.slides)
        ? (req.body.slides as unknown[])
        : [];
      const slideTexts = rawSlides.slice(0, 20).map((s, idx) => {
        const rawText =
          typeof s === 'object' && s !== null && 'text' in s
            ? (s as { text?: unknown }).text
            : s;
        return {
          pageNumber: idx + 1,
          text: String(rawText || `Slide ${idx + 1}`).slice(0, 1200),
        };
      });

      if (slideTexts.length === 0) {
        res.status(400).json({ error: 'No slide text provided for analysis.' });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analyze this broadcast slide deck ("${deckName}") and produce concise speaker talking points, a natural conversational teleprompter script, a lower-third banner, and an optional audience poll question for each slide:\n${JSON.stringify(
          slideTexts
        )}`,
        config: {
          systemInstruction:
            'You are an executive broadcast producer. For each slide in the deck, craft punchy, high-clarity live delivery notes optimized for an eye-line teleprompter.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pageNumber: { type: Type.INTEGER },
                slideTitle: { type: Type.STRING },
                talkingPoints: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                teleprompterScript: { type: Type.STRING },
                suggestedBannerTitle: { type: Type.STRING },
                suggestedBannerSub: { type: Type.STRING },
                suggestedPollQuestion: { type: Type.STRING },
              },
              required: [
                'pageNumber',
                'slideTitle',
                'talkingPoints',
                'teleprompterScript',
                'suggestedBannerTitle',
                'suggestedBannerSub',
              ],
            },
          },
        },
      });

      const cues = JSON.parse((response.text || '[]').trim());
      res.json({ cues });
    } catch (err) {
      const { status, message } = extractUpstreamError(err);
      res.status(status).json({ error: message });
    }
  });

  // Gemini AI Magic Clips & Video Highlight Detector
  app.post('/api/ai/magic-clips', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const payload = req.body || {};
      const durationSec = Math.max(30, Number(payload.durationSec || 180));
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Identify 3 high-retention viral Magic Clips (each 15-45 seconds long within total duration ${durationSec}s) from this broadcast/video session:\n${JSON.stringify(
          payload
        )}`,
        config: {
          systemInstruction:
            'You are a short-form broadcast video editor (Riverside / Opus style). Return 3 distinct viral clip moments with scroll-stopping hook captions, exact start/end timestamps within the session duration, recommended aspect ratio (9:16 or 16:9), and why each clip converts.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                hookCaption: { type: Type.STRING },
                startSec: { type: Type.INTEGER },
                endSec: { type: Type.INTEGER },
                aspect: { type: Type.STRING },
                viralityReason: { type: Type.STRING },
                category: { type: Type.STRING },
              },
              required: [
                'id',
                'title',
                'hookCaption',
                'startSec',
                'endSec',
                'aspect',
                'viralityReason',
                'category',
              ],
            },
          },
        },
      });

      const clips = JSON.parse((response.text || '[]').trim());
      res.json({ clips });
    } catch (err) {
      const { status, message } = extractUpstreamError(err);
      res.status(status).json({ error: message });
    }
  });

  // Legacy Stage Graphic Spec Endpoint
  app.post('/api/ai/stage-graphic', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const prompt = String(req.body?.prompt || 'Modern optical glass broadcast studio').slice(
        0,
        300
      );
      const mode = String(req.body?.mode || 'backdrop');
      const studioTitle = String(req.body?.studioTitle || 'Gather Live').slice(0, 80);

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Design a cohesive broadcast art specification (${mode}) for show "${studioTitle}" matching creative direction: "${prompt}"`,
        config: {
          systemInstruction:
            'You are a broadcast motion-graphics art director. Output crisp hex colors (#RRGGBB), pattern choice (aurora, grid, rings, or prism), headline, subtitle, and badge text with high WCAG contrast.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              themeName: { type: Type.STRING },
              primaryHex: { type: Type.STRING },
              secondaryHex: { type: Type.STRING },
              tertiaryHex: { type: Type.STRING },
              surfaceHex: { type: Type.STRING },
              pattern: { type: Type.STRING },
              badgeText: { type: Type.STRING },
            },
            required: [
              'headline',
              'subtitle',
              'themeName',
              'primaryHex',
              'secondaryHex',
              'tertiaryHex',
              'surfaceHex',
              'pattern',
              'badgeText',
            ],
          },
        },
      });

      const spec = JSON.parse((response.text || '{}').trim());
      res.json({ spec });
    } catch (err) {
      const { status, message } = extractUpstreamError(err);
      res.status(status).json({ error: message });
    }
  });

  // Sanitize Gemini-authored vector SVG strings for safe browser rasterization
  const sanitizeSvgMarkup = (rawSvg: string, fallbackWidth = 1920, fallbackHeight = 1080): string => {
    let svg = String(rawSvg || '').trim();
    const startIdx = svg.indexOf('<svg');
    const endIdx = svg.lastIndexOf('</svg>');
    if (startIdx >= 0 && endIdx > startIdx) {
      svg = svg.slice(startIdx, endIdx + 6);
    } else {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fallbackWidth} ${fallbackHeight}" fill="none"><rect x="36" y="36" width="${fallbackWidth - 72}" height="${fallbackHeight - 72}" rx="28" stroke="#3B82F6" stroke-width="5"/></svg>`;
    }
    svg = svg
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/on[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/<image[^>]*href\s*=\s*(['"])\s*https?:[\s\S]*?>/gi, '');
    if (!/xmlns=/.test(svg)) {
      svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return svg.slice(0, 48000);
  };

  // Free-Tier Gemini 4 Hydrogen: Transparent Gaming HUDs, Webcam Frames, Backdrops, Logos & Covers
  app.post('/api/ai/overlay-svg', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const prompt = String(req.body?.prompt || 'Esports tactical obsidian HUD frame').slice(0, 320);
      const mode = String(req.body?.mode || 'hud-frame');
      const showTitle = String(req.body?.showTitle || 'Gather Live').slice(0, 60);
      const accentHex = String(req.body?.accentHex || req.body?.primaryHex || '#3B82F6').slice(0, 16);
      const secondaryHex = String(req.body?.secondaryHex || '#38BDF8').slice(0, 16);
      const stylePreset = String(req.body?.stylePreset || '').slice(0, 80);

      const isSquare = mode === 'logo' || mode === 'podcast-cover';
      const vbW = mode === 'logo' ? 512 : isSquare ? 1400 : 1920;
      const vbH = mode === 'logo' ? 512 : isSquare ? 1400 : 1080;

      const modeRules =
        mode === 'hud-frame'
          ? `Create a TRANSPARENT 16:9 esports/gaming broadcast HUD frame (viewBox="0 0 1920 1080"). CRITICAL: Do NOT fill the canvas background; leave the center viewport (x:100..1820, y:96..952) completely transparent so live video/gameplay shines through! Include chamfered angular corner brackets, a slim top telemetry/match header pill (height <= 56px), subtle corner scan-ticks, and clean glowing accent strokes.`
          : mode === 'webcam-frame'
          ? `Create a TRANSPARENT camera/facecam border overlay (viewBox="0 0 1920 1080"). CRITICAL: Leave the middle area completely transparent (no opaque background rect). Draw crisp rounded/beveled studio bezel frames around the perimeter, subtle registration crosshairs, and a sleek bottom-left presenter dock tag.`
          : mode === 'logo'
          ? `Create an iconic geometric brand emblem logo (viewBox="0 0 512 512") on transparent background using layered SVG gradients, sharp negative space, and modern tech/esports/commerce geometry.`
          : mode === 'podcast-cover'
          ? `Create a rich 1400x1400 square podcast cover artwork (viewBox="0 0 1400 1400") with full dark atmospheric vector backdrop, radial glows, crisp acoustic/orbital rings, bold display title, and clean host badge.`
          : mode === 'thumbnail'
          ? `Create a full-bleed 1920x1080 YouTube/Twitch stream thumbnail graphic (viewBox="0 0 1920 1080") with dramatic vector lighting gradients, bold headline typography, contrast scrim, and clean badge.`
          : `Create a full-bleed 1920x1080 architectural broadcast stage backdrop (viewBox="0 0 1920 1080") with deep obsidian or studio slate gradients, refined perspective lines, radial ambient glow, and subtle geometric depth — no cluttered body text.`;

      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Generate an art-directed broadcast SVG asset.
Mode: ${mode}
Show Title: "${showTitle}"
Requested Palette: Primary ${accentHex}, Secondary ${secondaryHex}
${stylePreset ? `Aesthetic Direction: ${stylePreset}\n` : ''}Creative Direction: "${prompt}"
Rules: ${modeRules}`,
          config: {
            systemInstruction:
              'You are an Emmy-awarded broadcast motion & esports overlay vector designer. Output clean valid SVG 1.1 markup in the "svg" field using <defs>, <linearGradient>, <radialGradient>, <path>, <rect>, <circle>, and <text> with Outfit/sans-serif or JetBrains Mono fonts. Never use <script> or external URLs.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                svg: { type: Type.STRING, description: `Complete <svg viewBox="0 0 ${vbW} ${vbH}">...</svg> string.` },
                title: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                primaryHex: { type: Type.STRING },
                secondaryHex: { type: Type.STRING },
                surfaceHex: { type: Type.STRING },
                badgeText: { type: Type.STRING },
                fontRecommendation: { type: Type.STRING },
              },
              required: [
                'svg',
                'title',
                'subtitle',
                'primaryHex',
                'secondaryHex',
                'surfaceHex',
                'badgeText',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text || '{}').trim()) as Record<string, string>;
      res.json({
        svg: sanitizeSvgMarkup(parsed.svg || '', vbW, vbH),
        title: String(parsed.title || showTitle).slice(0, 60),
        subtitle: String(parsed.subtitle || prompt).slice(0, 90),
        primaryHex: String(parsed.primaryHex || accentHex),
        secondaryHex: String(parsed.secondaryHex || '#38BDF8'),
        surfaceHex: String(parsed.surfaceHex || '#070C19'),
        badgeText: String(parsed.badgeText || 'LIVE').slice(0, 24),
        fontRecommendation: String(parsed.fontRecommendation || 'Plus Jakarta Sans'),
        width: vbW,
        height: vbH,
        transparent: mode === 'hud-frame' || mode === 'webcam-frame' || mode === 'logo',
      });
    } catch (err) {
      const { status, message } = extractUpstreamError(err);
      res.status(status).json({ error: message });
    }
  });

  // Free-Tier Gemini 4 Hydrogen: Iterative SVG Overlay Refinement
  app.post('/api/ai/overlay-refine', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const currentSvg = String(req.body?.currentSvg || req.body?.svg || '').slice(0, 48000);
      const instruction = String(req.body?.instruction || 'Sharpen contrast and corner bevels').slice(0, 240);
      const mode = String(req.body?.mode || 'hud-frame');
      const accentHex = String(req.body?.accentHex || '#3B82F6');
      if (!currentSvg) {
        res.status(400).json({ error: 'currentSvg is required for refinement.' });
        return;
      }

      const vbW = mode === 'logo' ? 512 : mode === 'podcast-cover' ? 1400 : 1920;
      const vbH = mode === 'logo' ? 512 : mode === 'podcast-cover' ? 1400 : 1080;

      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Refine this broadcast ${mode} SVG according to the user edit request while keeping its viewBox and transparent center intact (if overlay/logo):
User Edit Request: "${instruction}"
Preferred Accent: ${accentHex}
Current SVG:
${currentSvg}`,
          config: {
            systemInstruction:
              'You are a precision vector broadcast designer. Return an upgraded, valid SVG matching the refinement request without adding scripts or breaking transparency.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                svg: { type: Type.STRING },
                summary: { type: Type.STRING },
              },
              required: ['svg', 'summary'],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text || '{}').trim()) as { svg?: string; summary?: string };
      res.json({
        svg: sanitizeSvgMarkup(parsed.svg || currentSvg, vbW, vbH),
        summary: String(parsed.summary || 'Refined vector overlay.'),
      });
    } catch (err) {
      const { status, message } = extractUpstreamError(err);
      res.status(status).json({ error: message });
    }
  });

  // Free-Tier Gemini 4 Hydrogen: Complete Store Brand Kit & 3 Illustrated Products Generator
  app.post('/api/ai/brand-kit', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const concept = String(req.body?.concept || 'Modern Creator Hardware & Audio Gear Drop').slice(0, 320);
      const nicheRaw = String(req.body?.niche || 'commerce');
      const niche = ['gaming', 'commerce', 'podcast', 'creator'].includes(nicheRaw)
        ? nicheRaw
        : 'commerce';
      const showTitle = String(req.body?.showTitle || 'Gather Studio').slice(0, 60);

      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Design a complete cohesive Broadcast & Live Shop Brand Kit for concept: "${concept}" (Niche: ${niche}, Show Title: "${showTitle}").
Include:
1) Brand identity (storeName, storeTagline, palette hexes, preset styling)
2) logoSvg: sleek 512x512 vector emblem (<svg viewBox="0 0 512 512">...</svg>)
3) backdropSvg: sleek 1920x1080 dark/editorial studio stage backdrop (<svg viewBox="0 0 1920 1080">...</svg>)
4) overlaySvg: TRANSPARENT 1920x1080 corner frame / HUD overlay (<svg viewBox="0 0 1920 1080">...</svg>, leaving middle gameplay/video completely transparent!)
5) Exactly 3 distinctive shop products, each with a stylish crisp 512x512 product vector illustration in productSvg (<svg viewBox="0 0 512 512">...</svg>).`,
          config: {
            systemInstruction: `You are a world-class brand director for live broadcast studios and creator commerce brands.
Valid backdropPreset values: "dusk" | "graphite" | "ember" | "forest" | "paper".
Valid stageFont values: "Plus Jakarta Sans" | "Instrument Serif" | "JetBrains Mono" | "Oswald" | "Playfair Display".
Valid frameStyle values: "none" | "rounded" | "sharp" | "floating" | "cinema".
Valid nameTagStyle values: "glass" | "solid" | "outline" | "minimal".
Valid bannerStyle values: "breaking" | "classic" | "minimal" | "ticker".`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                storeName: { type: Type.STRING },
                storeTagline: { type: Type.STRING },
                accentHex: { type: Type.STRING },
                secondaryHex: { type: Type.STRING },
                backdropPreset: { type: Type.STRING },
                stageFont: { type: Type.STRING },
                frameStyle: { type: Type.STRING },
                nameTagStyle: { type: Type.STRING },
                bannerStyle: { type: Type.STRING },
                bannerTitle: { type: Type.STRING },
                bannerSubtitle: { type: Type.STRING },
                logoSvg: { type: Type.STRING },
                backdropSvg: { type: Type.STRING },
                overlaySvg: { type: Type.STRING },
                gameTitle: { type: Type.STRING },
                teamAName: { type: Type.STRING },
                teamBName: { type: Type.STRING },
                modeOrRank: { type: Type.STRING },
                products: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      price: { type: Type.NUMBER },
                      category: { type: Type.STRING },
                      description: { type: Type.STRING },
                      variants: { type: Type.ARRAY, items: { type: Type.STRING } },
                      productSvg: { type: Type.STRING },
                    },
                    required: ['title', 'price', 'category', 'description', 'variants', 'productSvg'],
                  },
                },
              },
              required: [
                'name',
                'storeName',
                'storeTagline',
                'accentHex',
                'secondaryHex',
                'backdropPreset',
                'stageFont',
                'frameStyle',
                'nameTagStyle',
                'bannerStyle',
                'bannerTitle',
                'bannerSubtitle',
                'logoSvg',
                'backdropSvg',
                'overlaySvg',
                'products',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text || '{}').trim()) as Record<string, unknown>;
      const validPresets = ['dusk', 'graphite', 'ember', 'forest', 'paper'];
      const validFonts = ['Plus Jakarta Sans', 'Instrument Serif', 'JetBrains Mono', 'Oswald', 'Playfair Display'];
      const validFrames = ['none', 'rounded', 'sharp', 'floating', 'cinema'];
      const validTags = ['glass', 'solid', 'outline', 'minimal'];
      const validBanners = ['breaking', 'classic', 'minimal', 'ticker'];

      const rawProducts = Array.isArray(parsed.products) ? parsed.products : [];
      const products = rawProducts.slice(0, 3).map((item, idx) => {
        const p = (item || {}) as Record<string, unknown>;
        return {
          title: String(p.title || `Studio Edition #${idx + 1}`).slice(0, 64),
          price: Math.max(1, Math.round(Number(p.price || 48))),
          category: String(p.category || 'Limited Drop').slice(0, 32),
          description: String(p.description || 'Crafted for live broadcast audiences.').slice(0, 200),
          variants: Array.isArray(p.variants)
            ? p.variants.slice(0, 4).map((v) => String(v).slice(0, 24))
            : ['Standard'],
          productSvg: sanitizeSvgMarkup(String(p.productSvg || ''), 512, 512),
        };
      });

      res.json({
        name: String(parsed.name || `${parsed.storeName || 'Custom'} Kit`).slice(0, 60),
        niche,
        storeName: String(parsed.storeName || showTitle).slice(0, 60),
        storeTagline: String(parsed.storeTagline || 'Curated live broadcast drop').slice(0, 120),
        accentHex: String(parsed.accentHex || '#3B82F6').slice(0, 16),
        secondaryHex: String(parsed.secondaryHex || '#38BDF8').slice(0, 16),
        backdropPreset: validPresets.includes(String(parsed.backdropPreset)) ? String(parsed.backdropPreset) : 'dusk',
        stageFont: validFonts.includes(String(parsed.stageFont)) ? String(parsed.stageFont) : 'Plus Jakarta Sans',
        frameStyle: validFrames.includes(String(parsed.frameStyle)) ? String(parsed.frameStyle) : 'rounded',
        nameTagStyle: validTags.includes(String(parsed.nameTagStyle)) ? String(parsed.nameTagStyle) : 'glass',
        bannerStyle: validBanners.includes(String(parsed.bannerStyle)) ? String(parsed.bannerStyle) : 'classic',
        bannerTitle: String(parsed.bannerTitle || parsed.storeName || showTitle).slice(0, 64),
        bannerSubtitle: String(parsed.bannerSubtitle || parsed.storeTagline || 'Live on Gather').slice(0, 96),
        logoSvg: sanitizeSvgMarkup(String(parsed.logoSvg || ''), 512, 512),
        backdropSvg: sanitizeSvgMarkup(String(parsed.backdropSvg || ''), 1920, 1080),
        overlaySvg: sanitizeSvgMarkup(String(parsed.overlaySvg || ''), 1920, 1080),
        gamerHud:
          niche === 'gaming'
            ? {
                gameTitle: String(parsed.gameTitle || 'Live Arena').slice(0, 48),
                teamAName: String(parsed.teamAName || 'Home').slice(0, 24),
                teamBName: String(parsed.teamBName || 'Away').slice(0, 24),
                modeOrRank: String(parsed.modeOrRank || 'FINALS').slice(0, 24),
              }
            : undefined,
        products,
      });
    } catch (err) {
      const { status, message } = extractUpstreamError(err);
      res.status(status).json({ error: message });
    }
  });

  // Free-Tier Gemini 3.8 TTS: Broadcast Voice Stinger & Dual-Speaker Hype Drop Generator
  app.post('/api/ai/voice-stinger', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const script = String(req.body?.script || 'Welcome back to the stream — live drops are open right now!').slice(0, 380);
      const voiceName = String(req.body?.voiceName || 'Kore');
      const allowedVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
      const primaryVoice = allowedVoices.includes(voiceName) ? voiceName : 'Kore';
      const dualSpeaker = Boolean(req.body?.dualSpeaker);
      const mood = String(req.body?.mood || 'Crisp, energetic broadcast announcer').slice(0, 100);
      const secondVoiceRaw = String(req.body?.secondVoiceName || 'Puck');
      const secondVoice = allowedVoices.includes(secondVoiceRaw) && secondVoiceRaw !== primaryVoice
        ? secondVoiceRaw
        : primaryVoice === 'Puck'
        ? 'Kore'
        : 'Puck';

      let modelUsed = 'gemini-3.8-flash-lite-tts';
      let response;

      if (dualSpeaker) {
        modelUsed = 'gemini-3.8-flash-tts';
        const lines = script.split('\n').map((l) => l.trim()).filter(Boolean);
        const lineA = (lines[0] || `Host: ${script}`).replace(/^Host:\s*/i, '');
        const lineB = (lines[1] || 'CoHost: |yeah| Let us kick things off live on Gather!').replace(/^CoHost:\s*/i, '');

        response = await withGeminiRetry(() =>
          ai.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `Host: ${lineA}`,
                    speechMetadata: { speaker: 'Host', style: mood },
                  },
                  {
                    text: `CoHost: ${lineB}`,
                    speechMetadata: { speaker: 'CoHost', style: 'Bright, upbeat co-host reaction' },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: [
                    { speaker: 'Host', voiceConfig: { prebuiltVoiceConfig: { voiceName: primaryVoice } } },
                    { speaker: 'CoHost', voiceConfig: { prebuiltVoiceConfig: { voiceName: secondVoice } } },
                  ],
                },
              },
            },
          })
        );
      } else {
        response = await withGeminiRetry(() =>
          ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: script,
                    speechMetadata: { style: mood },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: primaryVoice },
                },
              },
            },
          })
        );
      }

      const parts = response.candidates?.[0]?.content?.parts || [];
      const audioPart = parts.find((p) => p.inlineData?.data);
      const base64Audio = audioPart?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Gemini TTS did not return audio bytes. Please try again.' });
        return;
      }

      res.json({
        audioDataUrl: `data:audio/wav;base64,${base64Audio}`,
        mimeType: audioPart?.inlineData?.mimeType || 'audio/wav',
        modelUsed,
        title: script.slice(0, 32),
      });
    } catch (err) {
      const { status, message } = extractUpstreamError(err);
      res.status(status).json({ error: message });
    }
  });

  // Free-Tier Gemini 4 Hydrogen: Structured Broadcast Synth Music Composition Spec
  app.post('/api/ai/music-spec', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const prompt = String(req.body?.prompt || 'Warm electronic lo-fi broadcast intermission groove').slice(0, 260);
      const mood = String(req.body?.mood || 'lofi').slice(0, 48);
      const durationSec = Math.max(4, Math.min(16, Number(req.body?.durationSec || 8)));

      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Compose an original loopable stereo synth/drum groove specification (${durationSec}s, mood: ${mood}) matching: "${prompt}"`,
          config: {
            systemInstruction:
              'You are a broadcast sound designer. Output structured musical parameters for a browser OfflineAudioContext synthesizer: bpm (72..144), keyRootMidi (45..64), scaleIntervals (array of 5..7 semitone offsets like [0,2,4,7,9]), chordProgression (4 root scale degree indices 0..6), leadPattern (8 16th-note scale step indices or -1 for rest), bassPattern (8 8th-note scale step indices), drumIntensity (0..1), synthTimbre ("warm-pad" | "synthwave-pluck" | "esports-bass" | "lofi-keys").',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                bpm: { type: Type.INTEGER },
                keyRootMidi: { type: Type.INTEGER },
                scaleIntervals: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                chordProgression: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                leadPattern: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                bassPattern: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                drumIntensity: { type: Type.NUMBER },
                synthTimbre: { type: Type.STRING },
              },
              required: [
                'title',
                'bpm',
                'keyRootMidi',
                'scaleIntervals',
                'chordProgression',
                'leadPattern',
                'bassPattern',
                'drumIntensity',
                'synthTimbre',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text || '{}').trim()) as Record<string, unknown>;
      const validTimbres = ['warm-pad', 'synthwave-pluck', 'esports-bass', 'lofi-keys'];
      res.json({
        spec: {
          title: String(parsed.title || 'AI Broadcast Loop').slice(0, 42),
          bpm: Math.max(70, Math.min(150, Math.round(Number(parsed.bpm || 110)))),
          keyRootMidi: Math.max(42, Math.min(67, Math.round(Number(parsed.keyRootMidi || 53)))),
          scaleIntervals: Array.isArray(parsed.scaleIntervals) && parsed.scaleIntervals.length > 0
            ? parsed.scaleIntervals.slice(0, 8).map((n) => Number(n) || 0)
            : [0, 2, 4, 7, 9],
          chordProgression: Array.isArray(parsed.chordProgression) && parsed.chordProgression.length > 0
            ? parsed.chordProgression.slice(0, 4).map((n) => Math.max(0, Math.round(Number(n) || 0)))
            : [0, 3, 4, 2],
          leadPattern: Array.isArray(parsed.leadPattern) && parsed.leadPattern.length > 0
            ? parsed.leadPattern.slice(0, 16).map((n) => Math.round(Number(n)))
            : [0, 2, 4, -1, 3, 2, 1, -1],
          bassPattern: Array.isArray(parsed.bassPattern) && parsed.bassPattern.length > 0
            ? parsed.bassPattern.slice(0, 8).map((n) => Math.round(Number(n)))
            : [0, 0, 2, 0, 3, 3, 4, 2],
          drumIntensity: Math.max(0, Math.min(1, Number(parsed.drumIntensity ?? 0.65))),
          synthTimbre: validTimbres.includes(String(parsed.synthTimbre))
            ? String(parsed.synthTimbre)
            : 'warm-pad',
          durationSec,
        },
      });
    } catch (err) {
      const { status, message } = extractUpstreamError(err);
      res.status(status).json({ error: message });
    }
  });

  // Free-Tier Gemini 4 Hydrogen: Kinetic Video Motion Bumper Choreography Spec
  app.post('/api/ai/motion-bumper-spec', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const prompt = String(req.body?.prompt || 'Starting Soon kinetic countdown bumper').slice(0, 240);
      const bumperType = String(req.body?.bumperType || 'starting-soon').slice(0, 32);
      const showTitle = String(req.body?.showTitle || 'Gather Live').slice(0, 60);
      const accentHex = String(req.body?.accentHex || '#3B82F6').slice(0, 16);
      const aspectRatio = req.body?.aspectRatio === '9:16' ? '9:16' : '16:9';
      const durationSec = Math.max(3, Math.min(8, Number(req.body?.durationSec || 5)));

      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Choreograph a ${durationSec}s broadcast motion-graphic video bumper (${bumperType}, ${aspectRatio}) for "${showTitle}" matching: "${prompt}"`,
          config: {
            systemInstruction:
              'You are a kinetic broadcast title designer. Return concise, high-impact title, subtitle, badgeText, primaryHex, secondaryHex, surfaceHex, and motionStyle ("aurora-pulse" | "esports-slash" | "kinetic-grid" | "countdown-ring").',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                headline: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                badgeText: { type: Type.STRING },
                primaryHex: { type: Type.STRING },
                secondaryHex: { type: Type.STRING },
                surfaceHex: { type: Type.STRING },
                motionStyle: { type: Type.STRING },
              },
              required: [
                'title',
                'headline',
                'subtitle',
                'badgeText',
                'primaryHex',
                'secondaryHex',
                'surfaceHex',
                'motionStyle',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text || '{}').trim()) as Record<string, string>;
      const styles = ['aurora-pulse', 'esports-slash', 'kinetic-grid', 'countdown-ring'];
      res.json({
        spec: {
          title: String(parsed.title || `${bumperType} Bumper`).slice(0, 48),
          headline: String(parsed.headline || showTitle).slice(0, 44),
          subtitle: String(parsed.subtitle || 'Broadcast begins momentarily').slice(0, 80),
          badgeText: String(parsed.badgeText || 'LIVE STUDIO').slice(0, 22),
          primaryHex: String(parsed.primaryHex || accentHex),
          secondaryHex: String(parsed.secondaryHex || '#38BDF8'),
          surfaceHex: String(parsed.surfaceHex || '#060A16'),
          motionStyle: styles.includes(String(parsed.motionStyle))
            ? String(parsed.motionStyle)
            : 'aurora-pulse',
          aspectRatio,
          durationSec,
        },
      });
    } catch (err) {
      const { status, message } = extractUpstreamError(err);
      res.status(status).json({ error: message });
    }
  });
}
