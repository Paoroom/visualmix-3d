import React, { useState } from 'react';
import type { MixElement, MixParam } from '../types';
import { computePosition } from '../mixLogic';

interface Props {
  element: MixElement;
  onChange: (param: MixParam | 'pan', value: number) => void;
}

interface ParamConfig {
  key: MixParam;
  label: string;
  unit?: string;
  leftLabel: string;
  rightLabel: string;
  color: string;
  shortRule: string;   // règle courte (1 ligne, toujours visible)
  why: string;         // explication "Pourquoi ?" (dépliable)
  min?: number;
  max?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Paramètres dans l'ordre professionnel de la chaîne signal
// ─────────────────────────────────────────────────────────────────────────────
const SECTIONS: { title: string; icon: string; params: ParamConfig[] }[] = [
  {
    title: 'Gain',
    icon: '🔊',
    params: [
      {
        key: 'volume',
        label: 'Volume',
        leftLabel: '− Faible',
        rightLabel: 'Fort +',
        color: '#e74c3c',
        shortRule: 'Plus fort = plus proche',
        why: "C'est la règle n°1 du mix. Le cerveau associe le volume relatif à la distance : un son plus fort que les autres semble plus proche, même si son volume absolu est identique. Ce n'est pas le niveau solo qui compte, c'est le niveau par rapport aux autres éléments.",
      },
    ],
  },
  {
    title: 'EQ — Égalisation',
    icon: '📊',
    params: [
      {
        key: 'eqBass',
        label: 'Graves (60–250 Hz)',
        leftLabel: '← Coupé',
        rightLabel: 'Boosté →',
        color: '#c0392b',
        shortRule: 'Descend dans le spectre → plus lourd, plus bas',
        why: "Les graves créent la gravité et le poids d'un son. Booster les basses fait 'descendre' l'élément visuellement dans l'espace fréquentiel. Ils ne rapprochent pas la source — les graves voyagent loin — mais ils définissent le plancher du mix.",
      },
      {
        key: 'eqMid',
        label: 'Médiums (250–2k Hz)',
        leftLabel: '← Coupé',
        rightLabel: 'Boosté →',
        color: '#e67e22',
        shortRule: 'Corps et définition du son',
        why: "Les médiums portent l'identité d'un instrument : sa 'chair', sa définition, sa présence dans le mix. Un boost donne du corps et de la clarté, ce qui rend l'élément plus présent. Une coupe peut l'éloigner ou le rendre creux. Zone critique pour la lisibilité.",
      },
      {
        key: 'eqTreble',
        label: 'Aigus (2k–20k Hz)',
        leftLabel: '← Coupé',
        rightLabel: 'Boosté →',
        color: '#f1c40f',
        shortRule: 'Brillance = proximité — l\'air absorbe les aigus',
        why: "Physique : dans la réalité, l'air absorbe les hautes fréquences avec la distance. Un son lointain perd ses aigus. En studio, booster les aigus crée une illusion de proximité. Couper les aigus éloigne. C'est l'indice de distance le plus naturel pour le cerveau.",
      },
    ],
  },
  {
    title: 'Dynamique — Compression',
    icon: '🎛',
    params: [
      {
        key: 'attackSpeed',
        label: 'Attaque',
        leftLabel: '← Lente',
        rightLabel: 'Rapide →',
        color: '#9b59b6',
        shortRule: 'Lente = transitoire nette = proche',
        why: "L'attaque du compresseur décide si la transitoire (le début du son) passe ou est écrasée. Attaque lente → laisse passer la transitoire → son punchy → source proche. Attaque rapide → écrase la transitoire → son lissé → source éloignée. Dans la réalité, les sons proches ont des attaques nettes.",
      },
      {
        key: 'releaseSpeed',
        label: 'Release',
        leftLabel: '← Lente',
        rightLabel: 'Rapide →',
        color: '#8e44ad',
        shortRule: 'Rapide = son vivant = présent',
        why: "Le release contrôle la reprise de gain après la compression. Rapide → le son 'respire' et rebondit → impression de vivacité → plus présent. Lente → le son reste 'collé' sous la compression → moins dynamique → plus en retrait dans le mix.",
      },
    ],
  },
  {
    title: 'Couleur — Saturation',
    icon: '🔥',
    params: [
      {
        key: 'saturation',
        label: 'Saturation',
        leftLabel: '← Clean',
        rightLabel: 'Saturé →',
        color: '#e8940a',
        shortRule: 'Harmoniques = présence = devant',
        why: "La saturation ajoute des harmoniques au signal, ce qui enrichit le son et lui donne du 'grain'. Ces harmoniques supplémentaires rendent l'élément plus audible dans le mix — même à volume identique. Un son trop clean peut sembler distant ou froid. Une saturation douce rapproche.",
      },
    ],
  },
  {
    title: 'Espace — Reverb',
    icon: '🌊',
    params: [
      {
        key: 'reverb',
        label: 'Reverb',
        leftLabel: '← Sec',
        rightLabel: 'Noyé →',
        color: '#2980b9',
        shortRule: 'Plus de reverb = plus loin',
        why: "La reverb simule l'acoustique d'un espace. Psychoacoustiquement, le cerveau associe beaucoup de réverbération à un son distant (comme dans une grande salle). Un son sec (dry) paraît proche. C'est l'outil le plus puissant pour créer de la profondeur.",
      },
      {
        key: 'predelay',
        label: 'Pré-delay',
        leftLabel: '← Court (fond)',
        rightLabel: 'Long (devant) →',
        color: '#17a2b8',
        shortRule: 'Long pré-delay = la source reste devant',
        why: "Le pré-delay est le délai entre le son direct et le début de la reverb. Court → la source se colle à la reverb → son fond de la scène. Long → la source est nettement perçue avant la reverb → l'instrument reste devant même avec beaucoup de reverb. Outil clé pour cumuler présence ET espace.",
      },
    ],
  },
  {
    title: 'Image stéréo',
    icon: '↔',
    params: [
      {
        key: 'stereoWidth',
        label: 'Largeur stéréo',
        leftLabel: '← Mono',
        rightLabel: 'Large →',
        color: '#607d8b',
        shortRule: 'Mono = solide/devant — Large = diffus/derrière',
        why: "Un son mono (centré) paraît plus focalisé et plus proche. Un son très large occupe tout le champ stéréo et semble plus diffus, moins défini — ce qui le pousse perceptuellement vers l'arrière. Les éléments importants (kick, basse, voix) sont souvent en mono ou peu larges pour rester devant.",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export const MixControls: React.FC<Props> = ({ element, onChange }) => {
  const [openWhy, setOpenWhy] = useState<string | null>(null);

  const pos = computePosition(element);
  const depthPercent = Math.round((1 - pos.z) * 100);
  const heightPercent = Math.round((pos.y + 1) / 2 * 100);

  const toggleWhy = (key: string) => {
    setOpenWhy(prev => prev === key ? null : key);
  };

  return (
    <div className="mix-controls">
      {/* En-tête élément */}
      <div className="element-header" style={{ borderColor: element.color }}>
        <span className="element-icon-large">{element.icon}</span>
        <div className="element-info">
          <h2 style={{ color: element.color }}>{element.name}</h2>
          <div className="position-badges">
            <span className="badge" style={{ background: '#0d1628' }}>
              Avant <strong style={{ color: element.color }}>{depthPercent}%</strong>
            </span>
            <span className="badge" style={{ background: '#0d1628' }}>
              Spectre <strong style={{ color: element.color }}>{heightPercent}%</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Sections de paramètres */}
      {SECTIONS.map(section => (
        <div key={section.title} className="param-section">
          <div className="param-section-title">
            <span className="section-icon">{section.icon}</span>
            {section.title}
          </div>

          {section.params.map(p => {
            const value = element[p.key];
            const pct = Math.round(value * 100);
            const isWhyOpen = openWhy === p.key;

            return (
              <div key={p.key} className="param-row">
                {/* Ligne label + valeur + bouton Pourquoi ? */}
                <div className="param-header">
                  <span className="param-label" style={{ color: p.color }}>
                    {p.label}
                  </span>
                  <div className="param-header-right">
                    <span className="param-value" style={{ color: p.color }}>
                      {pct}%
                    </span>
                    <button
                      className={`why-btn ${isWhyOpen ? 'open' : ''}`}
                      onClick={() => toggleWhy(p.key)}
                      title="Comprendre la règle physique"
                    >
                      Pourquoi ?
                    </button>
                  </div>
                </div>

                {/* Effets gauche / droite */}
                <div className="param-effects">
                  <span className="effect-tag left">{p.leftLabel}</span>
                  <span className="effect-tag right">{p.rightLabel}</span>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={p.min ?? 0}
                  max={p.max ?? 1}
                  step={0.01}
                  value={value}
                  onChange={e => onChange(p.key, parseFloat(e.target.value))}
                  className="slider"
                  style={{ '--track-color': p.color } as React.CSSProperties}
                />

                {/* Règle courte */}
                <p className="param-short-rule">{p.shortRule}</p>

                {/* Bloc "Pourquoi ?" dépliable */}
                {isWhyOpen && (
                  <div className="why-block" style={{ borderLeftColor: p.color }}>
                    <span className="why-icon">💡</span>
                    <p>{p.why}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
