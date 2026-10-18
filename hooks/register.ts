import type { EngineInterface, Register } from 'claude-code'

// Voci del Mac provate in ordine (maschili italiane, gratuite). La prima installata vince.
const DEFAULT_VOICES = ['Luca (ottimizzata)', 'Luca (Enhanced)', 'Luca (Premium)', 'Luca', 'Reed', 'Eddy', 'Rocko', 'Alice']

// La voce esce dal browser integrato dell'app Claude sul Mac: la sessione Cowork gira nel cloud,
// dove non c'è sintesi vocale, quindi Jarvis fa parlare la pagina tramite il collegamento al Mac.
const DEVICE = 'remote-devices'
const JS_TOOL = 'Claude_Browser__javascript_tool'
const OPEN_TOOL = 'Claude_Browser__preview_start'
const HOME_URL = 'https://example.com'

// Voce neurale gratuita (Kokoro, open source) generata nella sessione e suonata dal Mac.
const NEURAL_PY = '/home/claude/tts/venv/bin/python'
const NEURAL_SCRIPT = '/home/claude/tts/say.py'
const NEURAL_VOICES: Record<string, string> = { nicola: 'im_nicola', sara: 'if_sara', im_nicola: 'im_nicola', if_sara: 'if_sara' }

type Mode = 'briefing' | 'tutto' | 'off'

const HELP = [
  'Jarvis: comandi disponibili',
  '/jarvis prova: fa una prova della voce',
  '/jarvis ripeti: rilegge l\'ultimo briefing',
  '/jarvis briefing: legge solo la sezione "Briefing" (predefinito)',
  '/jarvis tutto: legge tutta la risposta finale',
  '/jarvis off: silenzia Jarvis',
  '/jarvis voce <nome>: usa una voce precisa del Mac (es. "Luca (Premium)")',
  '/jarvis voce auto: torna alla scelta automatica',
].join('\n')

