# Применяет SQL из supabase/migrations/ по порядку имени файла.
# Требует: npx supabase login + supabase link (или --linked project).
# Usage: .\scripts\apply-supabase-migrations.ps1 [-Linked]

param(
  [switch]$Linked = $true
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$migrationsDir = Join-Path $root 'supabase\migrations'

if (-not (Test-Path $migrationsDir)) {
  throw "Not found: $migrationsDir"
}

$files = Get-ChildItem $migrationsDir -Filter '*.sql' | Sort-Object Name
if ($files.Count -eq 0) {
  throw 'No .sql files in supabase/migrations'
}

Write-Host "Applying $($files.Count) migration(s)..." -ForegroundColor Cyan
Push-Location $root

try {
  foreach ($f in $files) {
    Write-Host "`n>> $($f.Name)" -ForegroundColor Yellow
    $npxArgs = @('supabase', 'db', 'query')
    if ($Linked) { $npxArgs += '--linked' }
    $npxArgs += @('--file', $f.FullName)
    & npm exec -- $npxArgs
    if ($LASTEXITCODE -ne 0) {
      throw "Failed: $($f.Name) (exit $LASTEXITCODE)"
    }
    Write-Host "OK $($f.Name)" -ForegroundColor Green
  }

  Write-Host "`n--- Verification ---" -ForegroundColor Cyan
  $verify = @'
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.messages'::regclass AND NOT tgisinternal
ORDER BY tgname;

SELECT proname FROM pg_proc
WHERE proname IN (
  'update_room_last_message',
  'purge_message_if_hidden_for_all',
  'trigger_push_on_message'
)
ORDER BY proname;

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'rooms'
  AND column_name LIKE 'last_message%'
ORDER BY column_name;

SELECT count(*) AS rooms_total,
       count(*) FILTER (WHERE last_message_at IS NULL) AS rooms_null_last
FROM public.rooms;

SELECT jobid, schedule, active FROM cron.job ORDER BY jobid;
'@
  $verifyPath = Join-Path $env:TEMP 'vault_verify_migrations.sql'
  Set-Content -Path $verifyPath -Value $verify -Encoding UTF8
  $qargs = @('supabase', 'db', 'query')
  if ($Linked) { $qargs += '--linked' }
  $qargs += @('--file', $verifyPath)
  & npm exec -- $qargs
}
finally {
  Pop-Location
}

Write-Host "`nDone." -ForegroundColor Green
