Documentazione Prophet: Calcoli e Risultati
Cos'è Prophet?
Prophet è una libreria open source sviluppata da Facebook (Meta) per la previsione di serie temporali. È particolarmente adatta per dati con trend, stagionalità e festività, e viene utilizzata in ambito business, finance, epidemiologia, ecc.
Quali calcoli effettua Prophet?
Prophet esegue una decomposizione additiva o moltiplicativa della serie temporale, modellando i seguenti componenti principali:
Trend (Tendenza)
Modella la crescita o decrescita a lungo termine dei dati.
Può essere lineare o logistica (con saturazione).
Individua automaticamente i "changepoints" (punti di cambiamento) dove il trend cambia pendenza.
Stagionalità
Modella le variazioni periodiche (ad esempio, giornaliere, settimanali, annuali).
Utilizza funzioni periodiche (Fourier) per rappresentare la stagionalità.
Festività/Eventi Speciali
Permette di aggiungere effetti dovuti a festività o eventi particolari che influenzano i dati.
Errori/Residui
La differenza tra i valori osservati e quelli previsti dal modello.
Formula generale del modello additivo

\[
y(t) = g(t) + s(t) + h(t) + \epsilon_t
\]

Dove:
- \(y(t)\): valore osservato o previsto al tempo \(t\)
- \(g(t)\): componente di trend (tendenza)
- \(s(t)\): componente di stagionalità
- \(h(t)\): componente festività/eventi speciali
- \(\epsilon_t\): errore o residuo

---

## Come vengono calcolate le componenti del modello in Prophet?

### 1. Trend

**Trend lineare:**
\[
g(t) = k \cdot t + m
\]
- \(k\): pendenza (velocità di crescita/decrescita)
- \(m\): intercetta (valore iniziale)

**Trend logistico (con saturazione):**
\[
g(t) = \frac{C}{1 + \exp(-k \cdot (t - m))}
\]
- \(C\): capacità massima (plateau)
- \(k\): velocità di crescita
- \(m\): punto di metà crescita

**Trend con changepoints (cambi di pendenza):**
\[
g(t) = (k + \sum_{i=1}^{S} a_i D_i(t)) \cdot t + (m + \sum_{i=1}^{S} b_i D_i(t))
\]
- \(D_i(t)\): funzione indicatrice che vale 1 dopo il changepoint \(i\), 0 altrimenti
- \(a_i, b_i\): variazioni di pendenza e intercetta ai changepoints

Prophet stima i parametri del trend (e i changepoints) tramite ottimizzazione (regressione) sui dati storici.

### 2. Stagionalità

\[
s(t) = \sum_{n=1}^{N} \left[ a_n \cos\left(\frac{2\pi n t}{P}\right) + b_n \sin\left(\frac{2\pi n t}{P}\right) \right]
\]
- \(P\): periodo della stagionalità (es. 365.25 per annuale, 7 per settimanale)
- \(N\): ordine della serie di Fourier (più alto = più dettagli)
- \(a_n, b_n\): coefficienti stimati dal modello

Prophet costruisce una matrice di regressione con queste funzioni e stima i coefficienti tramite fitting sui dati storici.

### 3. Festività

\[
h(t) = \sum_{j=1}^{J} \gamma_j \cdot I_j(t)
\]
- \(J\): numero di festività/eventi
- \(\gamma_j\): impatto stimato della festività \(j\)
- \(I_j(t)\): funzione indicatrice che vale 1 se il giorno \(t\) è la festività \(j\) (o nei giorni di finestra), 0 altrimenti

La festività viene trattata come una variabile categoriale nella regressione, e il suo effetto viene appreso dai dati.

### 4. Errore/Residuo

\[
\epsilon_t = y(t) - [g(t) + s(t) + h(t)]
\]

Prophet assume che gli errori siano distribuiti normalmente (gaussiani) e li utilizza per stimare gli intervalli di confidenza delle previsioni.

---

Quali risultati restituisce Prophet?
Quando Prophet viene utilizzato per fare una previsione (forecast), restituisce:
Valori previsti (yhat)
La previsione puntuale per ogni data futura richiesta.
Intervalli di confidenza (yhat_lower, yhat_upper)
Limiti inferiore e superiore dell'intervallo di confidenza (di solito al 95%) per ogni previsione.
Componenti del modello
Trend stimato
Stagionalità stimata (per ogni periodo specificato)
Effetti delle festività (se specificate)
Questi possono essere visualizzati separatamente tramite funzioni di plot dedicate.
Changepoints
Elenco dei punti in cui il trend cambia pendenza.
Esempio di output (tipico DataFrame di forecast)
| ds | yhat | yhat_lower | yhat_upper |
|--------------|--------|------------|------------|
| 2024-06-01 | 123.45 | 120.00 | 127.00 |
| 2024-06-02 | 124.00 | 121.00 | 128.00 |
| ... | ... | ... | ... |
ds: data della previsione
yhat: valore previsto
yhat_lower/yhat_upper: intervallo di confidenza
Tipi di risultati
Numerici: tutti i risultati sono numerici (float), organizzati in DataFrame (pandas) o tabelle simili.
Grafici: Prophet offre funzioni per visualizzare le previsioni, i trend, la stagionalità e gli effetti delle festività.








