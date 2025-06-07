#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script di inizializzazione del database MongoDB per il progetto Apollo.
Scarica e importa tutti i dati storici COVID-19 (nazionali, regionali e provinciali).
"""

import os
import sys
import logging
import argparse
from datetime import datetime

# Configura il logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("init_database.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('apollo-init-db')

# Importa le utilità per il database e l'elaborazione dati
from db_manager import db_manager
from data_utils import import_historical_data_to_mongodb, download_historical_data
from data_utils import get_available_regions, get_available_provinces

def parse_arguments():
    """Analizza gli argomenti dalla riga di comando"""
    parser = argparse.ArgumentParser(
        description="Inizializzazione database MongoDB per il progetto Apollo"
    )
    parser.add_argument(
        "--force-download", 
        action="store_true", 
        help="Forza il download di tutti i dati anche se esistono già localmente"
    )
    parser.add_argument(
        "--verify-only", 
        action="store_true",
        help="Verifica solo la connessione al database senza importare dati"
    )
    parser.add_argument(
        "--list-regions", 
        action="store_true",
        help="Elenca le regioni disponibili dopo l'importazione"
    )
    return parser.parse_args()

def main():
    """Funzione principale"""
    args = parse_arguments()
    
    # Verifica la connessione al database
    logger.info("Verifica connessione al database MongoDB...")
    if not db_manager.connect():
        logger.error("Impossibile connettersi al database MongoDB. Verifica che MongoDB sia in esecuzione.")
        return 1
    
    logger.info("Connessione al database MongoDB riuscita!")
    
    # Se richiesto solo verifica, termina qui
    if args.verify_only:
        logger.info("Verifica completata. Il database è raggiungibile.")
        return 0
    
    # Importa i dati storici
    start_time = datetime.now()
    logger.info(f"Inizio importazione dati alle {start_time.strftime('%H:%M:%S')}")
    
    import_result = import_historical_data_to_mongodb(args.force_download)
    
    # Mostra i risultati dell'importazione
    logger.info("Importazione completata!")
    logger.info("Risultati dati NAZIONALI:")
    logger.info(f"  Successo: {import_result['national'].get('success', False)}")
    logger.info(f"  Inseriti: {import_result['national'].get('inserted', 0)}")
    logger.info(f"  Aggiornati: {import_result['national'].get('updated', 0)}")
    logger.info(f"  Errori: {import_result['national'].get('errors', 0)}")
    
    logger.info("Risultati dati REGIONALI:")
    logger.info(f"  Successo: {import_result['regional'].get('success', False)}")
    logger.info(f"  Inseriti: {import_result['regional'].get('inserted', 0)}")
    logger.info(f"  Aggiornati: {import_result['regional'].get('updated', 0)}")
    logger.info(f"  Errori: {import_result['regional'].get('errors', 0)}")
    
    logger.info("Risultati dati PROVINCIALI:")
    logger.info(f"  Successo: {import_result['provincial'].get('success', False)}")
    logger.info(f"  Inseriti: {import_result['provincial'].get('inserted', 0)}")
    logger.info(f"  Aggiornati: {import_result['provincial'].get('updated', 0)}")
    logger.info(f"  Errori: {import_result['provincial'].get('errors', 0)}")
    
    end_time = datetime.now()
    elapsed = (end_time - start_time).total_seconds()
    logger.info(f"Tempo totale: {elapsed:.2f} secondi")
    
    # Se richiesto, mostra l'elenco delle regioni
    if args.list_regions:
        regions = get_available_regions()
        logger.info(f"Regioni disponibili ({len(regions)}):")
        for region in sorted(regions):
            provinces = get_available_provinces(region)
            logger.info(f"  - {region} ({len(provinces)} province)")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
