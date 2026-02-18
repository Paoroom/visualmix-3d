import React from 'react';
import type { MixElement } from '../types';
import { computePosition } from '../mixLogic';

interface Props {
  elements: MixElement[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDuplicate: (el: MixElement) => void;
  onDelete: (id: string) => void;
}

export const ElementList: React.FC<Props> = ({
  elements, selectedId, onSelect, onDuplicate, onDelete,
}) => {
  return (
    <div className="element-list">
      <h3 className="list-title">Éléments du mix</h3>
      {elements.map(el => {
        const { z, opacity } = computePosition(el);
        const depthPct = Math.round((1 - z) * 100);
        const isSelected = el.id === selectedId;

        return (
          <button
            key={el.id}
            className={`element-btn ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(el.id)}
            style={{
              borderColor: isSelected ? el.color : 'transparent',
              background: isSelected ? `${el.color}22` : 'rgba(255,255,255,0.04)',
            }}
          >
            <span className="el-icon">{el.icon}</span>
            <div className="el-info">
              <span className="el-name" style={{ color: isSelected ? el.color : 'white' }}>
                {el.name}
              </span>
              {/* Barre de profondeur miniature */}
              <div className="el-depth-bar">
                <div
                  className="el-depth-fill"
                  style={{
                    width: `${depthPct}%`,
                    backgroundColor: el.color,
                    opacity,
                  }}
                />
              </div>
            </div>
            <span className="el-depth-label" style={{ color: el.color }}>
              {depthPct}%
            </span>
            {/* Bouton dupliquer */}
            <button
              className="el-action-btn el-dup-btn"
              onClick={e => { e.stopPropagation(); onDuplicate(el); }}
              title="Dupliquer"
            >⊕</button>
            {/* Bouton supprimer */}
            <button
              className="el-action-btn el-del-btn"
              onClick={e => { e.stopPropagation(); onDelete(el.id); }}
              title="Supprimer"
              disabled={elements.length <= 1}
            >✕</button>
          </button>
        );
      })}
    </div>
  );
};
