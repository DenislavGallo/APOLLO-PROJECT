@echo off
REM Script di avvio rapido per sviluppo locale
REM Avvia ambiente virtuale se esiste
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)
REM Avvia il server Flask in modalità sviluppo
set FLASK_APP=server/app.py
set FLASK_ENV=development
flask run
pause
