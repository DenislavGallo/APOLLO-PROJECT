# -*- coding: utf-8 -*-
"""
Modulo GeoProphetModel per Apollo Project
- Implementazione di Prophet per dati regionali e provinciali
- Supporto per MongoDB come fonte dati
- Previsioni multi-area (nazione, regione, provincia)
"""
from prophet import Prophet
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
import sys
import os

# Aggiungi server al path per importare i moduli
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_manager import db_manager

class GeoProphetModel:
    """
    Modello Prophet esteso per analisi e previsione di dati COVID-19 
    a diversi livelli geografici (nazionale, regionale, provinciale).
    """
    
    def __init__(self, 
                 area_type='national',  # 'national', 'regional', 'provincial'
                 area_name=None,        # nome regione/provincia o None per nazionale
                 columns=None,          # metriche da prevedere
                 train_days=300,        # giorni da usare per addestramento
                 csv_path=None):        # supporto legacy per file CSV
        """
        Inizializza un nuovo modello Prophet per dati geografici.
        
        Args:
            area_type: Tipo di area ('national', 'regional', 'provincial')
            area_name: Nome dell'area (es. 'Lombardia', 'Milano')
            columns: Lista di colonne da prevedere, se None usa default
            train_days: Numero di giorni da usare per l'addestramento
            csv_path: Percorso file CSV (solo per compatibilità legacy)
        """
        self.area_type = area_type
        self.area_name = area_name
        self.train_days = train_days
        self.csv_path = csv_path
        
        # Imposta colonne predefinite in base al tipo di area
        if columns is None:
            if area_type == 'provincial':
                # Per le province sono disponibili solo alcuni indicatori
                self.columns = ['totale_casi']
            else:
                # Per regioni e nazionale abbiamo più indicatori
                self.columns = [
                    'nuovi_positivi', 'deceduti', 'dimessi_guariti', 
                    'terapia_intensiva', 'ricoverati_con_sintomi'
                ]
        else:
            self.columns = columns
        
        # Dizionario per memorizzare i modelli addestrati
        self.models = {}
        # DataFrame di addestramento
        self.train_df = None
        # Ultima data disponibile per i dati di addestramento
        self.last_train_date = None
        
        # Impostazione logger
        self.logger = logging.getLogger('models.geo_prophet_model')
        
        # Connessione al database
        self.db_available = db_manager.connect()
        
        # Addestra i modelli
        self._fit_all()

    def _load_data(self):
        """
        Carica i dati per l'addestramento, prima dal database, poi dal CSV.
        
        Returns:
            pandas.DataFrame: Dati caricati o None in caso di errore
        """
        if self.db_available:
            try:
                # Determina la query corretta in base al tipo di area
                if self.area_type == 'national':
                    # Se nazionale, non serve area_name
                    data = db_manager.db[db_manager.COLLECTION_NATIONAL].find().sort("data", 1)
                    self.logger.info(f"Dati nazionali caricati dal database")
                elif self.area_type == 'regional' and self.area_name:
                    # Se regionale, filtra per nome regione
                    data = db_manager.db[db_manager.COLLECTION_REGIONAL].find(
                        {"denominazione_regione": self.area_name}
                    ).sort("data", 1)
                    self.logger.info(f"Dati regionali caricati dal database per: {self.area_name}")
                elif self.area_type == 'provincial' and self.area_name:
                    # Se provinciale, filtra per nome provincia
                    data = db_manager.db[db_manager.COLLECTION_PROVINCIAL].find(
                        {"denominazione_provincia": self.area_name}
                    ).sort("data", 1)
                    self.logger.info(f"Dati provinciali caricati dal database per: {self.area_name}")
                else:
                    self.logger.error(f"Tipo di area non supportato o nome mancante: {self.area_type}, {self.area_name}")
                    return None
                
                # Converti i dati dal database in DataFrame
                df = pd.DataFrame(list(data))
                
                # Converti colonna data in datetime se non lo è già
                if not pd.api.types.is_datetime64_any_dtype(df['data']):
                    df['data'] = pd.to_datetime(df['data'])
                
                if not df.empty:
                    return df
                else:
                    self.logger.warning(f"Nessun dato trovato nel database per {self.area_type} - {self.area_name}")
            except Exception as e:
                self.logger.error(f"Errore nel caricamento dati dal database: {str(e)}")
        
        # Se il database non è disponibile o non ci sono dati, prova con il CSV
        if self.csv_path and os.path.exists(self.csv_path):
            try:
                df = pd.read_csv(self.csv_path)
                df['data'] = pd.to_datetime(df['data'])
                
                # Se stiamo caricando da CSV ma vogliamo dati regionali/provinciali, filtra
                if self.area_type == 'regional' and self.area_name and 'denominazione_regione' in df.columns:
                    df = df[df['denominazione_regione'] == self.area_name]
                elif self.area_type == 'provincial' and self.area_name and 'denominazione_provincia' in df.columns:
                    df = df[df['denominazione_provincia'] == self.area_name]
                
                if not df.empty:
                    self.logger.info(f"Dati caricati da CSV per {self.area_type} - {self.area_name}")
                    return df
                else:
                    self.logger.warning(f"CSV esiste ma nessun dato trovato per {self.area_type} - {self.area_name}")
            except Exception as e:
                self.logger.error(f"Errore nel caricamento dati da CSV: {str(e)}")
        
        self.logger.error(f"Impossibile caricare dati per {self.area_type} - {self.area_name}")
        return None

    def _fit_all(self):
        """
        Addestra modelli Prophet per tutte le colonne specificate.
        """
        # Carica i dati
        df = self._load_data()
        if df is None or df.empty:
            self.logger.error("Nessun dato disponibile per l'addestramento.")
            return
        
        # Log dei dati caricati
        self.logger.info(f"Dati caricati: {len(df)} record da {df['data'].min()} a {df['data'].max()}")
        
        # Ordina per data
        df = df.sort_values('data')
        
        # Usa solo gli ultimi train_days per l'addestramento
        if len(df) > self.train_days:
            self.train_df = df.iloc[-self.train_days:].copy()
        else:
            self.train_df = df.copy()
        
        # Memorizza l'ultima data disponibile
        self.last_train_date = self.train_df['data'].max()
        
        # Addestra un modello per ogni colonna specificata
        for col in self.columns:
            try:
                # Verifica che la colonna esista nei dati
                if col not in self.train_df.columns:
                    self.logger.warning(f"Colonna {col} non trovata nei dati. Modello non addestrato.")
                    continue
                
                # Prepara DataFrame per Prophet (ds, y)
                prophet_df = pd.DataFrame({
                    'ds': self.train_df['data'],
                    'y': self.train_df[col]
                })
                
                # Crea e addestra il modello
                model = Prophet(weekly_seasonality=True, yearly_seasonality=True, daily_seasonality=False)
                model.fit(prophet_df)
                
                # Memorizza il modello
                self.models[col] = model
                self.logger.info(f"Modello Prophet addestrato per {self.area_type} - {self.area_name} - {col}")
            except Exception as e:
                self.logger.error(f"Errore addestrando Prophet per {col}: {e}")
                self.models[col] = None

    def forecast(self, days=30):
        """
        Genera previsioni per tutti gli indicatori modellati.
        
        Args:
            days: Numero di giorni futuri da prevedere
            
        Returns:
            list: Lista di dizionari con le previsioni
        """
        try:
            # Se nessun modello è stato addestrato, non possiamo fare previsioni
            if not self.models or self.last_train_date is None:
                self.logger.error("Nessun modello addestrato disponibile per la previsione.")
                return []
            
            # Crea DataFrame con le date future
            future_dates = pd.date_range(
                start=self.last_train_date + pd.Timedelta(days=1),
                periods=days
            )
            df_future = pd.DataFrame({'ds': future_dates})
            
            # Dizionario per memorizzare i risultati per ogni colonna
            results = {col: [] for col in self.columns}
            
            # Genera previsioni per ogni colonna
            for col in self.columns:
                model = self.models.get(col)
                if model is not None:
                    # Esegui la previsione
                    forecast = model.predict(df_future)
                    
                    # Estrai i valori previsti (yhat) e arrotonda
                    if self.area_type == 'provincial':
                        # Per le province, manteniamo valori decimali nei totali
                        results[col] = [float(max(y, 0)) for y in forecast['yhat']]
                    else:
                        # Per regioni e nazionale, arrotondiamo a interi
                        results[col] = [int(max(y, 0)) for y in forecast['yhat']]
                    
                    # Salva anche intervallo di confidenza se disponibile
                    if 'yhat_lower' in forecast.columns and 'yhat_upper' in forecast.columns:
                        results[col + '_lower'] = [float(y) for y in forecast['yhat_lower']]
                        results[col + '_upper'] = [float(y) for y in forecast['yhat_upper']]
                    else:
                        results[col + '_lower'] = [None] * days
                        results[col + '_upper'] = [None] * days
                else:
                    # Se il modello non esiste, riempi con None
                    results[col] = [None] * days
                    results[col + '_lower'] = [None] * days
                    results[col + '_upper'] = [None] * days
            
            # Lista per i risultati finali
            forecast_json = []
            
            # Calcola valori cumulativi se necessario
            cum_values = {}
            
            # Se abbiamo dati nazionali o regionali, calcola cumulativi
            if self.area_type in ['national', 'regional'] and not self.train_df.empty:
                # Prendi l'ultimo record per inizializzare i cumulativi
                last_row = self.train_df.iloc[-1]
                
                # Inizializza i valori cumulativi
                for field in ['totale_casi', 'totale_positivi']:
                    if field in last_row:
                        value = float(last_row[field]) if not pd.isnull(last_row[field]) else 0
                        cum_values[field] = value
                        cum_values[field + '_lower'] = value
                        cum_values[field + '_upper'] = value
            
            # Genera previsione per ogni giorno futuro
            for i, date in enumerate(future_dates):
                # Crea dizionario base per la data
                entry = {'data': date.strftime('%Y-%m-%d')}
                
                # Aggiungi indicatore del tipo di area
                if self.area_type == 'national':
                    entry['stato'] = 'ITA'  # Per compatibilità
                elif self.area_type == 'regional' and self.area_name:
                    entry['denominazione_regione'] = self.area_name
                elif self.area_type == 'provincial' and self.area_name:
                    entry['denominazione_provincia'] = self.area_name
                
                # Aggiungi valori previsti per ogni colonna
                for col in self.columns:
                    entry[col] = results[col][i]
                    # Aggiungi intervallo di confidenza
                    entry[col + '_lower'] = results.get(col + '_lower', [None]*days)[i]
                    entry[col + '_upper'] = results.get(col + '_upper', [None]*days)[i]
                
                # Calcolo cumulativo per nazionali e regionali
                if self.area_type in ['national', 'regional']:
                    # Aggiorna totale_casi (somma cumulativa dei nuovi_positivi)
                    if 'nuovi_positivi' in results and 'totale_casi' in cum_values:
                        nuovi_positivi = entry.get('nuovi_positivi', 0) or 0
                        nuovi_positivi_lower = entry.get('nuovi_positivi_lower', 0) or 0
                        nuovi_positivi_upper = entry.get('nuovi_positivi_upper', 0) or 0
                        
                        cum_values['totale_casi'] += nuovi_positivi
                        cum_values['totale_casi_lower'] += nuovi_positivi_lower
                        cum_values['totale_casi_upper'] += nuovi_positivi_upper
                        
                        entry['totale_casi'] = cum_values['totale_casi']
                        entry['totale_casi_lower'] = cum_values['totale_casi_lower']
                        entry['totale_casi_upper'] = cum_values['totale_casi_upper']
                    
                    # Aggiorna totale_positivi (positivi attuali)
                    if all(k in results for k in ['nuovi_positivi', 'dimessi_guariti', 'deceduti']) and 'totale_positivi' in cum_values:
                        nuovi_positivi = entry.get('nuovi_positivi', 0) or 0
                        nuovi_positivi_lower = entry.get('nuovi_positivi_lower', 0) or 0
                        nuovi_positivi_upper = entry.get('nuovi_positivi_upper', 0) or 0
                        
                        dimessi_guariti = entry.get('dimessi_guariti', 0) or 0
                        dimessi_guariti_lower = entry.get('dimessi_guariti_lower', 0) or 0
                        dimessi_guariti_upper = entry.get('dimessi_guariti_upper', 0) or 0
                        
                        deceduti = entry.get('deceduti', 0) or 0
                        deceduti_lower = entry.get('deceduti_lower', 0) or 0
                        deceduti_upper = entry.get('deceduti_upper', 0) or 0
                        
                        # Aggiorna positivi attuali
                        cum_values['totale_positivi'] += nuovi_positivi - dimessi_guariti - deceduti
                        cum_values['totale_positivi_lower'] += nuovi_positivi_lower - dimessi_guariti_upper - deceduti_upper
                        cum_values['totale_positivi_upper'] += nuovi_positivi_upper - dimessi_guariti_lower - deceduti_lower
                        
                        # Garantisci valori positivi o zero
                        cum_values['totale_positivi'] = max(cum_values['totale_positivi'], 0)
                        cum_values['totale_positivi_lower'] = max(cum_values['totale_positivi_lower'], 0)
                        cum_values['totale_positivi_upper'] = max(cum_values['totale_positivi_upper'], 0)
                        
                        entry['totale_positivi'] = cum_values['totale_positivi']
                        entry['totale_positivi_lower'] = cum_values['totale_positivi_lower']
                        entry['totale_positivi_upper'] = cum_values['totale_positivi_upper']
                
                # Aggiungi trend e componente stagionale per la metrica principale
                main_col = self.columns[0]  # Prima colonna come metrica principale
                model = self.models.get(main_col)
                
                if model is not None:
                    forecast = model.predict(df_future)
                    
                    # Estrai componente di trend
                    entry['trend'] = float(forecast['trend'].iloc[i]) if 'trend' in forecast.columns else None
                    
                    # Somma tutte le colonne di stagionalità per la componente stagionale totale
                    seasonal_cols = [col for col in forecast.columns 
                                    if col not in ['ds', 'yhat', 'trend', 'yhat_lower', 'yhat_upper']]
                    
                    # Log informativo solo per il primo giorno
                    if i == 0 and seasonal_cols:
                        self.logger.info(f"Componenti stagionali trovate: {seasonal_cols}")
                    
                    # Calcola la componente stagionale totale
                    entry['seasonal'] = (float(sum(forecast[col].iloc[i] for col in seasonal_cols)) 
                                        if seasonal_cols else None)
                else:
                    entry['trend'] = None
                    entry['seasonal'] = None
                
                # Aggiungi elemento alla lista dei risultati
                forecast_json.append(entry)
            
            # Log di controllo
            if forecast_json:
                self.logger.info(f"Generate {len(forecast_json)} previsioni per {self.area_type} - {self.area_name}")
            else:
                self.logger.warning(f"Nessuna previsione generata per {self.area_type} - {self.area_name}")
            
            return forecast_json
            
        except Exception as e:
            self.logger.error(f"Errore nella generazione delle previsioni: {str(e)}")
            return []

    def get_model_stats(self):
        """
        Restituisce statistiche sul modello.
        
        Returns:
            dict: Dizionario con statistiche
        """
        return {
            'area_type': self.area_type,
            'area_name': self.area_name,
            'columns': self.columns,
            'train_days': self.train_days,
            'models_trained': list(self.models.keys()),
            'last_train_date': self.last_train_date.strftime('%Y-%m-%d') if self.last_train_date else None,
            'data_points': len(self.train_df) if self.train_df is not None else 0
        }

    def get_mape(self, indicator=None, days=7):
        """
        Calcola l'errore medio percentuale assoluto (MAPE) per un indicatore.
        
        Args:
            indicator: Nome dell'indicatore (se None, usa il primo disponibile)
            days: Numero di giorni da considerare
            
        Returns:
            float: MAPE o None se non calcolabile
        """
        if self.train_df is None:
            return None
            
        # Se indicator non specificato, usa il primo disponibile
        if indicator is None and self.columns:
            indicator = self.columns[0]
            
        if indicator not in self.columns or indicator not in self.models:
            return None
            
        df = self.train_df.sort_values('data')
        
        # Assicurati di avere abbastanza dati
        if len(df) < days:
            days = len(df)
            
        y_true = df[indicator].values[-days:]
        model = self.models.get(indicator)
        
        if model is None:
            return None
            
        df_future = pd.DataFrame({'ds': df['data'].values[-days:]})
        forecast = model.predict(df_future)
        y_pred = forecast['yhat'].values
        
        # Calcola MAPE solo per valori diversi da zero
        mask = y_true != 0
        if not np.any(mask):
            return None
            
        mape = np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100
        return round(mape, 2)
