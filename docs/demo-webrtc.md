# Démonstration WebRTC — ESTHER (agente commerciale BLOK Relance)

Procédure reproductible, sans appel téléphonique, sans vrai client,
sans donnée personnelle réelle. Core en mode mock, sortants verrouillés.

## Pré-requis vérifiés

- `docker compose ps` : 5 services sains (voir `docs/ETAT_PROJET_BLOK_RELANCE.md`).
- Proxy : `curl http://127.0.0.1:5000/health` → `aethex_configured:true`,
  `agent_configured:true`.
- Outils backend joignables (garde `x-voice-tool-secret`, préfixe `DEMO-`
  pour toute référence fictive).

## Partie A — Conversation vocale (manuelle, ~5 min)

1. Ouvrir `http://127.0.0.1:5000/` dans Chrome/Edge (micro autorisé ;
   le HTTPS n'est pas requis sur `127.0.0.1`, le `getUserMedia` fonctionne).
2. Cliquer « Démarrer la conversation », autoriser le microphone.
3. Badge attendu : `Connexion…` → `Connecté — parlez !`, puis la voix de
   ESTHER se présente en français (« Bonjour et bienvenue chez BLOK ! Je suis ESTHER, … »).
4. Dire, en français naturel : « Je construis une maison, il me faut du
   ciment pour les fondations, une dizaine de sacs. »
5. Sans outils enregistrés, ESTHER converse mais **ne peut pas consulter
   le catalogue** : elle doit le dire explicitement (règle de son prompt :
   ne jamais simuler une consultation).
6. Tester le stop : « Je ne veux plus recevoir d'appels commerciaux. »
   Réponse attendue : accusé immédiat + fin polie (l'enregistrement réel
   de l'opposition se fait via l'outil dès qu'il est câblé, Phase 2).
7. Cliquer « Terminer ». Erreurs possibles (messages affichés en français
   par `client.html`) : micro refusé/absent, ICE trop lent, session
   expirée (410 → recommencer).

## Partie B — Outils métier (scriptée, sans voix)

Rejoue exactement les appels qu'AethexAI fera une fois les outils
enregistrés (`blok_voice/agent/register_tools.py --apply`, exige un hôte
HTTPS public — bloqué en local, voir rapport). Exécuter depuis l'hôte :

```bash
docker exec blok-relance-backend-api-1 node -e "
(async()=>{
const S=process.env.VOICE_TOOL_SECRET, B='http://127.0.0.1:3001';
const post=async(p,b)=>{const r=await fetch(B+p,{method:'POST',
  headers:{'Content-Type':'application/json','x-voice-tool-secret':S},
  body:JSON.stringify(b)});return [r.status,await r.text()];};
console.log(await post('/api/v1/relance/tools/catalog-search',{query:'ciment'}));
console.log(await post('/api/v1/relance/tools/prepare-material-list',
  {customerRef:'DEMO-ESTHER-01',items:[{label:'Ciment CPJ 50kg',qty:10,unit:'sac'}]}));
console.log(await post('/api/v1/relance/tools/confirm-rfq',
  {organizationId:1,items:[{label:'Ciment CPJ 50kg',qty:10,unit:'sac'}],
   confirmationClient:true,idempotenceKey:'demo-esther-01'}));
})()"
```

Résultats attendus (vérifiés le 2026-10-29) : `201` + `correlationId`
partout ; catalogue mock (`prixVerifie:false`) ; liste `draft`
(`nonResolues:1`) ; RFQ `MOCK-…`, `mock:true`.

## Partie C — Transfert humain et opt-out (séparés)

```bash
# transfert (attendu 201, statut pending)
# .../request-human-handoff {customerRef:'DEMO-ESTHER-01',
#   motive:'Client demande un conseiller pour la toiture (10+ caractères)',
#   summary:'…'}
# opt-out (attendu 201, refused, effet immediat)
# .../record-voice-opt-out {customerRef:'DEMO-ESTHER-02'}
```

Vérification des traces (lecture seule) :

```bash
docker exec blok-relance-postgres-1 sh -c 'psql -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM material_lists \
  WHERE created_by='"'"'tool:agent_vocal'"'"'; \
  SELECT customer_ref || \"=\" || status FROM voice_consents \
  WHERE customer_ref LIKE '"'"'DEMO-%'"'"';"'
```

Attendu : `1` liste outil ; `DEMO-ESTHER-02=refused` + 1 `consent_events`.

## Limites connues de la démo

- Sans hôte HTTPS public, l'agent ne déclenche aucun outil lui-même :
  la partie B simule ses appels à l'identique (même URL, même en-tête,
  mêmes payloads).
- Aucune donnée DEMO n'est nettoyée automatiquement ; préfixe `DEMO-`
  obligatoire pour les retrouver et les distinguer.
