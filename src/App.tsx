import React, { useState, useCallback, useEffect } from 'react';
import { Scene3D } from './components/Scene3D';
import { MixControls } from './components/MixControls';
import { ElementList } from './components/ElementList';
import { DEFAULT_ELEMENTS } from './defaultElements';
import type { MixElement, MixParam } from './types';
import './App.css';

export default function App() {
  const [elements, setElements] = useState(DEFAULT_ELEMENTS);
  const [selectedId, setSelectedId] = useState<string>('vocals');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const selectedElement = elements.find(el => el.id === selectedId)!;

  // Sync état fullscreen avec l'API navigateur
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleChange = useCallback((param: MixParam | 'pan', value: number) => {
    setElements(prev =>
      prev.map(el =>
        el.id === selectedId ? { ...el, [param]: value } : el
      )
    );
  }, [selectedId]);

  const handleReset = () => setElements(DEFAULT_ELEMENTS);

  // ── Dupliquer un élément ──────────────────────────────────────────────────
  const handleDuplicate = useCallback((baseEl: MixElement) => {
    // Calculer l'id directement avec la liste actuelle (closure)
    let counter = 2;
    let newId = `${baseEl.id}-${counter}`;
    while (elements.some(e => e.id === newId)) { counter++; newId = `${baseEl.id}-${counter}`; }
    const newEl: MixElement = {
      ...baseEl,
      id: newId,
      name: `${baseEl.name} ${counter}`,
      pan: Math.max(-1, Math.min(1, baseEl.pan + 0.12)),
    };
    setElements(prev => [...prev, newEl]);
    setSelectedId(newId);
  }, [elements]);

  // ── Supprimer un élément ──────────────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    setElements(prev => {
      if (prev.length <= 1) return prev;
      const remaining = prev.filter(el => el.id !== id);
      if (selectedId === id) {
        setSelectedId(remaining[0].id);
      }
      return remaining;
    });
  }, [selectedId]);

  // ── Drag scène (pan + spectre) ────────────────────────────────────────────
  const handleDragElement = useCallback(
    (id: string, newPan: number, newTreble: number, newMid: number) => {
      setElements(prev =>
        prev.map(el =>
          el.id === id
            ? { ...el, pan: newPan, eqTreble: newTreble, eqMid: newMid }
            : el
        )
      );
    },
    []
  );

  // ── Drag barre profondeur (volume + reverb) ───────────────────────────────
  const handleDragDepth = useCallback(
    (id: string, newVolume: number, newReverb: number) => {
      setElements(prev =>
        prev.map(el =>
          el.id === id
            ? { ...el, volume: newVolume, reverb: newReverb }
            : el
        )
      );
    },
    []
  );

  return (
    <div className={`app${isFullscreen ? ' fullscreen' : ''}`}>
      <header className="app-header">
        <div className="header-content">
          <h1>VisualMix 3D <span className="header-brand">by MAO MAKER™</span></h1>
          <p className="header-sub">Visualisez l'impact de vos paramètres dans l'espace sonore</p>
        </div>
        <div className="header-actions">
          <button className="fullscreen-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
            {isFullscreen ? '✕ Quitter' : '⛶ Plein écran'}
          </button>
          <button className="reset-btn" onClick={handleReset}>↺ Réinitialiser</button>
        </div>
      </header>

      <div className="app-layout">
        {/* Colonne gauche : liste des éléments */}
        <aside className="sidebar-left">
          <ElementList
            elements={elements}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
          <div className="legend">
            <h4>Légende</h4>
            <div className="legend-item">
              <div className="legend-circle large" />
              <span>Grand + net = Avant</span>
            </div>
            <div className="legend-item">
              <div className="legend-circle small" />
              <span>Petit + flou = Arrière</span>
            </div>
            <div className="legend-item">
              <span className="legend-axis">↕</span>
              <span>Hauteur = Spectre fréq.</span>
            </div>
            <div className="legend-item">
              <span className="legend-axis">↔</span>
              <span>Largeur = Panoramique</span>
            </div>
          </div>
        </aside>

        {/* Centre : scène 3D */}
        <main className="scene-main">
          <Scene3D
            elements={elements}
            selectedId={selectedId}
            onSelect={setSelectedId}
            fullscreen={isFullscreen}
            onDragElement={handleDragElement}
            onDragDepth={handleDragDepth}
          />
        </main>

        {/* Colonne droite : panoramique + curseurs de mix */}
        <aside className="sidebar-right">
          {/* Panoramique */}
          <div className="pan-block" style={{ borderColor: selectedElement.color }}>
            <div className="pan-header">
              <span style={{ color: selectedElement.color }}>
                {selectedElement.icon} {selectedElement.name}
              </span>
              <span className="pan-header-label">↔ Panoramique</span>
            </div>
            <div className="pan-slider-row">
              <span className="pan-label">◀ L</span>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={selectedElement.pan}
                onChange={e => handleChange('pan', parseFloat(e.target.value))}
                className="slider pan-slider"
                style={{ '--track-color': selectedElement.color } as React.CSSProperties}
              />
              <span className="pan-label">R ▶</span>
              <span className="pan-value" style={{ color: selectedElement.color }}>
                {selectedElement.pan >= 0 ? '+' : ''}{Math.round(selectedElement.pan * 100)}
              </span>
            </div>
          </div>

          <MixControls
            element={selectedElement}
            onChange={handleChange}
          />
        </aside>
      </div>
    </div>
  );
}
