@echo off
set "ACTIVATE_SCRIPT=%~dp0..\.venv\Scripts\activate.bat"

if not exist "%ACTIVATE_SCRIPT%" (
    echo Existing project virtual environment not found: "%ACTIVATE_SCRIPT%"
    exit /b 1
)

call "%ACTIVATE_SCRIPT%"
