# Создаёт vault secret service_role_key для trigger_push_on_message.
# Usage:
#   $env:SUPABASE_SERVICE_ROLE_KEY = '<from Dashboard → Settings → API>'
#   .\scripts\setup-push-vault-secret.ps1
# Или без env — ключ возьмётся через `supabase projects api-keys` (нужен login).

param(
  [switch]$Linked = $true
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $root

try {
  $sr = $env:SUPABASE_SERVICE_ROLE_KEY
  if (-not $sr) {
    $keys = npm exec -- supabase projects api-keys --project-ref nqssqplizwsukowggzxd -o json 2>$null | ConvertFrom-Json
    $sr = ($keys | Where-Object { $_.id -eq 'service_role' }).api_key
  }
  if (-not $sr) {
    throw 'Set SUPABASE_SERVICE_ROLE_KEY or run: npx supabase login'
  }

  $escaped = $sr.Replace("'", "''")
  $sql = @"
DO `$`$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN
    PERFORM vault.update_secret(
      (SELECT id FROM vault.secrets WHERE name = 'service_role_key' LIMIT 1),
      '$escaped'
    );
  ELSE
    PERFORM vault.create_secret('$escaped', 'service_role_key', 'Push trigger auth');
  END IF;
END;
`$`$;
"@
  $tmp = Join-Path $env:TEMP "vault_setup_service_role.sql"
  [System.IO.File]::WriteAllText($tmp, $sql, (New-Object System.Text.UTF8Encoding $false))

  $args = @('supabase', 'db', 'query')
  if ($Linked) { $args += '--linked' }
  $args += @('--file', $tmp)
  & npm exec -- $args
  Remove-Item $tmp -Force
  Write-Host 'Vault secret service_role_key OK' -ForegroundColor Green
}
finally {
  Pop-Location
}
