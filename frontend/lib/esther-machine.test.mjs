import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decideOrbMode, ORB_LABELS } from "./esther-machine.ts";

function engine(over = {}) {
  return {
    phase: "live",
    micOpen: true,
    micLevel: 0,
    remoteLevel: 0,
    lastMicActiveAt: 0,
    now: 100000,
    ...over,
  };
}

function data(over = {}) {
  return { searchFlashAt: 0, now: 100000, finalizing: false, quoteReady: false, ...over };
}

describe("decideOrbMode — états pilotés par signaux réels", () => {
  it("accueil avant démarrage, connexion pendant l'initialisation", () => {
    assert.equal(decideOrbMode(engine({ phase: "idle" }), data()).mode, "accueil");
    assert.equal(decideOrbMode(engine({ phase: "connecting" }), data()).mode, "connexion");
  });

  it("erreur et termine passent devant tout", () => {
    assert.equal(
      decideOrbMode(engine({ phase: "error", remoteLevel: 0.9 }), data()).mode,
      "erreur",
    );
    assert.equal(decideOrbMode(engine({ phase: "ended" }), data()).mode, "termine");
    assert.equal(
      decideOrbMode(engine({ phase: "ended" }), data({ quoteReady: true })).mode,
      "devis",
    );
  });

  it("parole dès que le flux distant est actif (prioritaire)", () => {
    const d = decideOrbMode(engine({ remoteLevel: 0.5, micLevel: 0.4 }), data());
    assert.equal(d.mode, "parole");
    assert.ok(d.energy > 0 && d.energy <= 1);
  });

  it("recherche sur nouvelle donnée catalogue réelle", () => {
    const d = decideOrbMode(engine(), data({ searchFlashAt: 99000 }));
    assert.equal(d.mode, "recherche");
    const expire = decideOrbMode(engine(), data({ searchFlashAt: 50000 }));
    assert.notEqual(expire.mode, "recherche");
  });

  it("écoute sur activité micro réelle, pas en dessous du seuil", () => {
    assert.equal(decideOrbMode(engine({ micLevel: 0.4 }), data()).mode, "ecoute");
    assert.equal(decideOrbMode(engine({ micLevel: 0.01 }), data()).mode, "veille");
  });

  it("réflexion seulement après une parole récente du visiteur", () => {
    assert.equal(
      decideOrbMode(engine({ lastMicActiveAt: 95000 }), data()).mode,
      "reflexion",
    );
    assert.equal(decideOrbMode(engine({ lastMicActiveAt: 10000 }), data()).mode, "veille");
    assert.equal(decideOrbMode(engine({ micOpen: false, lastMicActiveAt: 95000 }), data()).mode, "veille");
  });

  it("devis pendant la finalisation demandée", () => {
    assert.equal(decideOrbMode(engine(), data({ finalizing: true })).mode, "devis");
  });

  it("chaque mode a un libellé français non vide", () => {
    for (const mode of Object.keys(ORB_LABELS)) {
      assert.ok(ORB_LABELS[mode].length > 0, mode);
    }
    assert.equal(ORB_LABELS.accueil, "Bonjour, je suis ESTHER");
  });
});
