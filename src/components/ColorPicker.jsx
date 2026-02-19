import { useState, useRef, useEffect } from 'react'

const PRESET_COLORS = [
  '#22c55e', // green
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#ef4444', // red
  '#f97316', // orange
  '#a855f7', // purple
  '#ec4899', // pink
  '#3b82f6', // blue
  '#ffffff', // white
  '#6b7280', // gray
]

export default function ColorPicker({ color, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        className="w-4 h-4 rounded-sm border border-black/20 flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
        style={{ backgroundColor: color }}
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        title="Pick color"
      />
      {open && (
        <div className="absolute top-5 left-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl p-2 grid grid-cols-5 gap-1 w-28">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              className="w-5 h-5 rounded-sm border border-black/20 hover:scale-110 transition-transform cursor-pointer"
              style={{ backgroundColor: c }}
              onClick={(e) => { e.stopPropagation(); onChange(c); setOpen(false) }}
            />
          ))}
          <input
            type="color"
            className="w-5 h-5 rounded-sm cursor-pointer border-0 p-0"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            title="Custom color"
          />
        </div>
      )}
    </div>
  )
}
