# APPROFONDIMENTO TECNICO: PROPHET NEL PROGETTO APOLLO

---

## 1. Cos’è Prophet?
Prophet è una libreria open source sviluppata da Facebook/Meta per la previsione di serie temporali. È particolarmente adatta a dati con trend e stagionalità, come quelli epidemiologici.

- **Modello additivo**: combina trend, componente stagionale e festività.
- **Gestione automatica dei missing, outlier, cambi di trend.**
- **Interfaccia semplice**: pochi parametri, facile da integrare in pipeline Python.

---

## 2. Come viene usato in Apollo

### a. Addestramento
- In `server/models/prophet_model.py`, per ogni indicatore base (es: "nuovi_positivi", "deceduti"), viene creato e addestrato un modello Prophet separato.
- Il training avviene su una finestra di 300 giorni di dati storici (parametro `train_days`).
- Ogni modello riceve in input un DataFrame con due colonne: `ds` (data) e `y` (valore dell’indicatore).
- Prophet viene configurato con stagionalità settimanale e annuale (`weekly_seasonality=True`, `yearly_seasonality=True`).

### b. Previsione
- Alla richiesta di forecast (metodo `forecast`), Prophet genera per ciascun giorno futuro:
  - **yhat**: valore previsto
  - **yhat_lower/yhat_upper**: intervallo di confidenza
- Questi valori sono raccolti in un dizionario per ogni indicatore.
- Per gli indicatori derivati (es: "totale_casi"), la previsione e la banda di confidenza sono calcolate sommando giorno per giorno i valori previsti e i limiti inferiori/superiori.

### c. Output
- Il risultato finale è una lista di dizionari, uno per ogni giorno futuro, con tutte le metriche e le bande di confidenza.
- L’output è sempre serializzabile in JSON.

---

## 3. Bande di Confidenza
- Prophet calcola per ogni previsione un intervallo di confidenza (default: 80%, configurabile).
- Nel progetto Apollo, la banda di confidenza è visualizzata nei grafici come area azzurra tra `*_lower` e `*_upper`.
- Per indicatori cumulativi, la banda viene calcolata sommando giorno per giorno i limiti.

---

## 4. Trend e Stagionalità
- Prophet separa automaticamente la componente **trend** (variazione di fondo) e la **stagionalità** (pattern ricorrenti, es. settimanali/annuali).
- Nel frontend, è possibile visualizzare i grafici di trend e stagionalità per ciascun indicatore base.

---

## 5. Robustezza e gestione errori
- Se Prophet non riesce ad addestrare un modello (es: dati insufficienti), viene loggato un errore e l’indicatore viene escluso dalla previsione.
- Tutte le eccezioni sono gestite e loggate.
- L’output dell’API è sempre consistente: se un indicatore non è disponibile, il suo valore sarà `null`.

---

## 6. Estendibilità
- Aggiungere un nuovo indicatore Prophet è semplice: basta aggiungere la colonna nei dati e nella lista `columns` in `ProphetModel`.
- Si possono configurare stagionalità personalizzate o aggiungere effetti di festività se necessario.

---

**Questo approfondimento ti permette di spiegare in modo rigoroso e dettagliato come Prophet viene usato, integrato e visualizzato nel progetto Apollo.**
