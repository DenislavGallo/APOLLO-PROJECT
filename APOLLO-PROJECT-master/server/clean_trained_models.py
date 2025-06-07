# Script per pulire la cartella dei modelli Prophet addestrati
import os
import glob

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'trained_models')
pattern = os.path.join(MODEL_DIR, 'prophet_*.joblib')

files = glob.glob(pattern)
if not files:
    print('Nessun modello trovato da eliminare.')
else:
    for f in files:
        try:
            os.remove(f)
            print(f'Eliminato: {f}')
        except Exception as e:
            print(f'Errore eliminando {f}: {e}')
    print(f'Totale file eliminati: {len(files)}')
