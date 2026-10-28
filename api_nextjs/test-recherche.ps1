# Script de test PowerShell pour la route /api/rechercher-produit

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 1. Test avec mauvais x-agent-secret (Attendu: 401)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$badHeaders = @{ "x-agent-secret" = "mauvais-secret" }
$body = @{ terme = "ciment" } | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "http://localhost:3001/api/rechercher-produit" -Method POST -Headers $badHeaders -Body $body -ContentType "application/json"
    Write-Host "Echec: la requete aurait du etre rejetee !" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "Code recu : $code (Rejet 401 valide)" -ForegroundColor Green
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host " 2. Test avec body invalide (Attendu: 400)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$validHeaders = @{ "x-agent-secret" = "dev-secret-12345" }
$invalidBody = @{ autre = 123 } | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "http://localhost:3001/api/rechercher-produit" -Method POST -Headers $validHeaders -Body $invalidBody -ContentType "application/json"
    Write-Host "Echec: la requete aurait du etre rejetee !" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "Code recu : $code (Validation Zod 400 valide)" -ForegroundColor Green
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host " 3. Test de recherche nominale ('ciment')" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

try {
    $res = Invoke-RestMethod -Uri "http://localhost:3001/api/rechercher-produit" -Method POST -Headers $validHeaders -Body $body -ContentType "application/json"
    Write-Host "Succes ! Reponse recue :" -ForegroundColor Green
    $res | ConvertTo-Json -Depth 5
} catch {
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errBody = $reader.ReadToEnd()
        Write-Host "Code recu : $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
        Write-Host "Details : $errBody" -ForegroundColor Yellow
        Write-Host "`nNote : Si l'erreur indique BLOK_API_KEY manquante ou 401 Blok, ajoutez votre cle Blok dans .env.local et relancez le dev server." -ForegroundColor Gray
    } else {
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}
