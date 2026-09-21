<#
.SYNOPSIS
  Push tools/quiz-sheet.gs to the live Apps Script project and cut a new
  version of the EXISTING deployment, so the endpoint URL never changes.

.DESCRIPTION
  Replaces the manual "Extensions > Apps Script, paste, Deploy > Manage
  deployments > Edit > New version" dance.

  The deployment id is read out of js/quiz-config.js - it is the AKfycb...
  part of the web app URL. The script id is asked for once and remembered in
  tools/.quiz-script-id (gitignored).

  What still needs a human, once per machine:
    * clasp login  - opens a browser; this script runs it for you
    * the Apps Script API must be ON for your account:
      https://script.google.com/home/usersettings

.EXAMPLE
  tools\deploy-quiz-script.ps1

.EXAMPLE
  tools\deploy-quiz-script.ps1 -ScriptId 1AbC..._long_id
#>
[CmdletBinding()]
param(
  # Apps Script project id, from the editor URL:
  # script.google.com/home/projects/<SCRIPT_ID>/edit   (not the AKfycb... one)
  [string]$ScriptId,

  # Skip the post-deploy endpoint check.
  [switch]$SkipVerify,

  [string]$ClaspVersion = '3.4.1'
)

$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent $PSScriptRoot
$tools   = Join-Path $root 'tools'
$gsFile  = Join-Path $tools 'quiz-sheet.gs'
$idCache = Join-Path $tools '.quiz-script-id'
$cliDir  = Join-Path $tools '.clasp-cli'

function Step([string]$m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok([string]$m)   { Write-Host "    $m" -ForegroundColor Green }
function Warn([string]$m) { Write-Host "    $m" -ForegroundColor Yellow }

# --- preflight -------------------------------------------------------------
Step 'Checking prerequisites'
if (-not (Test-Path $gsFile)) { throw "Missing $gsFile" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is required. Install it from https://nodejs.org and re-run.'
}
Ok "node $(node -v)"

# --- the deployment id lives in the web app URL ----------------------------
Step 'Reading the deployment id from js/quiz-config.js'
$configPath = Join-Path $root 'js\quiz-config.js'
$config = Get-Content -Raw $configPath
$m = [regex]::Match($config, "RTL3D_QUIZ_ENDPOINT\s*=\s*'([^']+)'")
if (-not $m.Success -or -not $m.Groups[1].Value.Trim()) {
  throw "No RTL3D_QUIZ_ENDPOINT in $configPath. Deploy once by hand first (tools\quiz-sheet.gs.txt), then this script can take over."
}
$endpoint = $m.Groups[1].Value.Trim()
$dm = [regex]::Match($endpoint, '/macros/s/([^/]+)/exec')
if (-not $dm.Success) { throw "Could not read a deployment id out of: $endpoint" }
$deploymentId = $dm.Groups[1].Value
Ok "deployment $deploymentId"

# --- clasp, kept local to this repo ----------------------------------------
Step "Preparing clasp $ClaspVersion"
$claspJs = Join-Path $cliDir 'node_modules\@google\clasp\build\src\index.js'
if (-not (Test-Path $claspJs)) {
  New-Item -ItemType Directory -Force -Path $cliDir | Out-Null
  $pkg = Join-Path $cliDir 'package.json'
  if (-not (Test-Path $pkg)) {
    '{ "private": true }' | Out-File -Encoding utf8 $pkg
  }
  Push-Location $cliDir
  try {
    Write-Host '    installing (first run only, ~20s)...'
    & npm install --silent --no-audit --no-fund "@google/clasp@$ClaspVersion" 2>&1 | Out-Null
  } finally { Pop-Location }
}
if (-not (Test-Path $claspJs)) { throw "clasp did not install into $cliDir" }
Ok 'clasp ready'

function Invoke-Clasp {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ClaspArgs)
  # clasp writes ordinary progress and errors to stderr. Under
  # $ErrorActionPreference = 'Stop' that becomes a terminating NativeCommandError
  # before we ever get to read $LASTEXITCODE, so the callers below could never
  # inspect a failure. Keep native stderr non-terminating for the call itself.
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & node $claspJs @ClaspArgs 2>&1 }
  finally { $ErrorActionPreference = $prev }
}

# --- auth ------------------------------------------------------------------
Step 'Checking Google sign-in'
$who = (Invoke-Clasp show-authorized-user 2>&1) -join "`n"
if ($LASTEXITCODE -ne 0 -or $who -match 'not logged in|No authorization|not authorized') {
  Warn 'Not signed in. A browser will open - use the account that owns the Sheet.'
  Invoke-Clasp login
  if ($LASTEXITCODE -ne 0) { throw 'clasp login failed.' }
  $who = (Invoke-Clasp show-authorized-user 2>&1) -join "`n"
}
Ok (($who -split "`n") | Select-Object -First 1)

