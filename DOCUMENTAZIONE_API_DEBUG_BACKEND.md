# APPROFONDIMENTO TECNICO: API, DEBUG, BACKEND — APOLLO PROJECT

---

## 1. API — Dettaglio Completo

### a. Struttura generale
- Tutte le API sono definite in `server/app.py` (Flask).
- Gli endpoint restituiscono sempre risposte JSON, con chiavi `success`, `data` (o `error` in caso di problemi).
- Validazione rigorosa degli input: parametri obbligatori, gestione errori, messaggi chiari.

### b. Elenco e spiegazione endpoint principali

| Endpoint                        | Metodo | Descrizione                                                                                      |
|----------------------------------|--------|--------------------------------------------------------------------------------------------------|
| `/api/data/historical`           | GET    | Restituisce i dati storici COVID-19 (array di record giornalieri).                               |
| `/api/data/forecast`             | GET    | Restituisce le previsioni future per tutti gli indicatori, inclusi intervalli di confidenza.     |
| `/api/model/mape`                | GET    | Restituisce la MAPE (accuratezza) per l’indicatore base richiesto.                              |
| `/api/data/latest`               | GET    | Restituisce gli ultimi 30 giorni di dati.                                                        |
| `/api/data/globe`                | GET    | Dati aggregati per la visualizzazione sul globo 3D.                                              |

#### Esempio risposta `/api/data/forecast`
```json
{
  "success": true,
  "data": [
    {
      "data": "2025-04-28",
      "nuovi_positivi": 1000,
      "nuovi_positivi_lower": 900,
      "nuovi_positivi_upper": 1100,
      ...
    },
    ...
  ]
}
```

#### Validazione e gestione errori
- Parametri mancanti o errati restituiscono errore 400 con messaggio dettagliato.
- Errori interni restituiscono errore 500 con dettagli utili per il debug.
- Tutti gli errori sono loggati lato server.

#### Sicurezza
- Nessuna API modifica dati (solo GET, progetto read-only).
- Tutti i dati passati tramite query string sono validati e sanificati.

---

## 2. DEBUG — Strategie e strumenti

### a. Backend (Flask/Python)
- **Logging**: configurato in `app.py` e `prophet_model.py` con livelli INFO, WARNING, ERROR.
  - Ogni richiesta API logga: endpoint, parametri, esito, eventuali eccezioni.
  - Errori di modello (es: Prophet non addestrato) vengono loggati con stacktrace.
- **Handler errori globali**: per 400/404/500, restituiscono JSON dettagliato e loggano l’evento.
- **Debug mode**: avviare Flask con `python server/app.py` per vedere log dettagliati in console.
- **Test automatici**: script in `/tests` simulano chiamate API con casi validi e edge-case.
- **Diagnostica**: in caso di bug, si verifica:
  - Log console server (per errori Python/Flask)
  - Risposta JSON dell’API (campo `error`)
  - Stacktrace e messaggi di logging

### b. Frontend (JS)
- **Console.log/error**: usato in tutti i punti critici (fetch API, rendering grafici, errori UI).
- **Messaggi utente**: errori di fetch o dati non validi mostrano messaggio chiaro nella UI.
- **Debug strumenti browser**: uso di console JS e network tab per tracciare richieste e risposte.

---

## 3. BACKEND — Architettura, logica, sicurezza

### a. Struttura file
- `server/app.py`: entrypoint Flask, definisce route, API, logging, error handler.
- `server/models/prophet_model.py`: logica modello Prophet (training, previsioni, calcolo intervalli).
- `server/data_utils.py`: utility per manipolazione/preparazione dati.
- `requirements.txt`: dipendenze Python.

### b. Flusso logico principale
1. **Avvio server**: Flask si avvia, carica dati storici, prepara modelli Prophet.
2. **Richiesta API**: riceve parametri, valida input, seleziona dati/modello.
3. **Elaborazione**: esegue calcoli (es: previsioni, cumulativi, banda di confidenza).
4. **Risposta**: restituisce JSON serializzabile, loggando ogni passaggio.

### c. Sicurezza e robustezza
- Nessuna modifica dati lato server.
- Validazione input su ogni endpoint.
- Errori gestiti con messaggi chiari e logging.
- Output sempre JSON serializzabile (mai oggetti Python complessi).

### d. Performance
- Cache dati in memoria per evitare ricalcoli inutili.
- Training Prophet eseguito solo quando necessario.
- Possibilità di estendere a più paesi/regioni con modelli separati.

---

**Questa sezione fornisce una visione rigorosa e approfondita di API, debug e backend di Apollo Project, pronta per essere usata in tesina o presentazione tecnica.**
