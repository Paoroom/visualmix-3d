export interface MixElement {
  id: string;
  name: string;
  icon: string;
  color: string;
  // Axe largeur
  pan: number;           // -1 à 1 (gauche/droite)
  stereoWidth: number;   // 0=mono (solide/devant), 1=large (diffus/derrière)
  // EQ — 3 bandes (0=coupé, 0.5=neutre, 1=boosté)
  eqBass: number;        // 60-250 Hz : fondation, poids, gravité
  eqMid: number;         // 250-2000 Hz : corps, définition, présence
  eqTreble: number;      // 2k-20k Hz : brillance, air, proximité
  // Dynamique — compression
  attackSpeed: number;   // 0=lente (transitoire nette=proche), 1=rapide (écrase=loin)
  releaseSpeed: number;  // 0=lente (collé=loin), 1=rapide (vivant=proche)
  // Saturation
  saturation: number;    // 0=clean, 1=saturé (harmoniques=présence=devant)
  // Espace — reverb
  reverb: number;        // 0=sec, 1=noyé (distance)
  predelay: number;      // 0=court (fond), 1=long (source reste devant)
  // Volume
  volume: number;        // 0 à 1
}

export type MixParam =
  | 'volume'
  | 'eqBass'
  | 'eqMid'
  | 'eqTreble'
  | 'attackSpeed'
  | 'releaseSpeed'
  | 'saturation'
  | 'reverb'
  | 'predelay'
  | 'stereoWidth';
