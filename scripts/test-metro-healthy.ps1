# Returns exit 0 when http://127.0.0.1:8081/status reports packager running.
try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8081/status' -UseBasicParsing -TimeoutSec 2
    $body = if ($r.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($r.Content) } else { [string]$r.Content }
    if ($r.StatusCode -eq 200 -and $body -match 'running') {
        exit 0
    }
} catch {
    # not healthy
}
exit 1
