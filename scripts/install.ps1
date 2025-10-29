# The following script is adapted from the bun.sh install script for PowerShell
# Licensed under the MIT License


param(
    [string]$Version = "latest"
)

$ErrorActionPreference = "Stop"

# Colors
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

# Determine platform
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

# Function to fetch latest version from GitHub API
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
    # Validate version format
    if ($Version -notmatch '^v?[0-9]+\.[0-9]+\.[0-9]+(-beta\.[0-9]+)?$') {
        Write-Error-Custom "Invalid version format: $Version. Expected format: x.y.z or x.y.z-beta.n (with optional 'v' prefix)"
    }
    
    # Trim 'v' prefix if present
    $version = $Version -replace '^v', ''
}

Write-Info "Version to install: $version"

function Get-DownloadUrl {
    param([string]$CliName)
    return "https://github.com/testfiesta/tacotruck/releases/download/v$version/$CliName-$version-$target.exe"
}

# Determine install directory
$installEnvVar = "TACOTRUCK_CLI_INSTALL"
if ($env:TACOTRUCK_CLI_INSTALL) {
    $installDir = $env:TACOTRUCK_CLI_INSTALL
} else {
    $installDir = Join-Path $env:USERPROFILE ".tacotruck"
}

$binDir = Join-Path $installDir "bin"

# Create install directory if it doesn't exist
if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
    Write-Info "Created install directory: $binDir"
}

foreach ($executableName in $executableNames) {
    $downloadUrl = Get-DownloadUrl -CliName $executableName
    $outputFile = Join-Path $binDir "$executableName.exe"
    
    Write-Info "Downloading $executableName bundle for version $version and target $target"
    Write-Info "URL: $downloadUrl"
    
    try {
        # Use TLS 1.2
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        
        # Download with progress
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $downloadUrl -OutFile $outputFile -ErrorAction Stop
        $ProgressPreference = 'Continue'
        
        Write-Success "Downloaded $executableName successfully"
    } catch {
        Write-Error-Custom "Failed to download $executableName bundle for version $version and target $target (might not exist for this platform/arch combination): $_"
    }
}

Write-Host ""
Write-Host ""
Write-Success "Tacotruck CLI $version is installed successfully!"

# Check if tacotruck is already in PATH
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

# Add to PATH if not already there
Write-Host ""
Write-Info "Adding $binDir to your PATH..."

# Get current user PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")

# Check if already in PATH
if ($userPath -notlike "*$binDir*") {
    # Add to user PATH
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
Write-Info "Note: You may need to restart your terminal or run 'refreshenv' (if using Chocolatey) for PATH changes to take effect"

