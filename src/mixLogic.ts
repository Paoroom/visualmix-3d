import type { MixElement } from './types';

/**
 * Calcule la position 3D d'un élément dans la scène de mix.
 *
 * Axes :
 *   X = gauche/droite (pan)
 *   Y = bas/haut (poids fréquentiel — graves en bas, aigus en haut)
 *   Z = profondeur (0 = avant/proche, 1 = arrière/loin)
 *
 * Règles psychoacoustiques appliquées :
 *   - Volume élevé → avant (règle fondamentale)
 *   - EQ aigus → proximity (l'air absorbe les hautes fréquences avec la distance)
 *   - EQ mids → définition, léger impact de proximité
 *   - Attaque lente → transitoire nette → proche
 *   - Release rapide → son vivant → présent
 *   - Saturation → harmoniques → présence → devant
 *   - Reverb → distance psychoacoustique → arrière
 *   - Pre-delay long → source reste devant malgré la reverb
 *   - Stéréo large → diffus → légèrement arrière
 */
export function computePosition(el: MixElement): {
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
  blur: number;
} {
  // ── Axe X : panoramique direct ──────────────────────────────────────────
  const x = el.pan;

  // ── Axe Y : spectre fréquentiel (graves bas, aigus haut) ───────────────
  // Chaque bande relative à son neutre (0.5) : aigus = +, graves = -, mids = léger
  const freqY = (el.eqTreble - 0.5) * 0.70   // aigus → haut
              - (el.eqBass   - 0.5) * 0.50   // graves → bas (antagoniste)
              + (el.eqMid    - 0.5) * 0.15;  // mids → effet neutre
  const y = Math.max(-1, Math.min(1, freqY));

  // ── Axe Z : profondeur (0=avant, 1=arrière) ─────────────────────────────
  let depth = 0.5; // point neutre

  // 1. Volume — effet dominant
  depth -= (el.volume - 0.5) * 0.42;

  // 2. EQ Treble — l'air absorbe les aigus avec la distance
  //    Booster les aigus = son plus proche, couper = plus loin
  depth -= (el.eqTreble - 0.5) * 0.18;

  // 3. EQ Mid — corps et définition, impact modéré
  depth -= (el.eqMid - 0.5) * 0.08;

  // 4. EQ Bass — pas d'effet de proximité (les graves voyagent loin)
  //    (impact uniquement sur l'axe Y)

  // 5. Attaque (compresseur) — lente = laisse passer la transitoire = proche
  //    attackSpeed 0 (lente) → depth baisse → avant
  //    attackSpeed 1 (rapide) → écrase la transitoire → loin
  depth += (el.attackSpeed - 0.5) * 0.20;

  // 6. Release (compresseur) — rapide = vivant = présent
  //    releaseSpeed 1 (rapide) → depth baisse → avant
  depth -= (el.releaseSpeed - 0.5) * 0.10;

  // 7. Saturation — harmoniques supplémentaires = présence = devant
  depth -= el.saturation * 0.14;

  // 8. Reverb — distance psychoacoustique
  depth += el.reverb * 0.32;

  // 9. Pre-delay — long = la source reste devant malgré la reverb
  //    (compense partiellement l'effet de la reverb)
  depth -= el.predelay * el.reverb * 0.20;

  // 10. Largeur stéréo — large = diffus = légèrement plus loin
  depth += el.stereoWidth * 0.08;

  // Clamp 0–1
  const z = Math.max(0, Math.min(1, depth));

  // ── Propriétés visuelles dérivées ───────────────────────────────────────
  // Taille : avant = grand, arrière = petit (min 0.45 pour rester lisible)
  const size = 0.45 + (1 - z) * 0.55;

  // Opacité : avant = plein, arrière = atténué (min 0.38)
  const opacity = 0.38 + (1 - z) * 0.62;

  // Flou : arrière = légèrement flouté (comme dans la réalité)
  const blur = z * 2.5;

  return { x, y, z, size, opacity, blur };
}
