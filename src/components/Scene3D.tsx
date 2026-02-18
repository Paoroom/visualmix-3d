import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { MixElement } from '../types';
import { computePosition } from '../mixLogic';

// Dimensions logiques du viewBox (constantes)
const W = 820;
const H = 560;
const ASPECT = W / H;
const SCENE_H = 500;

// Barre de profondeur
const RULER_Y = SCENE_H + 8;
const RULER_H = 32;
const RULER_X = 60;
const RULER_W = W - RULER_X - 70;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

interface DragState {
  id: string;
  startX: number;
  startY: number;
  startPan: number;
  startTreble: number;
  startMid: number;
  startVolume: number;
  startReverb: number;
  mode: 'scene' | 'ruler';
}

interface Props {
  elements: MixElement[];
  selectedId: string;
  onSelect: (id: string) => void;
  fullscreen?: boolean;
  onDragElement?: (id: string, newPan: number, newTreble: number, newMid: number) => void;
  onDragDepth?: (id: string, newVolume: number, newReverb: number) => void;
}

// ── Projection (pure function, outside component) ────────────────────────────
function toScreen(x: number, y: number, z: number) {
  const zoneYFront = SCENE_H * 0.82;
  const zoneYBack  = SCENE_H * 0.28;
  const baseY    = zoneYFront + (zoneYBack - zoneYFront) * z;
  const freqAmp  = SCENE_H * 0.34 * (1 - z * 0.45);
  const screenY  = baseY - y * freqAmp;
  const xAmp     = W * 0.46 * (1 - z * 0.42);
  const screenX  = W / 2 + x * xAmp;
  return { sx: screenX, sy: screenY };
}

// ── Calcul de position complète d'un élément (pour le rendu SVG impératif) ──
function computeScreenPos(el: MixElement) {
  const pos = computePosition(el);
  const { sx, sy } = toScreen(pos.x, pos.y, pos.z);
  const r = Math.max(48 * pos.size, 24);
  const floor = toScreen(pos.x, -1.4, pos.z);
  const dotX = RULER_X + (pos.z * 0.92 + 0.04) * RULER_W;
  return { pos, sx, sy, r, floor, dotX };
}

