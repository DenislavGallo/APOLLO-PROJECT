# --------------------------------------------------------------------------- #
# Progetto Apollo: Utility per elaborazione dati COVID-19                     #
# --------------------------------------------------------------------------- #

import pandas as pd
import numpy as np
import os
import requests
from datetime import datetime, timedelta
import logging
import json

# Importa il gestore del database MongoDB
from db_manager import db_manager

logger = logging.getLogger('apollo-datautils')

# URL per i dati più recenti
REGIONAL_DATA_URL = "https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-regioni/dpc-covid19-ita-regioni-latest.csv"
PROVINCIAL_DATA_URL = "https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-province/dpc-covid19-ita-province-latest.csv"

# URL per i dati storici (serie complete)
REGIONAL_HISTORY_URL = "https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-regioni/dpc-covid19-ita-regioni.csv"
PROVINCIAL_HISTORY_URL = "https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-province/dpc-covid19-ita-province.csv"

# Percorsi per salvare i file CSV scaricati
BASE_DIR = os.path.dirname(os.path.abspath(__file__)) # Directory corrente di data_utils.py
DATA_CACHE_DIR = os.path.join(BASE_DIR, "data_cache")

# Assicurati che la directory esista
os.makedirs(DATA_CACHE_DIR, exist_ok=True)

# Percorsi per i file locali
LOCAL_REGIONAL_CSV_PATH = os.path.join(DATA_CACHE_DIR, "dpc-covid19-ita-regioni-latest.csv")
LOCAL_PROVINCIAL_CSV_PATH = os.path.join(DATA_CACHE_DIR, "dpc-covid19-ita-province-latest.csv")
LOCAL_REGIONAL_HISTORY_PATH = os.path.join(DATA_CACHE_DIR, "dpc-covid19-ita-regioni.csv")
LOCAL_PROVINCIAL_HISTORY_PATH = os.path.join(DATA_CACHE_DIR, "dpc-covid19-ita-province.csv")

# Percorso per il file nazionale
LOCAL_NATIONAL_CSV_PATH = os.path.join(os.path.dirname(BASE_DIR), "dpc-covid19-ita-andamento-nazionale.csv")

def download_csv_from_url(url, save_path):
    """
    Scarica un file CSV da un URL e lo salva in un percorso specificato.

    Args:
        url (str): L'URL da cui scaricare il CSV.
        save_path (str): Il percorso completo (inclusa la cartella e il nome del file)
                         dove salvare il file CSV.

    Returns:
        bool: True se il download e il salvataggio hanno avuto successo, False altrimenti.
    """
    try:
        # Assicurati che la directory di destinazione esista
        os.makedirs(os.path.dirname(save_path), exist_ok=True)

        response = requests.get(url)
        response.raise_for_status()  # Solleva un'eccezione per risposte HTTP errate (4xx o 5xx)
        
        # Scrivi il contenuto nel file locale
        # Usiamo 'w' per scrivere in modalità testo, assicurando la codifica corretta (UTF-8 è comune per questi file)
        with open(save_path, 'w', encoding='utf-8') as f:
            f.write(response.text)
        
        print(f"File CSV scaricato con successo e salvato in: {save_path}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Errore durante il download del file da {url}: {e}")
        return False
    except IOError as e:
        print(f"Errore durante il salvataggio del file in {save_path}: {e}")
        return False

def load_regional_data_from_csv(file_path):
    """
    Carica i dati regionali da un file CSV in un DataFrame Pandas.

    Args:
        file_path (str): Il percorso del file CSV da caricare.

    Returns:
        pandas.DataFrame: DataFrame con i dati regionali, o None se si verifica un errore.
    """
    try:
        df = pd.read_csv(file_path)
        # Converti la colonna 'data' in oggetti datetime
        # Prophet si aspetta la colonna data in formato datetime
        df['data'] = pd.to_datetime(df['data'])
        print(f"Dati regionali caricati con successo da: {file_path}")
        return df
    except FileNotFoundError:
        print(f"Errore: File non trovato in {file_path}")
        return None
    except Exception as e:
        print(f"Errore durante il caricamento o la processazione del CSV {file_path}: {e}")
        return None



