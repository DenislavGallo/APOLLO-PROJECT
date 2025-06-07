import os
import requests
from data_utils import import_historical_data_to_mongodb

# Link ufficiali Protezione Civile
NATIONAL_URL = "https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-andamento-nazionale/dpc-covid19-ita-andamento-nazionale.csv"
REGIONAL_URL = "https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-regioni/dpc-covid19-ita-regioni.csv"
PROVINCIAL_URL = "https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-province/dpc-covid19-ita-province.csv"

# Percorsi locali
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_CACHE_DIR = os.path.join(BASE_DIR, "data_cache")
os.makedirs(DATA_CACHE_DIR, exist_ok=True)
NATIONAL_PATH = os.path.join(os.path.dirname(BASE_DIR), "dpc-covid19-ita-andamento-nazionale.csv")
REGIONAL_PATH = os.path.join(DATA_CACHE_DIR, "dpc-covid19-ita-regioni.csv")
PROVINCIAL_PATH = os.path.join(DATA_CACHE_DIR, "dpc-covid19-ita-province.csv")

def download_csv(url, path):
    print(f"Scarico {url} ...")
    r = requests.get(url)
    r.raise_for_status()
    with open(path, 'w', encoding='utf-8') as f:
        f.write(r.text)
    print(f"Salvato in {path}")

def main():
    try:
        download_csv(NATIONAL_URL, NATIONAL_PATH)
        download_csv(REGIONAL_URL, REGIONAL_PATH)
        download_csv(PROVINCIAL_URL, PROVINCIAL_PATH)
        print("Download completato. Aggiorno MongoDB...")
        import_historical_data_to_mongodb(force_download=False)
        print("Aggiornamento completato!")
    except Exception as e:
        print(f"Errore durante aggiornamento dati: {e}")

if __name__ == "__main__":
    main() 