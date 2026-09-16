@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Configurando identidade do Git (nome e e-mail)...
git config --global user.name "Ronaldo Correia"
git config --global user.email "ronaldocorreia8206@gmail.com"
echo.

echo Enviando alteracoes para o GitHub...
echo.
git add -A
git commit -m "Filtro de data inicial e final no Relatorio e Clientes" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin master
echo.
if %errorlevel%==0 (
  echo [OK] Concluido com sucesso.
) else (
  echo [ATENCAO] Ocorreu um erro. Veja a mensagem acima.
)
echo.
echo Pressione uma tecla para fechar.
pause >nul