def preprocess_regional_data_for_prophet(df_regional, region_name, metric_column='nuovi_positivi'):
    """
    Prepara i dati di una specifica regione per l'utilizzo con Prophet.

    Args:
        df_regional (pandas.DataFrame): DataFrame contenente i dati di tutte le regioni.
        region_name (str): Il nome della regione da estrarre (es. "Lombardia").
                           Deve corrispondere ai valori nella colonna 'denominazione_regione'.
        metric_column (str): Il nome della colonna da utilizzare come valore 'y' per Prophet
                             (es. 'nuovi_positivi', 'deceduti').

    Returns:
        pandas.DataFrame: DataFrame con colonne 'ds' (data) e 'y' (metrica),
                          pronto per Prophet, o None se la regione o la metrica non sono valide.
    """
    if df_regional is None:
        return None

    # Filtra per la regione specificata
    df_filtered_region = df_regional[df_regional['denominazione_regione'] == region_name].copy()

    if df_filtered_region.empty:
        print(f"Attenzione: Nessun dato trovato per la regione '{region_name}'. Verifica il nome.")
        return None

    if metric_column not in df_filtered_region.columns:
        print(f"Attenzione: La metrica '{metric_column}' non è presente nelle colonne del DataFrame.")
        print(f"Colonne disponibili: {df_filtered_region.columns.tolist()}")
        return None

    # Seleziona e rinomina le colonne per Prophet
    # 'data' -> 'ds'
    # la metrica scelta (es. 'nuovi_positivi') -> 'y'
    df_prophet = df_filtered_region[['data', metric_column]].rename(
        columns={'data': 'ds', metric_column: 'y'}
    )

    # Assicurati che 'y' sia numerico (potrebbe contenere NaN, Prophet li gestisce)
    df_prophet['y'] = pd.to_numeric(df_prophet['y'], errors='coerce')
    
    # Rimuovi eventuali righe dove 'y' è diventato NaT a causa di coercizione (se non erano numeri)
    # o dove 'ds' potrebbe essere NaT (anche se la conversione precedente dovrebbe averlo gestito)
    df_prophet.dropna(subset=['ds', 'y'], inplace=True)
    
    # Ordina per data, che è una buona pratica per le serie temporali
    df_prophet.sort_values(by='ds', inplace=True)
    
    print(f"Dati per la regione '{region_name}' e metrica '{metric_column}' preparati per Prophet.")
    return df_prophet



def load_provincial_data_from_csv(file_path):
    """
    Carica i dati provinciali da un file CSV in un DataFrame Pandas.

    Args:
        file_path (str): Il percorso del file CSV da caricare.

    Returns:
        pandas.DataFrame: DataFrame con i dati provinciali, o None se si verifica un errore.
    """
    try:
        df = pd.read_csv(file_path)
        # Converti la colonna 'data' in oggetti datetime
        df['data'] = pd.to_datetime(df['data'])
        logger.info(f"Dati provinciali caricati con successo da: {file_path} - {len(df)} record")
        return df
    except FileNotFoundError:
        logger.error(f"Errore: File non trovato in {file_path}")
        return None
    except Exception as e:
        logger.error(f"Errore durante il caricamento o la processazione del CSV {file_path}: {e}")
        return None


