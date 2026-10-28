# Guide d'Intégration & Fiche de Soutenance Backend
**Hackathon AethexAI × Mstudio — Projet Blok Voice Agent**  
*Rôle : Responsable Backend*

---

## 1. Message flash pour tes coéquipiers (Copier / Coller)

> *"Salut l'équipe ! Le backend est terminé, testé et validé à 100 %.
> J'ai analysé toute l'API de Blok et exposé **4 outils HTTPS prêts à brancher** dans l'agent vocal AethexAI.
> Chaque outil renvoie des données propres et un texte naturel déjà prêt pour la synthèse vocale.
>
> J'ai aussi blindé l'architecture :
> 1. **Sécurité :** validation stricte de chaque champ (Zod) + secret partagé (`x-agent-secret`).
> 2. **Fiabilité chantier :** timeout strict de 8s (l'agent ne restera jamais muet au téléphone).
> 3. **Filet de sécurité Démo :** catalogue de secours de 15 matériaux réels en FCFA (Abidjan) pour garantir que notre démo réussisse devant le jury même si l'API externe est lente ou en panne.
>
> Voici la fiche technique pour brancher les outils dans AethexAI."*

---

## 2. Configuration dans l'interface AethexAI

Chaque outil doit être configuré en appel HTTPS dans AethexAI avec les paramètres suivants :

- **Méthode :** `POST`
- **Header obligatoire :** `x-agent-secret: dev-secret-12345`
- **Content-Type :** `application/json`
- **URL de base locale (avec ngrok) :** `https://<votre-id-ngrok>.ngrok-free.app`
- **URL de base en prod :** `https://<votre-projet>.vercel.app`

---

## 3. Les 4 Outils exposés

### Outil 1 : `rechercher_produit`
- **Route :** `POST /api/rechercher-produit`
- **Quand l'agent doit l'appeler :** Quand le client demande la disponibilité ou le prix d'un matériau.
- **Paramètre envoyé :**
  ```json
  { "terme": "ciment" }
  ```
- **Ce que le backend renvoie (exploitable par la voix) :**
  ```json
  {
    "produits": [
      { "id": 101, "nom": "Ciment Bélier CPJ 32.5 (Sac 50kg)", "prix": 4800, "unite": "sac", "disponible": true }
    ],
    "message": "J'ai trouvé Ciment Bélier Classic à 4 800 francs CFA le sac. Combien de sacs vous faut-il ?"
  }
  ```

---

### Outil 2 : `verifier_client`
- **Route :** `POST /api/verifier-client`
- **Quand l'agent doit l'appeler :** En début d'appel pour accueillir le client par son nom et retrouver ses habitudes.
- **Paramètre envoyé :**
  ```json
  { "telephone": "+2250707070102" }
  ```
- **Ce que le backend renvoie :**
  ```json
  {
    "client": {
      "id": 501,
      "nom": "Kouassi Koffi",
      "statut": "actif",
      "derniere_commande": "50 sacs Ciment Bélier, 10 barres Fer de 10"
    },
    "message": "Bonjour Kouassi Koffi. Votre compte Blok est bien identifié. Souhaitez-vous recommander la même chose que la dernière fois ?"
  }
  ```

---

### Outil 3 : `preparer_devis`
- **Route :** `POST /api/preparer-devis`
- **Quand l'agent doit l'appeler :** Quand le client a confirmé les quantités et veut connaître le coût total.
- **Paramètre envoyé :**
  ```json
  {
    "client_id": 501,
    "articles": [
      { "designation": "Ciment Bélier CPJ 32.5", "quantite": 50, "prix_unitaire": 4800 },
      { "designation": "Fer de 10mm", "quantite": 10, "prix_unitaire": 5400 }
    ]
  }
  ```
- **Ce que le backend renvoie :**
  ```json
  {
    "devis": {
      "reference": "DEV-284910",
      "total_estime": 294000,
      "statut": "pret_en_attente_confirmation"
    },
    "message": "Votre devis s'élève à 294 000 francs CFA pour les 50 sacs de ciment et 10 barres de fer. Souhaitez-vous valider la commande ?"
  }
  ```

---

### Outil 4 : `proposer_produit_absent`
- **Route :** `POST /api/proposer-produit-absent`
- **Quand l'agent doit l'appeler :** Quand le matériau demandé n'existe pas dans le catalogue Blok.
- **Paramètre envoyé :**
  ```json
  {
    "designation": "Brique réfractaire 22x11x6",
    "unite": "brique",
    "quantite_estimee": 200,
    "commentaire": "Chantier Cocody"
  }
  ```
- **Ce que le backend renvoie :**
  ```json
  {
    "produit_propose": {
      "id": "PROP-482910",
      "designation": "Brique réfractaire 22x11x6",
      "statut": "a_valider"
    },
    "message": "J'ai bien noté votre demande pour la brique réfractaire. L'article est enregistré avec le statut 'à valider' et notre équipe commerciale vous recontactera rapidement."
  }
  ```

---

## 4. Tes arguments techniques devant le Jury (Défense du projet)

| Question possible du Jury | Ta réponse technique |
| :--- | :--- |
| **Pourquoi ne pas créer directement la commande en base chez Blok ?** | *"Principe de précaution : j'ai implémenté le drapeau `ENABLE_WRITES=false`. Le code de création de RFQ (`POST /rfqs`) est prêt mais sécurisé pour éviter toute écriture polluante pendant la phase de pitch."* |
| **Comment gérez-vous la mauvaise connexion sur les chantiers ?** | *"Un contrôleur d'abandon avec un **timeout strict de 8 secondes** a été mis en place. Si l'API externe ne répond pas dans les temps, l'agent vocal reçoit une erreur contrôlée pour informer l'utilisateur sans coupure gênante."* |
| **Comment assurez-vous la fiabilité des données échangées ?** | *"Validation systématique avec **Zod** sur chaque route. Tout type incohérent ou champ manquant est intercepté dès l'entrée avec un code HTTP 400 explicite."* |
| **Et si l'API Blok tombe en panne pendant le pitch ?** | *"Nous avons un mode `MOCK=true` contenant 15 matériaux authentiques du marché ivoirien avec des prix réels en FCFA. La démo marchera quoi qu'il arrive, en toute transparence avec l'étiquette `"simulation": true`."* |

---

## 5. Comment exposer ton backend local à AethexAI ?

Pour que l'agent vocal (hébergé sur les serveurs d'AethexAI) puisse appeler ton ordinateur en direct :

1. Installe et lance **ngrok** :
   ```powershell
   ngrok http 3000
   ```
2. Ngrok te donnera une adresse publique en HTTPS :
   `https://abcdef123.ngrok-free.app`
3. Donne cette adresse à ton coéquipier pour qu'il la colle dans AethexAI :
   - `https://abcdef123.ngrok-free.app/api/rechercher-produit`
   - `https://abcdef123.ngrok-free.app/api/verifier-client`
   - `https://abcdef123.ngrok-free.app/api/preparer-devis`
   - `https://abcdef123.ngrok-free.app/api/proposer-produit-absent`
