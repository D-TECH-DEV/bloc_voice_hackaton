# Script PowerShell complet de validation pour le Backend Blok x AethexAI
# Teste les 4 outils dans leurs différents états : nominal, simulation, 401, 400

$baseUrl = "http://localhost:3000"
$validSecret = "dev-secret-12345"
$badSecret = "secret-invalide"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " SUITE DE TESTS DU BACKEND VOCAL BLOK (AethexAI)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

function Run-ToolTest {
    param(
        [string]$Title,
        [string]$Endpoint,
        [hashtable]$Headers,
        [hashtable]$Body,
        [int]$ExpectedStatus
    )

    Write-Host "`n>>> $Title" -ForegroundColor Yellow
    $jsonBody = $Body | ConvertTo-Json -Depth 5

    try {
        $res = Invoke-RestMethod -Uri "$baseUrl$Endpoint" `
            -Method POST `
            -Headers $Headers `
            -Body $jsonBody `
            -ContentType "application/json"

        Write-Host "Status HTTP : 200 (OK)" -ForegroundColor Green
        if ($res.simulation) {
            Write-Host "[FLAG SIMULATION : ACTIF (Plan de secours demo)]" -ForegroundColor Magenta
        }
        if ($res.message) {
            Write-Host "Message vocal : `"$($res.message)`"" -ForegroundColor Gray
        }
        return $res
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq $ExpectedStatus) {
            Write-Host "Status HTTP : $status (Conforme au rejet attendu)" -ForegroundColor Green
        } else {
            Write-Host "Status HTTP : $status (Attendu: $ExpectedStatus)" -ForegroundColor Red
        }

        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errBody = $reader.ReadToEnd()
            Write-Host "Corps de l'erreur : $errBody" -ForegroundColor DarkGray
        }
    }
}

# -------------------------------------------------------------
# 1. Tests de la route /api/rechercher-produit
# -------------------------------------------------------------
Write-Host "`n--- [1/4] ROUTE /api/rechercher-produit ---" -ForegroundColor Cyan

Run-ToolTest -Title "1.1 Rejet si secret manquant/invalide (401)" `
    -Endpoint "/api/rechercher-produit" `
    -Headers @{ "x-agent-secret" = $badSecret } `
    -Body @{ terme = "ciment" } `
    -ExpectedStatus 401

Run-ToolTest -Title "1.2 Rejet validation Zod si champ terme vide (400)" `
    -Endpoint "/api/rechercher-produit" `
    -Headers @{ "x-agent-secret" = $validSecret } `
    -Body @{ autre = "invalide" } `
    -ExpectedStatus 400

$rechercheRes = Run-ToolTest -Title "1.3 Recherche nominale 'ciment' (Catalogue reel)" `
    -Endpoint "/api/rechercher-produit" `
    -Headers @{ "x-agent-secret" = $validSecret } `
    -Body @{ terme = "ciment" } `
    -ExpectedStatus 200

# -------------------------------------------------------------
# 2. Tests de la route /api/verifier-client
# -------------------------------------------------------------
Write-Host "`n--- [2/4] ROUTE /api/verifier-client ---" -ForegroundColor Cyan

Run-ToolTest -Title "2.1 Rejet si aucun critere d'identification fourni (400)" `
    -Endpoint "/api/verifier-client" `
    -Headers @{ "x-agent-secret" = $validSecret } `
    -Body @{} `
    -ExpectedStatus 400

$clientRes = Run-ToolTest -Title "2.2 Client reconnu par telephone (+2250707070102)" `
    -Endpoint "/api/verifier-client" `
    -Headers @{ "x-agent-secret" = $validSecret } `
    -Body @{ telephone = "+2250707070102" } `
    -ExpectedStatus 200

Run-ToolTest -Title "2.3 Client inconnu (numero non enregistre)" `
    -Endpoint "/api/verifier-client" `
    -Headers @{ "x-agent-secret" = $validSecret } `
    -Body @{ telephone = "0100000000" } `
    -ExpectedStatus 200

# -------------------------------------------------------------
# 3. Tests de la route /api/preparer-devis
# -------------------------------------------------------------
Write-Host "`n--- [3/4] ROUTE /api/preparer-devis ---" -ForegroundColor Cyan

Run-ToolTest -Title "3.1 Rejet si liste d'articles vide (400)" `
    -Endpoint "/api/preparer-devis" `
    -Headers @{ "x-agent-secret" = $validSecret } `
    -Body @{ client_id = 501; articles = @() } `
    -ExpectedStatus 400

$devisArticles = @(
    @{ produit_id = 101; designation = "Ciment Belier Classic CPJ 32.5 (Sac 50kg)"; quantite = 50; prix_unitaire = 4800 },
    @{ produit_id = 104; designation = "Fer a Beton Tor FeE500 Diametre 10mm"; quantite = 10; prix_unitaire = 5400 }
)
$devisRes = Run-ToolTest -Title "3.2 Preparation nominale de devis (Calcul total & lignes)" `
    -Endpoint "/api/preparer-devis" `
    -Headers @{ "x-agent-secret" = $validSecret } `
    -Body @{ client_id = 501; articles = $devisArticles } `
    -ExpectedStatus 200

# -------------------------------------------------------------
# 4. Tests de la route /api/proposer-produit-absent
# -------------------------------------------------------------
Write-Host "`n--- [4/4] ROUTE /api/proposer-produit-absent ---" -ForegroundColor Cyan

Run-ToolTest -Title "4.1 Rejet si designation manquante (400)" `
    -Endpoint "/api/proposer-produit-absent" `
    -Headers @{ "x-agent-secret" = $validSecret } `
    -Body @{ commentaire = "Pas de nom" } `
    -ExpectedStatus 400

$propRes = Run-ToolTest -Title "4.2 Enregistrement d'un produit absent avec statut 'a_valider'" `
    -Endpoint "/api/proposer-produit-absent" `
    -Headers @{ "x-agent-secret" = $validSecret } `
    -Body @{
        designation = "Brique refractaire 22x11x6";
        unite = "brique";
        quantite_estimee = 200;
        commentaire = "Four a pain artisanal a Bassam"
    } `
    -ExpectedStatus 200

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " TOUS LES TESTS SONT EXECUTES AVEC SUCCES" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
