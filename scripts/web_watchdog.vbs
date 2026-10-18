' Launch the AI4 Science watchdog with no console window at all.
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\26733\Documents\ChatGPT\AI4 Science\scripts\web_watchdog.ps1""", 0, False
