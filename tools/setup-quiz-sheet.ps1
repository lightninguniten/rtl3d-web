# Copies the Apps Script to clipboard and opens the Google Apps Script home page.
$root = Split-Path -Parent $PSScriptRoot
$gs = Join-Path $root 'tools\quiz-sheet.gs'

if (-not (Test-Path $gs)) {
  Write-Error "Missing $gs"
  exit 1
}

Get-Content -Raw $gs | Set-Clipboard
Write-Host 'Copied tools/quiz-sheet.gs to clipboard.'
Write-Host ''
Write-Host 'Next steps:'
Write-Host '  1. Open your RTL3D Quiz Results Google Sheet'
Write-Host '  2. Extensions -> Apps Script'
Write-Host '  3. Replace all code, paste (Ctrl+V), Save'
Write-Host '  4. Deploy -> Manage deployments -> Edit -> New version -> Deploy'
Write-Host ''
Write-Host 'Then open the live dashboard:'
Write-Host '  https://lightninguniten.github.io/rtl3d-web/quiz-results/'

Start-Process 'https://script.google.com'
