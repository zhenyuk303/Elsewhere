param([string]$Source = (Join-Path $PSScriptRoot '..\data\elsewhere.mv.db'))
$ErrorActionPreference = 'Stop'
$backendDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourceFile = (Resolve-Path -LiteralPath $Source).Path
if (!$sourceFile.EndsWith('.mv.db')) { throw 'Source must be an H2 .mv.db file' }
$backupDir = Join-Path $backendDir 'data\backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$backupFile = Join-Path $backupDir ('elsewhere-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.mv.db')
Copy-Item -LiteralPath $sourceFile -Destination $backupFile
Push-Location $backendDir
try {
    & mvn -q dependency:build-classpath '-DincludeScope=test' '-Dmdep.outputFile=target/migration-classpath.txt'
    if ($LASTEXITCODE -ne 0) { throw 'Could not resolve migration dependencies' }
    $classpath = (Get-Content -LiteralPath 'target/migration-classpath.txt' -Raw).Trim()
    $databasePath = $backupFile.Substring(0, $backupFile.Length - 6)
    & java -cp $classpath (Join-Path $PSScriptRoot 'MigrateH2.java') $databasePath
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed. The target transaction was rolled back.' }
    Write-Output "Backup retained at $backupFile"
} finally { Pop-Location }
