# PegasofastView 🚀

Suite completa di automazione per l'Università Pegaso - funzionante con Tampermonkey

## 📦 Contenuto

### 1. **pegaso.js** - Auto Video Viewer
Script per visualizzare automaticamente le lezioni video dell'università Pegaso.

**Funzionalità:**
- ✅ Avvio automatico delle lezioni video
- ✅ Apertura automatica di tutte le sezioni
- ✅ Identificazione lezioni mancanti
- ✅ Salvataggio stato in locale
- ✅ Velocità video configurabile
- ✅ Completamento automatico del corso

### 2. **pegaso-test-auto.js** - Auto Test Compiler ⭐ NEW
Script per compilare automaticamente i test di fine lezione usando un paniere di risposte.

**Funzionalità:**
- ✅ Carica risposte da file JSON locale
- ✅ Rileva automaticamente le domande del test
- ✅ Compila automaticamente le risposte corrette
- ✅ Opzione invio automatico
- ✅ Matching intelligente test-risposte
- ✅ Interfaccia grafica intuitiva
- ✅ Progresso in tempo reale

### 3. **convertitore-paniere.html** - JSON Converter
Tool web per convertire facilmente i file Excel/CSV in formato JSON per il paniere risposte.

**Funzionalità:**
- ✅ Converte CSV/Excel in JSON
- ✅ Interfaccia drag & drop
- ✅ Preview del risultato
- ✅ Download immediato
- ✅ Copia negli appunti

## 🚀 Quick Start

### Per le Video Lezioni:
1. Installa [Tampermonkey](https://www.tampermonkey.net/)
2. Apri `pegaso.js` in Tampermonkey
3. Naviga su una pagina di lezioni Pegaso
4. Click sul pulsante "Avvia Bot" che appare

### Per i Test Automatici:
1. Installa [Tampermonkey](https://www.tampermonkey.net/)
2. Apri `pegaso-test-auto.js` in Tampermonkey
3. Prepara il file JSON con le risposte (usa `convertitore-paniere.html`)
4. Apri un test su Pegaso
5. Carica il file JSON dal pannello
6. Click "Avvia Test"

## 📚 Documentazione

- **Video Lezioni**: Consulta i commenti nel codice di `pegaso.js`
- **Test Automatici**: Leggi la guida completa in `GUIDA-TEST-AUTO.md`
- **Esempi**: Vedi `paniere-esempio.json` per il formato risposte

## 🎯 Formato Paniere Risposte

```json
{
  "Nome Test": {
    "1": {
      "question": "Testo domanda",
      "answer": "B",
      "text": "Testo risposta corretta"
    }
  }
}
```

## 🛠️ Strumenti Inclusi

| File | Descrizione | Uso |
|------|-------------|-----|
| `pegaso.js` | Script principale video lezioni | Tampermonkey |
| `pegaso-test-auto.js` | Script compilazione test | Tampermonkey |
| `paniere-esempio.json` | Esempio formato risposte | Reference |
| `convertitore-paniere.html` | Convertitore CSV→JSON | Browser |
| `GUIDA-TEST-AUTO.md` | Guida completa test auto | Documentazione |

## ⚙️ Configurazione

### Video Lezioni:
```javascript
REQUIRED_PERCENTAGE: 92,  // Percentuale completamento video
PLAYBACK_SPEED: 1.0,      // Velocità riproduzione
AUTO_START: false         // Avvio automatico
```

### Test Auto:
```javascript
AUTO_START: false,    // Avvio automatico test
AUTO_SUBMIT: false,   // Invio automatico
ANSWER_DELAY: 500     // Delay tra risposte (ms)
```

## 🔧 Troubleshooting

### Script non funziona
1. Verifica che Tampermonkey sia attivo
2. Controlla la console (F12) per errori
3. Ricarica la pagina

### Test non viene compilato
1. Verifica formato JSON del paniere
2. Controlla che il nome test corrisponda
3. Guarda i log in console

## ⚠️ Disclaimer

Questi script sono forniti **solo a scopo educativo**. L'uso di strumenti di automazione potrebbe violare i termini di servizio della piattaforma. Usa a tuo rischio e pericolo.

## 📝 Versioni

- **v3.0** - Auto Video Viewer con gestione sezioni migliorata
- **v1.0** - Auto Test Compiler (NEW!)
- **v1.0** - Convertitore Paniere (NEW!)

## 🤝 Contributi

Sentiti libero di contribuire al progetto con:
- 🐛 Segnalazione bug
- 💡 Suggerimenti miglioramenti
- 📝 Documentazione aggiuntiva
- 🔧 Pull requests

## 📜 Licenza

Uso personale ed educativo

---

**Compatibile con**: Chrome, Firefox, Edge  
**Richiede**: Tampermonkey/Violentmonkey/Greasemonkey