export const Scene3D: React.FC<Props> = ({
  elements, selectedId, onSelect, onDragElement, onDragDepth,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgSize, setSvgSize] = useState<{ w: number; h: number } | null>(null);

  // dragRef contient l'état du drag courant — NE déclenche PAS de re-render
  const dragRef = useRef<DragState | null>(null);
  // isDragging est un state minimal juste pour changer le curseur
  const [isDraggingCursor, setIsDraggingCursor] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const availW = entry.contentRect.width;
        const availH = entry.contentRect.height;
        const byWidth  = { w: availW,         h: availW / ASPECT };
        const byHeight = { w: availH * ASPECT, h: availH };
        const size = byWidth.h <= availH ? byWidth : byHeight;
        setSvgSize({ w: Math.floor(size.w), h: Math.floor(size.h) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Handlers de drag — sur window pour ne pas perdre le drag ────────────
  const svgSizeRef = useRef(svgSize);
  useEffect(() => { svgSizeRef.current = svgSize; }, [svgSize]);

  const onMouseMoveFn = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    // drag.startX/Y sont déjà en coordonnées viewBox (convertis dans startDrag)
    // On convertit uniquement le point COURANT en viewBox
    const svgEl = svgRef.current;
    let dxL = 0, dyL = 0;
    if (svgEl) {
      const ctm = svgEl.getScreenCTM();
      if (ctm) {
        const inv = ctm.inverse();
        const curPt = new DOMPoint(e.clientX, e.clientY).matrixTransform(inv);
        // startX/Y sont déjà en viewBox → delta direct sans double-transformation
        dxL = curPt.x - drag.startX;
        dyL = curPt.y - drag.startY;
      }
    }

    // Trouver l'élément en cours de drag dans la liste
    // On recalcule à partir des valeurs de départ stockées dans dragRef
    const fakeEl: Partial<MixElement> = { id: drag.id };

    if (drag.mode === 'scene' && onDragElement) {
      const xAmp = W * 0.46 * (1 - 0.5 * 0.42);
      const fAmp = SCENE_H * 0.34 * (1 - 0.5 * 0.45);
      const newPan    = clamp(drag.startPan + dxL / xAmp, -1, 1);
      const yDelta    = -dyL / fAmp;
      const newTreble = clamp(drag.startTreble + yDelta * 0.70, 0, 1);
      const newMid    = clamp(drag.startMid    + yDelta * 0.30, 0, 1);
      fakeEl.pan = newPan; fakeEl.eqTreble = newTreble; fakeEl.eqMid = newMid;
      // Mettre à jour le SVG impérativement (sans re-render React)
      // On reconstruit un élément temporaire pour computeScreenPos
      onDragElement(drag.id, newPan, newTreble, newMid);

    } else if (drag.mode === 'ruler' && onDragDepth) {
      // dxL > 0 = vers droite = vers ARRIÈRE (z↑ = reverb↑ + volume↓)
      const depthDelta = dxL / RULER_W;
      const newVolume = clamp(drag.startVolume - depthDelta * 0.60, 0, 1);
      const newReverb = clamp(drag.startReverb + depthDelta * 0.40, 0, 1);
      fakeEl.volume = newVolume; fakeEl.reverb = newReverb;
      onDragDepth(drag.id, newVolume, newReverb);
    }
  }, [onDragElement, onDragDepth]);

  const onMouseUpFn = useCallback(() => {
    dragRef.current = null;
    setIsDraggingCursor(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMoveFn);
    window.addEventListener('mouseup', onMouseUpFn);
    return () => {
      window.removeEventListener('mousemove', onMouseMoveFn);
      window.removeEventListener('mouseup', onMouseUpFn);
    };
  }, [onMouseMoveFn, onMouseUpFn]);

  const startDrag = useCallback((el: MixElement, e: React.MouseEvent, mode: 'scene' | 'ruler') => {
    e.stopPropagation();
    onSelect(el.id);
    // Convertir le point de départ en coordonnées viewBox UNE SEULE FOIS ici
    let startX = e.clientX, startY = e.clientY;
    const svgEl = svgRef.current;
    if (svgEl) {
      const ctm = svgEl.getScreenCTM();
      if (ctm) {
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
        startX = pt.x;
        startY = pt.y;
      }
    }
    dragRef.current = {
      id: el.id,
      startX,  // en coordonnées viewBox
      startY,  // en coordonnées viewBox
      startPan: el.pan,
      startTreble: el.eqTreble,
      startMid: el.eqMid,
      startVolume: el.volume,
      startReverb: el.reverb,
      mode,
    };
    setIsDraggingCursor(true);
  }, [onSelect]);

  // ── Grille statique ──────────────────────────────────────────────────────
  const floorY = -1.4;
  const floorLines = Array.from({ length: 6 }, (_, i) => {
    const z = i / 5;
    const l = toScreen(-1.18, floorY, z);
    const r = toScreen(1.18, floorY, z);
    return (
      <line key={`fl${i}`}
        x1={l.sx} y1={l.sy} x2={r.sx} y2={r.sy}
        stroke={i === 0 ? '#3a55aa' : '#111c30'}
        strokeWidth={i === 0 ? 1.5 : 0.7}
      />
    );
  });

  const lateralLines = [-2, -1, 0, 1, 2].map(xi => {
    const xv = xi * 0.59;
    const front = toScreen(xv, floorY, 0);
    const back  = toScreen(xv, floorY, 1);
    return (
      <line key={`ll${xi}`}
        x1={front.sx} y1={front.sy} x2={back.sx} y2={back.sy}
        stroke={xi === 0 ? '#1e3060' : '#0c1525'}
        strokeWidth={xi === 0 ? 1 : 0.6}
      />
    );
  });

  const freqGrid = Array.from({ length: 5 }, (_, yi) => {
    const y = -1 + yi * 0.5;
    return [0, 0.33, 0.67, 1].map(z => {
      const l = toScreen(-1.1, y, z);
      const r = toScreen(1.1, y, z);
      return (
        <line key={`fg${yi}-${z}`}
          x1={l.sx} y1={l.sy} x2={r.sx} y2={r.sy}
          stroke="#09121e" strokeWidth="0.5" strokeDasharray="4,12"
        />
      );
    });
  });

  const frontL = toScreen(-1.18, floorY, 0);
  const frontR = toScreen(1.18, floorY, 0);
  const backL  = toScreen(-1.18, floorY, 1);
  const backR  = toScreen(1.18, floorY, 1);

  // Trier arrière → avant
  const sorted = [...elements].sort((a, b) => computePosition(b).z - computePosition(a).z);

  return (
    <div className="scene-container" ref={containerRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="scene-svg"
        preserveAspectRatio="xMidYMid meet"
        width={svgSize?.w ?? W}
        height={svgSize?.h ?? H}
        style={{ cursor: isDraggingCursor ? 'grabbing' : 'default', userSelect: 'none' }}
      >
        <defs>
          <radialGradient id="bg-grad" cx="50%" cy="25%" r="75%">
            <stop offset="0%" stopColor="#0f1c36" />
            <stop offset="100%" stopColor="#050911" />
          </radialGradient>
          <radialGradient id="glow-front" cx="50%" cy="82%" r="48%">
            <stop offset="0%" stopColor="#1a3570" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#050911" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ruler-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5b8dee" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#5b8dee" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        <rect width={W} height={SCENE_H} fill="url(#bg-grad)" rx="12" />
        <rect width={W} height={SCENE_H} fill="url(#glow-front)" rx="12" />

        {freqGrid}
        {lateralLines}
        {floorLines}

        <polygon
          points={`${frontL.sx},${frontL.sy} ${frontR.sx},${frontR.sy} ${backR.sx},${backR.sy} ${backL.sx},${backL.sy}`}
          fill="none" stroke="#253a6a" strokeWidth="1"
        />

        <text x={frontL.sx - 4} y={frontL.sy + 3}
          fill="#4060c0" fontSize="9" textAnchor="end" fontWeight="700">AVANT</text>
        <text x={(backL.sx + backR.sx) / 2} y={backL.sy - 6}
          fill="#1a2a50" fontSize="9" textAnchor="middle">ARRIÈRE</text>

        <text x={W / 2} y={10}
          fill="#3a4a6a" fontSize="8" textAnchor="middle" fontWeight="600" letterSpacing="1">↑ AIGUS</text>
        <text x={W / 2} y={SCENE_H - 8}
          fill="#3a4a6a" fontSize="8" textAnchor="middle" fontWeight="600" letterSpacing="1">GRAVES ↓</text>
        <text x={8} y={SCENE_H * 0.42}
          fill="#3a4a6a" fontSize="8" textAnchor="middle" fontWeight="600"
          transform={`rotate(-90, 8, ${SCENE_H * 0.42})`}>◀ G</text>
        <text x={W - 8} y={SCENE_H * 0.42}
          fill="#3a4a6a" fontSize="8" textAnchor="middle" fontWeight="600"
          transform={`rotate(90, ${W - 8}, ${SCENE_H * 0.42})`}>D ▶</text>

        {/* ═══ ÉLÉMENTS DE MIX ═══ */}
        {sorted.map(el => {
          const { pos, sx, sy, r, floor } = computeScreenPos(el);
          const isSelected = el.id === selectedId;

          return (
            <g
              key={el.id}
              data-el={el.id}
              style={{ cursor: 'grab' }}
              onMouseDown={e => startDrag(el, e, 'scene')}
            >
              <ellipse className="el-shadow"
                cx={floor.sx} cy={floor.sy}
                rx={r * 0.62 * (1 - pos.z * 0.3)}
                ry={r * 0.15 * (1 - pos.z * 0.3)}
                fill="rgba(0,0,0,0.28)"
              />
              <line className="el-line"
                x1={floor.sx} y1={floor.sy}
                x2={sx} y2={sy + r * 0.82}
                stroke={el.color}
                strokeWidth={isSelected ? 1.5 : 0.8}
                strokeDasharray="3,4"
                opacity={pos.opacity * 0.40}
              />
              {isSelected && (
                <>
                  <circle className="el-halo1" cx={sx} cy={sy} r={r + 10}
                    fill="none" stroke="white" strokeWidth="1.5"
                    strokeDasharray="5,4" opacity={0.60} />
                  <circle className="el-halo2" cx={sx} cy={sy} r={r + 17}
                    fill="none" stroke={el.color} strokeWidth="0.8"
                    strokeDasharray="3,9" opacity={0.28} />
                </>
              )}
              <circle className="el-glow" cx={sx} cy={sy} r={r * 1.55}
                fill={el.color} opacity={pos.opacity * 0.11} />
              {!isSelected && (
                <circle className="el-ring" cx={sx} cy={sy} r={r + 3}
                  fill="none" stroke={el.color} strokeWidth="0.8"
                  opacity={pos.opacity * 0.35} />
              )}
              <circle className="el-circle"
                cx={sx} cy={sy} r={r}
                fill={el.color}
                opacity={pos.opacity}
                stroke={isSelected ? 'rgba(255,255,255,0.85)' : `${el.color}99`}
                strokeWidth={isSelected ? 2.5 : 1.8}
                style={pos.blur > 0.3 ? { filter: `blur(${pos.blur}px)` } : undefined}
              />
              <text className="el-icon"
                x={sx} y={sy}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.max(r * 0.86, 11)}
                opacity={Math.max(pos.opacity + 0.1, 0.55)}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >{el.icon}</text>
              <text className="el-name"
                x={sx} y={sy + r + 14}
                textAnchor="middle" fill="white"
                fontSize={isSelected ? 11 : 10}
                fontWeight={isSelected ? '700' : '400'}
                opacity={Math.max(pos.opacity * 0.85, 0.55)}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >{el.name}</text>
              <text className="el-badge"
                x={sx + r * 0.52} y={sy - r * 0.58}
                fill="white" fontSize="8" fontWeight="600"
                opacity={Math.max(pos.opacity * 0.7, 0.28)}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >{Math.round((1 - pos.z) * 100)}%</text>
            </g>
          );
        })}

        {/* ═══ BARRE DE PROFONDEUR ═══ */}
        <line x1={0} y1={SCENE_H + 2} x2={W} y2={SCENE_H + 2}
          stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <text x={RULER_X - 4} y={RULER_Y + RULER_H / 2}
          fill="#5b8dee" fontSize="8" textAnchor="end" dominantBaseline="middle"
          fontWeight="600" letterSpacing="0.5">◀ AVANT</text>
        <text x={RULER_X + RULER_W + 4} y={RULER_Y + RULER_H / 2}
          fill="#2a3a5a" fontSize="8" textAnchor="start" dominantBaseline="middle"
          fontWeight="600" letterSpacing="0.5">ARRIÈRE ▶</text>
        <rect
          x={RULER_X} y={RULER_Y}
          width={RULER_W} height={RULER_H}
          rx="6" ry="6"
          fill="url(#ruler-grad)"
          stroke="rgba(255,255,255,0.06)" strokeWidth="1"
        />
        <text x={RULER_X + RULER_W / 2} y={RULER_Y + RULER_H + 10}
          fill="#1a2a40" fontSize="7" textAnchor="middle">
          ← glisser les icônes pour régler la profondeur →
        </text>

        {sorted.map(el => {
          const { pos, dotX } = computeScreenPos(el);
          const dotY = RULER_Y + RULER_H / 2;
          const isSelected = el.id === selectedId;

          return (
            <g
              key={`dot-${el.id}`}
              data-dot={el.id}
              style={{ cursor: 'ew-resize' }}
              onMouseDown={e => startDrag(el, e, 'ruler')}
            >
              {isSelected && (
                <circle className="dot-halo" cx={dotX} cy={dotY} r={13}
                  fill="none" stroke="white" strokeWidth="1.2"
                  opacity={0.5} strokeDasharray="3,3" />
              )}
              <text className="dot-text"
                x={dotX} y={dotY}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={isSelected ? 16 : 11}
                opacity={Math.max(pos.opacity, 0.45)}
                style={{
                  userSelect: 'none',
                  filter: isSelected ? 'drop-shadow(0 0 5px white)' : undefined,
                }}
              >{el.icon}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
