# Plan d’exécution — BLOK Voice Copilot

## Phase 1 — Vérifier les deux blocages techniques

> **Résultat attendu :** Une preuve de lecture réelle de BLOK et une preuve de faisabilité des appels AethexAI. *(Si un blocage empêche l’un de ces tests, documenter le problème et préparer immédiatement une solution de démonstration simulée).*

* \[ \] **Tâche 1 :** API BLOK — Récupérer la documentation officielle, identifier l’URL de base, l’authentification, les permissions du token et les limites de requêtes.

* \[ \] **Tâche 2 :** API BLOK — Repérer les endpoints accessibles pour les clients, commandes, achats, catalogue, prix, stocks, demandes de cotation et webhooks.

* \[ \] **Tâche 3 :** API BLOK — Configurer le token de manière sécurisée et réaliser une première requête de lecture.

* \[ \] **Tâche 4 :** API BLOK — Vérifier les réponses réelles, les erreurs d’authentification et les restrictions d’accès.

* \[ \] **Tâche 5 :** AethexAI — Vérifier l’accès au compte, la clé API, l’agent vocal, les langues disponibles et les outils HTTPS personnalisés.

* \[ \] **Tâche 6 :** Téléphonie — Vérifier les appels sortants, le numéro émetteur autorisé, le fournisseur téléphonique et la possibilité d’appeler des numéros ivoiriens.

* \[ \] **Tâche 7 :** Test vocal — Effectuer un appel vers un membre de l’équipe et vérifier le résultat.

## Phase 2 — Définir le MVP et préparer le projet

> **Résultat attendu :** Un projet exécutable, un périmètre validé et un contrat clair entre le backend et l’agent vocal.

### Scénario & Périmètre

* \[ \] Choisir le scénario principal : un client souhaite construire une maison et cherche les matériaux nécessaires.

* \[ \] Définir le fonctionnement du copilote commercial et celui du suivi client.

* \[ \] Déterminer les données réellement disponibles et les résultats attendus.

* \[ \] Définir les fonctionnalités indispensables et celles qui attendront après le hackathon.

* \[ \] Valider ensemble les critères de réussite de la démonstration.

### Choix Techniques & Infrastructure

* \[ \] Choisir le backend en privilégiant un framework déjà maîtrisé.

* \[ \] Choisir la base de données et la structure du frontend.

* \[ \] Définir les échanges entre AethexAI, le backend et BLOK.

* \[ \] Définir les mécanismes d’authentification, de gestion des erreurs et des délais d’attente.

### Initialisation du Projet

* \[ \] Créer le dépôt Git et organiser les répertoires.

* \[ \] Ajouter le `README.md`, le fichier `.env.example` et les règles `.gitignore`.

* \[ \] Définir les conventions de branches et de commits.

* \[ \] Installer les dépendances et configurer le backend, la base de données et le frontend.

* \[ \] Vérifier que les deux membres peuvent lancer le projet.

* \[ \] Ajouter une commande de démarrage simple et vérifier que les secrets ne sont pas suivis par Git.

### Contrats d'API & Modélisation

* \[ \] Définir les contrats des endpoints internes : projets, catalogue, demandes, relances et résultats d’appels.

* \[ \] Définir les formats de réponse des outils AethexAI.

* \[ \] Concevoir le modèle minimal des données : projet, préférences de contact, tâche de suivi et résultat d’appel.

* \[ \] Définir les relations entre clients, projets et achats ainsi que les règles de conservation des données.

## Phase 3 — Construire le connecteur BLOK et le moteur métier

> **Résultat attendu :** Un backend capable de consulter les données disponibles, de conserver un projet et de contrôler les actions commerciales.

### Integrateur API BLOK

* \[ \] Centraliser les appels à l’API BLOK.

* \[ \] Gérer le token côté serveur.

* \[ \] Ajouter les délais d’attente, la gestion des erreurs HTTP et les réponses inattendues.

* \[ \] Ajouter des logs sans données sensibles.

* \[ \] Implémenter la consultation des informations autorisées d’un client.

* \[ \] Implémenter la consultation des commandes et achats accessibles.

* \[ \] Implémenter la recherche dans le catalogue.

* \[ \] Vérifier les prix et disponibilités si les endpoints existent.

* \[ \] Préparer une demande de cotation.

