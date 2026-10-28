# Contrat d'Interface des Outils - Agent Vocal Blok (AethexAI)

Ce document décrit les outils HTTPS exposés par le backend Next.js à l'agent vocal AethexAI pour la marketplace Blok.

---

## Sécurité commune
- **Protocole** : HTTPS (méthode `POST`)
- **En-tête obligatoire** : `x-agent-secret: <AGENT_SHARED_SECRET>`
- **Content-Type** : `application/json`
- **Simulation** : Si l'API Blok est indisponible ou en mode démonstration, le champ `"simulation": true` est inclus.

---

## 1. `rechercher_produit`
> **Route :** `POST /api/rechercher-produit`  
> **Description pour l'agent :** Permet de trouver des matériaux de construction dans le catalogue Blok avec leurs prix et disponibilités à partir de mots-clés prononcés par le client.

### Arguments (JSON)
| Champ | Type | Obligatoire | Description |
| :--- | :--- | :--- | :--- |
| `terme` | `string` | **Oui** | Mot ou expression recherchée (ex: `"ciment"`, `"fer de 10"`, `"sable"`). |

### Exemple de réponse JSON
```json
{
  "produits": [
    {
      "id": 101,
      "nom": "Ciment Bélier Classic CPJ 32.5 (Sac 50kg)",
      "prix": 4800,
      "unite": "sac",
      "disponible": true
    },
    {
      "id": 102,
      "nom": "Ciment Dangote Haute Résistance CPJ 42.5 (Sac 50kg)",
      "prix": 5200,
      "unite": "sac",
      "disponible": true
    }
  ],
  "message": "J'ai trouvé 2 options pour \"ciment\". Le premier résultat est Ciment Bélier Classic CPJ 32.5 à 4 800 francs CFA. Souhaitez-vous d'autres détails ?"
}
```

### Erreurs possibles
- `400` : Terme de recherche manquant ou vide.
- `401` : Clé secrète `x-agent-secret` invalide ou absente.
- `502` / `504` : Erreur ou dépassement de délai (8s) auprès du serveur Blok.

---

## 2. `verifier_client`
> **Route :** `POST /api/verifier-client`  
> **Description pour l'agent :** Permet d'identifier un client sur le chantier par son numéro de téléphone ou son nom pour retrouver son compte et sa dernière commande.

### Arguments (JSON)
*(Au moins un des champs suivants doit être fourni)*
| Champ | Type | Obligatoire | Description |
| :--- | :--- | :--- | :--- |
| `telephone` | `string` | Optionnel | Numéro de téléphone de l'artisan (ex: `"+2250707070102"` ou `"0707070102"`). |
| `nom` | `string` | Optionnel | Nom ou prénom du client. |
| `id` | `string/number` | Optionnel | Identifiant unique du client chez Blok. |

### Exemple de réponse JSON (Client reconnu)
```json
{
  "client": {
    "id": 501,
    "nom": "Kouassi Koffi",
    "telephone": "+2250707070102",
    "entreprise": "BTP Ivoire Construction",
    "statut": "actif",
    "historique": [
      {
        "devis_id": "DEV-2026-089",
        "date": "2026-10-20",
        "montant_total": 240000,
        "statut": "Livre",
        "articles": ["50 sacs Ciment Bélier", "10 barres Fer de 10"]
      }
    ]
  },
  "message": "Bonjour Kouassi Koffi. Votre compte Blok est bien identifié. Votre dernière commande concernait : 50 sacs Ciment Bélier, 10 barres Fer de 10. Que souhaitez-vous commander aujourd'hui ?"
}
```

### Exemple de réponse JSON (Client non trouvé)
```json
{
  "client": null,
  "message": "Je n'ai trouvé aucun compte client correspondant à 0700000000. Souhaitez-vous que je crée une nouvelle fiche pour votre chantier ?"
}
```

### Erreurs possibles
- `400` : Aucun critère de recherche fourni (`telephone`, `nom` ou `id` manquant).
- `401` : Clé secrète `x-agent-secret` non autorisée.

---

## 3. `preparer_devis`
> **Route :** `POST /api/preparer-devis`  
> **Description pour l'agent :** Permet de chiffrer une commande de matériaux, calculer le montant total estimé et préparer une demande de devis officielle.

### Arguments (JSON)
| Champ | Type | Obligatoire | Description |
| :--- | :--- | :--- | :--- |
| `articles` | `array` | **Oui** | Liste d'au moins un article à inclure dans le devis. |
| `articles[].designation` | `string` | **Oui** | Nom du matériau (ex: `"Ciment Bélier"`). |
| `articles[].quantite` | `number` | **Oui** | Quantité souhaitée (entier supérieur à 0). |
| `articles[].produit_id` | `string/number` | Optionnel | Identifiant catalogue si connu. |
| `articles[].prix_unitaire`| `number` | Optionnel | Prix unitaire en FCFA pour calcul direct. |
| `client_id` | `string/number` | Optionnel | Identifiant du client rattaché au devis. |

### Exemple de réponse JSON
```json
{
  "devis": {
    "reference": "DEV-284910",
    "client_id": 501,
    "lignes": [
      {
        "designation": "Ciment Bélier Classic CPJ 32.5",
        "quantite": 50,
        "prix_unitaire": 4800,
        "sous_total": 240000
      },
      {
        "designation": "Fer à Béton 10mm",
        "quantite": 10,
        "prix_unitaire": 5400,
        "sous_total": 54000
      }
    ],
    "total_estime": 294000,
    "statut": "pret_en_attente_confirmation",
    "pdf_url": "https://blok.africa/quotes/DEV-284910/download.pdf"
  },
  "ecriture_activee": false,
  "message": "Votre devis pour 50 Ciment Bélier Classic CPJ 32.5 et 1 autre article s'élève à environ 294 000 francs CFA. Souhaitez-vous que je le transmette pour validation ?"
}
```

---

## 4. `proposer_produit_absent`
> **Route :** `POST /api/proposer-produit-absent`  
> **Description pour l'agent :** Permet d'enregistrer une demande d'un artisan pour un matériau introuvable dans le catalogue afin que l'équipe commerciale Blok le recherche.

### Arguments (JSON)
| Champ | Type | Obligatoire | Description |
| :--- | :--- | :--- | :--- |
| `designation` | `string` | **Oui** | Nom précis du produit demandé (ex: `"brique réfractaire 22x11x6"`). |
| `unite` | `string` | Optionnel | Unité de mesure (ex: `"brique"`, `"sac"`, `"m2"` - défaut: `"unité"`). |
| `quantite_estimee` | `number` | Optionnel | Quantité approximative souhaitée. |
| `commentaire` | `string` | Optionnel | Précision sur l'usage ou la marque souhaitée. |
| `client_id` | `string/number` | Optionnel | Identifiant de l'artisan demandeur. |

### Exemple de réponse JSON
```json
{
  "produit_propose": {
    "id": "PROP-482910",
    "designation": "Brique réfractaire 22x11x6",
    "unite": "brique",
    "quantite_estimee": 200,
    "statut": "a_valider",
    "date_creation": "2026-10-28T02:30:00.000Z"
  },
  "ecriture_activee": false,
  "message": "J'ai bien noté votre demande pour \"Brique réfractaire 22x11x6\". Ce produit n'est pas encore au catalogue, mais votre demande est enregistrée avec le statut \"à valider\". Notre équipe commerciale Blok va vérifier la disponibilité auprès des fournisseurs."
}
```
