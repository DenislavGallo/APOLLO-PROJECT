# -*- coding: utf-8 -*-
"""
Apollo Project - Server di integrazione
import pandas as pd

Questo server Flask gestisce:
1. Servire l'applicazione web
2. Fornire API per i dati storici e predizioni
3. Eseguire il modello Prophet per le predizioni
"""

import os
import sys
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from flask import Flask, jsonify, render_template, send_from_directory, request
import logging
import random
from db_manager import db_manager  # Importa il gestore DB con registry e feature store
import joblib
import subprocess

# Aggiungi la directory parent al path per importare il modulo prophet_model
sys.path.append(os.path.join(os.path.dirname(__file__), 'models'))
from models.prophet_model import ProphetModel

# Importa l'utilità per l'elaborazione dei dati
from data_utils import CovidDataProcessor

# Configura il logger
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('apollo-server')

# Inizializza l'app Flask
app = Flask(__name__, 
            template_folder='../templates',
            static_folder='../static')

# === HANDLER GLOBALE ERRORI ===
@app.errorhandler(400)
def bad_request(e):
    return jsonify({'success': False, 'error': 'Bad Request', 'details': str(e)}), 400

@app.errorhandler(404)
def not_found(e):
    return jsonify({'success': False, 'error': 'Not Found', 'details': str(e)}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({'success': False, 'error': 'Internal Server Error', 'details': str(e)}), 500

# Percorsi file
DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dpc-covid19-ita-andamento-nazionale.csv')
FORECAST_PATH = os.path.join(app.static_folder, 'data/forecast_data.json')

# Modello Prophet
prophet_model = None

# Processore dati COVID
covid_processor = CovidDataProcessor(country_code="ITA")

# Parametri di training
TRAIN_DAYS = 300
FUTURE_DAYS = 30
COLUMN = 'nuovi_positivi'

# Cache dati per ottimizzare le prestazioni
data_cache = {
    'historical': None,
    'forecast': None,
    'last_update': None,
    'globe': None
}

@app.route('/')
def index():
    """Pagina principale dell'applicazione"""
    return render_template('index.html')

@app.route('/previsioni')
def previsioni():
    """Pagina delle previsioni"""
    return render_template('previsioni.html')

@app.route('/statistiche')
def statistiche():
    """Pagina delle statistiche"""
    return render_template('statistiche.html')

@app.route('/informazioni')
def informazioni():
    """Pagina delle informazioni"""
    return render_template('informazioni.html')

@app.route('/landing')
def landing():
    """Landing page con animazioni"""
    return render_template('landing.html')

@app.route('/api/data/historical')
def get_historical_data():
    """API: Restituisce SOLO i dati storici usati per l'addestramento Prophet (train set), con NaN -> None e data in formato YYYY-MM-DD. Ora supporta parametro country."""
    from flask import request
    import numpy as np
    country = request.args.get('country', 'ITA').upper()
    # Validazione country: solo 3 lettere maiuscole
    if not country.isalpha() or len(country) != 3:
        logger.warning(f"[API] Parametro country non valido: {country}")
        return jsonify({'success': False, 'error': 'Parametro country non valido. Deve essere un codice ISO 3 lettere.'}), 400
    try:
        logger.info(f"[API] Richiesta dati storici per paese: {country}")
        processor = CovidDataProcessor(country_code=country)
        if not processor.load_data() or processor.national_data is None:
            logger.error(f"[API] Dati non disponibili per {country}")
            return jsonify({'success': False, 'error': f'Dati non disponibili per {country}'}), 404
        df = processor.national_data.copy()
        df = df.sort_values('data')
        df = df.iloc[:TRAIN_DAYS]
        # Forza la colonna data nel formato YYYY-MM-DD
        df['data'] = pd.to_datetime(df['data']).dt.strftime('%Y-%m-%d')
        # Sostituisci tutti i NaN (anche stringhe) con None
        data = []
        for row in df.to_dict(orient='records'):
            clean_row = {}
            for k, v in row.items():
                if isinstance(v, float) and (np.isnan(v) or v == float('nan')):
                    clean_row[k] = None
                elif isinstance(v, str) and v.lower() == 'nan':
                    clean_row[k] = None
                else:
                    clean_row[k] = v
            data.append(clean_row)
        logger.info(f"[API] Dati storici puliti: {len(data)} record restituiti per {country}.")
        return jsonify({'success': True, 'data': data, 'country': country})
    except Exception as e:
        import traceback
        logger.error(f"Errore nel caricamento dei dati storici per {country}: {e}\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e), 'country': country}), 500

@app.route('/api/data/forecast')
def get_forecast_data():
    """API: Restituisce SOLO le previsioni future generate dal modello Prophet. Ora supporta parametro country."""
    from flask import request
    country = request.args.get('country', 'ITA').upper()
    # Validazione country: solo 3 lettere maiuscole
    if not country.isalpha() or len(country) != 3:
        logger.warning(f"[API] Parametro country non valido: {country}")
        return jsonify({'success': False, 'error': 'Parametro country non valido. Deve essere un codice ISO 3 lettere.', 'country': country}), 400
    try:
        logger.info(f"[API] Richiesta forecast per paese: {country}")
        processor = CovidDataProcessor(country_code=country)
        if not processor.load_data() or processor.national_data is None:
            logger.error(f"[API] Dati non disponibili per {country}")
            return jsonify({'success': False, 'error': f'Dati non disponibili per {country}', 'country': country}), 404
        # Crea un nuovo ProphetModel per il paese richiesto
        try:
            model = ProphetModel(processor.national_file, columns=['nuovi_positivi', 'deceduti', 'dimessi_guariti', 'terapia_intensiva', 'ricoverati_con_sintomi'], train_days=TRAIN_DAYS)
            forecast_data = model.forecast(days=FUTURE_DAYS)
            if not isinstance(forecast_data, list):
                logger.error(f"[ERRORE] forecast_data non è una lista ma: {type(forecast_data)}. Valore: {forecast_data}")
                forecast_data = []
            else:
                for el in forecast_data:
                    if not isinstance(el, dict):
                        logger.error(f"[ERRORE] Elemento non dict in forecast_data: {el}")
                        forecast_data = []
                        break
            return jsonify({'success': True, 'data': forecast_data, 'country': country})
        except Exception as e:
            logger.warning(f"Errore Prophet per {country}: {e}")
            return jsonify({'success': False, 'error': f'Errore Prophet per {country}: {e}', 'country': country}), 500
    except Exception as e:
        logger.error(f"Errore nella generazione delle previsioni per {country}: {e}")
        return jsonify({'success': False, 'error': str(e), 'country': country}), 500

@app.route('/api/data/latest')
def get_latest_data():
    """API: Restituisce i dati più recenti degli ultimi 30 giorni. Ora supporta parametro country."""
    from flask import request
    country = request.args.get('country', 'ITA').upper()
    # Validazione country: solo 3 lettere maiuscole
    if not country.isalpha() or len(country) != 3:
        logger.warning(f"[API] Parametro country non valido: {country}")
        return jsonify({'success': False, 'error': 'Parametro country non valido. Deve essere un codice ISO 3 lettere.', 'country': country}), 400
    try:
        logger.info(f"[API] Richiesta dati recenti per paese: {country}")
        processor = CovidDataProcessor(country_code=country)
        if not processor.load_data() or processor.national_data is None:
            logger.error(f"[API] Dati non disponibili per {country}")
            return jsonify({'success': False, 'error': f'Dati non disponibili per {country}', 'country': country}), 404
        # Ottieni gli ultimi 30 giorni di dati
        latest_data = processor.get_latest_data(30)
        if not latest_data:
            return jsonify({
                'success': False,
                'error': f"Dati recenti non disponibili per {country}",
                'country': country
            }), 404
        # Sostituisci NaN con None
        df = pd.DataFrame(latest_data)
        df = df.where(pd.notnull(df), None)
        latest_data = df.to_dict(orient='records')
        return jsonify({
            'success': True,
            'data': latest_data,
            'country': country
        })
    except Exception as e:
        logger.error(f"Errore nel caricamento dei dati recenti per {country}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'country': country
        }), 500

@app.route('/api/data/globe')
def get_globe_data():
    """API: Restituisce i dati per il globo 3D, aggregando più paesi se disponibili."""
    from flask import request
    country = request.args.get('country', None)
    # Validazione opzionale country
    if country is not None:
        country = country.upper()
        if not country.isalpha() or len(country) != 3:
            logger.warning(f"[API] Parametro country non valido: {country}")
            return jsonify({'success': False, 'error': 'Parametro country non valido. Deve essere un codice ISO 3 lettere.', 'country': country}), 400
    try:
        logger.info("[API] Richiesta dati globo 3D")
        # Usa la funzione multi-paese
        processor = CovidDataProcessor(country_code="ITA")
        globe_data = processor.get_world_data()
        # Sostituisci NaN con None
        import pandas as pd
        df = pd.DataFrame(globe_data)
        df = df.where(pd.notnull(df), None)
        globe_data = df.to_dict(orient='records')
        data_cache['globe'] = globe_data
        return jsonify({
            'success': True,
            'data': globe_data
        })
    except Exception as e:
        logger.error(f"Errore nella generazione dei dati del globo: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

    except Exception as e:
        logger.error(f"Errore nella generazione dei dati del globo: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/stats/model')
def get_model_stats():
    """API: Restituisce statistiche sul modello e la sua accuratezza"""
    if prophet_model is None:
        return jsonify({
            'success': False,
            'error': 'Modello non inizializzato'
        }), 404
    
    try:
        stats = prophet_model.get_model_stats()
        return jsonify({
            'success': True,
            'data': stats
        })
    except Exception as e:
        logger.error(f"Errore nel recupero delle statistiche del modello: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/model/mape')
def api_mape():
    """
    API: restituisce la MAPE per l'indicatore selezionato e il paese richiesto.
    Sicurezza: questo endpoint valida tutti i parametri di input (indicator, days, country) e restituisce errore 400 in caso di input non valido.
    """
    from flask import request
    VALID_INDICATORS = ['nuovi_positivi', 'deceduti', 'dimessi_guariti', 'terapia_intensiva', 'ricoverati_con_sintomi']
    indicator = request.args.get('indicator', 'nuovi_positivi')
    days_raw = request.args.get('days', '7')
    country = request.args.get('country', 'ITA').upper()
    logger.info(f"[MAPE] Richiesta per country={country}, indicator={indicator}, days={days_raw}")
    # Validazione indicator
    if indicator not in VALID_INDICATORS:
        logger.warning(f"[MAPE] Indicatore non valido: {indicator}")
        return jsonify({'success': False, 'error': f"Indicatore non valido. Valori ammessi: {', '.join(VALID_INDICATORS)}"}), 400
    # Validazione days
    try:
        days = int(days_raw)
        if days <= 0:
            raise ValueError
    except Exception:
        logger.warning(f"[MAPE] Parametro days non valido: {days_raw}")
        return jsonify({'success': False, 'error': 'Parametro days deve essere un intero positivo'}), 400
    try:
        from models.prophet_model import ProphetModel
        from data_utils import CovidDataProcessor
        logger.info(f"[MAPE] Carico dati per {country}")
        processor = CovidDataProcessor(country_code=country)
        if not processor.load_data() or processor.national_data is None:
            logger.error(f"[MAPE] Dati non disponibili per {country}")
            return jsonify({'success': False, 'error': f'Dati non disponibili per {country}', 'country': country}), 404
        logger.info(f"[MAPE] Creo ProphetModel per {country}")
        model = ProphetModel(processor.national_file, columns=VALID_INDICATORS, train_days=300)
        logger.info(f"[MAPE] Calcolo MAPE per {indicator}, ultimi {days} giorni")
        mape = model.get_mape(indicator=indicator, days=days)
        if mape is None:
            logger.warning(f"[MAPE] MAPE non disponibile per {country}")
            return jsonify({'success': False, 'error': f'MAPE non disponibile per {country}', 'country': country}), 404
        logger.info(f"[MAPE] Valore MAPE calcolato: {mape}")
        return jsonify({'success': True, 'mape': mape, 'country': country})
    except Exception as ex:
        logger.error(f"[MAPE] Errore interno: {ex}", exc_info=True)
        return jsonify({'success': False, 'error': f'Errore interno: {str(ex)}', 'country': country}), 500


# NOTA: Tutti gli endpoint che accettano parametri via query string devono implementare validazione robusta degli input.
# Attualmente, /api/model/mape è l'unico endpoint che richiede questa validazione. Estendere questa logica a futuri endpoint parametrizzati.


# Funzione di fallback per generare dati di previsione simulati
def generate_simulated_forecast():
    try:
        # Se i dati storici sono disponibili, usa quelli come base
        if covid_processor.national_data is not None:
            df = covid_processor.national_data.copy()
            # Ottieni ultimi 60 giorni
            last_60days = df.tail(60).copy()
            
            # Crea date future (30 giorni)
            last_date = last_60days['data'].max()
            future_dates = [last_date + timedelta(days=i+1) for i in range(30)]
            
            # Crea dataframe simulato
            simulated_df = pd.DataFrame()
            simulated_df['data'] = future_dates
            simulated_df['stato'] = 'ITA'
            
            # Media degli ultimi 7 giorni come base per le previsioni
            avg_7d = last_60days.tail(7)['nuovi_positivi'].mean()
            std_7d = last_60days.tail(7)['nuovi_positivi'].std() / 2  # Riduci la variabilità
            
            # Genera nuovi casi simulati con trend discendente
            trend = np.linspace(1.0, 0.8, 30)  # Trend discendente del 20%
            nuovi_positivi = []
            for i in range(30):
                base = avg_7d * trend[i]
                noise = np.random.normal(0, std_7d)
                value = max(0, int(base + noise))
                nuovi_positivi.append(value)
            
            simulated_df['nuovi_positivi'] = nuovi_positivi
            
            # Copia gli ultimi valori per altri indicatori
            last_values = last_60days.iloc[-1].to_dict()
            for col in ['totale_positivi', 'dimessi_guariti', 'deceduti', 'totale_casi',
                         'terapia_intensiva', 'ricoverati_con_sintomi']:
                if col in last_values:
                    # Incrementa leggermente per ogni giorno
                    base_val = last_values[col]
                    if col == 'totale_casi':
                        # Incrementa il totale casi con i nuovi positivi
                        total_cases = [base_val]
                        for i in range(30):
                            total_cases.append(total_cases[-1] + nuovi_positivi[i])
                        simulated_df[col] = total_cases[1:]  # Escludi il primo valore (base)
                    elif col == 'dimessi_guariti':
                        # Incrementa i guariti in modo plausibile
                        recovery_rate = 0.8  # 80% di guarigione
                        recovered = [base_val]
                        for i in range(30):
                            new_recovered = int(nuovi_positivi[i] * recovery_rate * 0.7)  # 70% dei nuovi casi guariscono
                            recovered.append(recovered[-1] + new_recovered)
                        simulated_df[col] = recovered[1:]
                    elif col == 'deceduti':
                        # Incrementa i decessi in modo plausibile
                        death_rate = 0.005  # 0.5% tasso di mortalità
                        deaths = [base_val]
                        for i in range(30):
                            new_deaths = int(nuovi_positivi[i] * death_rate)
                            deaths.append(deaths[-1] + new_deaths)
                        simulated_df[col] = deaths[1:]
                    elif col == 'totale_positivi':
                        # Calcola attivi in base a nuovi casi, guariti e decessi
                        active = [base_val]
                        for i in range(30):
                            new_active = nuovi_positivi[i] - int(nuovi_positivi[i] * 0.8 * 0.7) - int(nuovi_positivi[i] * 0.005)
                            active.append(max(0, active[-1] + new_active))
                        simulated_df[col] = active[1:]
                    else:
                        # Trend leggermente decrescente per altri indicatori
                        values = [base_val]
                        for i in range(30):
                            noise = np.random.normal(0, base_val * 0.02)  # 2% di rumore
                            trend_factor = 0.99  # Decrescita dell'1% al giorno
                            values.append(max(0, int(values[-1] * trend_factor + noise)))
                        simulated_df[col] = values[1:]
            
            # Converti date in stringhe
            simulated_df['data'] = simulated_df['data'].dt.strftime('%Y-%m-%d')
            
            # Converti in records
            simulated_data = simulated_df.to_dict(orient='records')
        else:
            # Se non ci sono dati storici, crea dati completamente simulati
            simulated_data = []
            today = datetime.now()
            
            for i in range(30):
                date = today + timedelta(days=i)
                simulated_data.append({
                    'data': date.strftime('%Y-%m-%d'),
                    'stato': 'ITA',
                    'nuovi_positivi': int(np.random.normal(500, 100)),
                    'totale_positivi': int(np.random.normal(10000, 1000)),
                    'dimessi_guariti': int(np.random.normal(5000000, 10000)),
                    'deceduti': int(np.random.normal(150000, 1000)),
                    'totale_casi': int(np.random.normal(5200000, 10000)),
                    'terapia_intensiva': int(np.random.normal(30, 5)),
                    'ricoverati_con_sintomi': int(np.random.normal(200, 20))
                })
        
        logger.info("Previsioni generate con dati simulati")
        
        # Aggiorna cache
        data_cache['forecast'] = simulated_data
        data_cache['last_update'] = datetime.now()
        
        return jsonify({
            'success': True,
            'data': simulated_data,
            'cached': False,
            'last_update': data_cache['last_update'].isoformat(),
            'simulated': True
        })
    except Exception as e:
        logger.error(f"Errore nella generazione delle previsioni simulate: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Endpoint per servire i file statici che potrebbero non essere trovati direttamente
@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# Endpoint per dati regionali
@app.route('/api/data/regional')
def get_regional_data():
    """API: Restituisce i dati per una specifica regione."""
    from flask import request
    region_name = request.args.get('region', None)
    
    if not region_name:
        # Restituisci la lista delle regioni disponibili
        from data_utils import get_available_regions
        regions = get_available_regions()
        return jsonify({
            'success': True, 
            'data': regions,
            'message': 'Usa parametro region= per specificare una regione'
        })
    
    try:
        # Usa il modello GeoProphetModel per ottenere dati specifici per la regione
        from models.geo_prophet_model import GeoProphetModel
        model = GeoProphetModel(area_type='regional', area_name=region_name)
        latest_data = model.get_latest_data(days=30)
        
        if not latest_data:
            return jsonify({
                'success': False,
                'error': f'Dati non disponibili per la regione: {region_name}'
            }), 404
            
        return jsonify({
            'success': True,
            'data': latest_data,
            'region': region_name
        })
    except Exception as e:
        logger.error(f"Errore nel caricamento dei dati regionali per {region_name}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'region': region_name
        }), 500

# Endpoint per dati provinciali
@app.route('/api/data/provincial')
def get_provincial_data():
    """API: Restituisce i dati per una specifica provincia."""
    from flask import request
    province_name = request.args.get('province', None)
    region_name = request.args.get('region', None)
    
    if not province_name:
        # Restituisci la lista delle province disponibili
        from data_utils import get_available_provinces
        provinces = get_available_provinces(region_name)
        return jsonify({
            'success': True, 
            'data': provinces,
            'message': 'Usa parametro province= per specificare una provincia'
        })
    
    try:
        # Usa il modello GeoProphetModel per ottenere dati specifici per la provincia
        from models.geo_prophet_model import GeoProphetModel
        model = GeoProphetModel(area_type='provincial', area_name=province_name)
        latest_data = model.get_latest_data(days=30)
        
        if not latest_data:
            return jsonify({
                'success': False,
                'error': f'Dati non disponibili per la provincia: {province_name}'
            }), 404
            
        return jsonify({
            'success': True,
            'data': latest_data,
            'province': province_name
        })
    except Exception as e:
        logger.error(f"Errore nel caricamento dei dati provinciali per {province_name}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'province': province_name
        }), 500

# Endpoint per previsioni regionali
@app.route('/api/forecast/regional')
def get_regional_forecast():
    """API: Restituisce le previsioni future per una specifica regione."""
    from flask import request
    region_name = request.args.get('region', None)
    days = int(request.args.get('days', '30'))
    
    if not region_name:
        return jsonify({
            'success': False,
            'error': 'Specifica una regione con il parametro region='
        }), 400
    
    try:
        # Usa il modello GeoProphetModel per generare previsioni regionali
        from models.geo_prophet_model import GeoProphetModel
        model = GeoProphetModel(area_type='regional', area_name=region_name)
        forecast_data = model.forecast(days=days)
        
        if not forecast_data:
            return jsonify({
                'success': False,
                'error': f'Impossibile generare previsioni per la regione: {region_name}'
            }), 404
            
        return jsonify({
            'success': True,
            'data': forecast_data,
            'region': region_name,
            'days': days
        })
    except Exception as e:
        logger.error(f"Errore nella generazione delle previsioni regionali per {region_name}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'region': region_name
        }), 500

# Endpoint per previsioni provinciali
@app.route('/api/forecast/provincial')
def get_provincial_forecast():
    """API: Restituisce le previsioni future per una specifica provincia."""
    from flask import request
    province_name = request.args.get('province', None)
    days = int(request.args.get('days', '30'))
    
    if not province_name:
        return jsonify({
            'success': False,
            'error': 'Specifica una provincia con il parametro province='
        }), 400
    
    try:
        # Usa il modello GeoProphetModel per generare previsioni provinciali
        from models.geo_prophet_model import GeoProphetModel
        model = GeoProphetModel(area_type='provincial', area_name=province_name)
        forecast_data = model.forecast(days=days)
        
        if not forecast_data:
            return jsonify({
                'success': False,
                'error': f'Impossibile generare previsioni per la provincia: {province_name}'
            }), 404
            
        return jsonify({
            'success': True,
            'data': forecast_data,
            'province': province_name,
            'days': days
        })
    except Exception as e:
        logger.error(f"Errore nella generazione delle previsioni provinciali per {province_name}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'province': province_name
        }), 500

# === ENDPOINT: Elenco modelli Prophet registrati ===
@app.route('/api/models/prophet', methods=['GET'])
def list_prophet_models():
    """Restituisce la lista dei modelli Prophet registrati nel model registry"""
    area_type = request.args.get('area_type', None)
    area_name = request.args.get('area_name', None)
    models = db_manager.list_models(area_type=area_type, area_name=area_name)
    # Serializza ObjectId e datetime
    for m in models:
        m['_id'] = str(m['_id'])
        if 'created_at' in m:
            m['created_at'] = m['created_at'].isoformat()
    return jsonify({'success': True, 'models': models})

# === ENDPOINT: Feature Store ===
@app.route('/api/features', methods=['GET'])
def get_features():
    """Restituisce le feature dal feature store per area e intervallo di date"""
    area_type = request.args.get('area_type', 'national')
    area_name = request.args.get('area_name', 'ITA')
    start_date = request.args.get('start_date', None)
    end_date = request.args.get('end_date', None)
    features = db_manager.get_features(area_type, area_name, start_date, end_date)
    # Serializza ObjectId e datetime
    for f in features:
        f['_id'] = str(f['_id'])
        if 'data' in f and hasattr(f['data'], 'isoformat'):
            f['data'] = f['data'].isoformat()
    return jsonify({'success': True, 'features': features})

# === ENDPOINT: Real-time Prophet prediction ===
@app.route('/api/predict/prophet', methods=['GET'])
def predict_prophet():
    """Restituisce una previsione real-time usando il modello Prophet più recente dal registry"""
    indicator = request.args.get('indicator', 'nuovi_positivi')
    area_type = request.args.get('area_type', 'national')
    area_name = request.args.get('area_name', 'ITA')
    days = int(request.args.get('days', 30))
    # Recupera il modello più recente dal registry
    model_doc = db_manager.get_latest_model(f'prophet_{area_name}_{indicator}', area_type, area_name)
    if not model_doc:
        return jsonify({'success': False, 'error': 'Modello non trovato'}), 404
    model_path = model_doc['file_path']
    try:
        model = joblib.load(model_path)
    except Exception as e:
        return jsonify({'success': False, 'error': f'Errore caricando il modello: {str(e)}'}), 500
    # Prepara le date future
    today = datetime.today()
    import pandas as pd
    future_dates = pd.date_range(start=today + timedelta(days=1), periods=days)
    df_future = pd.DataFrame({'ds': future_dates})
    # Fai la previsione
    try:
        forecast = model.predict(df_future)
        yhat = forecast['yhat'].tolist()
        yhat_lower = forecast['yhat_lower'].tolist() if 'yhat_lower' in forecast else None
        yhat_upper = forecast['yhat_upper'].tolist() if 'yhat_upper' in forecast else None
        result = {
            'success': True,
            'indicator': indicator,
            'area_type': area_type,
            'area_name': area_name,
            'days': days,
            'prediction': yhat,
            'yhat_lower': yhat_lower,
            'yhat_upper': yhat_upper
        }
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': f'Errore nella previsione: {str(e)}'}), 500

# === ENDPOINT ADMIN: Aggiornamento dati dal web ===
@app.route('/admin/update_data', methods=['POST'])
def admin_update_data():
    """Endpoint admin per aggiornare i dati dal web. Richiede parametro 'secret' per autorizzazione."""
    secret = request.form.get('secret')
    # Sostituisci 'TUOSEGRETO' con una chiave segreta a tua scelta
    if secret != 'TUOSEGRETO':
        return jsonify({'success': False, 'error': 'Non autorizzato'}), 403
    try:
        # Lancia lo script di aggiornamento
        result = subprocess.run(['python', 'server/update_data_from_web.py'], capture_output=True, text=True)
        output = result.stdout + '\n' + result.stderr
        if result.returncode == 0:
            return jsonify({'success': True, 'output': output})
        else:
            return jsonify({'success': False, 'output': output}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Avvio server in modalità debug per sviluppo
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Avvio server Apollo su porta {port}")

    # DEBUG: Stampa tutte le route Flask attive
    print("\nROUTE FLASK ATTIVE:")
    for rule in app.url_map.iter_rules():
        print(f"{rule.endpoint:30s} -> {rule}")
    print()

    # Precarica il modello Prophet e i dati
    try:
        covid_processor.load_data()
        logger.info(f"Dati COVID-19 caricati con successo: {len(covid_processor.national_data)} record")
        # Precarica ProphetModel solo per ITA (opzionale, ogni richiesta ora crea il modello per il paese richiesto)
        if prophet_model is None:
            from models.prophet_model import ProphetModel
            from models.geo_prophet_model import GeoProphetModel
            prophet_model = ProphetModel(covid_processor.national_file, columns=['nuovi_positivi', 'deceduti', 'dimessi_guariti', 'terapia_intensiva', 'ricoverati_con_sintomi'], train_days=TRAIN_DAYS)
            logger.info("Modello Prophet ITA precaricato con successo")
    except Exception as e:
        logger.warning(f"Impossibile precaricare i dati o il modello: {e}")
    app.run(host='0.0.0.0', port=port, debug=True)
