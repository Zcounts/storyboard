import React, { useRef, useEffect } from 'react'
import useStore from '../store'

const COLORS = [
  { label: 'Green', value: '#4ade80' },
  { label: 'Cyan', value: '#22d3ee' },
  { label: 'Yellow', value: '#facc15' },
  { label: 'Red', value: '#f87171' },
  { label: 'Blue', value: '#60a5fa' },
  { label: 'Orange', value: '#fb923c' },
  { label: 'Purple', value: '#c084fc' },
  { label: 'Pink', value: '#f472b6' },
  { label: 'White', value: '#ffffff' },
  { label: 'Gray', value: '#9ca3af' },
]

export default function ColorPicker({ shotId, currentColor, onClose }) {
  const updateShotColor = useStore(s => s.updateShotColor)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-2"
      style={{ top: '100%', left: 0, minWidth: 120 }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="grid grid-cols-5 gap-1">
        {COLORS.map(c => (
          <button
            key={c.value}
            title={c.label}
            onClick={() => {
              updateShotColor(shotId, c.value)
              onClose()
            }}
            className="w-5 h-5 rounded cursor-pointer hover:scale-110 transition-transform border"
            style={{
              backgroundColor: c.value,
              borderColor: currentColor === c.value ? '#1a1a1a' : 'rgba(0,0,0,0.15)',
              borderWidth: currentColor === c.value ? 2 : 1,
            }}
          />
        ))}
      </div>
    </div>
  )
}
