# APOLLO Project - COVID-19 Data Visualization

## Overview

APOLLO Project is a web application designed to visualize and analyze COVID-19 data. It features an interactive 3D globe, dynamic charts for historical and forecasted data, and detailed statistics. The application provides insights into the pandemic's progression, including new cases, deaths, and vaccination rates, with a focus on delivering a compelling and informative user experience.

## Features

- **Interactive 3D Globe**: Explore COVID-19 data geographically.
- **Dynamic Charts**: View historical trends and future forecasts for various indicators.
- **Detailed Statistics**: Access key metrics and data summaries.
- **Virus-themed Loading Animation**: An engaging and fluid loading screen inspired by organic effects.
- **Data-driven Updates**: Statistics and visualizations update based on user selections (date, indicator).

## Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.7+**: Download from [python.org](https://www.python.org/downloads/)
- **pip**: Python package installer (usually comes with Python)
- **Web Browser**: A modern web browser (e.g., Chrome, Firefox, Edge)

## Getting Started

Follow these steps to set up and run the APOLLO Project locally:

### 1. Clone the Repository (if applicable)

If you have the project in a Git repository, clone it:

```bash
git clone <repository-url>
cd APOLLO-PROJECT
```

If you have the project files directly, navigate to the root directory (`c:\ProgettoMaturita\APOLLO-PROJECT\`).

### 2. Create a Virtual Environment (Recommended)

It's good practice to create a virtual environment to manage project dependencies.

```bash
python -m venv venv
```

Activate the virtual environment:

- **Windows:**
  ```bash
  .\venv\Scripts\activate
  ```
- **macOS/Linux:**
  ```bash
  source venv/bin/activate
  ```

### 3. Install Dependencies

Install the required Python packages using the `requirements.txt` file located in the project root:

```bash
pip install -r requirements.txt
```

This will install Flask and other necessary libraries.

### 4. Run the Application

Once the dependencies are installed, you can start the Flask development server.
Navigate to the `server` directory:

```bash
cd server
```

Then, run the `app.py` file:

```bash
python app.py
```

The application will typically start on `http://127.0.0.1:5000/` or `http://localhost:5000/`.
Open this URL in your web browser to view the application.

### 5. Interacting with the Application

- The **loading screen** will display an organic virus animation while initial data is fetched.
- Use the **date slider** to navigate through different time points.
- Select different **indicators** (e.g., "New Positives", "Deceased") to update the visualizations.
- Toggle between **historical data** and **forecasted data** using the provided controls.
- Explore data on the **3D globe** by rotating and zooming.

## Project Structure

```
APOLLO-PROJECT/
├── server/                     # Backend Flask application
│   ├── app.py                  # Main Flask application file
│   ├── data_utils.py           # Utilities for data loading and processing
│   └── ...                     # Other backend files (e.g., models, routes)
├── static/                     # Static assets (CSS, JavaScript, images)
│   ├── css/
│   │   ├── styles.css
│   │   └── virus-loader.css
│   ├── js/
│   │   ├── main.js             # Main frontend JavaScript controller
│   │   ├── globe.js            # 3D Globe logic
│   │   ├── data.js             # Data handling on the client-side
│   │   ├── canvas-virus-loader.js # Canvas-based virus loader animation
│   │   └── ...                 # Other JS files
│   └── data/                   # Data files (e.g., CSV, JSON)
├── templates/
│   └── index.html              # Main HTML template
├── venv/                       # Virtual environment (if created)
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

## Troubleshooting

- **Port Already in Use**: If you get an error that port 5000 is already in use, you can run the Flask app on a different port:
  ```bash
  python app.py --port=5001
  ```
  (Note: `app.py` might need to be modified to accept a port argument if not already configured).
- **Dependency Issues**: Ensure your virtual environment is activated and all packages from `requirements.txt` are installed correctly.
- **Data Loading Errors**: Check the console in your web browser and the Flask server terminal for error messages related to data fetching or processing.

## Contributing

If you'd like to contribute to the project, please follow standard Git practices (fork, branch, pull request).

## Aggiornamento automatico dei dati COVID

### Aggiornamento manuale

Esegui:

    python server/update_data_from_web.py

per scaricare e aggiornare i dati nazionali, regionali e provinciali direttamente dal web e aggiornare MongoDB.

### Aggiornamento via endpoint admin (solo per utenti autorizzati)

POST a:

    http://localhost:5000/admin/update_data

con form-data:

    secret=TUOSEGRETO

Risposta: output dello script di aggiornamento.

### Aggiornamento automatico schedulato (Windows)

1. Apri "Utilità di Pianificazione" (Task Scheduler)
2. Crea una nuova attività di base
3. Imposta la frequenza (es: ogni giorno alle 7:00)
4. Azione: Avvia un programma
5. Programma/script:

    python

6. Aggiungi argomenti:

    server/update_data_from_web.py

7. Avvia nella cartella:

    C:\APOLLO-PROJECT-master

Salva e l'attività aggiornerà i dati in automatico secondo la pianificazione.

---

This README provides the necessary steps to get the APOLLO Project up and running. Enjoy exploring the COVID-19 data visualization!
