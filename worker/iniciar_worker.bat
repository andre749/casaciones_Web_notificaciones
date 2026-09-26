@echo off
REM Arranca el worker del CEJ (usar desde el Programador de tareas de Windows)
cd /d "%~dp0"
python cej_scrapper.py servir --intervalo-horas 12 >> worker.log 2>&1
