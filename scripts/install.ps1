param(
    [string]$Version = "latest",
    [switch]$Force,
    [switch]$Upgrade
)

$ErrorActionPreference = "Stop"

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "error: " -ForegroundColor Red -NoNewline
    Write-Host $Message
    exit 1
}

function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor DarkGray
}

function Write-Info-Bold {
    param([string]$Message)
    Write-Host $Message -ForegroundColor White
}

function Write-Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

$arch = $env:PROCESSOR_ARCHITECTURE
if ($arch -eq "AMD64" -or $arch -eq "x86_64") {
    $target = "windows-x64"
} elseif ($arch -eq "ARM64") {
    $target = "windows-arm64"
} else {
    Write-Error-Custom "Unsupported architecture: $arch"
}

Write-Info "Detected platform: $target"

$githubRepo = "https://github.com/testfiesta/tacotruck"

function Get-LatestVersion {
    $apiUrl = "https://api.github.com/repos/testfiesta/tacotruck/releases/latest"
    
    try {
        $response = Invoke-RestMethod -Uri $apiUrl -ErrorAction Stop
        $version = $response.tag_name -replace '^v', ''
        return $version
    } catch {
        Write-Info "No latest release found, checking for pre-releases..."
        
        $preReleaseApiUrl = "https://api.github.com/repos/testfiesta/tacotruck/releases"
        try {
            $preReleaseResponse = Invoke-RestMethod -Uri $preReleaseApiUrl -ErrorAction Stop
            if ($preReleaseResponse.Count -gt 0) {
                $version = $preReleaseResponse[0].tag_name -replace '^v', ''
                Write-Info "Using pre-release version: $version"
                return $version
            }
        } catch {
            Write-Error-Custom "Failed to fetch releases from GitHub API: $_"
        }
        
        Write-Error-Custom "Failed to parse version from GitHub API response"
    }
}

$executableNames = @("tacotruck")

if ($Version -eq "latest") {
    $version = Get-LatestVersion
} else {
    if ($Version -notmatch '^v?[0-9]+\.[0-9]+\.[0-9]+(-beta\.[0-9]+)?$') {
        Write-Error-Custom "Invalid version format: $Version. Expected format: x.y.z or x.y.z-beta.n (with optional 'v' prefix)"
    }
    
    $version = $Version -replace '^v', ''
}

Write-Info "Version to install: $version"

function Get-DownloadUrl {
    param([string]$CliName)
    return "https://github.com/testfiesta/tacotruck/releases/download/v$version/$CliName-$version-$target.exe"
}

$installEnvVar = "TACOTRUCK_CLI_INSTALL"
if ($env:TACOTRUCK_CLI_INSTALL) {
    $installDir = $env:TACOTRUCK_CLI_INSTALL
} else {
    $installDir = Join-Path $env:USERPROFILE ".tacotruck"
}

$binDir = Join-Path $installDir "bin"
$executablePath = Join-Path $binDir "tacotruck.exe"

$isUpgrade = $false
$currentVersion = $null

if ($Upgrade) {
    if (-not (Test-Path $executablePath)) {
        Write-Error-Custom "Tacotruck CLI is not installed. Cannot upgrade. Use install.ps1 without -Upgrade flag to install first."
    }
    
    $isUpgrade = $true
    Write-Info "Upgrade mode: Upgrading Tacotruck CLI..."
    
    try {
        $currentVersionOutput = & $executablePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $currentVersion = $currentVersionOutput.Trim()
            Write-Info "Current version: $currentVersion"
            Write-Warning "Upgrading to version $version"
        } else {
            Write-Info "Could not get current version, proceeding with upgrade..."
        }
    } catch {
        Write-Info "Could not get current version, proceeding with upgrade..."
    }
} elseif (Test-Path $executablePath) {
    $isUpgrade = $true
    Write-Info "Tacotruck CLI is already installed. Checking current version..."
    
    try {
        $currentVersionOutput = & $executablePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $currentVersion = $currentVersionOutput.Trim()
            Write-Info "Current version: $currentVersion"
            
            if (-not $Force -and $currentVersion -eq $version) {
                Write-Success "You're already on version $version. Use -Force to reinstall or -Upgrade to upgrade anyway."
                exit 0
            }
            
            Write-Warning "Upgrading from $currentVersion to $version"
        } else {
            Write-Info "Could not get current version, proceeding with install/upgrade..."
        }
    } catch {
        Write-Info "Could not get current version, proceeding with install/upgrade..."
    }
} else {
    Write-Info "Tacotruck CLI is not installed. Installing version $version..."
}

