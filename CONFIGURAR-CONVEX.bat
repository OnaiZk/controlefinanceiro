@echo off
setlocal
cd /d "%~dp0"
echo Configure CONVEX_DEPLOY_KEY do deployment correto no arquivo .env.local.
echo A chave nao deve ser enviada pelo chat nem pelo Git.
echo.
call npm run convex:deploy
if errorlevel 1 (
  echo A publicacao nao foi concluida. Leia a mensagem acima.
) else (
  echo Backend publicado. Continue com as variaveis do Netlify em docs\DEPLOYMENT.md.
)
pause