def preprocess_provincial_data_for_prophet(df_provincial, province_name, metric_column='totale_casi'):
    """
    Prepara i dati di una specifica provincia per l'utilizzo con Prophet.

    Args:
        df_provincial (pandas.DataFrame): DataFrame contenente i dati di tutte le province.
        province_name (str): Il nome della provincia da estrarre (es. "Milano").
                           Deve corrispondere ai valori nella colonna 'denominazione_provincia'.
        metric_column (str): Il nome della colonna da utilizzare come valore 'y' per Prophet
                             (es. 'totale_casi').

    Returns:
        pandas.DataFrame: DataFrame con colonne 'ds' (data) e 'y' (metrica),
                          pronto per Prophet, o None se la provincia o la metrica non sono valide.
    """
    if df_provincial is None:
        return None

    # Filtra per la provincia specificata
    df_filtered_province = df_provincial[df_provincial['denominazione_provincia'] == province_name].copy()

    if df_filtered_province.empty:
        logger.warning(f"Nessun dato trovato per la provincia '{province_name}'. Verifica il nome.")
        return None

    if metric_column not in df_filtered_province.columns:
        logger.warning(f"La metrica '{metric_column}' non è presente nelle colonne del DataFrame provinciale.")
        logger.info(f"Colonne disponibili: {df_filtered_province.columns.tolist()}")
        return None

    # Seleziona e rinomina le colonne per Prophet
    df_prophet = df_filtered_province[['data', metric_column]].rename(
        columns={'data': 'ds', metric_column: 'y'}
    )

    # Assicurati che 'y' sia numerico 
    df_prophet['y'] = pd.to_numeric(df_prophet['y'], errors='coerce')
    
    # Rimuovi eventuali righe dove 'y' è NaN
    df_prophet.dropna(subset=['ds', 'y'], inplace=True)
    
    # Ordina per data
    df_prophet.sort_values(by='ds', inplace=True)
    
    logger.info(f"Dati per la provincia '{province_name}' e metrica '{metric_column}' preparati per Prophet.")
    return df_prophet


def get_prophet_ready_provincial_data(province_name, 
                                     metric_column='totale_casi', 
                                     force_download=False):
    """
    Ottiene i dati di una specifica provincia pronti per Prophet,
    scaricandoli se necessario.

    Args:
        province_name (str): Il nome della provincia.
        metric_column (str, optional): La metrica da usare per 'y'. 
                                       Default 'totale_casi'.
        force_download (bool, optional): Se True, scarica sempre il file CSV aggiornato.
                                         Se False, usa il file locale se esiste. 
                                         Default False.

    Returns:
        pandas.DataFrame: DataFrame pronto per Prophet o None in caso di errore.
    """
    # Controlla se il file CSV locale esiste o se è richiesto il download forzato
    if force_download or not os.path.exists(LOCAL_PROVINCIAL_CSV_PATH):
        logger.info(f"Download dei dati provinciali richiesto (force_download={force_download})...")
        if not download_csv_from_url(PROVINCIAL_DATA_URL, LOCAL_PROVINCIAL_CSV_PATH):
            logger.error("Download dati provinciali fallito. Impossibile procedere.")
            return None # Interrompi se il download fallisce
    else:
        logger.info(f"Utilizzo del file CSV provinciale locale: {LOCAL_PROVINCIAL_CSV_PATH}")

    # Carica i dati grezzi dal CSV
    df_raw_provincial = load_provincial_data_from_csv(LOCAL_PROVINCIAL_CSV_PATH)
    if df_raw_provincial is None:
        logger.error("Caricamento dei dati provinciali grezzi fallito.")
        return None

    # Prepara i dati per Prophet
    df_prophet_ready = preprocess_provincial_data_for_prophet(df_raw_provincial, province_name, metric_column)
    
    return df_prophet_ready


