import React from 'react'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import ShotCard from './ShotCard'

function AddShotButton({ onClick }) {
  return (
    <button className="add-shot-btn" onClick={onClick} title="Add new shot">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="10" cy="10" r="8" />
        <line x1="10" y1="6" x2="10" y2="14" />
        <line x1="6" y1="10" x2="14" y2="10" />
      </svg>
      <span>Add Shot</span>
    </button>
  )
}

/**
 * ShotGrid — renders a grid of sortable shot cards for one page of a scene.
 *
 * Props:
 *  sceneId       – the scene this grid belongs to
 *  shots         – array of shots WITH displayId already attached
 *  allShotIds    – full ordered list of shot ids for the scene (for SortableContext)
 *  columnCount   – number of grid columns
 *  useDropdowns  – spec table input mode
 *  showAddBtn    – show the "Add Shot" button (only on last page)
 *  onAddShot     – callback when Add Shot is clicked
 */
export default function ShotGrid({
  sceneId,
  shots,
  allShotIds,
  columnCount,
  useDropdowns,
  showAddBtn = false,
  onAddShot,
}) {
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
    gap: '1px',
    backgroundColor: '#e5e0d8',
  }

  return (
    <SortableContext items={allShotIds} strategy={rectSortingStrategy}>
      <div style={gridStyle}>
        {shots.map(shot => (
          <ShotCard
            key={shot.id}
            shot={shot}
            displayId={shot.displayId}
            useDropdowns={useDropdowns}
            sceneId={sceneId}
          />
        ))}
        {showAddBtn && <AddShotButton onClick={onAddShot} />}
      </div>
    </SortableContext>
  )
}
