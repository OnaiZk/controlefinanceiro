@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Instale o Node.js 24.7 ou superior da linha 24 LTS.
  pause
  exit /b 1
)
if not exist "node_modules\next\package.json" (
  echo Instalando dependencias gratuitas...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo A instalacao falhou. Consulte a mensagem de rede ou proxy acima.
    pause
    exit /b 1
  )
)
if not exist ".env.local" (
  echo Configure os dois logins. As senhas serao armazenadas apenas como hashes Argon2id.
  call npm run setup
  if errorlevel 1 exit /b 1
)
echo.
echo Abra http://localhost:3000 no navegador.
echo Deixe esta janela aberta durante os testes locais. Use Ctrl+C para encerrar.
call npm run dev
pause