* \[ \] Créer ou modifier une demande uniquement si l’API l’autorise.

* \[ \] Tester les réponses normales, les erreurs d’accès et les données manquantes.

* \[ \] Vérifier qu’aucune donnée inventée n’est présentée comme réelle.

### Gestion des Projets

* \[ \] Créer ou retrouver un projet de construction.

* \[ \] Enregistrer les informations déclarées par le client.

* \[ \] Associer les achats à un projet uniquement lorsque le lien est fiable.

* \[ \] Permettre au client de confirmer ou de corriger le projet associé.

* \[ \] Conserver les informations nécessaires à la reprise d’une conversation.

### Moteur Métier Commercial

* \[ \] Identifier les informations manquantes et distinguer les besoins confirmés des besoins supposés.

* \[\] Utiliser des règles métier pour les calculs.

* \[ \] Consulter le catalogue avant de proposer une référence.

* \[ \] Interdire toute substitution automatique de produit sans validation.

* \[ \] Définir les actions autorisées pour l’agent.

* \[ \] Valider chaque action côté backend.

* \[ \] Empêcher les demandes en double.

* \[ \] Enregistrer le résultat de chaque action.

## Phase 4 — Configurer l’agent vocal AethexAI

> **Résultat attendu :** Un agent vocal connecté au backend, capable de répondre à un besoin commercial sans inventer d’informations.

* \[ \] Définir l’identité et le rôle commercial de l’agent.

* \[ \] Rédiger ses instructions système.

* \[ \] Définir le ton, la langue et les limites de ses réponses.

* \[ \] Lui interdire d’inventer des prix, des stocks, des produits, des références ou des quantités.

* \[ \] Définir sa conduite lorsqu’une information est indisponible.

* \[ \] Créer l’outil de consultation d’un projet.

* \[ \] Créer l’outil de recherche dans le catalogue.

* \[ \] Créer l’outil de récupération des informations nécessaires à une demande.

* \[ \] Créer l’outil de préparation ou de création d’une demande selon les permissions.

* \[ \] Créer l’outil d’enregistrement du résultat d’une conversation.

* \[ \] Ajouter une validation des arguments côté backend.

* \[ \] Limiter les outils aux opérations nécessaires.

* \[ \] Tester un besoin simple, un besoin incomplet, un produit absent du catalogue et un prix indisponible.

* \[ \] Tester les réponses ambiguës et la transmission à un commercial.

* \[ \] Tester une conversation en français, les interruptions et les réponses imprévues.

* \[ \] Vérifier les statuts d’appel et les mécanismes de suivi après appel.

## Phase 5 — Développer le Module A : copilote commercial du client

> **Résultat attendu :** Un parcours complet, de l’expression du besoin à la préparation d’une demande commerciale.

* \[ \] Créer une interface mobile-first.

* \[ \] Ajouter un bouton de démarrage de conversation.

* \[ \] Gérer l’autorisation du microphone.

* \[ \] Afficher le statut de la conversation.

* \[ \] Afficher les informations importantes du projet.

* \[ \] Prévoir l’arrêt et la reprise de la conversation.

* \[ \] Permettre au client de décrire son projet.

* \[ \] Faire poser par l’agent les questions nécessaires.

* \[ \] Enregistrer les réponses structurées dans le backend.

* \[ \] Rechercher les produits disponibles.

* \[ \] Préparer une liste de besoins.

* \[ \] Préparer une demande de cotation lorsque cela est possible.

* \[ \] Permettre au client de vérifier et de corriger les informations.

* \[ \] Distinguer clairement les éléments confirmés de ceux qui restent à préciser.

* \[ \] Conserver l’état du projet indépendamment de la session vocale.

* \[ \] Laisser le client se connecter par le mécanisme normal de BLOK.

* \[ \] Vérifier ses droits après connexion.

* \[ \] Réassocier le projet au compte uniquement si cela est légitime.

* \[ \] Reprendre le parcours sans demander au client de tout répéter.

## Phase 6 — Développer le Module B : suivi commercial intelligent

> **Résultat attendu :** Une relance commerciale contrôlée, justifiée et traçable *(L’absence d’un achat dans les données ne doit jamais être considérée automatiquement comme un besoin du client)*.

### Identification & Règles de Relance

* \[ \] Déterminer quelles données BLOK permettent d’identifier un projet actif.

