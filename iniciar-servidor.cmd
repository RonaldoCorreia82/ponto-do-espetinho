@echo off
cd /d "%~dp0"
echo Iniciando o servidor do Ponto do Espetinho...
echo.
call npm run dev
echo.
echo O servidor foi encerrado. Pressione uma tecla para fechar.
pause >nul
