# -*- coding: utf-8 -*-
"""
Modulo ProphetModel per Apollo Project
- Permette di addestrare un modello Prophet su una serie temporale
- Permette di generare previsioni future
"""
from prophet import Prophet
import pandas as pd

import logging

class ProphetModel:
    def __init__(self, csv_path, columns=None, train_days=300):
        self.csv_path = csv_path
        self.columns = columns or [
            'nuovi_positivi', 'deceduti', 'dimessi_guariti', 'terapia_intensiva', 'ricoverati_con_sintomi'
        ]
        self.train_days = train_days
        self.models = {}
        self.train_df = None
        self.last_train_date = None
        self.logger = logging.getLogger('models.prophet_model')
        self._fit_all()


    def _fit_all(self):
        df = pd.read_csv(self.csv_path)
        self.logger.info(f"Dati caricati: {len(df)} record da {df['data'].iloc[0]} a {df['data'].iloc[-1]}")
        df['data'] = pd.to_datetime(df['data'])
        df = df.sort_values('data')
        self.train_df = df.iloc[:self.train_days].copy()
        self.last_train_date = self.train_df['data'].max()
        for col in self.columns:
            try:
                prophet_df = pd.DataFrame({'ds': self.train_df['data'], 'y': self.train_df[col]})
                model = Prophet(weekly_seasonality=True, yearly_seasonality=True, daily_seasonality=False)
                model.fit(prophet_df)
                self.models[col] = model
                self.logger.info(f"Modello Prophet addestrato per {col}")
            except Exception as e:
                self.logger.error(f"Errore addestrando Prophet per {col}: {e}")
                self.models[col] = None

    def forecast(self, days=30):
        try:
            future_dates = pd.date_range(start=self.last_train_date + pd.Timedelta(days=1), periods=days)
            df_future = pd.DataFrame({'ds': future_dates})
            results = {col: [] for col in self.columns}
            for col in self.columns:
                model = self.models.get(col)
                if model is not None:
                    forecast = model.predict(df_future)
                    results[col] = [int(max(y, 0)) for y in forecast['yhat']]
                    # Salva anche intervallo di confidenza se disponibili
                    if 'yhat_lower' in forecast.columns and 'yhat_upper' in forecast.columns:
                        results[col + '_lower'] = [float(y) for y in forecast['yhat_lower']]
                        results[col + '_upper'] = [float(y) for y in forecast['yhat_upper']]
                    else:
                        results[col + '_lower'] = [None] * days
                        results[col + '_upper'] = [None] * days
                else:
                    results[col] = [None] * days
                    results[col + '_lower'] = [None] * days
                    results[col + '_upper'] = [None] * days
            forecast_json = []
            # Calcolo cumulativo dei totali a partire dall'ultimo valore reale
            last_row = self.train_df.iloc[-1]
            last_totale_casi = int(last_row['totale_casi']) if not pd.isnull(last_row['totale_casi']) else 0
            last_totale_positivi = int(last_row['totale_positivi']) if not pd.isnull(last_row['totale_positivi']) else 0
            cum_casi = last_totale_casi
            cum_positivi = last_totale_positivi
            # Inizializza cumulativi anche per le bande di confidenza
            cum_casi_lower = last_totale_casi
            cum_casi_upper = last_totale_casi
            cum_positivi_lower = last_totale_positivi
            cum_positivi_upper = last_totale_positivi

            for i, date in enumerate(future_dates):
                entry = {'data': date.strftime('%Y-%m-%d'), 'stato': 'ITA'}
                for col in self.columns:
                    entry[col] = results[col][i]
                    # Aggiungi intervallo di confidenza se presente
                    entry[col + '_lower'] = results.get(col + '_lower', [None]*days)[i]
                    entry[col + '_upper'] = results.get(col + '_upper', [None]*days)[i]
                # Calcolo cumulativo
                nuovi_positivi = entry.get('nuovi_positivi', 0) or 0
                nuovi_positivi_lower = entry.get('nuovi_positivi_lower', 0) or 0
                nuovi_positivi_upper = entry.get('nuovi_positivi_upper', 0) or 0
                dimessi_guariti = entry.get('dimessi_guariti', 0) or 0
                dimessi_guariti_lower = entry.get('dimessi_guariti_lower', 0) or 0
                dimessi_guariti_upper = entry.get('dimessi_guariti_upper', 0) or 0
                deceduti = entry.get('deceduti', 0) or 0
                deceduti_lower = entry.get('deceduti_lower', 0) or 0
                deceduti_upper = entry.get('deceduti_upper', 0) or 0
                # totale_casi = somma cumulativa dei nuovi positivi
                cum_casi += nuovi_positivi
                cum_casi_lower += nuovi_positivi_lower
                cum_casi_upper += nuovi_positivi_upper
                entry['totale_casi'] = cum_casi
                entry['totale_casi_lower'] = cum_casi_lower
                entry['totale_casi_upper'] = cum_casi_upper
                # totale_positivi = totale_positivi giorno prima + nuovi_positivi - guariti - deceduti
                cum_positivi += nuovi_positivi - dimessi_guariti - deceduti
                cum_positivi_lower += nuovi_positivi_lower - dimessi_guariti_upper - deceduti_upper
                cum_positivi_upper += nuovi_positivi_upper - dimessi_guariti_lower - deceduti_lower
                cum_positivi = max(cum_positivi, 0)
                cum_positivi_lower = max(cum_positivi_lower, 0)
                cum_positivi_upper = max(cum_positivi_upper, 0)
                entry['totale_positivi'] = cum_positivi
                entry['totale_positivi_lower'] = cum_positivi_lower
                entry['totale_positivi_upper'] = cum_positivi_upper
                # Se vuoi aggiungere cumulativi anche ad altri indicatori derivati, aggiungi qui la logica.                
                # # Aggiungi trend e seasonal dalla previsione Prophet SOLO per la colonna principale (nuovi_positivi)
                main_col = 'nuovi_positivi' if 'nuovi_positivi' in self.columns else self.columns[0]
                model = self.models.get(main_col)
                if model is not None:
                    forecast = model.predict(df_future)
                    # Log diagnostico dei primi valori della componente stagionale totale
                    if i == 0:
                        seasonal_cols = [col for col in forecast.columns if col not in ['ds', 'yhat', 'trend', 'yhat_lower', 'yhat_upper']]
                        first10 = [float(sum(forecast[col].iloc[j] for col in seasonal_cols)) if seasonal_cols else None for j in range(10)]
                        self.logger.info(f"Primi 10 valori stagionalità totale Prophet ({main_col}): {first10}")
                        self.logger.info(f"Colonne di stagionalità trovate da Prophet: {seasonal_cols}")
                        if not seasonal_cols:
                            self.logger.warning("Nessuna componente stagionale trovata: verifica che Prophet abbia weekly/yearly seasonality attive e che i dati abbiano pattern periodici.")
                    entry['trend'] = float(forecast['trend'].iloc[i]) if 'trend' in forecast.columns else None
                    # Somma tutte le colonne di stagionalità per la componente stagionale totale
                    seasonal_cols = [col for col in forecast.columns if col not in ['ds', 'yhat', 'trend', 'yhat_lower', 'yhat_upper']]
                    if i == 0:
                        self.logger.info(f"Colonne di stagionalità trovate da Prophet: {seasonal_cols}")
                        if not seasonal_cols:
                            self.logger.warning("Nessuna componente stagionale trovata: verifica che Prophet abbia weekly/yearly seasonality attive e che i dati abbiano pattern periodici.")
                    entry['seasonal'] = float(sum(forecast[col].iloc[i] for col in seasonal_cols)) if seasonal_cols else None
                else:
                    entry['trend'] = None
                    entry['seasonal'] = None
                forecast_json.append(entry)
            # Logging di controllo
            self.logger.info(f"Forecast multi-colonna generato: {forecast_json[:2]} ...")
            from flask import Response as FlaskResponse
            if isinstance(forecast_json, FlaskResponse):
                self.logger.error("[DEFENSIVE] forecast_json è un Flask Response! Questo è un bug.")
                return []
            if not isinstance(forecast_json, list) or not all(isinstance(el, dict) for el in forecast_json):
                self.logger.error(f"[DEFENSIVE] forecast_json non è una lista di dict! Tipo: {type(forecast_json)}")
                return []
            return forecast_json
        except Exception as e:
            self.logger.error(f"Errore nella generazione forecast multi-target: {e}")
            return []

    def get_model_stats(self):
        return {
            'train_days': self.train_days,
            'last_train_date': self.last_train_date.strftime('%Y-%m-%d') if self.last_train_date else None
        }

    def get_mape(self, indicator='nuovi_positivi', days=7):
        import numpy as np
        if self.train_df is None or indicator not in self.columns:
            return None
        df = self.train_df.sort_values('data')
        y_true = df[indicator].values[-days:]
        model = self.models.get(indicator)
        if model is None:
            return None
        df_future = pd.DataFrame({'ds': df['data'].values[-days:]})
        forecast = model.predict(df_future)
        y_pred = forecast['yhat'].values
        mask = y_true != 0
        if not np.any(mask):
            return None
        mape = np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100
        return round(mape, 2)

