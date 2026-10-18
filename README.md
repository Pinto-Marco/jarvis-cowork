# Jarvis per Claude Cowork

Mod per Claude che legge ad alta voce, con la voce del Mac, la sezione **"🎙️ Briefing"** con cui Claude chiude le risposte. Gratis, nessun servizio esterno.

## Come funziona
- A fine attività la mod prende il testo dopo l'intestazione "🎙️ Briefing", toglie markdown e link e lo fa leggere al browser integrato dell'app Claude sul Mac.
- Voce: la prima disponibile tra `Luca (ottimizzata)`, Luca Premium/Enhanced, Luca, Reed, Eddy, Rocko, Alice.
- Strumenti per Claude: `parla` (dice un testo) e `imposta` (modalità `briefing` | `tutto` | `off`, voce, velocità).
- Opzionale: voce neurale Kokoro (`tts/say.py`), usata solo se scegli la voce `nicola` o `sara` e l'ambiente ha Kokoro installato.

## Requisiti
- App desktop Claude aperta sul Mac, sessione collegata al computer (serve il browser integrato).
- Le voci Siri non sono utilizzabili: scarica una voce "ottimizzata"/Premium da Impostazioni di Sistema → Accessibilità → Contenuto letto ad alta voce.
- Nelle istruzioni del progetto, chiedi a Claude di chiudere ogni attività con una sezione "🎙️ Briefing".

## Installazione
Nell'app desktop: clic su **+** accanto al campo del messaggio → **Plugins** → **Add marketplace** con `Pinto-Marco/jarvis-cowork` → **Add plugin**.

Da terminale (Claude Code):

```
/plugin install jarvis --marketplace Pinto-Marco/jarvis-cowork
```

oppure dalla shell:

```
claude plugin install jarvis --marketplace Pinto-Marco/jarvis-cowork
```
