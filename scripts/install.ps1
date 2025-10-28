#!/usr/bin/env pwsh
param(
  [String]$Version = "latest",
  [Switch]$ForceBaseline = $false,
  [Switch]$NoPathUpdate = $false,
  [Switch]$NoRegisterInstallation = $false,
  [Switch]$NoCompletions = $false,
  [Switch]$DownloadWithoutCurl = $false
);

if (-not ((Get-CimInstance Win32_ComputerSystem)).SystemType -match "x64-based") { 
  Write-Output "Install Failed:"
  Write-Output "Tacotruck for Windows is currently only available for x86 64-bit Windows.`n"
  return 1
}

$MinBuild = 17763;
$MinBuildName = "Windows 10 1809 / Windows Server 2019"

$WinVer = [System.Environment]::OSVersion.Version
if ($WinVer.Major -lt 10 -or ($WinVer.Major -eq 10 -and $WinVer.Build -lt $MinBuild)) {
  Write-Warning "Tacotruck requires at ${MinBuildName} or newer.`n`nThe install will still continue but it may not work.`n"
  return 1
}

$ErrorActionPreference = "Stop"

function Get-LatestVersion {
    param(
        [string]$Repository = "testfiesta/tacotruck"
    )
    
    try {
        Write-Host "Fetching latest version from GitHub API..." -ForegroundColor Yellow
        
        $apiUrl = "https://api.github.com/repos/$Repository/releases/latest"
        $response = Invoke-RestMethod -Uri $apiUrl -ErrorAction Stop
        
        if ($response.tag_name) {
            $version = $response.tag_name -replace '^v', ''
            Write-Host "Found latest stable version: $version" -ForegroundColor Green
            return $version
        }
    }
    catch {
        Write-Host "No stable release found, checking for pre-releases..." -ForegroundColor Yellow
        
        try {
            $prereleaseApiUrl = "https://api.github.com/repos/$Repository/releases"
            $prereleaseResponse = Invoke-RestMethod -Uri $prereleaseApiUrl -ErrorAction Stop
            
            if ($prereleaseResponse -and $prereleaseResponse.Count -gt 0) {
                $version = $prereleaseResponse[0].tag_name -replace '^v', ''
                Write-Host "Using pre-release version: $version" -ForegroundColor Yellow
                return $version
            }
        }
        catch {
            Write-Error "Failed to fetch version information from GitHub API: $($_.Exception.Message)"
            return $null
        }
    }
    
    Write-Error "Failed to fetch version information from GitHub API"
    return $null
}

function Test-VersionFormat {
    param(
        [string]$Version
    )
    
    $pattern = '^v?[0-9]+\.[0-9]+\.[0-9]+(-beta\.[0-9]+)?$'
    
    if ($Version -match $pattern) {
        return $true
    }
    
    return $false
}