def get_prophet_ready_regional_data(region_name, 
                                    metric_column='nuovi_positivi', 
                                    force_download=False,
                                    use_db=True):
    """
    Ottiene i dati di una specifica regione pronti per Prophet,
    scaricandoli se necessario. Supporta sia CSV che MongoDB.

    Args:
        region_name (str): Il nome della regione.
        metric_column (str, optional): La metrica da usare per 'y'. 
                                       Default 'nuovi_positivi'.
        force_download (bool, optional): Se True, scarica sempre il file CSV aggiornato.
                                         Se False, usa il file locale se esiste. 
                                         Default False.
        use_db (bool, optional): Se True, prova prima a ottenere i dati dal database.
                                 Default True.

    Returns:
        pandas.DataFrame: DataFrame pronto per Prophet o None in caso di errore.
    """
    # Se richiesto, prova prima a ottenere i dati dal database
    if use_db:
        try:
            logger.info(f"Tentativo di recupero dati regionali da MongoDB per {region_name}")
            prophet_data = db_manager.get_prophet_ready_data('regional', region_name, metric_column)
            if prophet_data and len(prophet_data) > 0:
                # Converti i dati dal database in DataFrame
                df_prophet = pd.DataFrame(prophet_data)
                logger.info(f"Dati regionali recuperati dal database per {region_name}: {len(df_prophet)} record")
                return df_prophet
            logger.info("Nessun dato trovato nel database, procedo con CSV")
        except Exception as e:
            logger.error(f"Errore nel recupero dati dal database: {str(e)}. Procedo con CSV.")
    
    # Continua con il metodo CSV se il database non è disponibile o richiesto
    # Controlla se il file CSV locale esiste o se è richiesto il download forzato
    if force_download or not os.path.exists(LOCAL_REGIONAL_CSV_PATH):
        logger.info(f"Download dei dati regionali richiesto (force_download={force_download})")
        if not download_csv_from_url(REGIONAL_DATA_URL, LOCAL_REGIONAL_CSV_PATH):
            logger.error("Download fallito. Impossibile procedere.")
            return None # Interrompi se il download fallisce
    else:
        logger.info(f"Utilizzo del file CSV regionale locale: {LOCAL_REGIONAL_CSV_PATH}")

    # Carica i dati grezzi dal CSV
    df_raw_regional = load_regional_data_from_csv(LOCAL_REGIONAL_CSV_PATH)
    if df_raw_regional is None:
        logger.error("Caricamento dei dati regionali grezzi fallito.")
        return None

    # Prepara i dati per Prophet
    df_prophet_ready = preprocess_regional_data_for_prophet(df_raw_regional, region_name, metric_column)
    
    # Se c'è il database e non è vuoto, salva i dati
    if use_db and df_prophet_ready is not None:
        try:
            # Converti in formato per il database
            data_to_save = df_prophet_ready.to_dict('records')
            # Tenta di salvare nel database
            db_manager.save_regional_data(data_to_save)
            logger.info(f"Dati regionali per {region_name} salvati nel database")
        except Exception as e:
            logger.error(f"Errore nel salvataggio dati regionali nel database: {str(e)}")
    
    return df_prophet_ready



def download_historical_data(force_download=False):
    """
    Scarica i dati storici completi (regionali e provinciali)
    
    Args:
        force_download (bool): Se True, scarica sempre i file anche se esistono localmente
        
    Returns:
        dict: Dizionario con i percorsi locali dei file scaricati e stato del download
    """
    result = {
        "regional": {"success": False, "path": LOCAL_REGIONAL_HISTORY_PATH},
        "provincial": {"success": False, "path": LOCAL_PROVINCIAL_HISTORY_PATH}
    }
    
    # Scarica dati storici regionali
    if force_download or not os.path.exists(LOCAL_REGIONAL_HISTORY_PATH):
        logger.info(f"Download dei dati storici regionali...")
        result["regional"]["success"] = download_csv_from_url(
            REGIONAL_HISTORY_URL, 
            LOCAL_REGIONAL_HISTORY_PATH
        )
    else:
        logger.info(f"Utilizzo del file dati storici regionali locale: {LOCAL_REGIONAL_HISTORY_PATH}")
        result["regional"]["success"] = True
    
    # Scarica dati storici provinciali
    if force_download or not os.path.exists(LOCAL_PROVINCIAL_HISTORY_PATH):
        logger.info(f"Download dei dati storici provinciali...")
        result["provincial"]["success"] = download_csv_from_url(
            PROVINCIAL_HISTORY_URL, 
            LOCAL_PROVINCIAL_HISTORY_PATH
        )
    else:
        logger.info(f"Utilizzo del file dati storici provinciali locale: {LOCAL_PROVINCIAL_HISTORY_PATH}")
        result["provincial"]["success"] = True
        
    return result

