import React, { useState, useCallback, useRef, useEffect } from 'react'
import useStore from '../store'

// ── Dropdown options (matching SpecsTable.jsx) ───────────────────────────────
const SIZE_OPTIONS = ['WIDE SHOT', 'MEDIUM', 'CLOSE UP', 'OTS', 'ECU', 'INSERT', 'ESTABLISHING']
const TYPE_OPTIONS = ['EYE LVL', 'SHOULDER LVL', 'CROWD LVL', 'HIGH ANGLE', 'LOW ANGLE', 'DUTCH']
const MOVE_OPTIONS = ['STATIC', 'PUSH', 'PULL', 'PAN', 'TILT', 'STATIC or PUSH', 'TRACKING', 'CRANE']
const EQUIP_OPTIONS = ['STICKS', 'GIMBAL', 'HANDHELD', 'STICKS or GIMBAL', 'CRANE', 'DOLLY', 'STEADICAM']
const INT_EXT_OPTIONS = ['INT', 'EXT', 'INT/EXT']

// ── Column definitions ───────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'checked',        label: 'X',                  width: 36,  type: 'checkbox' },
  { key: 'displayId',      label: 'SHOT#',              width: 54,  type: 'readonly' },
  { key: '__intExt__',     label: 'I/E D/N',            width: 76,  type: 'intExt' },
  { key: 'subject',        label: 'SUBJECT',            width: 130, type: 'text' },
  { key: 'specs.type',     label: 'ANGLE',              width: 96,  type: 'dropdown', options: TYPE_OPTIONS },
  { key: 'focalLength',    label: 'LENS',               width: 64,  type: 'text' },
  { key: 'specs.equip',    label: 'EQUIPMENT',          width: 100, type: 'dropdown', options: EQUIP_OPTIONS },
  { key: 'specs.move',     label: 'MOVEMENT',           width: 96,  type: 'dropdown', options: MOVE_OPTIONS },
  { key: 'specs.size',     label: 'COVERAGE',           width: 110, type: 'dropdown', options: SIZE_OPTIONS },
  { key: 'notes',          label: 'NOTES',              width: 160, type: 'text' },
  { key: 'scriptTime',     label: 'SCRIPT TIME',        width: 84,  type: 'text' },
  { key: 'setupTime',      label: 'SETUP TIME',         width: 84,  type: 'text' },
  { key: 'predictedTakes', label: 'PREDIC# OF TAKES',  width: 104, type: 'text' },
  { key: 'shootTime',      label: 'SHOOT TIME',         width: 84,  type: 'text' },
  { key: 'takeNumber',     label: 'TAKE #',             width: 60,  type: 'text' },
]

const TOTAL_WIDTH = COLUMNS.reduce((sum, col) => sum + col.width, 0)
const ROW_H = 28

