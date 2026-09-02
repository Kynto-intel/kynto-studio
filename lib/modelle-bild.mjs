// KATALOG: BILDMODELLE (OpenRouter)
// Ausschliesslich Daten und Nachladen. Keine Aufruf-Logik - die steht in
// anbieter-openrouter-bild.mjs.
//
// ACHTUNG: OpenRouters /api/v1/models gibt Bildmodelle NICHT aus.
// Nur mit ?output_modalities=image.

const OR = 'https://openrouter.ai/api/v1/models?output_modalities=image';

/** OpenRouter. Kostet, kann dafuer Referenzbild und Text im Bild. */
export const OPENROUTER = [
  // Google Nano Banana
  { id: 'google/gemini-3-pro-image', name: 'Nano Banana Pro', gruppe: 'Google', kannReferenz: true, notiz: 'Beste Textwiedergabe im Bild.' },
  { id: 'google/gemini-3.1-flash-image', name: 'Nano Banana 2', gruppe: 'Google', kannReferenz: true, notiz: 'Guter Alltagsstandard.' },
  { id: 'google/gemini-3.1-flash-lite-image', name: 'Nano Banana 2 Lite', gruppe: 'Google', kannReferenz: true, notiz: 'Guenstigste Google-Variante.' },
  { id: 'google/gemini-2.5-flash-image', name: 'Nano Banana', gruppe: 'Google', kannReferenz: true, notiz: 'Vorgaenger, weiter brauchbar.' },
  { id: 'google/gemini-3-pro-image-preview', name: 'Nano Banana Pro (Preview)', gruppe: 'Google', kannReferenz: true, notiz: '' },
  { id: 'google/gemini-3.1-flash-image-preview', name: 'Nano Banana 2 (Preview)', gruppe: 'Google', kannReferenz: true, notiz: '' },

  // OpenAI
  { id: 'openai/gpt-image-2', name: 'GPT Image 2', gruppe: 'OpenAI', kannReferenz: true, notiz: 'Stark bei Text im Bild.' },
  { id: 'openai/gpt-5.4-image-2', name: 'GPT-5.4 Image 2', gruppe: 'OpenAI', kannReferenz: true, notiz: '' },
  { id: 'openai/gpt-5-image', name: 'GPT-5 Image', gruppe: 'OpenAI', kannReferenz: true, notiz: '' },
  { id: 'openai/gpt-5-image-mini', name: 'GPT-5 Image Mini', gruppe: 'OpenAI', kannReferenz: true, notiz: 'Guenstig.' },
  { id: 'openai/gpt-image-1', name: 'GPT Image 1', gruppe: 'OpenAI', kannReferenz: true, notiz: '' },
  { id: 'openai/gpt-image-1-mini', name: 'GPT Image 1 Mini', gruppe: 'OpenAI', kannReferenz: true, notiz: '' },

  // Black Forest Labs
  { id: 'black-forest-labs/flux.2-max', name: 'FLUX.2 Max', gruppe: 'Black Forest Labs', kannReferenz: true, notiz: 'Hoechste FLUX-Stufe.' },
  { id: 'black-forest-labs/flux.2-pro', name: 'FLUX.2 Pro', gruppe: 'Black Forest Labs', kannReferenz: true, notiz: '' },
  { id: 'black-forest-labs/flux.2-flex', name: 'FLUX.2 Flex', gruppe: 'Black Forest Labs', kannReferenz: true, notiz: '' },
  { id: 'black-forest-labs/flux.2-klein-4b', name: 'FLUX.2 Klein 4B', gruppe: 'Black Forest Labs', kannReferenz: true, notiz: 'Kleinstes FLUX.2, guenstig.' },

  // ByteDance Seedream
  { id: 'bytedance-seed/seedream-5-0-pro', name: 'Seedream 5.0 Pro', gruppe: 'ByteDance', kannReferenz: true, notiz: '' },
  { id: 'bytedance-seed/seedream-5-0-lite', name: 'Seedream 5.0 Lite', gruppe: 'ByteDance', kannReferenz: true, notiz: '' },
  { id: 'bytedance-seed/seedream-4.5', name: 'Seedream 4.5', gruppe: 'ByteDance', kannReferenz: true, notiz: '' },

  // Krea
  { id: 'krea/krea-2-large', name: 'Krea 2 Large', gruppe: 'Krea', kannReferenz: true, notiz: 'Kraeftige Aesthetik.' },
  { id: 'krea/krea-2-medium', name: 'Krea 2 Medium', gruppe: 'Krea', kannReferenz: true, notiz: '' },
  { id: 'krea/krea-2-medium-turbo', name: 'Krea 2 Medium Turbo', gruppe: 'Krea', kannReferenz: true, notiz: '' },

  // Qwen / Microsoft / xAI / Sourceful
  { id: 'qwen/qwen-image-3-pro', name: 'Qwen Image 3 Pro', gruppe: 'Weitere', kannReferenz: true, notiz: '' },
  { id: 'qwen/qwen-image-3', name: 'Qwen Image 3', gruppe: 'Weitere', kannReferenz: true, notiz: '' },
  { id: 'microsoft/mai-image-2.5-pro', name: 'MAI-Image 2.5 Pro', gruppe: 'Weitere', kannReferenz: true, notiz: '' },
  { id: 'microsoft/mai-image-2.5', name: 'MAI-Image 2.5', gruppe: 'Weitere', kannReferenz: true, notiz: '' },
  { id: 'x-ai/grok-imagine-image-2.0', name: 'Grok Imagine Image 2.0', gruppe: 'Weitere', kannReferenz: true, notiz: '' },
  { id: 'x-ai/grok-imagine-image-quality', name: 'Grok Imagine Quality', gruppe: 'Weitere', kannReferenz: true, notiz: '' },
  { id: 'sourceful/riverflow-v2.5-pro', name: 'Riverflow V2.5 Pro', gruppe: 'Weitere', kannReferenz: true, notiz: '' },
  { id: 'sourceful/riverflow-v2.5-fast', name: 'Riverflow V2.5 Fast', gruppe: 'Weitere', kannReferenz: true, notiz: '' },
  { id: 'sourceful/riverflow-v2-pro', name: 'Riverflow V2 Pro', gruppe: 'Weitere', kannReferenz: true, notiz: '' },
  { id: 'sourceful/riverflow-v2-fast', name: 'Riverflow V2 Fast', gruppe: 'Weitere', kannReferenz: true, notiz: '' },

  // Recraft - Vektor und Logo
  { id: 'recraft/recraft-v4.1-pro', name: 'Recraft V4.1 Pro', gruppe: 'Recraft (Vektor/Logo)', kannReferenz: true, notiz: '' },
  { id: 'recraft/recraft-v4.1', name: 'Recraft V4.1', gruppe: 'Recraft (Vektor/Logo)', kannReferenz: true, notiz: '' },
  { id: 'recraft/recraft-v4.1-pro-vector', name: 'Recraft V4.1 Pro Vektor', gruppe: 'Recraft (Vektor/Logo)', kannReferenz: true, notiz: 'Fuer Shirt-Designs interessant.' },
  { id: 'recraft/recraft-v4.1-vector', name: 'Recraft V4.1 Vektor', gruppe: 'Recraft (Vektor/Logo)', kannReferenz: true, notiz: '' },
  { id: 'recraft/recraft-v4.1-utility-pro', name: 'Recraft V4.1 Utility Pro', gruppe: 'Recraft (Vektor/Logo)', kannReferenz: true, notiz: '' },
  { id: 'recraft/recraft-v4.1-utility', name: 'Recraft V4.1 Utility', gruppe: 'Recraft (Vektor/Logo)', kannReferenz: true, notiz: '' },
  { id: 'recraft/recraft-v4-pro', name: 'Recraft V4 Pro', gruppe: 'Recraft (Vektor/Logo)', kannReferenz: true, notiz: '' },
  { id: 'recraft/recraft-v4', name: 'Recraft V4', gruppe: 'Recraft (Vektor/Logo)', kannReferenz: true, notiz: '' },
  { id: 'recraft/recraft-v4-pro-vector', name: 'Recraft V4 Pro Vektor', gruppe: 'Recraft (Vektor/Logo)', kannReferenz: true, notiz: '' },
  { id: 'recraft/recraft-v4-vector', name: 'Recraft V4 Vektor', gruppe: 'Recraft (Vektor/Logo)', kannReferenz: true, notiz: '' },
  { id: 'recraft/recraft-v3', name: 'Recraft V3', gruppe: 'Recraft (Vektor/Logo)', kannReferenz: true, notiz: '' },
];

