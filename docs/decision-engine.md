# Moteur de décision — règles v1.0.0

`evaluateCallEligibility` est une fonction pure (`DecisionEngineService`,
aucune I/O) : mêmes entrées → même décision. Version `RULE_VERSION` persistée
dans chaque `decision_logs` (traçabilité des évolutions de règles).

## Contrat

Entrée : `taskId`, `taskStatus`, `attemptCount`, `lastAttemptAt?`, `motive`,
`consent` (`granted` | `refused` | `withdrawn` | `unknown`),
`identityVerified`, `coreAvailable`, `telephonyActivated`, `now`.

Sortie : `{allowed, reasonCodes[], ruleVersion, evaluatedAt, taskId, facts}`.
`allowed` est vrai si et seulement si aucun code de blocage n'est émis
(`reasonCodes = ["ELIGIBLE"]`).

## Règles de blocage (ordre stable)

1. `TASK_NOT_ACTIONABLE` — statut ≠ `pending` (annulée, traitée, réservée…).
2. `OPPOSITION_EXISTS` — consentement `refused`.
3. `CONSENT_WITHDRAWN` — consentement `withdrawn`.
4. `CONSENT_MISSING` — absent, inconnu ou invalide (doute = blocage).
5. `IDENTITY_UNVERIFIED` — identité/numéro non vérifiés par une source fiable.
6. `MAX_ATTEMPTS_REACHED` — `attemptCount ≥ MAX_ATTEMPTS_PER_TASK` (défaut 3).
7. `MIN_DELAY_NOT_MET` — délai depuis la dernière tentative <
   `MIN_DELAY_BETWEEN_ATTEMPTS_HOURS` (défaut 72 h).
8. `QUIET_HOURS` — heure locale `BUSINESS_TIMEZONE` (défaut
   `Africa/Abidjan`, silence 20 h–8 h). **Point d'attention** : `Intl`
   fr-FR rend « 22 h » (non numérique) — extraction par chiffres, et en cas
   de doute le créneau est considéré silencieux (bug réel trouvé par test).
9. `MOTIVE_INSUFFICIENT` — motif < 10 caractères.
10. `CORE_UNAVAILABLE` — une vérification obligatoire dépend d'un service en panne.
11. `TELEPHONY_DISABLED` — double verrou non validé (toujours émis en
    `manual_only` : aucune autorisation ne peut passer).

## Garanties d'exécution

- Réévaluation **immédiatement avant toute tentative** (l'autorisation à la
  création ne suffit jamais) ; le planificateur réévalue sans réserver.
- Réservation atomique + outcome idempotent + opposition concurrente :
  si l'opposition est constatée avant le démarrage, rien n'est composé.
- Échec d'enregistrement d'une opposition ⇒ aucune nouvelle action
  commerciale + signalement (file interne + interface).
- Panne réseau ≠ « sans réponse » : l'outcome reste inconnu.
