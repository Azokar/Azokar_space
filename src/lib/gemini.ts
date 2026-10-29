/** Cliente mínimo de Gemini. La clave viaja en una cabecera (no en la URL, para que no quede en registros) y por HTTPS. */
// Si un modelo está saturado (503) o sin cuota (429), se prueba el siguiente: los límites del plan gratuito son por modelo.
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const endpoint = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const TIMEOUT_MS = 20000;
const RETRY_STATUS = new Set([404, 429, 500, 502, 503, 504]);

export type GeminiErrorCode = 'key' | 'quota' | 'busy' | 'network' | 'format' | 'blocked';
export class GeminiError extends Error {
  constructor(public code: GeminiErrorCode, message: string) { super(message); }
}

type Attempt = { response: Response } | { networkError: true };

async function attempt(model: string, apiKey: string, system: string, userText: string): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(endpoint(model), {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    });
    return { response };
  } catch { return { networkError: true }; }
  finally { clearTimeout(timer); }
}

/** Envía la instrucción y el texto del usuario y devuelve el JSON que responde el modelo. */
export async function askGemini(apiKey: string, system: string, userText: string): Promise<unknown> {
  let lastStatus = 0;
  let networkFailed = false;
  for (const model of MODELS) {
    const result = await attempt(model, apiKey, system, userText);
    if ('networkError' in result) { networkFailed = true; continue; }
    const { response } = result;
    if (response.status === 400 || response.status === 401 || response.status === 403) throw new GeminiError('key', 'Gemini rechazó tu clave. Revísala o vuelve a pegarla en tu perfil.');
    if (!response.ok) {
      lastStatus = response.status;
      if (RETRY_STATUS.has(response.status)) continue;
      throw new GeminiError('network', `Gemini no respondió bien (error ${response.status}). Inténtalo de nuevo.`);
    }
    const body = await response.json().catch(() => null) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
    const text = body?.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('') ?? '';
    if (!text) throw new GeminiError('blocked', 'Gemini no devolvió una respuesta para ese mensaje. Reformúlalo.');
    try { return JSON.parse(text); }
    catch { throw new GeminiError('format', 'No pude entender la respuesta de Gemini. Inténtalo de nuevo.'); }
  }
  if (lastStatus === 429) throw new GeminiError('quota', 'Llegaste al límite gratuito de Gemini. Espera un minuto e inténtalo otra vez.');
  if (lastStatus > 0) throw new GeminiError('busy', 'Los servidores de Gemini están saturados ahora mismo. Inténtalo de nuevo en unos segundos.');
  if (networkFailed) throw new GeminiError('network', 'No se pudo conectar con Gemini. Revisa tu conexión e inténtalo de nuevo.');
  throw new GeminiError('network', 'No se pudo conectar con Gemini.');
}
