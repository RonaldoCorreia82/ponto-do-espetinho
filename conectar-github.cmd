@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ====================================================
echo  Conectar este projeto ao GitHub
echo ====================================================
echo.

git --version >nul 2>&1
if errorlevel 1 (
  echo [ERRO] O Git nao esta instalado ou nao esta no PATH.
  echo Baixe e instale em: https://git-scm.com/download/win
  echo Depois rode este arquivo novamente.
  echo.
  pause
  exit /b
)

echo Repositorio remoto configurado:
git remote -v
echo.

echo Limpando credencial antiga do GitHub (se houver)...
cmdkey /delete:git:https://github.com >nul 2>&1
cmdkey /delete:LegacyGeneric:target=git:https://github.com >nul 2>&1
echo.

echo Agora vou tentar enviar. Se aparecer uma janela do navegador,
echo entre na sua conta do GitHub para autorizar.
echo.
pause

git push origin master
echo.
if %errorlevel%==0 (
  echo [OK] Conectado e enviado com sucesso!
) else (
  echo [ATENCAO] Nao foi possivel enviar. Veja a mensagem acima.
)
echo.
echo Pressione uma tecla para fechar.
pause >nul
