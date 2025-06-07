#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script per aggiornare i documenti delle collezioni MongoDB aggiungendo il campo 'imported_at' se mancante.
"""

from datetime import datetime
from db_manager import DatabaseManager, COLLECTION_NATIONAL, COLLECTION_REGIONAL, COLLECTION_PROVINCIAL

COLLECTIONS = [
    (COLLECTION_NATIONAL, "nazionali"),
    (COLLECTION_REGIONAL, "regionali"),
    (COLLECTION_PROVINCIAL, "provinciali")
]

def update_imported_at():
    db_manager = DatabaseManager()
    if not db_manager.connect():
        print("Impossibile connettersi a MongoDB.")
        return
    
    for collection_name, label in COLLECTIONS:
        collection = db_manager.db[collection_name]
        # Trova i documenti senza 'imported_at'
        missing = collection.count_documents({"imported_at": {"$exists": False}})
        if missing == 0:
            print(f"Tutti i documenti della collezione {label} hanno già 'imported_at'.")
            continue
        # Aggiorna i documenti mancanti
        result = collection.update_many(
            {"imported_at": {"$exists": False}},
            {"$set": {"imported_at": datetime.now()}}
        )
        print(f"Collezione {label}: aggiornati {result.modified_count} documenti privi di 'imported_at'.")

if __name__ == "__main__":
    update_imported_at() 