/** Alle Bildmodelle. */
export function alle() {
  return OPENROUTER.map((m) => ({ ...m, anbieter: 'openrouter' }));
}

export function finde(id) {
  return alle().find((m) => m.id === id) || null;
}

/**
 * Holt die aktuelle Liste live von OpenRouter nach.
 * Die eingebaute Liste ist nur der Startbestand - so veraltet der Katalog
 * nicht, wenn OpenRouter Modelle nachlegt.
 */
export async function aktualisiere() {
  const antwort = await fetch(OR, { headers: { accept: 'application/json' } });
  if (!antwort.ok) throw new Error(`OpenRouter antwortete mit ${antwort.status}`);
  const roh = (await antwort.json()).data || [];
  const bekannt = new Map(OPENROUTER.map((m) => [m.id, m]));
  return roh
    .filter((m) => !m.id.startsWith('openrouter/auto')) // Router, kein Bildmodell
    .map((m) => {
      const alt = bekannt.get(m.id);
      return {
        id: m.id,
        name: alt?.name || m.name || m.id,
        gruppe: alt?.gruppe || 'Neu bei OpenRouter',
        kannReferenz: (m.architecture?.input_modalities || []).includes('image'),
        notiz: alt?.notiz || '',
        anbieter: 'openrouter',
        neu: !alt,
      };
    });
}