* \[ \] Définir les situations dans lesquelles une relance peut réellement être utile.

* \[ \] Définir les délais de relance et les cas où aucune relance ne doit être créée.

* \[ \] Prévoir un déclenchement manuel pour la démonstration si nécessaire.

### Vérification des Éligibilités

* \[ \] Vérifier l’existence d’un motif de contact.

* \[ \] Vérifier que le client a accepté le type de suivi prévu.

* \[ \] Vérifier la validité du numéro de téléphone.

* \[ \] Vérifier la date du dernier contact.

* \[ \] Appliquer les limites de fréquence.

* \[ \] Bloquer les contacts après un refus.

* \[ \] Enregistrer la justification de chaque décision.

### Planification & Exécution

* \[ \] Créer une tâche avec une date d’exécution.

* \[ \] Prévoir un mécanisme d’exécution des tâches.

* \[ \] Éviter les déclenchements en double.

* \[ \] Vérifier les autorisations une dernière fois avant l’appel.

* \[ \] Annuler les tâches devenues inutiles.

* \[ \] Limiter les nouvelles tentatives après un échec.

* \[ \] Construire le contexte autorisé de l’appel.

* \[ \] Déclencher l’appel via AethexAI.

* \[ \] Faire poser les questions prévues à l’agent.

* \[ \] Identifier le besoin réellement exprimé.

* \[ \] Enregistrer le résultat de l’appel.

* \[ \] Préparer une demande ou transmettre le dossier à un commercial.

* \[ \] Enregistrer les refus et les préférences de contact.

## Phase 7 — Enregistrer les résultats et sécuriser le système

> **Résultat attendu :** Un historique fiable et un système qui respecte les autorisations, même lorsqu’un appel ou une intégration échoue.

### Suivi & Traitement des Appels

* \[ \] Associer chaque appel à un identifiant unique.

* \[ \] Récupérer le statut final via l’API ou les webhooks disponibles.

* \[ \] Distinguer un appel accepté par l’API d’un appel réellement abouti.

* \[ \] Gérer les appels sans réponse et les échecs.

* \[ \] Éviter les traitements en double.

* \[ \] Enregistrer le résultat de l’appel, un résumé commercial utile, le besoin exprimé et la prochaine action.

* \[ \] Limiter la conservation des données sensibles.

* \[ \] Prévoir une procédure de correction manuelle.

### Sécurité & Confidentialité

* \[ \] Garder les clés API exclusivement côté serveur.

* \[ \] Ne jamais intégrer le token BLOK dans le frontend.

* \[ \] Vérifier les droits avant chaque action.

* \[ \] Limiter les données personnelles transmises à AethexAI.

* \[ \] Définir les conditions de consentement aux appels.

* \[ \] Prévoir un moyen simple de refuser les appels futurs.

* \[ \] Appliquer des limites de fréquence et des plages horaires.

* \[ \] Protéger les endpoints contre les appels non autorisés.

* \[ \] Vérifier les signatures des webhooks lorsqu’elles sont disponibles.

* \[ \] Définir les règles de conservation et de suppression des données.

* \[ \] Tester les accès non autorisés.

* \[ \] Ne jamais collecter de mot de passe ou de code de vérification dans la conversation vocale.

## Phase 8 — Créer l’interface de suivi interne

> *(À développer une fois le parcours principal fonctionnel)*
>
> **Résultat attendu :** Une interface simple permettant de comprendre et de contrôler les actions du système.

* \[ \] Afficher les projets connus.

* \[ \] Afficher les tâches de relance et leurs statuts.

* \[ \] Afficher les appels effectués.

* \[ \] Afficher les résultats et les prochaines actions.

* \[ \] Permettre à un opérateur d’annuler une relance.

* \[ \] Permettre à un commercial de reprendre un dossier.

* \[ \] Identifier clairement les données réelles et les données de démonstration.

## Phase 9 — Tester l’ensemble et préparer la démonstration

> **Résultat attendu :** Une démonstration répétable, avec un parcours principal et un plan de secours.

### Tests de Validation

* \[ \] Vérifier la connexion à BLOK.

* \[ \] Vérifier la connexion à AethexAI.

* \[ \] Vérifier les outils personnalisés.

* \[ \] Vérifier le déclenchement d’un appel.

* \[ \] Vérifier la récupération du résultat.

