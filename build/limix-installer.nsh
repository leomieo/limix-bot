; Limix Bot: before installing or updating, stop every process still running from the install folder (the app's
; helpers, such as the computer-control driver, the bots' browser, cloudflared, Python and uv, can outlive the window and
; lock files, so an update removed the old UI but could not write the new one).
!macro limixStopRunning
  nsExec::ExecToLog `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$$d = '$INSTDIR'; Get-Process | Where-Object { $$_.Id -ne $$PID -and $$_.Path -and (($$d -ne '' -and $$_.Path.StartsWith($$d + '\', [StringComparison]::OrdinalIgnoreCase)) -or $$_.Path -like '*\Programs\limixbot\*') } | Stop-Process -Force -ErrorAction SilentlyContinue"`
  Pop $0
  Sleep 1500
!macroend

!macro customInit
  !insertmacro limixStopRunning
!macroend

!macro customUnInit
  !insertmacro limixStopRunning
!macroend
