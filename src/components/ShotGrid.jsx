import React, { useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import useStore from '../store'
import ShotCard from './ShotCard'
import { useState } from 'react'

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

export default function ShotGrid() {
  const shots = useStore(s => s.shots)
  const getShotsWithIds = useStore(s => s.getShotsWithIds)
  const addShot = useStore(s => s.addShot)
  const reorderShots = useStore(s => s.reorderShots)
  const columnCount = useStore(s => s.columnCount)
  const useDropdowns = useStore(s => s.useDropdowns)
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const shotsWithIds = getShotsWithIds()
  const activeShot = activeId ? shotsWithIds.find(s => s.id === activeId) : null

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    reorderShots(active.id, over.id)
  }, [reorderShots])

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
    gap: '1px',
    backgroundColor: '#e5e0d8',
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={shots.map(s => s.id)} strategy={rectSortingStrategy}>
        <div style={gridStyle}>
          {shotsWithIds.map(shot => (
            <ShotCard
              key={shot.id}
              shot={shot}
              displayId={shot.displayId}
              useDropdowns={useDropdowns}
            />
          ))}
          <AddShotButton onClick={addShot} />
        </div>
      </SortableContext>

      <DragOverlay>
        {activeShot ? (
          <div className="drag-overlay">
            <ShotCard
              shot={activeShot}
              displayId={activeShot.displayId}
              useDropdowns={useDropdowns}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
