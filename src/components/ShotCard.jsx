import { useRef, useState, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../store/useStore'
import ColorPicker from './ColorPicker'
import SpecsTable from './SpecsTable'

function autoResizeTextarea(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}


export default function ShotCard({ shot, isDragOverlay = false }) {
  const { id, shotLabel, color, cameraName, focalLength, image, imageType, specs, notes } = shot
  const settings = useStore(s => s.settings)
  const updateShotField = useStore(s => s.updateShotField)
  const updateShotImage = useStore(s => s.updateShotImage)
  const deleteShot = useStore(s => s.deleteShot)
  const duplicateShot = useStore(s => s.duplicateShot)

  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)
  const fileInputRef = useRef(null)
  const notesRef = useRef(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isDragOverlay })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      updateShotImage(id, ev.target.result.split(',')[1], file.type)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [id, updateShotImage])

  const handleContextMenu = (e) => {
    e.preventDefault()
    setContextPos({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }

  const handleNotesChange = (e) => {
    updateShotField(id, 'notes', e.target.value)
    autoResizeTextarea(e.target)
  }

  const imageSrc = image ? `data:${imageType};base64,${image}` : null

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderTopColor: color, borderTopWidth: 3 }}
      className="relative bg-white dark:bg-gray-800 rounded-sm border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowContextMenu(false) }}
      onContextMenu={handleContextMenu}
    >
      {/* Drag handle + Card Header */}
      <div
        className="flex items-center gap-1.5 px-1.5 py-1 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <ColorPicker
          color={color}
          onChange={(c) => updateShotField(id, 'color', c)}
        />
        <span className="flex-1 text-[11px] font-semibold truncate dark:text-gray-100">
          {shotLabel} — {cameraName}
        </span>
        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
          {focalLength}
        </span>
      </div>

      {/* Image Area */}
      <div
        className="relative w-full cursor-pointer group"
        style={{ aspectRatio: '16/9', borderTop: `2px solid ${color}`, borderBottom: `2px solid ${color}` }}
        onClick={handleImageClick}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={shotLabel}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <span className="text-3xl text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors">+</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleImageChange}
        />
      </div>

      {/* Specs Table */}
      <div className="px-0">
        <SpecsTable shotId={id} specs={specs} dropdownMode={settings.dropdownMode} />
      </div>

      {/* Notes */}
      <div className="px-1.5 py-1 flex-1">
        <textarea
          ref={notesRef}
          className="w-full text-[10px] bg-transparent dark:text-gray-200 border-0 outline-none leading-relaxed placeholder-gray-400 dark:placeholder-gray-600 min-h-[32px]"
          placeholder="Notes... (ACTION: BGD: EST: SHOOT ORDER:)"
          value={notes || ''}
          onChange={handleNotesChange}
          onFocus={(e) => autoResizeTextarea(e.target)}
          rows={2}
        />
      </div>

      {/* Delete button on hover */}
      {hovered && !isDragOverlay && (
        <button
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 z-10"
          onClick={(e) => { e.stopPropagation(); deleteShot(id) }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Delete shot"
        >
          ×
        </button>
      )}

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ top: contextPos.y, left: contextPos.x }}
          onMouseLeave={() => setShowContextMenu(false)}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200"
            onClick={() => { duplicateShot(id); setShowContextMenu(false) }}
          >
            Duplicate Shot
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
            onClick={() => { deleteShot(id); setShowContextMenu(false) }}
          >
            Delete Shot
          </button>
        </div>
      )}
    </div>
  )
}