def import_historical_data_to_mongodb(force_download=False):
    """
    Importa tutti i dati storici (nazionali, regionali e provinciali) in MongoDB
    """
    # Scarica i dati storici se necessario (solo regionali e provinciali)
    download_result = download_historical_data(force_download)
    result = {
        "national": {"success": False, "inserted": 0, "updated": 0, "errors": 0},
        "regional": {"success": False, "inserted": 0, "updated": 0, "errors": 0},
        "provincial": {"success": False, "inserted": 0, "updated": 0, "errors": 0}
    }
    # Importa dati nazionali
    try:
        if os.path.exists(LOCAL_NATIONAL_CSV_PATH):
            df_national = pd.read_csv(LOCAL_NATIONAL_CSV_PATH)
            df_national['data'] = pd.to_datetime(df_national['data'])
            national_data = df_national.to_dict('records')
            national_result = db_manager.save_national_data(national_data)
            result["national"] = national_result
            logger.info(f"Importazione dati nazionali completata: {len(national_data)} record elaborati")
            logger.info(f"Risultato: {national_result['inserted']} inseriti, {national_result['updated']} aggiornati")
        else:
            logger.error(f"File dati nazionali non trovato: {LOCAL_NATIONAL_CSV_PATH}")
            result["national"]["errors"] += 1
    except Exception as e:
        logger.error(f"Errore durante l'importazione dei dati nazionali: {str(e)}")
        result["national"]["errors"] += 1
    # Importa dati regionali
    if download_result["regional"]["success"]:
        try:
            # Carica il CSV
            df_regional = pd.read_csv(LOCAL_REGIONAL_HISTORY_PATH)
            # Converti la colonna data in oggetti datetime
            df_regional['data'] = pd.to_datetime(df_regional['data'])
            
            # Prepara i dati per l'inserimento in MongoDB
            regional_data = df_regional.to_dict('records')
            
            # Salva nel database
            regional_result = db_manager.save_regional_data(regional_data)
            result["regional"] = regional_result
            
            logger.info(f"Importazione dati regionali completata: {len(regional_data)} record elaborati")
            logger.info(f"Risultato: {regional_result['inserted']} inseriti, {regional_result['updated']} aggiornati")
        except Exception as e:
            logger.error(f"Errore durante l'importazione dei dati regionali: {str(e)}")
            result["regional"]["errors"] += 1
    
    # Importa dati provinciali
    if download_result["provincial"]["success"]:
        try:
            # Carica il CSV
            df_provincial = pd.read_csv(LOCAL_PROVINCIAL_HISTORY_PATH)
            # Converti la colonna data in oggetti datetime
            df_provincial['data'] = pd.to_datetime(df_provincial['data'])
            
            # Prepara i dati per l'inserimento in MongoDB
            provincial_data = df_provincial.to_dict('records')
            
            # Salva nel database
            provincial_result = db_manager.save_provincial_data(provincial_data)
            result["provincial"] = provincial_result
            
            logger.info(f"Importazione dati provinciali completata: {len(provincial_data)} record elaborati")
            logger.info(f"Risultato: {provincial_result['inserted']} inseriti, {provincial_result['updated']} aggiornati")
        except Exception as e:
            logger.error(f"Errore durante l'importazione dei dati provinciali: {str(e)}")
            result["provincial"]["errors"] += 1
    
    return result

def get_available_regions():
    """
    Ottiene l'elenco delle regioni disponibili nel database o dal CSV locale
    
    Returns:
        list: Elenco dei nomi delle regioni disponibili
    """
    # Prova prima dal database
    try:
        regions = db_manager.get_available_regions()
        if regions and len(regions) > 0:
            logger.info(f"Recuperate {len(regions)} regioni dal database")
            return regions
    except Exception as e:
        logger.error(f"Errore nel recupero delle regioni dal database: {str(e)}")
    
    # Se il database non ha dati, usa il CSV locale
    try:
        # Assicura che il file CSV esista
        if not os.path.exists(LOCAL_REGIONAL_CSV_PATH):
            download_csv_from_url(REGIONAL_DATA_URL, LOCAL_REGIONAL_CSV_PATH)
        
        df_regional = pd.read_csv(LOCAL_REGIONAL_CSV_PATH)
        regions = df_regional['denominazione_regione'].unique().tolist()
        logger.info(f"Recuperate {len(regions)} regioni dal CSV locale")
        return regions
    except Exception as e:
        logger.error(f"Errore nel recupero delle regioni dal CSV: {str(e)}")
        return []