* \[ \] Vérifier les erreurs et les délais d’attente.

* \[ \] Tester un client dont le projet est clairement identifié.

* \[ \] Tester un client dont le projet est inconnu.

* \[ \] Tester une demande nécessitant une clarification.

* \[ \] Tester un produit indisponible.

* \[ \] Tester un client ayant refusé les appels.

* \[ \] Tester un numéro absent ou invalide.

* \[ \] Tester un appel sans réponse.

* \[ \] Tester une demande de transfert à un commercial.

* \[ \] Tester la reprise d’un projet après connexion.

* \[ \] Vérifier qu’un événement ne déclenche pas plusieurs appels.

* \[ \] Vérifier qu’un échec AethexAI n’efface pas la tâche.

* \[ \] Vérifier qu’une donnée BLOK absente n’est pas inventée.

* \[ \] Vérifier que les erreurs ne révèlent aucun secret.

* \[ \] Vérifier qu'aucun appel n’est déclenché après un refus.

### Préparation de la Démo

* \[ \] Préparer un client de test, un projet de construction et un achat ou une demande de test.

* \[ \] Préparer un numéro de test autorisé.

* \[ \] Préparer le contexte de l’appel et le résultat attendu.

* \[ \] Préparer un scénario de secours si la téléphonie échoue.

* \[ \] Expliquer le problème commercial et présenter les deux modules.

* \[ \] Montrer l’intégration à AethexAI et l’utilisation de l’API BLOK.

* \[ \] Montrer le déclenchement de la relance et le résultat enregistré.

* \[ \] Expliquer les limites du prototype et les prochaines évolutions.

* \[ \] Répéter la démonstration et corriger les anomalies prioritaires.

## Répartition des tâches

### Membre 1 — Backend et Intégrations

* \[ \] Étude de l’API BLOK.

* \[ \] Étude de l’API AethexAI et de la téléphonie.

* \[ \] Connecteur BLOK.

* \[ \] Backend métier et base de données.

* \[ \] Moteur de décision.

* \[ \] Déclenchement et suivi des appels.

* \[ \] Sécurité et tests d’intégration.

### Membre 2 — Agent Vocal et Expérience Utilisateur

* \[ \] Conception du parcours client.

* \[ \] Configuration de l’agent AethexAI.

* \[ \] Instructions système.

* \[ \] Définition des outils personnalisés.

* \[ \] Interface vocale.

* \[ \] Affichage du projet et des demandes.

* \[ \] Interface de suivi interne.

* \[ \] Scénario de démonstration et présentation.

### Travail Commun

* \[ \] Valider le périmètre MVP.

* \[ \] Définir ensemble le contrat entre l’agent et le backend.

* \[ \] Tester les appels et valider les réponses de l’agent.

* \[ \] Vérifier les règles de contact.

* \[ \] Corriger les anomalies prioritaires.

* \[ \] Répéter la démonstration.

## Backlog (Post-MVP)

*Ces fonctionnalités ne doivent pas bloquer la livraison du parcours principal :*

* \[ \] Interface de suivi plus élaborée.

* \[ \] Reprise avancée des projets après connexion.

* \[ \] Prise en charge de plusieurs types de projets.

* \[ \] Optimisation des règles de relance.

* \[ \] Analyse statistique des résultats commerciaux.

* \[ \] Mise en production.

* \[ \] Gestion avancée des consentements.

* \[ \] Intégration approfondie au CRM.

* \[ \] Mesure du taux de conversion.

* \[ \] Optimisation des coûts d’appel.

* \[ \] Évaluation de la pertinence des relances sur des données réelles.

## Critères de Validation Finale

* \[ \] Le backend accède aux données BLOK autorisées.

* \[ \] L’agent vocal comprend un besoin simple.

* \[ \] L’agent utilise les données du catalogue sans inventer d’informations.

* \[ \] Le backend décide si une relance est autorisée.

* \[ \] Un appel sortant de test fonctionne avec un numéro autorisé, ou le parcours de secours est clairement présenté comme une simulation.

* \[ \] Le résultat de l’appel est enregistré.

* \[ \] Une action commerciale peut être préparée ou transmise.

* \[ \] Un refus de contact empêche les relances suivantes.

* \[ \] La démonstration peut être répétée sans dépendre d’une action manuelle imprévisible.