import { test, expect } from 'claude-code/testing'
import { extractBriefing, toSpeech } from './register'

test('estrae il briefing e toglie il markdown', () => {
  const answer = 'Fatto tutto.\n\n## 🎙️ Briefing\nHo creato **2026-10-18-survey.md** in [Claude work](https://x.y).\n- Consiglio: chiama 5 clienti.\n'
  expect(extractBriefing(answer)).toBe('Ho creato 2026-10-18-survey.md in Claude work. Consiglio: chiama 5 clienti.')
})

test('nessun briefing, nessuna voce', () => {
  expect(extractBriefing('Risposta normale senza sezione.')).toBe(undefined)
})

test('si ferma alla sezione successiva', () => {
  expect(extractBriefing('**🎙️ Briefing**\nUno.\n## File\nx')).toBe('Uno.')
  expect(toSpeech('`a` ```b```')).toBe('a')
})