if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
    Write-Info "Created install directory: $binDir"
}

foreach ($executableName in $executableNames) {
    $downloadUrl = Get-DownloadUrl -CliName $executableName
    $outputFile = Join-Path $binDir "$executableName.exe"
    $tempFile = "${outputFile}.tmp"
    
    if ($isUpgrade) {
        if ($Upgrade) {
            Write-Info "Downloading $executableName bundle for version $version and target $target (upgrading)"
        } else {
            Write-Info "Downloading $executableName bundle for version $version and target $target (upgrade)"
        }
    } else {
        Write-Info "Downloading $executableName bundle for version $version and target $target"
    }
    Write-Info "URL: $downloadUrl"
    
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        
        $ProgressPreference = 'SilentlyContinue'
        
        Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile -ErrorAction Stop
        
        $ProgressPreference = 'Continue'
        
        Write-Success "Downloaded $executableName successfully"
        
        if ($isUpgrade) {
            Write-Info "Replacing old binary..."
            if (Test-Path $outputFile) {
                Remove-Item $outputFile -Force
            }
        }
        
        Move-Item $tempFile $outputFile -Force
        
    } catch {
        $ProgressPreference = 'Continue'
        
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        }
        
        $statusCode = $null
        if ($_.Exception -and $_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
        }
        
        if ($statusCode -eq 404) {
            Write-Error-Custom "Version $version not found. Please check if this version exists on GitHub releases."
        } else {
            Write-Error-Custom "Failed to download $executableName bundle for version $version and target $target (might not exist for this platform/arch combination): $_"
        }
    }
}

Write-Host ""
Write-Host ""

if ($isUpgrade) {
    Write-Info "Verifying upgrade..."
    try {
        $newVersionOutput = & $executablePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $newVersion = $newVersionOutput.Trim()
            if ($newVersion -eq $version) {
                Write-Success "Tacotruck CLI upgraded successfully from $currentVersion to $version!"
            } else {
                Write-Warning "Upgrade completed but version mismatch. Expected $version, got $newVersion"
            }
        } else {
            Write-Warning "Upgrade completed but failed to verify version"
        }
    } catch {
        Write-Warning "Upgrade completed but failed to verify: $_"
    }
} else {
    Write-Success "Tacotruck CLI $version is installed successfully!"
}

Write-Host ""

$tacotruckInPath = $false
try {
    $null = Get-Command tacotruck -ErrorAction Stop
    $tacotruckInPath = $true
} catch {
    $tacotruckInPath = $false
}

if ($tacotruckInPath) {
    Write-Host "Run 'tacotruck --help' to get started"
    exit 0
}

Write-Host ""
Write-Info "Adding $binDir to your PATH..."

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")

if ($userPath -notlike "*$binDir*") {
    $newPath = "$binDir;$userPath"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    
    Write-Success "Added `"$binDir`" to your PATH"
    Write-Info "You may need to restart your terminal for the changes to take effect"
} else {
    Write-Info "$binDir is already in your PATH"
}

Write-Host ""
Write-Info "To get started, run:"
Write-Host ""
Write-Info-Bold "  tacotruck --help"
Write-Host ""
if ($isUpgrade) {
    Write-Info "Note: You may need to restart your terminal for the upgrade to take full effect"
} else {
    Write-Info "Note: You may need to restart your terminal or run 'refreshenv' (if using Chocolatey) for PATH changes to take effect"
}

