param(
    [int]$Port = 8084,
    [string]$Root = ".",
    [string]$DefaultFile = "my_strategy_025.html"
)

$ErrorActionPreference = 'Stop'
# Убрать \ в конце и кавычки
$Root = $Root.Trim().TrimEnd('\').Trim('"')
$rootPath = (Resolve-Path $Root).Path
Write-Host "Root: $rootPath"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "Server started: http://localhost:$Port/"
Write-Host "Default file: $DefaultFile"
Write-Host "Stop: Ctrl+C or bot_stop_powershell.bat"
Write-Host ""

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response
        $path = $req.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($path)) { $path = $DefaultFile }

        $fullPath = Join-Path $rootPath $path
        if (Test-Path $fullPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            $mime = switch ($ext) {
                '.html' { 'text/html; charset=utf-8' }
                '.htm'  { 'text/html; charset=utf-8' }
                '.js'   { 'application/javascript; charset=utf-8' }
                '.json' { 'application/json; charset=utf-8' }
                '.css'  { 'text/css; charset=utf-8' }
                '.png'  { 'image/png' }
                '.jpg'  { 'image/jpeg' }
                '.svg'  { 'image/svg+xml' }
                default { 'application/octet-stream' }
            }
            $res.ContentType = $mime
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "200 $($req.HttpMethod) /$path"
        } else {
            $res.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
            $res.ContentLength64 = $msg.Length
            $res.OutputStream.Write($msg, 0, $msg.Length)
            Write-Host "404 $($req.HttpMethod) /$path"
        }
        $res.Close()
    }
} finally {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
    Write-Host "Server stopped."
}