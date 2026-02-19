import React, { useState, useRef, useEffect, useCallback } from 'react'
import useStore from '../store'

const BOLD_PREFIXES = ['ACTION:', 'BGD:', 'EST:', 'SHOOT ORDER:']

function formatNotesLine(line) {
  for (const prefix of BOLD_PREFIXES) {
    if (line.startsWith(prefix)) {
      return (
        <>
          <strong>{prefix}</strong>
          {line.slice(prefix.length)}
        </>
      )
    }
  }
  return line
}

function FormattedNotes({ text }) {
  if (!text) return <span className="text-gray-400 italic text-xs">Notes...</span>
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => (
        <div key={i} style={{ minHeight: '1em' }}>
          {formatNotesLine(line)}
          {i < lines.length - 1 && null}
        </div>
      ))}
    </>
  )
}

export default function NotesArea({ shotId, value }) {
  const updateShotNotes = useStore(s => s.updateShotNotes)
  const [editing, setEditing] = useState(false)
  const textareaRef = useRef(null)

  const handleFocus = () => setEditing(true)
  const handleBlur = () => setEditing(false)

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      // Move cursor to end
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
      autoResize(textareaRef.current)
    }
  }, [editing])

  const autoResize = (el) => {
    el.style.height = 'auto'
    el.style.height = Math.max(40, el.scrollHeight) + 'px'
  }

  const handleChange = useCallback((e) => {
    updateShotNotes(shotId, e.target.value)
    autoResize(e.target)
  }, [shotId, updateShotNotes])

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        className="notes-area"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={e => { if (e.key === 'Escape') e.target.blur() }}
        placeholder="ACTION: ...&#10;BGD: ...&#10;EST: ...&#10;SHOOT ORDER: ..."
        rows={2}
        style={{ minHeight: 40, height: 'auto' }}
      />
    )
  }

  return (
    <div
      className="notes-display cursor-text"
      onClick={handleFocus}
      style={{ minHeight: 40 }}
    >
      <FormattedNotes text={value} />
    </div>
  )
}
