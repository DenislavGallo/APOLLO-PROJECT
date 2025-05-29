# DOCUMENTAZIONE TECNICA COMPLETA — APOLLO PROJECT
---

## 1. ARCHITETTURA GENERALE

- **Frontend**: HTML, CSS, JavaScript (ES6+), Chart.js (grafici), Three.js (globo 3D).
- **Backend**: Python con Flask, API RESTful, gestione dati e modello IA.
- **Modello IA**: Prophet (Meta/Facebook) per previsioni temporali.
- **Dati**: CSV ufficiali Protezione Civile.
- **Testing**: Unittest Python per API.

---

## 2. FLUSSO DATI E FUNZIONAMENTO

1. **Caricamento dati storici**: dal file CSV, elaborati con Pandas.
2. **Training modello**: Prophet addestrato su ciascun indicatore base.
3. **Previsioni**: su richiesta, Prophet genera valori futuri e bande di confidenza.
4. **API REST**: il backend espone endpoint per dati storici, previsioni, accuratezza.
5. **Frontend**: JS effettua fetch alle API, aggiorna grafici e UI.

---

## 3. BACKEND: STRUTTURA, API, LOGGING, DEBUG

### a. Struttura file
- `server/app.py`: entrypoint Flask, definisce tutte le route e API.
- `server/models/prophet_model.py`: classe ProphetModel, training, previsioni, calcolo bande.
- `server/data_utils.py`: utility per manipolazione dati.
- `requirements.txt`: dipendenze.

### b. API principali
- `/api/data/historical`: dati storici.
- `/api/data/forecast`: previsioni future (con banda di confidenza per ogni indicatore).
- `/api/model/mape`: accuratezza MAPE per indicatori base.
- `/api/data/latest`: ultimi dati.
- `/api/data/globe`: dati aggregati per il globo 3D.

### c. Logging e debug
- Logging Python configurato in `app.py` e `prophet_model.py` (info, warning, error).
- Ogni richiesta API viene loggata (parametri, esito, errori).
- Handler errori globali (400, 404, 500) restituiscono JSON dettagliato.
- Errori di modello (es: Prophet non addestrato) sono loggati e restituiti all’utente come errore API.
- Debug: avvio Flask in modalità debug (`python server/app.py`).

---

## 4. MODELLO PROPHET: TRAINING, PREVISIONI, BANDE DI CONFIDENZA

- **Training**: Prophet viene addestrato su 300 giorni di dati storici per ogni indicatore base.
- **Previsioni**: per ogni giorno futuro, Prophet restituisce valore previsto (`yhat`) e intervallo di confidenza (`yhat_lower`, `yhat_upper`).
- **Banda di confidenza**: per ogni indicatore base, la banda è direttamente quella di Prophet. Per indicatori derivati (es: totale_casi), la banda è la somma cumulativa giorno per giorno dei limiti inferiori/superiori.
- **Output**: il backend restituisce sempre una lista di dizionari serializzabili in JSON, con tutti i valori e le bande.

---

## 5. FRONTEND: STRUTTURA, LOGICA JS, ACCESSIBILITÀ

### a. Struttura file
- `static/js/forecasting.js`: logica di fetch API, aggiornamento grafici, gestione banda di confidenza e legenda.
- `static/js/main.js`: logica generale UI.
- `templates/previsioni.html`: pagina HTML delle previsioni.

### b. Logica JS
- All’avvio, JS effettua fetch alle API per dati storici e previsioni.
- I dati sono processati e visualizzati tramite Chart.js (grafici) e Three.js (globo).
- La banda di confidenza è visualizzata come area azzurra sotto la curva principale.
- La legenda viene generata dinamicamente e inserita sotto il grafico.
- Eventi (cambio indicatore, paese, periodo) aggiornano i dati e la UI.
- Gli errori di fetch vengono gestiti mostrando messaggi all’utente e loggando in console.

### c. Accessibilità
- Legenda testuale sempre visibile.
- Colori accessibili anche per daltonici.
- Navigazione da tastiera e struttura HTML semantica.

---

## 6. INDICATORI: BASE, DERIVATI, LOGICA CUMULATIVA

- **Indicatori base**: previsti direttamente dal modello Prophet (nuovi_positivi, deceduti, dimessi_guariti, terapia_intensiva, ricoverati_con_sintomi).
- **Indicatori derivati**: calcolati come somma cumulativa (es: totale_casi = somma nuovi_positivi).
- **Banda di confidenza per derivati**: somma cumulativa giorno per giorno dei limiti inferiori/superiori.
- **MAPE**: calcolata solo per indicatori base (il frontend non la mostra per i derivati).

---

## 7. VISUALIZZAZIONE: GRAFICI, GLOBO 3D, LEGENDA

- **Grafici**: Chart.js, linea principale per la previsione, banda di confidenza come area azzurra.
- **Legenda**: box sotto il grafico che spiega la banda di confidenza, accessibile e visibile sempre.
- **Mappamondo 3D**: Three.js per visualizzare l’intensità dei casi a livello globale.

---

## 8. TESTING E MANUTENZIONE

- **Test automatici**: cartella `/tests` con script Python per testare API e logica edge-case.
- **Debug**: strumenti di sviluppo browser per JS, log Flask per backend.
- **Aggiornamento dati**: basta sostituire il CSV con i nuovi dati.
- **Aggiunta indicatori**: modificare ProphetModel e forecasting.js secondo guida in README.

---

## 9. ESTENDIBILITÀ E ROADMAP

- **Nuovi indicatori**: aggiungibili facilmente seguendo la guida.
- **Nuovi modelli**: possibile integrare modelli diversi da Prophet (es: LSTM, ARIMA).
- **Nuove funzionalità**: download dati, notifiche, esportazione grafici, confronti tra modelli.
- **Migliorie UI/UX**: tooltip avanzati, modalità dark/light, accessibilità avanzata.
- **Collaborazione**: struttura pronta per open-source, guida CONTRIBUTING.md consigliata.

---

## 10. GLOSSARIO E RIFERIMENTI

- **Prophet**: modello di previsione serie temporali sviluppato da Meta/Facebook.
- **Banda di confidenza**: intervallo che rappresenta l’incertezza della previsione.
- **MAPE**: Mean Absolute Percentage Error, misura di accuratezza delle previsioni.
- **Chart.js**: libreria JS per grafici.
- **Three.js**: libreria JS per grafica 3D.
- **Flask**: micro-framework Python per web API.

---

**Questa documentazione fornisce una panoramica rigorosa e dettagliata di tutto il funzionamento del progetto Apollo, pronta per essere usata come riferimento tecnico o materiale per la tesina.**
