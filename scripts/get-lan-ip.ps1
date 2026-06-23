# Returns PC LAN IPv4 for Metro / dev-client deep links (stdout only — safe for cmd for /f).
param([switch]$Quiet)

function Find-FlipLanIp {
  $candidates = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.PrefixOrigin -ne "WellKnown" -and
      $_.IPAddress -notlike "169.254.*"
    })

  $wifi = @($candidates | Where-Object {
    $_.InterfaceAlias -match "Wi-Fi|WLAN|Wireless" -and $_.IPAddress -like "192.168.*"
  } | Select-Object -First 1)
  if ($wifi.Count -gt 0) { return $wifi[0].IPAddress }

  $lan192 = @($candidates | Where-Object { $_.IPAddress -like "192.168.*" } | Select-Object -First 1)
  if ($lan192.Count -gt 0) { return $lan192[0].IPAddress }

  $any = @($candidates | Select-Object -First 1)
  if ($any.Count -gt 0) { return $any[0].IPAddress }

  return $null
}

$ip = Find-FlipLanIp
if ($ip) {
  Write-Output $ip
} elseif (-not $Quiet) {
  Write-Error "No LAN IPv4 found. Connect PC to Wi-Fi (same network as phone)."
  exit 1
}
