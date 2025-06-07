"""
Modulo per la gestione della connessione e delle operazioni con MongoDB.
Fornisce funzionalità per salvare e recuperare dati COVID nazionali, regionali e provinciali.
"""

import os
import logging
import pymongo
from datetime import datetime
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import redis

# Configurazione logging
logger = logging.getLogger('apollo-db-manager')

# Configurazione del database
# In un ambiente di produzione, queste informazioni dovrebbero essere in un file .env
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'apollo_covid_db')

# Collezioni
COLLECTION_NATIONAL = 'dati_nazionali'
COLLECTION_REGIONAL = 'dati_regionali'
COLLECTION_PROVINCIAL = 'dati_provinciali'
COLLECTION_METADATA = 'metadata'
COLLECTION_MODEL_REGISTRY = 'model_registry'
COLLECTION_FEATURE_STORE = 'feature_store'
COLLECTION_AB_TEST_RESULTS = 'ab_test_results'

class DatabaseManager:
    """Classe per gestire le operazioni con il database MongoDB e la cache Redis"""
    
    _instance = None
    
    def __new__(cls):
        """Implementazione Singleton per assicurare una sola connessione al DB"""
        if cls._instance is None:
            cls._instance = super(DatabaseManager, cls).__new__(cls)
            cls._instance.client = None
            cls._instance.db = None
            cls._instance.is_connected = False
            # Redis
            cls._instance.redis_client = None
        return cls._instance
    
    def connect(self):
        """Stabilisce la connessione al database MongoDB"""
        if self.is_connected:
            return True
            
        try:
            self.client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            # Verifica la connessione
            self.client.admin.command('ping')
            self.db = self.client[DB_NAME]
            self.is_connected = True
            logger.info(f"Connessione a MongoDB stabilita con successo: {MONGO_URI}, DB: {DB_NAME}")
            
            # Creazione indici se non esistono
            self._create_indices()
            
            return True
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"Impossibile connettersi a MongoDB: {str(e)}")
            self.is_connected = False
            return False
    
    def _create_indices(self):
        """Crea gli indici necessari per ottimizzare le query"""
        try:
            # Indice per data sui dati nazionali
            self.db[COLLECTION_NATIONAL].create_index([("data", pymongo.ASCENDING)], unique=True)
            
            # Indice composito per regione e data
            self.db[COLLECTION_REGIONAL].create_index([
                ("denominazione_regione", pymongo.ASCENDING),
                ("data", pymongo.ASCENDING)
            ], unique=True)
            
            # Indice composito per provincia e data
            self.db[COLLECTION_PROVINCIAL].create_index([
                ("denominazione_provincia", pymongo.ASCENDING),
                ("data", pymongo.ASCENDING)
            ], unique=True)
            
            logger.info("Indici MongoDB creati o verificati")
            
        except Exception as e:
            logger.error(f"Errore nella creazione degli indici: {str(e)}")
    
    def close(self):
        """Chiude la connessione al database"""
        if self.client:
            self.client.close()
            self.is_connected = False
            logger.info("Connessione a MongoDB chiusa")
    
    def save_national_data(self, data_list):
        """
        Salva o aggiorna i dati nazionali
        
        Args:
            data_list: Lista di dizionari con i dati nazionali
            
        Returns:
            dict: Risultato dell'operazione con conteggi
        """
        if not self.is_connected and not self.connect():
            return {"success": False, "error": "Connessione al database non disponibile"}
        
        if not data_list:
            return {"success": False, "error": "Nessun dato fornito"}
        
        collection = self.db[COLLECTION_NATIONAL]
        result = {"inserted": 0, "updated": 0, "errors": 0}
        
        for item in data_list:
            try:
                # Assicurati che la data sia in formato datetime
                if isinstance(item.get('data'), str):
                    item['data'] = datetime.fromisoformat(item['data'].replace('Z', '+00:00'))
                
                # Aggiungi timestamp di importazione
                item['imported_at'] = datetime.now()
                
                # Usa upsert per inserire o aggiornare
                update_result = collection.update_one(
                    {"data": item['data']},  # filtro per trovare il documento
                    {"$set": item},  # dati da aggiornare
                    upsert=True  # crea se non esiste
                )
                
                if update_result.upserted_id:
                    result["inserted"] += 1
                elif update_result.modified_count:
                    result["updated"] += 1
                    
            except Exception as e:
                logger.error(f"Errore nel salvataggio dei dati nazionali: {str(e)}")
                result["errors"] += 1
        
        # Aggiorna metadata
        self._update_metadata("national", {
            "last_update": datetime.now(),
            "record_count": collection.count_documents({})
        })
        
        result["success"] = result["errors"] == 0
        return result
    
    def save_regional_data(self, data_list):
        """
        Salva o aggiorna i dati regionali
        
        Args:
            data_list: Lista di dizionari con i dati regionali
            
        Returns:
            dict: Risultato dell'operazione con conteggi
        """
        if not self.is_connected and not self.connect():
            return {"success": False, "error": "Connessione al database non disponibile"}
        
        if not data_list:
            return {"success": False, "error": "Nessun dato fornito"}
        
        collection = self.db[COLLECTION_REGIONAL]
        result = {"inserted": 0, "updated": 0, "errors": 0}
        
        for item in data_list:
            try:
                # Assicurati che la data sia in formato datetime
                if isinstance(item.get('data'), str):
                    item['data'] = datetime.fromisoformat(item['data'].replace('Z', '+00:00'))
                
                # Aggiungi timestamp di importazione
                item['imported_at'] = datetime.now()
                
                # Usa upsert per inserire o aggiornare
                update_result = collection.update_one(
                    {
                        "denominazione_regione": item['denominazione_regione'],
                        "data": item['data']
                    },
                    {"$set": item},
                    upsert=True
                )
                
                if update_result.upserted_id:
                    result["inserted"] += 1
                elif update_result.modified_count:
                    result["updated"] += 1
                    
            except Exception as e:
                logger.error(f"Errore nel salvataggio dei dati regionali: {str(e)}")
                result["errors"] += 1
        
        # Aggiorna metadata
        self._update_metadata("regional", {
            "last_update": datetime.now(),
            "record_count": collection.count_documents({})
        })
        
        result["success"] = result["errors"] == 0
        return result
    
    def save_provincial_data(self, data_list):
        """
        Salva o aggiorna i dati provinciali
        
        Args:
            data_list: Lista di dizionari con i dati provinciali
            
        Returns:
            dict: Risultato dell'operazione con conteggi
        """
        if not self.is_connected and not self.connect():
            return {"success": False, "error": "Connessione al database non disponibile"}
        
        if not data_list:
            return {"success": False, "error": "Nessun dato fornito"}
        
        collection = self.db[COLLECTION_PROVINCIAL]
        result = {"inserted": 0, "updated": 0, "errors": 0}
        
        for item in data_list:
            try:
                # Assicurati che la data sia in formato datetime
                if isinstance(item.get('data'), str):
                    item['data'] = datetime.fromisoformat(item['data'].replace('Z', '+00:00'))
                
                # Aggiungi timestamp di importazione
                item['imported_at'] = datetime.now()
                
                # Usa upsert per inserire o aggiornare
                update_result = collection.update_one(
                    {
                        "denominazione_provincia": item['denominazione_provincia'],
                        "data": item['data']
                    },
                    {"$set": item},
                    upsert=True
                )
                
                if update_result.upserted_id:
                    result["inserted"] += 1
                elif update_result.modified_count:
                    result["updated"] += 1
                    
            except Exception as e:
                logger.error(f"Errore nel salvataggio dei dati provinciali: {str(e)}")
                result["errors"] += 1
        
        # Aggiorna metadata
        self._update_metadata("provincial", {
            "last_update": datetime.now(),
            "record_count": collection.count_documents({})
        })
        
        result["success"] = result["errors"] == 0
        return result
    
    def _update_metadata(self, data_type, metadata):
        """Aggiorna i metadati per un tipo di dati"""
        try:
            self.db[COLLECTION_METADATA].update_one(
                {"data_type": data_type},
                {"$set": metadata},
                upsert=True
            )
        except Exception as e:
            logger.error(f"Errore nell'aggiornamento dei metadati: {str(e)}")
    
    def get_regional_data(self, region_name=None, start_date=None, end_date=None, limit=None):
        """
        Recupera i dati regionali dal database
        
        Args:
            region_name: Nome della regione (opzionale)
            start_date: Data di inizio per il filtro (opzionale)
            end_date: Data di fine per il filtro (opzionale)
            limit: Numero massimo di risultati (opzionale)
            
        Returns:
            list: Lista di dati regionali
        """
        if not self.is_connected and not self.connect():
            logger.error("Impossibile connettersi al database")
            return []
        
        collection = self.db[COLLECTION_REGIONAL]
        query = {}
        
        # Aggiungi filtri se presenti
        if region_name:
            query["denominazione_regione"] = region_name
        
        # Filtro per date
        if start_date or end_date:
            query["data"] = {}
            if start_date:
                query["data"]["$gte"] = start_date if isinstance(start_date, datetime) else datetime.fromisoformat(start_date)
            if end_date:
                query["data"]["$lte"] = end_date if isinstance(end_date, datetime) else datetime.fromisoformat(end_date)
        
        # Esegui query
        cursor = collection.find(query).sort("data", pymongo.ASCENDING)
        
        # Applica limite se specificato
        if limit:
            cursor = cursor.limit(limit)
        
        # Converti risultati in lista
        results = list(cursor)
        
        # Converti ObjectId in stringa per serializzazione JSON
        for item in results:
            item["_id"] = str(item["_id"])
        
        return results
    
    def get_provincial_data(self, province_name=None, region_name=None, start_date=None, end_date=None, limit=None):
        """
        Recupera i dati provinciali dal database
        
        Args:
            province_name: Nome della provincia (opzionale)
            region_name: Nome della regione per filtrare province (opzionale)
            start_date: Data di inizio per il filtro (opzionale)
            end_date: Data di fine per il filtro (opzionale)
            limit: Numero massimo di risultati (opzionale)
            
        Returns:
            list: Lista di dati provinciali
        """
        if not self.is_connected and not self.connect():
            logger.error("Impossibile connettersi al database")
            return []
        
        collection = self.db[COLLECTION_PROVINCIAL]
        query = {}
        
        # Aggiungi filtri se presenti
        if province_name:
            query["denominazione_provincia"] = province_name
        
        if region_name:
            query["denominazione_regione"] = region_name
        
        # Filtro per date
        if start_date or end_date:
            query["data"] = {}
            if start_date:
                query["data"]["$gte"] = start_date if isinstance(start_date, datetime) else datetime.fromisoformat(start_date)
            if end_date:
                query["data"]["$lte"] = end_date if isinstance(end_date, datetime) else datetime.fromisoformat(end_date)
        
        # Esegui query
        cursor = collection.find(query).sort("data", pymongo.ASCENDING)
        
        # Applica limite se specificato
        if limit:
            cursor = cursor.limit(limit)
        
        # Converti risultati in lista
        results = list(cursor)
        
        # Converti ObjectId in stringa per serializzazione JSON
        for item in results:
            item["_id"] = str(item["_id"])
        
        return results
    
    def get_prophet_ready_data(self, area_type, area_name, metric_column='nuovi_positivi'):
        """
        Recupera i dati già formattati per Prophet (ds, y)
        
        Args:
            area_type: Tipo di area ('national', 'regional', 'provincial')
            area_name: Nome dell'area (regione o provincia)
            metric_column: Metrica da utilizzare come target (y)
            
        Returns:
            list: Dati formattati per Prophet con colonne 'ds' e 'y'
        """
        if not self.is_connected and not self.connect():
            logger.error("Impossibile connettersi al database")
            return []
        
        if area_type == 'national':
            collection = self.db[COLLECTION_NATIONAL]
            query = {}
        elif area_type == 'regional':
            collection = self.db[COLLECTION_REGIONAL]
            query = {"denominazione_regione": area_name}
        elif area_type == 'provincial':
            collection = self.db[COLLECTION_PROVINCIAL]
            query = {"denominazione_provincia": area_name}
        else:
            logger.error(f"Tipo di area non valido: {area_type}")
            return []
        
        # Verifica che la metrica esista nei dati
        sample = collection.find_one(query)
        if not sample or metric_column not in sample:
            logger.error(f"Metrica '{metric_column}' non trovata nei dati {area_type}")
            return []
        
        # Esegui la query e formatta i dati per Prophet
        results = []
        for doc in collection.find(query).sort("data", pymongo.ASCENDING):
            if metric_column in doc:
                results.append({
                    "ds": doc["data"],
                    "y": doc[metric_column]
                })
        
        return results
    
    def get_available_regions(self):
        """Recupera l'elenco delle regioni disponibili nel database"""
        if not self.is_connected and not self.connect():
            return []
            
        return self.db[COLLECTION_REGIONAL].distinct("denominazione_regione")
    
    def get_available_provinces(self, region_name=None):
        """
        Recupera l'elenco delle province disponibili
        
        Args:
            region_name: Se specificato, filtra per regione
            
        Returns:
            list: Elenco delle province
        """
        if not self.is_connected and not self.connect():
            return []
            
        query = {}
        if region_name:
            query["denominazione_regione"] = region_name
            
        return self.db[COLLECTION_PROVINCIAL].distinct("denominazione_provincia", query)

    def connect_redis(self, host='localhost', port=6379, db=0):
        """Connessione a Redis"""
        try:
            self.redis_client = redis.Redis(host=host, port=port, db=db, decode_responses=True)
            # Test connessione
            self.redis_client.ping()
            logger.info(f"Connessione a Redis stabilita su {host}:{port}, db={db}")
            return True
        except Exception as e:
            logger.error(f"Impossibile connettersi a Redis: {str(e)}")
            self.redis_client = None
            return False

    def cache_set(self, key, value, ex=60):
        """Salva un valore in cache Redis (default: 60s)"""
        if self.redis_client:
            self.redis_client.set(key, value, ex=ex)

    def cache_get(self, key):
        """Recupera un valore dalla cache Redis"""
        if self.redis_client:
            return self.redis_client.get(key)
        return None

    def register_model(self, model_name, area_type, area_name, version, file_path, metrics=None, note=None):
        """Registra un nuovo modello Prophet nel model registry"""
        if not self.is_connected and not self.connect():
            return False
        doc = {
            "model_name": model_name,
            "area_type": area_type,
            "area_name": area_name,
            "version": version,
            "created_at": datetime.now(),
            "file_path": file_path,
            "metrics": metrics or {},
            "note": note or ""
        }
        self.db[COLLECTION_MODEL_REGISTRY].insert_one(doc)
        return True

    def get_latest_model(self, model_name, area_type, area_name=None):
        """Recupera l'ultimo modello registrato per nome/area"""
        if not self.is_connected and not self.connect():
            return None
        query = {"model_name": model_name, "area_type": area_type}
        if area_name:
            query["area_name"] = area_name
        doc = self.db[COLLECTION_MODEL_REGISTRY].find(query).sort("created_at", -1).limit(1)
        return next(doc, None)

    def list_models(self, area_type=None, area_name=None):
        """Elenca tutti i modelli registrati, opzionalmente filtrando per area"""
        if not self.is_connected and not self.connect():
            return []
        query = {}
        if area_type:
            query["area_type"] = area_type
        if area_name:
            query["area_name"] = area_name
        return list(self.db[COLLECTION_MODEL_REGISTRY].find(query).sort("created_at", -1))

    def save_features(self, area_type, area_name, features_list):
        """Salva una lista di feature (dict) per una certa area nel feature store"""
        if not self.is_connected and not self.connect():
            return False
        # Ogni elemento di features_list deve avere almeno 'data' e le feature
        for feat in features_list:
            doc = {
                "area_type": area_type,
                "area_name": area_name,
                "data": feat["data"],
                "features": {k: v for k, v in feat.items() if k != "data"}
            }
            # upsert per data/area
            self.db[COLLECTION_FEATURE_STORE].update_one(
                {"area_type": area_type, "area_name": area_name, "data": feat["data"]},
                {"$set": doc},
                upsert=True
            )
        return True

    def get_features(self, area_type, area_name, start_date=None, end_date=None):
        """Recupera le feature per una certa area e intervallo di date"""
        if not self.is_connected and not self.connect():
            return []
        query = {"area_type": area_type, "area_name": area_name}
        if start_date or end_date:
            query["data"] = {}
            if start_date:
                query["data"]["$gte"] = start_date
            if end_date:
                query["data"]["$lte"] = end_date
        cursor = self.db[COLLECTION_FEATURE_STORE].find(query).sort("data", 1)
        return list(cursor)

    def log_ab_test_result(self, area_type, area_name, model_used, prediction, input_data=None, note=None):
        """Logga un risultato di A/B test nel database"""
        if not self.is_connected and not self.connect():
            return False
        doc = {
            "timestamp": datetime.now(),
            "area_type": area_type,
            "area_name": area_name,
            "model_used": model_used,
            "input_data": input_data,
            "prediction": prediction,
            "note": note or ""
        }
        self.db[COLLECTION_AB_TEST_RESULTS].insert_one(doc)
        return True

# Singleton instance
db_manager = DatabaseManager()