# --- which Apps Script project? -------------------------------------------
if (-not $ScriptId -and (Test-Path $idCache)) {
  $ScriptId = (Get-Content -Raw $idCache).Trim()
}
if (-not $ScriptId) {
  Step 'Finding the Apps Script project'
  $listing = (Invoke-Clasp list-scripts --noShorten 2>&1) -join "`n"
  # @() matters: with a single match PowerShell would hand back a bare string,
  # and $ids[0] would then index into it and yield one character.
  $ids = @([regex]::Matches($listing, 'script\.google\.com/d/([^/]+)/edit') |
    ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)

  if ($ids.Count -eq 1) {
    # Only one project on the account, so there is nothing to choose between.
    $ScriptId = $ids[0]
    Ok 'one project on this account; using it'
  } else {
    Write-Host $listing
    Write-Host ''
    Write-Host '    Paste the id of the quiz project (the long one, not AKfycb...),'
    Write-Host '    or re-run with -ScriptId <id>.'
    $ScriptId = (Read-Host '    Script id').Trim()
    if (-not $ScriptId) { throw 'No script id given. Re-run with -ScriptId <id>.' }
  }
}
Set-Content -Path $idCache -Value $ScriptId -Encoding utf8
Ok "script $ScriptId"

# --- stage: pull the remote project, swap in our code, push ----------------
Step 'Staging the project'
$stage = Join-Path ([System.IO.Path]::GetTempPath()) ('rtl3d-quiz-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force -Path $stage | Out-Null
try {
  @{ scriptId = $ScriptId; rootDir = '.' } | ConvertTo-Json |
    Out-File -Encoding utf8 (Join-Path $stage '.clasp.json')

  Push-Location $stage
  try {
    # Pull first, so the remote manifest (timezone, scopes) is preserved
    # instead of overwritten with a guess.
    Invoke-Clasp pull 2>&1 | Out-Null

    $manifest = Join-Path $stage 'appsscript.json'
    if (-not (Test-Path $manifest)) {
      Warn 'No remote manifest found; writing a default one.'
      $default = '{' + [Environment]::NewLine +
        '  "timeZone": "Asia/Kuala_Lumpur",' + [Environment]::NewLine +
        '  "exceptionLogging": "STACKDRIVER",' + [Environment]::NewLine +
        '  "runtimeVersion": "V8"' + [Environment]::NewLine + '}'
      $default | Out-File -Encoding utf8 $manifest
    }

    # The web app must stay open to anyone, or the public site cannot post.
    $mf = Get-Content -Raw $manifest | ConvertFrom-Json
    if (-not $mf.webapp) {
      $webapp = [pscustomobject]@{ executeAs = 'USER_DEPLOYING'; access = 'ANYONE_ANONYMOUS' }
      $mf | Add-Member -NotePropertyName webapp -NotePropertyValue $webapp -Force
      ($mf | ConvertTo-Json -Depth 10) | Out-File -Encoding utf8 $manifest
      Ok 'manifest: web app set to Anyone'
    }

    # One script file only, so we cannot end up with two copies of doPost.
    Get-ChildItem -Path $stage -Include *.gs, *.js -Recurse -File |
      ForEach-Object { Remove-Item $_.FullName -Force }
    Copy-Item $gsFile (Join-Path $stage 'Code.gs') -Force
    Ok 'Code.gs <- tools/quiz-sheet.gs'

    Step 'Pushing code'
    $pushOut = (Invoke-Clasp push -f 2>&1) -join "`n"
    Write-Host $pushOut
    if ($LASTEXITCODE -ne 0) {
      if ($pushOut -match 'not enabled the Apps Script API') {
        # One switch, once per Google account, and only reachable in a browser.
        Write-Host ''
        Warn 'The Apps Script API is off for this account. It is a single toggle:'
        Warn '    https://script.google.com/home/usersettings'
        Warn 'Turn on "Google Apps Script API", wait about a minute, then re-run this script.'
        try { Start-Process 'https://script.google.com/home/usersettings' } catch { }
        throw 'Apps Script API is disabled - see above. Nothing was changed.'
      }
      throw 'clasp push failed.'
    }

    Step 'Creating a version'
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
    $vOut = (Invoke-Clasp create-version "RTL3D quiz $stamp" 2>&1) -join "`n"
    Write-Host $vOut
    $vm = [regex]::Match($vOut, '(\d+)')
    if (-not $vm.Success) { throw "Could not read the new version number from: $vOut" }
    $version = $vm.Groups[1].Value
    Ok "version $version"

    Step "Updating deployment $deploymentId"
    Invoke-Clasp redeploy $deploymentId -V $version -d "RTL3D quiz $stamp"
    if ($LASTEXITCODE -ne 0) { throw 'clasp redeploy failed.' }
    Ok 'deployed - the endpoint URL is unchanged'
  } finally { Pop-Location }
} finally {
  Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
}

# --- did it actually work? -------------------------------------------------
if ($SkipVerify) { return }

Step 'Verifying the live endpoint'
try {
  $res = Invoke-WebRequest -UseBasicParsing -Uri $endpoint -TimeoutSec 30
  $body = $res.Content
  if ($body -match 'Script function not found') {
    Warn 'The endpoint still reports a missing function. Check Deploy > Manage deployments.'
    return
  }
  $json = $body | ConvertFrom-Json
  Ok 'endpoint returns JSON'
  if ($json.sheetUrl) {
    Write-Host ''
    Write-Host '    Your results Sheet:' -ForegroundColor Green
    Write-Host "      $($json.sheetUrl)"
    Write-Host ''
    Write-Host '    Paste that into js/quiz-config.js as RTL3D_QUIZ_SHEET_URL so the'
    Write-Host '    results page can link to it even when the script is down.'
  }
  Write-Host ''
  Write-Host '    Dashboard: https://lightninguniten.github.io/rtl3d-web/quiz-results/'
} catch {
  Warn "Could not read the endpoint: $($_.Exception.Message)"
  Warn 'Open it in a browser to see what it says.'
}