function Publish-Env {
  if (-not ("Win32.NativeMethods" -as [Type])) {
    Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition @"
[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
public static extern IntPtr SendMessageTimeout(
    IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam,
    uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
"@
  }
  $HWND_BROADCAST = [IntPtr] 0xffff
  $WM_SETTINGCHANGE = 0x1a
  $result = [UIntPtr]::Zero
  [Win32.NativeMethods]::SendMessageTimeout($HWND_BROADCAST,
    $WM_SETTINGCHANGE,
    [UIntPtr]::Zero,
    "Environment",
    2,
    5000,
    [ref] $result
  ) | Out-Null
}

function Write-Env {
  param([String]$Key, [String]$Value)

  $RegisterKey = Get-Item -Path 'HKCU:'

  $EnvRegisterKey = $RegisterKey.OpenSubKey('Environment', $true)
  if ($null -eq $Value) {
    $EnvRegisterKey.DeleteValue($Key)
  } else {
    $RegistryValueKind = if ($Value.Contains('%')) {
      [Microsoft.Win32.RegistryValueKind]::ExpandString
    } elseif ($EnvRegisterKey.GetValue($Key)) {
      $EnvRegisterKey.GetValueKind($Key)
    } else {
      [Microsoft.Win32.RegistryValueKind]::String
    }
    $EnvRegisterKey.SetValue($Key, $Value, $RegistryValueKind)
  }

  Publish-Env
}

function Get-Env {
  param([String] $Key)

  $RegisterKey = Get-Item -Path 'HKCU:'
  $EnvRegisterKey = $RegisterKey.OpenSubKey('Environment')
  $EnvRegisterKey.GetValue($Key, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
}

function Install-Tacotruck {
  param(
    [string]$Version,
    [bool]$ForceBaseline = $False
  );

  if ($Version -eq "latest" -or [string]::IsNullOrEmpty($Version)) {
    Write-Host "Version not specified, fetching latest version..." -ForegroundColor Yellow
    $actualVersion = Get-LatestVersion
    if (-not $actualVersion) {
      Write-Error "Failed to determine latest version. Please specify a version manually."
      return 1
    }
    $Version = $actualVersion
  }
  else {
    if (-not (Test-VersionFormat $Version)) {
      Write-Error "Invalid version format: '$Version'. Expected format: x.y.z or x.y.z-beta.n (with optional 'v' prefix)"
      Write-Host "Examples: '1.0.0', '1.0.0-beta.1', 'v1.0.0'" -ForegroundColor Yellow
      return 1
    }
    
    $Version = $Version -replace '^v', ''
    Write-Host "Installing Tacotruck version: $Version" -ForegroundColor Green
  }

  $releaseTag = "v$Version"

  $Arch = "x64"
  $IsBaseline = $ForceBaseline
  if (!$IsBaseline) {
    $IsBaseline = !( `
      Add-Type -MemberDefinition '[DllImport("kernel32.dll")] public static extern bool IsProcessorFeaturePresent(int ProcessorFeature);' `
        -Name 'Kernel32' -Namespace 'Win32' -PassThru `
    )::IsProcessorFeaturePresent(40);
  }

  $TacotruckRoot = if ($env:TACOTRUCK_INSTALL) { $env:TACOTRUCK_INSTALL } else { "${Home}\.tacotruck" }
  $TacotruckBin = mkdir -Force "${TacotruckRoot}\bin"

  try {
    Remove-Item "${TacotruckBin}\tacotruck.exe" -Force
  } catch [System.Management.Automation.ItemNotFoundException] {
    # ignore
  } catch [System.UnauthorizedAccessException] {
    $openProcesses = Get-Process -Name tacotruck | Where-Object { $_.Path -eq "${TacotruckBin}\tacotruck.exe" }
    if ($openProcesses.Count -gt 0) {
      Write-Output "Install Failed - An older installation exists and is open. Please close open Tacotruck processes and try again."
      return 1
    }
    Write-Output "Install Failed - An unknown error occurred while trying to remove the existing installation"
    Write-Output $_
    return 1
  } catch {
    Write-Output "Install Failed - An unknown error occurred while trying to remove the existing installation"
    Write-Output $_
    return 1
  }

  $Target = "tacotruck-windows-$Arch"
  if ($IsBaseline) {
    $Target = "tacotruck-windows-$Arch-baseline"
  }
  
  $BaseURL = "https://github.com/testfiesta/tacotruck/releases"
  $URL = "$BaseURL/download/$releaseTag/$Target.zip"

  $ZipPath = "${TacotruckBin}\$Target.zip"

  $DisplayVersion = "Tacotruck $Version"

  $null = mkdir -Force $TacotruckBin
  Remove-Item -Force $ZipPath -ErrorAction SilentlyContinue

  Write-Host "Downloading $DisplayVersion for Windows $Arch..." -ForegroundColor Yellow
  Write-Host "URL: $URL" -ForegroundColor Gray

  $downloadSuccess = $false
  
  if (-not $DownloadWithoutCurl) {
    try {
      Write-Host "Attempting download with curl..." -ForegroundColor Yellow
      curl.exe "-#SfLo" "$ZipPath" "$URL" 
      if ($LASTEXITCODE -eq 0) {
        $downloadSuccess = $true
        Write-Host "Download completed successfully with curl" -ForegroundColor Green
      }
    }
    catch {
      Write-Warning "curl download failed: $($_.Exception.Message)"
    }
  }
  
  if (-not $downloadSuccess) {
    Write-Warning "curl download failed or was skipped. Trying PowerShell download method..."
    try {
      Write-Host "Downloading with PowerShell..." -ForegroundColor Yellow
      Invoke-RestMethod -Uri $URL -OutFile $ZipPath -ErrorAction Stop
      $downloadSuccess = $true
      Write-Host "Download completed successfully with PowerShell" -ForegroundColor Green
    } catch {
      Write-Error "Install Failed - could not download $URL"
      Write-Error "Error: $($_.Exception.Message)"
      Write-Host "This might be due to:" -ForegroundColor Yellow
      Write-Host "  - Network connectivity issues" -ForegroundColor Yellow
      Write-Host "  - Antivirus software blocking the download" -ForegroundColor Yellow
      Write-Host "  - The version '$Version' does not exist for this platform" -ForegroundColor Yellow
      Write-Host "  - GitHub API rate limiting" -ForegroundColor Yellow
      return 1
    }
  }

  if (!(Test-Path $ZipPath)) {
    Write-Error "Install Failed - could not download $URL"
    Write-Error "The file '$ZipPath' does not exist. Did an antivirus delete it?"
    Write-Host "Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "  - Check your internet connection" -ForegroundColor Yellow
    Write-Host "  - Temporarily disable antivirus software" -ForegroundColor Yellow
    Write-Host "  - Try running PowerShell as Administrator" -ForegroundColor Yellow
    return 1
  }

  $fileSize = (Get-Item $ZipPath).Length
  if ($fileSize -lt 1024) {    Write-Error "Downloaded file is too small ($fileSize bytes). The download may have failed."
    return 1
  }
  Write-Host "Downloaded file size: $([math]::Round($fileSize / 1MB, 2)) MB" -ForegroundColor Green

  Write-Host "Extracting archive..." -ForegroundColor Yellow
  try {
    $lastProgressPreference = $global:ProgressPreference
    $global:ProgressPreference = 'SilentlyContinue';
    Expand-Archive "$ZipPath" "$TacotruckBin" -Force
    $global:ProgressPreference = $lastProgressPreference
    
    if (!(Test-Path "${TacotruckBin}\$Target\tacotruck.exe")) {
      throw "The file '${TacotruckBin}\$Target\tacotruck.exe' does not exist. Download is corrupt or intercepted by Antivirus?"
    }
    
    Write-Host "Archive extracted successfully" -ForegroundColor Green
  } catch {
    Write-Error "Install Failed - could not unzip $ZipPath"
    Write-Error "Error: $($_.Exception.Message)"
    Write-Host "This might be due to:" -ForegroundColor Yellow
    Write-Host "  - Corrupted download" -ForegroundColor Yellow
    Write-Host "  - Antivirus software blocking extraction" -ForegroundColor Yellow
    Write-Host "  - Insufficient disk space" -ForegroundColor Yellow
    return 1
  }

  Write-Host "Installing Tacotruck executable..." -ForegroundColor Yellow
  Move-Item "${TacotruckBin}\$Target\tacotruck.exe" "${TacotruckBin}\tacotruck.exe" -Force

  Remove-Item "${TacotruckBin}\$Target" -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue

  Write-Host "Verifying installation..." -ForegroundColor Yellow
  $TacotruckRevision = "$(& "${TacotruckBin}\tacotruck.exe" --version)"
  if ($LASTEXITCODE -eq 1073741795) { # STATUS_ILLEGAL_INSTRUCTION
    if ($IsBaseline) {
      Write-Error "Install Failed - tacotruck.exe (baseline) is not compatible with your CPU."
      Write-Host "Your CPU does not support the required instruction set." -ForegroundColor Yellow
      Write-Host "Please open a GitHub issue with your CPU model:" -ForegroundColor Yellow
      Write-Host "https://github.com/testfiesta/tacotruck/issues/new/choose" -ForegroundColor Cyan
      return 1
    }

    Write-Warning "tacotruck.exe is not compatible with your CPU. This should have been detected before downloading."
    Write-Host "Attempting to download tacotruck.exe (baseline) instead..." -ForegroundColor Yellow

    Install-Tacotruck -Version $Version -ForceBaseline $True
    return $LASTEXITCODE
  }
  if (($LASTEXITCODE -eq 3221225781) -or ($LASTEXITCODE -eq -1073741515)) # STATUS_DLL_NOT_FOUND
  { 
    Write-Error "Install Failed - You are missing a DLL required to run tacotruck.exe"
    Write-Host "This can be solved by installing the Visual C++ Redistributable from Microsoft:" -ForegroundColor Yellow
    Write-Host "See: https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist" -ForegroundColor Cyan
    Write-Host "Direct Download: https://aka.ms/vs/17/release/vc_redist.x64.exe" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Note: This error should be unreachable as Tacotruck does not depend on this library." -ForegroundColor Yellow
    Write-Host "Please report this issue: https://github.com/testfiesta/tacotruck/issues/new/choose" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The command '${TacotruckBin}\tacotruck.exe --version' exited with code ${LASTEXITCODE}" -ForegroundColor Red
    return 1
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Install Failed - could not verify tacotruck.exe"
    Write-Error "The command '${TacotruckBin}\tacotruck.exe --version' exited with code ${LASTEXITCODE}"
    Write-Host "This might indicate:" -ForegroundColor Yellow
    Write-Host "  - The executable is corrupted" -ForegroundColor Yellow
    Write-Host "  - Missing system dependencies" -ForegroundColor Yellow
    Write-Host "  - Antivirus interference" -ForegroundColor Yellow
    return 1
  }

  Write-Host "Installation verification successful!" -ForegroundColor Green

  try {
    $env:IS_TACOTRUCK_AUTO_UPDATE = "1"
    if ($NoCompletions) {
      $env:TACOTRUCK_NO_INSTALL_COMPLETIONS = "1"
    }
    $output = "$(& "${TacotruckBin}\tacotruck.exe" completions 2>&1)"
    if ($LASTEXITCODE -ne 0) {
      Write-Output $output
      Write-Output "Install Failed - could not finalize installation"
      Write-Output "The command '${TacotruckBin}\tacotruck.exe completions' exited with code ${LASTEXITCODE}`n"
      return 1
    }
  } catch {
  }
  $env:IS_TACOTRUCK_AUTO_UPDATE = $null
  $env:TACOTRUCK_NO_INSTALL_COMPLETIONS = $null

  $DisplayVersion = if ($TacotruckRevision -like "*-canary.*") {
    "${TacotruckRevision}"
  } else {
    "$(& "${TacotruckBin}\tacotruck.exe" --version)"
  }

  $C_RESET = [char]27 + "[0m"
  $C_GREEN = [char]27 + "[1;32m"

  Write-Host ""
  Write-Host "🎉 Tacotruck $Version was installed successfully!" -ForegroundColor Green
  Write-Host "📍 Binary location: ${TacotruckBin}\tacotruck.exe" -ForegroundColor Cyan
  Write-Host ""

  $hasExistingOther = $false;
  try {
    $existing = Get-Command tacotruck -ErrorAction
    if ($existing.Source -ne "${TacotruckBin}\tacotruck.exe") {
      Write-Warning "Note: Another tacotruck.exe is already in %PATH% at $($existing.Source)`nTyping 'tacotruck' in your terminal will not use what was just installed.`n"
      $hasExistingOther = $true;
    }
  } catch {}

  if (-not $NoRegisterInstallation) {
    $rootKey = $null
    try {
      $RegistryKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Tacotruck"  
      $rootKey = New-Item -Path $RegistryKey -Force
      New-ItemProperty -Path $RegistryKey -Name "DisplayName" -Value "Tacotruck" -PropertyType String -Force | Out-Null
      New-ItemProperty -Path $RegistryKey -Name "InstallLocation" -Value "${TacotruckRoot}" -PropertyType String -Force | Out-Null
      New-ItemProperty -Path $RegistryKey -Name "DisplayIcon" -Value $TacotruckBin\tacotruck.exe -PropertyType String -Force | Out-Null
      $uninstallCmd = 'powershell -c "& ''$TacotruckRoot\uninstall.ps1'' -PauseOnError" -ExecutionPolicy Bypass'
      New-ItemProperty -Path $RegistryKey -Name "UninstallString" -Value $uninstallCmd -PropertyType String -Force | Out-Null
    } catch {
      if ($rootKey -ne $null) {
        Remove-Item -Path $RegistryKey -Force
      }
    }
  }

  if(!$hasExistingOther) {
    $Path = (Get-Env -Key "Path") -split ';'
    if ($Path -notcontains $TacotruckBin) {
      if (-not $NoPathUpdate) {
        $Path += $TacotruckBin
        Write-Env -Key 'Path' -Value ($Path -join ';')
        $env:PATH = $Path -join ';'
      } else {
        Write-Output "Skipping adding '${TacotruckBin}' to the user's %PATH%`n"
      }
    }

    Write-Host "🚀 To get started:" -ForegroundColor Green
    Write-Host "   1. Restart your terminal/editor" -ForegroundColor Yellow
    Write-Host "   2. Run: tacotruck --help" -ForegroundColor Cyan
    Write-Host ""
  }

  $LASTEXITCODE = 0;
}

Install-Tacotruck -Version $Version -ForceBaseline $ForceBaseline