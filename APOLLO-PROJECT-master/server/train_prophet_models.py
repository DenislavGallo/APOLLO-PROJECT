# Script di training per Prophet: addestra e salva i modelli per ogni paese e indicatore
import os
import joblib
from models.prophet_model import ProphetModel
from data_utils import CovidDataProcessor
from db_manager import db_manager

# Configurazione
COUNTRIES = ['ITA', 'FRA']  # aggiungi altri paesi qui
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'trained_models')
VALID_INDICATORS = ['nuovi_positivi', 'deceduti', 'dimessi_guariti', 'terapia_intensiva', 'ricoverati_con_sintomi']
TRAIN_DAYS = 300

os.makedirs(MODEL_DIR, exist_ok=True)

for country in COUNTRIES:
    print(f'== Training Prophet per {country} ==')
    processor = CovidDataProcessor(country_code=country)
    if not processor.load_data() or processor.national_data is None:
        print(f'  [ERRORE] Dati non disponibili per {country}')
        continue
    model = ProphetModel(processor.national_file, columns=VALID_INDICATORS, train_days=TRAIN_DAYS)
    # Salva ogni modello per ogni indicatore
    for indicator, prophet_model in model.models.items():
        if prophet_model is not None:
            filename = f'prophet_{country}_{indicator}.joblib'
            filepath = os.path.join(MODEL_DIR, filename)
            joblib.dump(prophet_model, filepath)
            print(f'  [OK] Salvato modello {indicator} in {filepath}')
            # Calcola MAPE come metrica
            mape = model.get_mape(indicator=indicator, days=7)
            # Registra nel model registry
            db_manager.register_model(
                model_name=f'prophet_{country}_{indicator}',
                area_type='national',
                area_name=country,
                version='latest',  # puoi usare una stringa con data/ora se vuoi versionare
                file_path=filepath,
                metrics={"MAPE": mape},
                note="Training automatico Prophet"
            )
        else:
            print(f'  [FAIL] Modello non addestrato per {indicator}')
print('== Training completato ==')