def get_available_provinces(region_name=None):
    """
    Ottiene l'elenco delle province disponibili nel database o dal CSV locale
    
    Args:
        region_name (str, optional): Nome della regione per filtrare le province
    
    Returns:
        list: Elenco dei nomi delle province disponibili
    """
    # Prova prima dal database
    try:
        provinces = db_manager.get_available_provinces(region_name)
        if provinces and len(provinces) > 0:
            logger.info(f"Recuperate {len(provinces)} province dal database")
            return provinces
    except Exception as e:
        logger.error(f"Errore nel recupero delle province dal database: {str(e)}")
    
    # Se il database non ha dati, usa il CSV locale
    try:
        # Assicura che il file CSV esista
        if not os.path.exists(LOCAL_PROVINCIAL_CSV_PATH):
            download_csv_from_url(PROVINCIAL_DATA_URL, LOCAL_PROVINCIAL_CSV_PATH)
        
        df_provincial = pd.read_csv(LOCAL_PROVINCIAL_CSV_PATH)
        
        # Filtra per regione se specificata
        if region_name:
            df_provincial = df_provincial[df_provincial['denominazione_regione'] == region_name]
        
        provinces = df_provincial['denominazione_provincia'].unique().tolist()
        logger.info(f"Recuperate {len(provinces)} province dal CSV locale")
        return provinces
    except Exception as e:
        logger.error(f"Errore nel recupero delle province dal CSV: {str(e)}")
        return []


def validate_forecast_data(forecast_data):
    """
    Verifica che i dati di previsione siano in un formato valido e serializzabile
    
    Args:
        forecast_data: Dati di previsione da verificare
        
    Returns:
        dict: Dizionario con flag di successo e dati validati o messaggio di errore
    """
    if forecast_data is None:
        return {"success": False, "error": "Nessun dato di previsione disponibile"}
        
    # Verifica se forecast_data è un oggetto Response
    if hasattr(forecast_data, 'json') and callable(getattr(forecast_data, 'json')):
        try:
            # Prova a estrarre i dati JSON dalla Response
            data = forecast_data.json()
            return {"success": True, "data": data}
        except Exception as e:
            logger.error(f"Errore nella conversione della risposta in JSON: {str(e)}")
            return {"success": False, "error": f"Errore nella conversione della risposta: {str(e)}"}
    
    # Verifica se i dati sono già in un formato serializzabile
    try:
        # Prova a serializzare i dati in JSON per verificare
        json.dumps(forecast_data)
        return {"success": True, "data": forecast_data}
    except (TypeError, OverflowError) as e:
        logger.error(f"I dati di previsione non sono serializzabili: {str(e)}")
        
        # Tenta di convertire i dati in un formato serializzabile
        try:
            # Se è un DataFrame, converti in dict
            if hasattr(forecast_data, 'to_dict'):
                serializable_data = forecast_data.to_dict(orient='records')
                return {"success": True, "data": serializable_data}
            
            # Se è numpy array, converti in lista
            elif isinstance(forecast_data, np.ndarray):
                serializable_data = forecast_data.tolist()
                return {"success": True, "data": serializable_data}
            
            # Altrimenti, prova con una conversione personalizzata
            else:
                logger.warning("Tentativo di conversione personalizzata dei dati di previsione")
                # Converte date, numeri numpy, etc.
                def make_serializable(obj):
                    if isinstance(obj, (datetime, np.datetime64)):
                        return obj.isoformat()
                    elif isinstance(obj, (np.int64, np.int32, np.float64, np.float32)):
                        return float(obj)
                    elif isinstance(obj, (list, tuple)):
                        return [make_serializable(x) for x in obj]
                    elif isinstance(obj, dict):
                        return {k: make_serializable(v) for k, v in obj.items()}
                    else:
                        return str(obj)
                
                serializable_data = make_serializable(forecast_data)
                return {"success": True, "data": serializable_data}
        
        except Exception as convert_err:
            logger.error(f"Impossibile convertire i dati in formato serializzabile: {str(convert_err)}")
            return {"success": False, "error": "Formato dati non supportato per la previsione"}

