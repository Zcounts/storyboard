import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { useState } from 'react'
import useStore from '../store/useStore'
import ShotCard from './ShotCard'
import PageHeader from './PageHeader'

const SHOTS_PER_PAGE_BY_COLS = {
  2: 4,
  3: 6,
  4: 8,
}

export default function ShotGrid() {
  const shots = useStore(s => s.shots)
  const settings = useStore(s => s.settings)
  const addShot = useStore(s => s.addShot)
  const reorderShots = useStore(s => s.reorderShots)

  const [activeId, setActiveId] = useState(null)

  const cols = settings.columnCount || 4
  const shotsPerPage = SHOTS_PER_PAGE_BY_COLS[cols] || 8

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderShots(active.id, over.id)
    }
    setActiveId(null)
  }

  const activeShot = activeId ? shots.find(s => s.id === activeId) : null

  // Paginate
  const pages = []
  for (let i = 0; i < Math.max(1, Math.ceil(shots.length / shotsPerPage)); i++) {
    pages.push(shots.slice(i * shotsPerPage, (i + 1) * shotsPerPage))
  }

  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[cols] || 'grid-cols-4'

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={shots.map(s => s.id)} strategy={rectSortingStrategy}>
        <div className="flex flex-col gap-8 pb-8">
          {pages.map((pageShots, pageIdx) => (
            <div
              key={pageIdx}
              className="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 p-4 rounded-sm"
              style={{ maxWidth: 1200 }}
            >
              <PageHeader pageNum={pageIdx + 1} totalPages={pages.length} />

              <div className={`grid ${gridCols} gap-2`}>
                {pageShots.map(shot => (
                  <ShotCard key={shot.id} shot={shot} />
                ))}

                {/* Add Shot button in last page */}
                {pageIdx === pages.length - 1 && (
                  <button
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-sm flex items-center justify-center hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group min-h-[120px]"
                    onClick={addShot}
                  >
                    <div className="flex flex-col items-center text-gray-400 dark:text-gray-500 group-hover:text-blue-500">
                      <span className="text-2xl leading-none">+</span>
                      <span className="text-[10px] font-semibold mt-1">ADD SHOT</span>
                    </div>
                  </button>
                )}
              </div>

              {/* Page number */}
              <div className="text-center text-[10px] text-gray-400 dark:text-gray-500 mt-3 font-medium">
                — {pageIdx + 1} —
              </div>
            </div>
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeShot && (
          <div className="rotate-2 scale-105 shadow-2xl">
            <ShotCard shot={activeShot} isDragOverlay />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