// ── Time utilities ────────────────────────────────────────────────────────────
function parseTimeStr(str) {
  if (!str || !str.trim()) return null
  const parts = str.trim().split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

function formatSeconds(totalSecs) {
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function sumScriptTimes(shots) {
  let total = 0
  let anyParsed = false
  for (const shot of shots) {
    const secs = parseTimeStr(shot.scriptTime)
    if (secs !== null) { total += secs; anyParsed = true }
  }
  return anyParsed ? formatSeconds(total) : null
}

// ── EditableCell ──────────────────────────────────────────────────────────────
function EditableCell({ value, onChange, type, options, isChecked, isDark }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef(null)

  useEffect(() => { if (!editing) setDraft(value ?? '') }, [value, editing])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const commit = useCallback(() => {
    setEditing(false)
    if (draft !== (value ?? '')) onChange(draft)
  }, [draft, value, onChange])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') e.target.blur()
    if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
  }, [value])

  // ── Checkbox ──
  if (type === 'checkbox') {
    return (
      <div
        onClick={() => onChange(!isChecked)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', cursor: 'pointer' }}
      >
        <div style={{
          width: 14,
          height: 14,
          border: `1.5px solid ${isChecked ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#555' : '#bbb')}`,
          borderRadius: 2,
          background: isChecked ? (isDark ? '#4ade80' : '#16a34a') : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.1s, border-color 0.1s',
        }}>
          {isChecked && (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
    )
  }

  // ── Read-only (SHOT#) ──
  if (type === 'readonly') {
    return (
      <div style={{
        padding: '0 6px',
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        fontWeight: 700,
        fontFamily: 'monospace',
        fontSize: 11,
        color: isDark ? '#aaa' : '#555',
        userSelect: 'none',
      }}>
        {value}
      </div>
    )
  }

  // ── Editing mode ──
  const editStyle = {
    width: '100%',
    height: '100%',
    border: 'none',
    background: isDark ? '#1e3a5f' : '#eff6ff',
    color: isDark ? '#e0e0e0' : '#1a1a1a',
    fontSize: 11,
    fontFamily: 'inherit',
    padding: '0 6px',
    outline: 'none',
  }

  if (editing) {
    if (type === 'dropdown') {
      const isCustom = options && !options.includes(value)
      return (
        <select
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          style={{ ...editStyle, padding: '0 4px', cursor: 'pointer' }}
        >
          {isCustom && <option value={value ?? ''}>{value}</option>}
          {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        style={editStyle}
      />
    )
  }

  // ── Display mode ──
  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        padding: '0 6px',
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        cursor: 'text',
        fontSize: 11,
        color: value ? (isDark ? '#e0e0e0' : '#1a1a1a') : (isDark ? '#3a3a3a' : '#ccc'),
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {value || '—'}
    </div>
  )
}

// ── IntExtCell — scene-level I/E D/N (updates whole scene) ───────────────────
function IntExtCell({ value, onChange, isDark }) {
  const [editing, setEditing] = useState(false)
  const selectRef = useRef(null)

  useEffect(() => { if (editing && selectRef.current) selectRef.current.focus() }, [editing])

  const commit = useCallback((newVal) => {
    setEditing(false)
    if (newVal !== value) onChange(newVal)
  }, [value, onChange])

  if (editing) {
    return (
      <select
        ref={selectRef}
        value={value}
        onChange={e => commit(e.target.value)}
        onBlur={() => setEditing(false)}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: isDark ? '#1e3a5f' : '#eff6ff',
          color: isDark ? '#e0e0e0' : '#1a1a1a',
          fontSize: 11,
          fontFamily: 'monospace',
          fontWeight: 600,
          padding: '0 4px',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        {INT_EXT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        padding: '0 6px',
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        cursor: 'pointer',
        fontSize: 11,
        fontFamily: 'monospace',
        fontWeight: 600,
        color: isDark ? '#aaa' : '#444',
        userSelect: 'none',
      }}
    >
      {value || '—'}
    </div>
  )
}

// ── Main ShotlistTab ──────────────────────────────────────────────────────────
export default function ShotlistTab() {
  const scenes = useStore(s => s.scenes)
  const getShotsForScene = useStore(s => s.getShotsForScene)
  const updateShot = useStore(s => s.updateShot)
  const updateShotSpec = useStore(s => s.updateShotSpec)
  const updateScene = useStore(s => s.updateScene)
  const theme = useStore(s => s.theme)
  const isDark = theme === 'dark'

  const c = {
    pageBg:       isDark ? '#141414' : '#e8e4db',
    tableBg:      isDark ? '#1e1e1e' : '#ffffff',
    rowAlt:       isDark ? '#252525' : '#faf8f5',
    headerBg:     isDark ? '#2a2a2a' : '#f0ede4',
    border:       isDark ? '#2e2e2e' : '#e0dbd0',
    thickBorder:  isDark ? '#444'    : '#c4bfb5',
    text:         isDark ? '#e0e0e0' : '#1a1a1a',
    muted:        isDark ? '#555'    : '#aaa',
  }

  const getShotFieldValue = (shot, key) => {
    if (key.startsWith('specs.')) return shot.specs?.[key.split('.')[1]] ?? ''
    return shot[key] ?? ''
  }

  const handleShotChange = useCallback((shotId, key, value) => {
    if (key.startsWith('specs.')) {
      updateShotSpec(shotId, key.split('.')[1], value)
    } else {
      updateShot(shotId, { [key]: value })
    }
  }, [updateShot, updateShotSpec])

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: c.pageBg,
    }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <table style={{
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          width: TOTAL_WIDTH,
          minWidth: '100%',
          backgroundColor: c.tableBg,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.08)',
          fontSize: 11,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
        }}>
          <colgroup>
            {COLUMNS.map(col => <col key={col.key} style={{ width: col.width }} />)}
          </colgroup>

          {/* Sticky column header row */}
          <thead>
            <tr style={{ height: ROW_H }}>
              {COLUMNS.map((col, i) => (
                <th
                  key={col.key}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    backgroundColor: c.headerBg,
                    color: isDark ? '#888' : '#666',
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    textAlign: col.type === 'checkbox' ? 'center' : 'left',
                    padding: col.type === 'checkbox' ? 0 : '0 6px',
                    borderBottom: `2px solid ${c.thickBorder}`,
                    borderRight: i < COLUMNS.length - 1 ? `1px solid ${c.thickBorder}` : 'none',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    overflow: 'hidden',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {scenes.map(scene => {
              const shots = getShotsForScene(scene.id)
              const timeTotal = sumScriptTimes(shots)

              return (
                <React.Fragment key={scene.id}>
                  {/* Bold scene header row */}
                  <tr>
                    <td
                      colSpan={COLUMNS.length}
                      style={{
                        height: 30,
                        backgroundColor: '#2a2a2a',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        letterSpacing: '0.08em',
                        padding: '0 12px',
                        borderTop: '3px solid #111',
                        borderBottom: '1px solid #555',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>
                          {scene.sceneLabel}
                          <span style={{ fontWeight: 300, opacity: 0.45, margin: '0 10px' }}>|</span>
                          {scene.location}
                          <span style={{ fontWeight: 300, opacity: 0.45, margin: '0 10px' }}>|</span>
                          {scene.intOrExt}
                        </span>
                        <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.6, letterSpacing: '0.05em' }}>
                          {shots.length} SHOT{shots.length !== 1 ? 'S' : ''}
                          {timeTotal ? ` · ${timeTotal} TOTAL` : ''}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Shot rows */}
                  {shots.map((shot, idx) => {
                    const isChecked = !!shot.checked
                    const rowBg = isChecked
                      ? (isDark ? '#1a2a1a' : '#f0fdf4')
                      : (idx % 2 === 0 ? c.tableBg : c.rowAlt)

                    return (
                      <tr
                        key={shot.id}
                        style={{
                          height: ROW_H,
                          backgroundColor: rowBg,
                          opacity: isChecked ? 0.5 : 1,
                        }}
                      >
                        {COLUMNS.map((col, colIdx) => {
                          const isLastCol = colIdx === COLUMNS.length - 1
                          const cellStyle = {
                            borderBottom: `1px solid ${c.border}`,
                            borderRight: !isLastCol ? `1px solid ${c.border}` : 'none',
                            padding: 0,
                            height: ROW_H,
                            overflow: 'hidden',
                            verticalAlign: 'middle',
                          }

                          if (col.type === 'checkbox') {
                            return (
                              <td key={col.key} style={{ ...cellStyle, textAlign: 'center' }}>
                                <EditableCell
                                  type="checkbox"
                                  isChecked={isChecked}
                                  isDark={isDark}
                                  onChange={(val) => handleShotChange(shot.id, 'checked', val)}
                                />
                              </td>
                            )
                          }

                          if (col.type === 'readonly') {
                            return (
                              <td key={col.key} style={cellStyle}>
                                <EditableCell
                                  type="readonly"
                                  value={shot.displayId}
                                  isDark={isDark}
                                  onChange={() => {}}
                                />
                              </td>
                            )
                          }

                          if (col.type === 'intExt') {
                            return (
                              <td key={col.key} style={cellStyle}>
                                <IntExtCell
                                  value={scene.intOrExt}
                                  isDark={isDark}
                                  onChange={(val) => updateScene(scene.id, { intOrExt: val })}
                                />
                              </td>
                            )
                          }

                          const val = getShotFieldValue(shot, col.key)
                          return (
                            <td key={col.key} style={cellStyle}>
                              <EditableCell
                                type={col.type}
                                options={col.options}
                                value={val}
                                isDark={isDark}
                                onChange={(newVal) => handleShotChange(shot.id, col.key, newVal)}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}

                  {/* Empty scene placeholder */}
                  {shots.length === 0 && (
                    <tr>
                      <td
                        colSpan={COLUMNS.length}
                        style={{
                          height: 36,
                          padding: '0 16px',
                          fontSize: 11,
                          color: c.muted,
                          fontStyle: 'italic',
                          borderBottom: `1px solid ${c.border}`,
                        }}
                      >
                        No shots — add shots in the Storyboard tab
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