/** Estrae il testo dopo l'intestazione "Briefing" (con o senza 🎙️). */
export function extractBriefing(answer: string): string | undefined {
  const match = answer.match(/^[#>*\s]*(?:🎙️|🎙)?\s*\**\s*briefing\b[^\n]*\n([\s\S]*)$/im)
  if (!match) return undefined
  // Si ferma alla sezione successiva, se c'è.
  const body = match[1].split(/\n#{1,6}\s/)[0]
  const clean = toSpeech(body)
  return clean.length > 0 ? clean : undefined
}

/** Toglie markdown, link, codice ed emoji: resta testo da leggere. */
export function toSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^#+\s*/gm, '')
    .replace(/[*_~>|#]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function getMode($: EngineInterface): Promise<Mode> {
  const m = await $.store.get('mode')
  return m === 'tutto' || m === 'off' ? m : 'briefing'
}

function speechScript(text: string, voices: string[]): string {
  return `(async () => {
  const want = ${JSON.stringify(voices)};
  let vs = speechSynthesis.getVoices();
  if (!vs.length) vs = await new Promise(r => { speechSynthesis.onvoiceschanged = () => r(speechSynthesis.getVoices()); setTimeout(() => r(speechSynthesis.getVoices()), 1500) });
  const it = vs.filter(v => v.lang && v.lang.startsWith('it'));
  let pick;
  for (const w of want) { pick = vs.find(v => v.name === w || v.name.startsWith(w + ' ')); if (pick) break }
  pick = pick || it[0];
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(${JSON.stringify(text)});
  u.lang = 'it-IT'; u.rate = 1.0; u.pitch = 0.9;
  if (pick) u.voice = pick;
  speechSynthesis.speak(u);
  return 'JARVIS_OK:' + (pick ? pick.name : 'predefinita');
})()`
}

function textOf(result: { content?: unknown; isError?: boolean }): string {
  const blocks = Array.isArray(result.content) ? result.content : []
  return blocks.map(b => (b && typeof b === 'object' && 'text' in b ? String((b as { text: unknown }).text) : '')).join('\n')
}

async function runInBrowser($: EngineInterface, script: string): Promise<string> {
  let out = textOf(await $.mcp.call(DEVICE, JS_TOOL, { action: 'javascript_exec', text: script }))
  if (!/JARVIS_OK:/.test(out)) {
    // Il browser integrato non è aperto: lo apre e riprova.
    await $.mcp.call(DEVICE, OPEN_TOOL, { url: HOME_URL })
    await $.clock.sleep(2500)
    out = textOf(await $.mcp.call(DEVICE, JS_TOOL, { action: 'javascript_exec', text: script }))
  }
  const m = out.match(/JARVIS_OK:([^"\n]*)/)
  if (!m) throw new Error(out.slice(0, 300) || 'nessuna risposta dal Mac')
  return m[1]
}

async function speakNeural($: EngineInterface, text: string, voice: string): Promise<string> {
  const speedRaw = await $.store.get('speed')
  const speed = typeof speedRaw === 'number' ? speedRaw : 1.0
  const r = await $.process.run([NEURAL_PY, NEURAL_SCRIPT, voice, String(speed), text], { timeoutMs: 120000 })
  if (r.exitCode !== 0 || !r.stdout) throw new Error(`voce neurale: ${r.stderr.slice(-300)}`)
  const script = `(async () => {
  speechSynthesis.cancel();
  if (window.__jarvis) { window.__jarvis.pause(); }
  const a = new Audio('data:audio/mpeg;base64,${r.stdout.trim()}');
  window.__jarvis = a;
  await a.play();
  return 'JARVIS_OK:${voice}';
})()`
  return runInBrowser($, script)
}

async function speak($: EngineInterface, text: string): Promise<string> {
  const chosen = await $.store.get('voice')
  const clipped = text.slice(0, 4000)
  const neural = typeof chosen === 'string' ? NEURAL_VOICES[chosen.toLowerCase()] : undefined
  if (neural) {
    try {
      return await speakNeural($, clipped, neural)
    } catch (err) {
      $.ui.toast(`Jarvis: voce neurale non disponibile, uso quella del Mac (${String(err).slice(0, 120)})`)
    }
  }
  const voices = typeof chosen === 'string' && !neural ? [chosen, ...DEFAULT_VOICES] : [...DEFAULT_VOICES]
  return runInBrowser($, speechScript(clipped, voices))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'jarvis',
      description: 'Jarvis: voce del Mac per i briefing (prova, ripeti, tutto, briefing, off, voce)',
    })
    await $.tool.register({
      name: 'parla',
      description: 'Jarvis: pronuncia ad alta voce un testo con la voce del Mac. Restituisce la voce usata o l\'errore.',
      inputSchema: { type: 'object', properties: { testo: { type: 'string' } }, required: ['testo'] },
    })
    await $.tool.register({
      name: 'imposta',
      description: 'Jarvis: imposta la modalità (briefing | tutto | off) e/o la voce del Mac (nome esatto, oppure "auto").',
      inputSchema: {
        type: 'object',
        properties: { modalita: { type: 'string', enum: ['briefing', 'tutto', 'off'] }, voce: { type: 'string', description: 'nicola | sara (neurali) oppure il nome di una voce del Mac, o auto' }, velocita: { type: 'number', description: 'velocità della voce neurale, 0.7-1.4' } },
      },
    })
    return next(e)
  })

  on('tool.call', { tool: 'mcp__jarvis__imposta' }, async ($, e) => {
    const input = e as { modalita?: unknown; voce?: unknown; velocita?: unknown }
    const out: string[] = []
    if (input.modalita === 'briefing' || input.modalita === 'tutto' || input.modalita === 'off') {
      await $.store.set('mode', input.modalita)
      out.push(`modalità: ${input.modalita}`)
    }
    if (typeof input.voce === 'string' && input.voce.trim()) {
      if (input.voce.trim() === 'auto') await $.store.delete('voice')
      else await $.store.set('voice', input.voce.trim())
      out.push(`voce: ${input.voce.trim()}`)
    }
    if (typeof input.velocita === 'number' && input.velocita >= 0.5 && input.velocita <= 2) {
      await $.store.set('speed', input.velocita)
      out.push(`velocità: ${input.velocita}`)
    }
    return { result: out.length ? `Jarvis impostato (${out.join(', ')})` : 'Niente da cambiare.' }
  })

  on('tool.call', { tool: 'mcp__jarvis__parla' }, async ($, e) => {
    const testo = String((e as { testo?: unknown }).testo ?? '')
    try {
      const v = await speak($, testo)
      return { result: `Pronunciato con la voce: ${v}` }
    } catch (err) {
      return { result: `Errore voce: ${String(err)}` }
    }
  })

  on('command.run', { command: 'jarvis' }, async ($, e) => {
    const args = e.args.trim()
    const [sub, ...rest] = args.split(/\s+/)
    switch ((sub ?? '').toLowerCase()) {
      case 'prova': {
        try {
          const v = await speak($, 'Buongiorno Marco. Sistemi operativi. Sono pronto a lavorare su PoP.')
          return { text: `Jarvis ha parlato con la voce: ${v}.` }
        } catch (err) {
          return { text: `Jarvis non riesce a parlare: ${String(err)}` }
        }
      }
      case 'ripeti': {
        const last = await $.store.get('last')
        if (typeof last !== 'string') return { text: 'Nessun briefing da ripetere.' }
        void speak($, last).catch(() => {})
        return { text: 'Rileggo l\'ultimo briefing.' }
      }
      case 'tutto':
      case 'briefing':
      case 'off':
        await $.store.set('mode', sub.toLowerCase())
        return { text: `Jarvis: modalità "${sub.toLowerCase()}".` }
      case 'voce': {
        const name = rest.join(' ').trim()
        if (!name || name === 'auto') {
          await $.store.delete('voice')
          return { text: 'Jarvis: voce automatica (Luca, poi Daniel, poi predefinita).' }
        }
        await $.store.set('voice', name)
        return { text: `Jarvis: voce impostata su "${name}". Prova con /jarvis prova.` }
      }
      default:
        return { text: HELP }
    }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer') return result
    const mode = await getMode($)
    if (mode === 'off') return result
    const text = mode === 'tutto' ? toSpeech(e.answer) : extractBriefing(e.answer)
    if (!text) return result
    await $.store.set('last', text)
    // Non blocca la fine del turno: parla in sottofondo.
    void speak($, text).catch(err => $.ui.toast(`Jarvis: ${String(err)}`))
    return result
  })
}