def process_prophet_forecast(forecast_data):
    """
    Elabora i dati di previsione di Prophet e li converte in un formato adatto all'API
    
    Args:
        forecast_data: Dati di previsione da elaborare (DataFrame o altro formato)
        
    Returns:
        list: Lista di dizionari con i dati di previsione elaborati
    """
    # Verifica e valida i dati
    validation_result = validate_forecast_data(forecast_data)
    
    if not validation_result["success"]:
        logger.error(f"Errore nella validazione dei dati di previsione: {validation_result.get('error')}")
        return []
    
    forecast_data = validation_result["data"]
    
    # Se è già una lista di dizionari, restituisci direttamente
    if isinstance(forecast_data, list) and all(isinstance(item, dict) for item in forecast_data):
        # Aggiungi eventuali elaborazioni supplementari se necessario
        return forecast_data
    
    # Se è un dizionario, incapsula in una lista
    if isinstance(forecast_data, dict):
        return [forecast_data]
    
    # Caso fallback: restituisci lista vuota se i dati non sono elaborabili
    logger.warning("Formato dati di previsione non riconosciuto dopo la validazione")
    return []

class CovidDataProcessor:
    """Classe per il caricamento e l'elaborazione dei dati COVID-19 per qualsiasi paese"""

    @staticmethod
    def get_data_file_for_country(country_code):
        """Restituisce il percorso del file dati per il paese richiesto (es: ITA, FRA)"""
        code = country_code.upper()
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if code == "ITA":
            return os.path.join(base_dir, "dpc-covid19-ita-andamento-nazionale.csv")
        elif code == "FRA":
            return os.path.join(base_dir, "dpc-covid19-fra-andamento-nazionale.csv")
        # Estendibile per altri paesi
        else:
            return None

    def __init__(self, country_code="ITA"):
        """Inizializza il processore dei dati per un paese
        Args:
            country_code: codice ISO del paese (es: ITA, FRA)
        """
        self.country_code = country_code.upper()
        self.national_file = self.get_data_file_for_country(self.country_code)
        self.national_data = None
        self.prepared_data = {}
        self.last_update = None

    def load_data(self):
        """Carica i dati dai file CSV"""
        try:
            # Carica dati nazionali per il paese richiesto
            if not self.national_file or not os.path.exists(self.national_file):
                logger.error(f"File dati non trovato per il paese: {self.country_code}")
                self.national_data = None
                return False
            self.national_data = pd.read_csv(self.national_file)
            # Converti la colonna data in datetime
            self.national_data['data'] = pd.to_datetime(self.national_data['data'])
            # Ordina per data
            self.national_data = self.national_data.sort_values('data')
            # Aggiorna timestamp dell'ultimo aggiornamento
            self.last_update = datetime.now()
            logger.info(f"Dati caricati per {self.country_code}: {len(self.national_data)} record da {self.national_data['data'].min().strftime('%Y-%m-%d')}")
            return True
        except Exception as e:
            logger.error(f"Errore nel caricamento dei dati per {self.country_code}: {str(e)}")
            self.national_data = None
            return False
    
    def prepare_timeseries(self, column="nuovi_positivi"):
        """Prepara una serie temporale per l'analisi e previsione
        
        Args:
            column: nome della colonna da usare (default: nuovi_positivi)
            
        Returns:
            DataFrame con le colonne 'ds' (data) e 'y' (valore) pronto per Prophet
        """
        if self.national_data is None:
            self.load_data()
            
        if column not in self.national_data.columns:
            logger.error(f"Colonna {column} non trovata nei dati")
            return None
        
        # Crea dataframe Prophet (ds, y)
        prophet_df = pd.DataFrame()
        prophet_df['ds'] = self.national_data['data']
        prophet_df['y'] = self.national_data[column]
        
        # Memorizza nel dizionario
        self.prepared_data[column] = prophet_df
        
        return prophet_df
    
    def get_latest_data(self, days=30):
        """Restituisce gli ultimi N giorni di dati nazionali
        
        Args:
            days: numero di giorni da restituire
            
        Returns:
            DataFrame con gli ultimi N giorni di dati
        """
        if self.national_data is None:
            self.load_data()
            
        if self.national_data is None:
            return None
            
        # Ottieni gli ultimi N giorni
        latest_data = self.national_data.tail(days).copy()
        
        # Converti le date in formato stringa ISO
        latest_data['data_str'] = latest_data['data'].dt.strftime('%Y-%m-%d')
        
        # Calcola alcuni dati aggiuntivi
        latest_data['tasso_positivita'] = (latest_data['nuovi_positivi'] / latest_data['tamponi'].diff()) * 100
        latest_data['tasso_positivita'] = latest_data['tasso_positivita'].fillna(0).round(2)
        
        # Calcola la media mobile a 7 giorni
        latest_data['nuovi_positivi_ma7'] = latest_data['nuovi_positivi'].rolling(7).mean().round(2)
        latest_data['deceduti_ma7'] = latest_data['deceduti'].diff().rolling(7).mean().round(2)
        
        # Converti in dizionario per l'API
        result = latest_data.to_dict(orient='records')
        
        return result
    
    def get_world_data(self):
        """Genera dati simulati per il globo 3D
        In futuro: sostituire con dati internazionali reali
        
        Returns:
            Lista di dizionari con dati per i diversi paesi
        """
        if self.national_data is None:
            self.load_data()
            
        if self.national_data is None:
            return []
        
        # Ottieni l'ultimo giorno di dati nazionali per consistenza
        last_date = self.national_data['data'].max()
        
        # Dizionario con informazioni sui paesi e le coordinate
        countries = {
            "Italia": {"lat": 41.87, "long": 12.56},
            "Francia": {"lat": 46.23, "long": 2.21},
            "Germania": {"lat": 51.17, "long": 10.45},
            "Spagna": {"lat": 40.46, "long": -3.75},
            "Regno Unito": {"lat": 55.38, "long": -3.44},
            "Stati Uniti": {"lat": 37.09, "long": -95.71},
            "Brasile": {"lat": -14.24, "long": -51.93},
            "Russia": {"lat": 61.52, "long": 105.32},
            "India": {"lat": 20.59, "long": 78.96},
            "Cina": {"lat": 35.86, "long": 104.2},
            "Giappone": {"lat": 36.20, "long": 138.25},
            "Corea del Sud": {"lat": 35.91, "long": 127.77},
            "Australia": {"lat": -25.27, "long": 133.78},
            "Canada": {"lat": 56.13, "long": -106.35},
            "Messico": {"lat": 23.63, "long": -102.55},
            "Sud Africa": {"lat": -30.56, "long": 22.94},
            "Egitto": {"lat": 26.82, "long": 30.8},
            "Nigeria": {"lat": 9.08, "long": 8.68}
        }
        
        # Per l'Italia, usa i dati reali dall'ultimo giorno
        last_ita_data = self.national_data[self.national_data['data'] == last_date].iloc[0]
        
        result = []
        for country, coords in countries.items():
            if country == "Italia":
                # Usa dati reali
                point_data = {
                    "country": country,
                    "lat": coords["lat"],
                    "long": coords["long"],
                    "cases": int(last_ita_data['nuovi_positivi']),
                    "totalCases": int(last_ita_data['totale_casi']),
                    "date": last_date.strftime("%Y-%m-%d")
                }
            else:
                # Genera dati simulati basati sui trend italiani
                # Nella versione futura: sostituire con dati reali!
                point_data = {
                    "country": country,
                    "lat": coords["lat"],
                    "long": coords["long"],
                    "cases": int(np.random.normal(last_ita_data['nuovi_positivi'] * 0.8, last_ita_data['nuovi_positivi'] * 0.3)),
                    "totalCases": int(np.random.normal(last_ita_data['totale_casi'] * 0.7, last_ita_data['totale_casi'] * 0.2)),
                    "date": last_date.strftime("%Y-%m-%d")
                }
                # Assicura che non ci siano numeri negativi
                point_data["cases"] = max(0, point_data["cases"])
                point_data["totalCases"] = max(0, point_data["totalCases"])
            
            result.append(point_data)
            
        return result
