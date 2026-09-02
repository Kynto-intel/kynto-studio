// KATALOG: VIDEOMODELLE
// Ausschliesslich Daten und Nachladen. Keine Aufruf-Logik - die steht in
// anbieter-openrouter-video.mjs.
//
// ACHTUNG: OpenRouters /api/v1/models gibt Videomodelle NICHT aus.
// Nur mit ?output_modalities=video. Genau daran bin ich beim Pruefen
// dreimal vorbeigelaufen und habe faelschlich behauptet, es gaebe keine.

const OR = 'https://openrouter.ai/api/v1/models?output_modalities=video';

/**
 * kannBildEingang = taugt fuer Bild -> Video (Standbild animieren).
 * flux-video-upscale nimmt Video statt Standbild und faellt deshalb raus.
 */
export const OPENROUTER = [
  // Google Veo
  { id: 'google/veo-3.1-fast', name: 'Veo 3.1 Fast', gruppe: 'Google Veo', kannBildEingang: true, notiz: 'Guenstige Alltagswahl. Erster Test hiermit.' },
  { id: 'google/veo-3.1', name: 'Veo 3.1', gruppe: 'Google Veo', kannBildEingang: true, notiz: 'Beste Google-Qualitaet, teurer.' },
  { id: 'google/veo-3.1-lite', name: 'Veo 3.1 Lite', gruppe: 'Google Veo', kannBildEingang: true, notiz: '' },

  // Kling
  { id: 'kwaivgi/kling-v3.0-std', name: 'Kling v3.0 Standard', gruppe: 'Kling', kannBildEingang: true, notiz: 'Guenstige Alltagswahl.' },
  { id: 'kwaivgi/kling-v3.0-pro', name: 'Kling v3.0 Pro', gruppe: 'Kling', kannBildEingang: true, notiz: 'Sehr gute Bewegung.' },
  { id: 'kwaivgi/kling-video-o1', name: 'Kling Video O1', gruppe: 'Kling', kannBildEingang: true, notiz: '' },

  // Runway
  { id: 'runway/gen-4.5', name: 'Runway Gen-4.5', gruppe: 'Runway', kannBildEingang: true, notiz: 'Filmische Kamerafahrten.' },
  { id: 'runway/aleph-2', name: 'Runway Aleph 2.0', gruppe: 'Runway', kannBildEingang: true, notiz: '' },

  // OpenAI
  { id: 'openai/sora-2-pro', name: 'Sora 2 Pro', gruppe: 'OpenAI', kannBildEingang: true, notiz: 'Teuer, fuer den seltenen guten Clip.' },

  // ByteDance Seedance
  { id: 'bytedance/seedance-2.5', name: 'Seedance 2.5', gruppe: 'ByteDance', kannBildEingang: true, notiz: '' },
  { id: 'bytedance/seedance-2.0', name: 'Seedance 2.0', gruppe: 'ByteDance', kannBildEingang: true, notiz: '' },
  { id: 'bytedance/seedance-2.0-fast', name: 'Seedance 2.0 Fast', gruppe: 'ByteDance', kannBildEingang: true, notiz: '' },
  { id: 'bytedance/seedance-2.0-mini', name: 'Seedance 2.0 Mini', gruppe: 'ByteDance', kannBildEingang: true, notiz: 'Guenstig.' },
  { id: 'bytedance/seedance-1-5-pro', name: 'Seedance 1.5 Pro', gruppe: 'ByteDance', kannBildEingang: true, notiz: '' },

  // MiniMax
  { id: 'minimax/hailuo-3', name: 'MiniMax H3', gruppe: 'MiniMax', kannBildEingang: true, notiz: '' },
  { id: 'minimax/hailuo-2.3', name: 'MiniMax Hailuo 2.3', gruppe: 'MiniMax', kannBildEingang: true, notiz: '' },

  // Alibaba
  { id: 'alibaba/wan-2.7', name: 'Wan 2.7', gruppe: 'Alibaba', kannBildEingang: true, notiz: '' },
  { id: 'alibaba/wan-2.6', name: 'Wan 2.6', gruppe: 'Alibaba', kannBildEingang: true, notiz: '' },
  { id: 'alibaba/happyhorse-1.1', name: 'HappyHorse 1.1', gruppe: 'Alibaba', kannBildEingang: true, notiz: '' },
  { id: 'alibaba/happyhorse-1.0', name: 'HappyHorse 1.0', gruppe: 'Alibaba', kannBildEingang: true, notiz: '' },

  // xAI
  { id: 'x-ai/grok-imagine-video-1.5', name: 'Grok Imagine Video 1.5', gruppe: 'xAI', kannBildEingang: true, notiz: '' },
  { id: 'x-ai/grok-imagine-video', name: 'Grok Imagine Video', gruppe: 'xAI', kannBildEingang: true, notiz: '' },

  // Black Forest Labs
  { id: 'black-forest-labs/flux-3-video', name: 'FLUX.3 Video', gruppe: 'Black Forest Labs', kannBildEingang: true, notiz: '' },
  { id: 'black-forest-labs/flux-video-upscale', name: 'FLUX Video Upscale', gruppe: 'Black Forest Labs', kannBildEingang: false, notiz: 'Nimmt Video statt Standbild - nur zum Nachschaerfen fertiger Clips.' },
];

/** Alle Videomodelle. */
export function alle() {
  return OPENROUTER.map((m) => ({ ...m, anbieter: 'openrouter' }));
}

/** Nur die, mit denen sich ein Standbild animieren laesst. */
export function fuerBildZuVideo() {
  return alle().filter((m) => m.kannBildEingang);
}

export function finde(id) {
  return alle().find((m) => m.id === id) || null;
}

/** Holt die aktuelle Liste live von OpenRouter nach. */
export async function aktualisiere() {
  const antwort = await fetch(OR, { headers: { accept: 'application/json' } });
  if (!antwort.ok) throw new Error(`OpenRouter antwortete mit ${antwort.status}`);
  const roh = (await antwort.json()).data || [];
  const bekannt = new Map(OPENROUTER.map((m) => [m.id, m]));
  return roh.map((m) => {
    const alt = bekannt.get(m.id);
    return {
      id: m.id,
      name: alt?.name || m.name || m.id,
      gruppe: alt?.gruppe || 'Neu bei OpenRouter',
      kannBildEingang: (m.architecture?.input_modalities || []).includes('image'),
      notiz: alt?.notiz || '',
      anbieter: 'openrouter',
      neu: !alt,
    };
  });
}
