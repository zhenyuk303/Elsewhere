param(
    [Parameter(Mandatory = $true)][ValidateSet('Export', 'Import')][string]$Action,
    [string]$File,
    [string]$OwnerUsername = ''
)
$ErrorActionPreference = 'Stop'
$backendDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (!$File) { $File = Join-Path $backendDir '..\database\shared.sql' }
$sqlFile = [IO.Path]::GetFullPath($File)
Push-Location $backendDir
try {
    & mvn -q dependency:build-classpath '-DincludeScope=runtime' '-Dmdep.outputFile=target/share-classpath.txt'
    if ($LASTEXITCODE -ne 0) { throw 'Could not resolve database tool dependencies' }
    $classpath = (Get-Content -LiteralPath 'target/share-classpath.txt' -Raw).Trim()
    & java -cp $classpath (Join-Path $PSScriptRoot 'ShareDatabase.java') $Action $sqlFile $OwnerUsername
    if ($LASTEXITCODE -ne 0) { throw 'Database sharing operation failed. Review the error above.' }
} finally { Pop-Location }
