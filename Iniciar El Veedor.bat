@echo off
title El Veedor - Servidor local
cd /d "C:\Projects\el-veedor"
echo ==================================================
echo    EL VEEDOR - Iniciando servidor local...
echo ==================================================
echo.
echo  Tu navegador se abrira solo en unos segundos.
echo.
echo  Para DETENER el servidor: cierra esta ventana
echo  (o presiona Ctrl + C).
echo.
echo ==================================================
echo.
start "" cmd /c "timeout /t 4 >nul & start http://localhost:5173"
call npm run dev
pause
