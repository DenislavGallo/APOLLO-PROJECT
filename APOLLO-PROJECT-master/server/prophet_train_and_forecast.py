# -*- coding: utf-8 -*-
"""
Script per addestrare Prophet sui dati COVID-19 italiani e generare previsioni future.
- Usa una parte dello storico per allenare Prophet
- Salva le previsioni su file JSON per il frontend
"""
import pandas as pd
import numpy as np
from prophet import Prophet
import json
from datetime import timedelta

# === PARAMETRI ===
CSV_PATH = '../dpc-covid19-ita-andamento-nazionale.csv'  # Path relativo dalla cartella server
OUTPUT_PATH = '../static/data/forecast_data.json'        # Dove salvare le previsioni
COLUMN = 'nuovi_positivi'                                # Colonna target
TRAIN_DAYS = 300                                         # Giorni da usare per il training (modifica a piacere)
FUTURE_DAYS = 30                                         # Giorni di previsione (oltre lo storico)

# === 1. Carica dati ===
df = pd.read_csv(CSV_PATH)
df['data'] = pd.to_datetime(df['data'])
df = df.sort_values('data')

# === 2. Suddividi in train/test ===
df_train = df.iloc[:TRAIN_DAYS].copy()
df_test = df.iloc[TRAIN_DAYS:].copy()  # Per confronto futuro

# === 3. Prepara dati per Prophet ===
df_prophet = pd.DataFrame({'ds': df_train['data'], 'y': df_train[COLUMN]})

# === 4. Allena Prophet ===
m = Prophet()
m.fit(df_prophet)

# === 5. Genera date future ===
last_train_date = df_train['data'].max()
future_dates = pd.date_range(start=last_train_date + timedelta(days=1), periods=FUTURE_DAYS)
df_future = pd.DataFrame({'ds': future_dates})

# === 6. Previsione ===
forecast = m.predict(df_future)

# === 7. Serializza previsioni nel formato richiesto dal frontend ===
forecast_json = []
for i, row in forecast.iterrows():
    forecast_json.append({
        'data': row['ds'].strftime('%Y-%m-%d'),
        'stato': 'ITA',
        'nuovi_positivi': int(max(row['yhat'], 0)),
        'totale_positivi': None,  # Prophet fornisce solo la serie target, puoi aggiungere altre logiche
        'dimessi_guariti': None,
        'deceduti': None,
        'totale_casi': None,
        'terapia_intensiva': None,
        'ricoverati_con_sintomi': None
    })

# === 8. Salva su file JSON ===
with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(forecast_json, f, ensure_ascii=False, indent=2)

print(f"Previsioni Prophet salvate in {OUTPUT_PATH}. {len(forecast_json)} giorni previsti.")
