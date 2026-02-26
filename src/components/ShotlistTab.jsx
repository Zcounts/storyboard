import React, { useState, useCallback, useRef, useEffect, useId, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../store'

// ── Dropdown options (matching SpecsTable.jsx) ───────────────────────────────
const SIZE_OPTIONS  = ['WIDE SHOT', 'MEDIUM', 'CLOSE UP', 'OTS', 'ECU', 'INSERT', 'ESTABLISHING']
const TYPE_OPTIONS  = ['EYE LVL', 'SHOULDER LVL', 'CROWD LVL', 'HIGH ANGLE', 'LOW ANGLE', 'DUTCH']
const MOVE_OPTIONS  = ['STATIC', 'PUSH', 'PULL', 'PAN', 'TILT', 'STATIC or PUSH', 'TRACKING', 'CRANE']
const EQUIP_OPTIONS = ['STICKS', 'GIMBAL', 'HANDHELD', 'STICKS or GIMBAL', 'CRANE', 'DOLLY', 'STEADICAM']
const INT_EXT_OPTIONS  = ['INT', 'EXT', 'INT/EXT']
const DAY_NIGHT_OPTIONS = ['DAY', 'NIGHT', 'DAY/NIGHT']

// ── Built-in column definitions (source of truth for metadata) ──────────────
const BUILTIN_COLUMNS = [
  { key: 'checked',        label: 'X',                  width: 36,  type: 'checkbox' },
  { key: 'displayId',      label: 'SHOT#',              width: 54,  type: 'readonly' },
  { key: '__int__',        label: 'I/E',                width: 52,  type: 'intExt' },
  { key: '__dn__',         label: 'D/N',                width: 52,  type: 'dayNight' },
  { key: 'subject',        label: 'SUBJECT',            width: 130, type: 'text' },
  { key: 'specs.type',     label: 'ANGLE',              width: 96,  type: 'dropdown', options: TYPE_OPTIONS,  customOptionsField: 'type'  },
  { key: 'focalLength',    label: 'LENS',               width: 64,  type: 'text' },
  { key: 'specs.equip',    label: 'EQUIPMENT',          width: 100, type: 'dropdown', options: EQUIP_OPTIONS, customOptionsField: 'equip' },
  { key: 'specs.move',     label: 'MOVEMENT',           width: 96,  type: 'dropdown', options: MOVE_OPTIONS,  customOptionsField: 'move'  },
  { key: 'specs.size',     label: 'COVERAGE',           width: 110, type: 'dropdown', options: SIZE_OPTIONS,  customOptionsField: 'size'  },
  { key: 'notes',          label: 'NOTES',              width: 160, type: 'textarea' },
  { key: 'scriptTime',     label: 'SCRIPT TIME',        width: 84,  type: 'text' },
  { key: 'setupTime',      label: 'SETUP TIME',         width: 84,  type: 'text' },
  { key: 'predictedTakes', label: 'PREDIC# OF TAKES',  width: 104, type: 'text' },
  { key: 'shootTime',      label: 'SHOOT TIME',         width: 84,  type: 'text' },
  { key: 'takeNumber',     label: 'TAKE #',             width: 60,  type: 'text' },
]

// Non-configurable drag-handle/delete utility column width
const DRAG_COL_WIDTH = 36
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
// customOptions: extra options to merge with the built-in options list
// onAddCustomOption: callback(value) called when user commits a value not in options
function EditableCell({ value, onChange, type, options, customOptions, onAddCustomOption, isChecked, isDark }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef(null)
  const datalistId = useId()

  useEffect(() => { if (!editing) setDraft(value ?? '') }, [value, editing])

  // Use a ref callback so focus happens synchronously during React's commit phase —
  // BEFORE the browser paints — eliminating the "blue background, no cursor" flash.
  const setFocusRef = useCallback((el) => {
    inputRef.current = el
    if (el) el.focus()
  }, [])

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
    // ── Dropdown via datalist — allows free-text custom values ──
    if (type === 'dropdown') {
      const allOpts = [...new Set([...(options || []), ...(customOptions || [])])]
      return (
        <>
          <input
            ref={setFocusRef}
            type="text"
            value={draft}
            list={datalistId}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => {
              const trimmed = draft.trim()
              if (trimmed && !allOpts.includes(trimmed) && onAddCustomOption) {
                onAddCustomOption(trimmed)
              }
              commit()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur()
              if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
            }}
            style={{ ...editStyle, padding: '0 4px' }}
            autoComplete="off"
          />
          <datalist id={datalistId}>
            {allOpts.map(o => <option key={o} value={o} />)}
          </datalist>
        </>
      )
    }

    if (type === 'textarea') {
      return (
        <textarea
          ref={setFocusRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
          }}
          style={{
            ...editStyle,
            padding: '2px 6px',
            resize: 'none',
            overflow: 'auto',
            lineHeight: 1.4,
            verticalAlign: 'top',
          }}
        />
      )
    }

    return (
      <input
        ref={setFocusRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        style={editStyle}
      />
    )
  }

  // ── Display mode ──
  // onMouseDown preventDefault prevents browser text-selection highlight;
  // onClick still fires and enters edit mode immediately.
  return (
    <div
      onMouseDown={e => e.preventDefault()}
      onClick={() => setEditing(true)}
      style={{
        padding: '0 6px',
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        cursor: type === 'textarea' ? 'text' : 'default',
        fontSize: 11,
        color: value ? (isDark ? '#e0e0e0' : '#1a1a1a') : (isDark ? '#3a3a3a' : '#ccc'),
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        outline: 'none',
      }}
    >
      {value || '—'}
    </div>
  )
}

// ── SceneLevelDropdownCell — for scene-wide I/E and D/N ───────────────────────
// Clicking edits the value for the entire scene (not per-shot).
function SceneLevelDropdownCell({ value, onChange, options, customOptions, onAddCustomOption, isDark }) {
  const [editing, setEditing] = useState(false)
  const selectRef = useRef(null)
  const datalistId = useId()

  useEffect(() => { if (editing && selectRef.current) selectRef.current.focus() }, [editing])

  const allOpts = [...new Set([...(options || []), ...(customOptions || [])])]

  if (editing) {
    return (
      <>
        <input
          ref={selectRef}
          type="text"
          value={value}
          list={datalistId}
          onChange={e => {
            const newVal = e.target.value
            if (allOpts.includes(newVal)) {
              setEditing(false)
              if (newVal !== value) onChange(newVal)
            }
          }}
          onBlur={e => {
            const v = e.target.value.trim()
            if (v && !allOpts.includes(v) && onAddCustomOption) {
              onAddCustomOption(v)
            }
            setEditing(false)
            if (v && v !== value) onChange(v)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') setEditing(false)
          }}
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
          }}
          autoComplete="off"
        />
        <datalist id={datalistId}>
          {allOpts.map(o => <option key={o} value={o} />)}
        </datalist>
      </>
    )
  }

  return (
    <div
      onMouseDown={e => e.preventDefault()}
      onClick={() => setEditing(true)}
      style={{
        padding: '0 6px',
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        cursor: 'default',
        fontSize: 11,
        fontFamily: 'monospace',
        fontWeight: 600,
        color: isDark ? '#aaa' : '#444',
        userSelect: 'none',
        outline: 'none',
      }}
    >
      {value || '—'}
    </div>
  )
}

// ── Drag handle icon ──────────────────────────────────────────────────────────
function DragHandleIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
      <circle cx="3" cy="2.5" r="1.5" />
      <circle cx="7" cy="2.5" r="1.5" />
      <circle cx="3" cy="7"   r="1.5" />
      <circle cx="7" cy="7"   r="1.5" />
      <circle cx="3" cy="11.5" r="1.5" />
      <circle cx="7" cy="11.5" r="1.5" />
    </svg>
  )
}

// ── SortableColumnItem (inside the config panel) ──────────────────────────────
function SortableColumnItem({ id, label, visible, onToggle, isDark, isCustom, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 4px',
        borderRadius: 3,
        background: isDark ? '#252525' : '#f8f7f3',
        marginBottom: 3,
        cursor: 'default',
        userSelect: 'none',
        border: `1px solid ${isDark ? '#333' : '#e5e1d8'}`,
      }}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          color: isDark ? '#555' : '#ccc',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          lineHeight: 0,
          padding: '0 2px',
        }}
      >
        <DragHandleIcon />
      </span>

      {/* Visibility toggle */}
      <input
        type="checkbox"
        checked={visible}
        onChange={() => onToggle(id)}
        style={{ cursor: 'pointer', flexShrink: 0, margin: 0 }}
      />

      {/* Column label */}
      <span style={{
        fontSize: 10,
        fontFamily: 'monospace',
        fontWeight: 600,
        letterSpacing: '0.05em',
        color: isDark ? '#bbb' : '#444',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>

      {/* Delete button for custom columns */}
      {isCustom && onDelete && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onDelete(id) }}
          title="Remove custom column"
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: isDark ? '#f87171' : '#dc2626',
            fontSize: 14,
            lineHeight: 1,
            padding: '0 2px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            opacity: 0.7,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── Column config panel ───────────────────────────────────────────────────────
function ColumnConfigPanel({ config, isDark, onChange, onClose, customColumns, onAddCustomColumn, onRemoveCustomColumn }) {
  const panelSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const [newColName, setNewColName] = useState('')
  const [newColType, setNewColType] = useState('text')
  const [addingCol, setAddingCol] = useState(false)

  const handleDragEnd = useCallback(({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIdx = config.findIndex(c => c.key === active.id)
    const newIdx = config.findIndex(c => c.key === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    onChange(arrayMove(config, oldIdx, newIdx))
  }, [config, onChange])

  const toggle = useCallback((key) => {
    onChange(config.map(c => c.key === key ? { ...c, visible: !c.visible } : c))
  }, [config, onChange])

  const getColLabel = useCallback((key) => {
    const builtin = BUILTIN_COLUMNS.find(col => col.key === key)
    if (builtin) return builtin.label
    const custom = customColumns.find(c => c.key === key)
    return custom ? custom.label : key
  }, [customColumns])

  const isCustomCol = useCallback((key) => {
    return customColumns.some(c => c.key === key)
  }, [customColumns])

  const handleAddColumn = () => {
    const name = newColName.trim()
    if (!name) return
    onAddCustomColumn(name, newColType)
    setNewColName('')
    setNewColType('text')
    setAddingCol(false)
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 34,
        right: 0,
        zIndex: 200,
        width: 240,
        background: isDark ? '#1a1a1a' : '#fff',
        border: `1px solid ${isDark ? '#3a3a3a' : '#d4d0c8'}`,
        borderRadius: 6,
        boxShadow: isDark
          ? '0 8px 28px rgba(0,0,0,0.7)'
          : '0 8px 28px rgba(0,0,0,0.18)',
        padding: '10px 8px 8px',
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingBottom: 7,
        borderBottom: `1px solid ${isDark ? '#2e2e2e' : '#eee'}`,
      }}>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: isDark ? '#777' : '#666',
        }}>
          Configure Columns
        </span>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: isDark ? '#666' : '#999',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 2px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ×
        </button>
      </div>

      {/* Hint */}
      <p style={{
        margin: '0 0 6px',
        fontSize: 9,
        color: isDark ? '#444' : '#bbb',
        fontFamily: 'monospace',
        letterSpacing: '0.03em',
      }}>
        Drag to reorder · toggle to show/hide
      </p>

      {/* Sortable column list */}
      <DndContext
        sensors={panelSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={config.map(c => c.key)}
          strategy={verticalListSortingStrategy}
        >
          {config.map(c => {
            const label = getColLabel(c.key)
            if (!label && !isCustomCol(c.key)) return null
            return (
              <SortableColumnItem
                key={c.key}
                id={c.key}
                label={label || c.key}
                visible={c.visible}
                onToggle={toggle}
                isDark={isDark}
                isCustom={isCustomCol(c.key)}
                onDelete={onRemoveCustomColumn}
              />
            )
          })}
        </SortableContext>
      </DndContext>

      {/* ── Add new custom column ── */}
      <div style={{
        marginTop: 8,
        paddingTop: 8,
        borderTop: `1px solid ${isDark ? '#2e2e2e' : '#eee'}`,
      }}>
        {addingCol ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <input
              type="text"
              value={newColName}
              onChange={e => setNewColName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') setAddingCol(false) }}
              placeholder="Column name…"
              autoFocus
              style={{
                width: '100%',
                padding: '4px 6px',
                fontSize: 10,
                fontFamily: 'monospace',
                border: `1px solid ${isDark ? '#444' : '#ccc'}`,
                borderRadius: 3,
                background: isDark ? '#252525' : '#fafafa',
                color: isDark ? '#ddd' : '#222',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <select
                value={newColType}
                onChange={e => setNewColType(e.target.value)}
                style={{
                  flex: 1,
                  padding: '3px 4px',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  border: `1px solid ${isDark ? '#444' : '#ccc'}`,
                  borderRadius: 3,
                  background: isDark ? '#252525' : '#fafafa',
                  color: isDark ? '#ddd' : '#222',
                  outline: 'none',
                }}
              >
                <option value="text">Free text</option>
                <option value="dropdown">Dropdown</option>
              </select>
              <button
                onClick={handleAddColumn}
                disabled={!newColName.trim()}
                style={{
                  padding: '3px 8px',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 3,
                  background: isDark ? '#4ade80' : '#16a34a',
                  color: '#fff',
                  cursor: newColName.trim() ? 'pointer' : 'not-allowed',
                  opacity: newColName.trim() ? 1 : 0.5,
                }}
              >
                Add
              </button>
              <button
                onClick={() => { setAddingCol(false); setNewColName('') }}
                style={{
                  padding: '3px 6px',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  border: `1px solid ${isDark ? '#444' : '#ccc'}`,
                  borderRadius: 3,
                  background: 'none',
                  color: isDark ? '#888' : '#666',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingCol(true)}
            style={{
              width: '100%',
              padding: '5px 0',
              fontSize: 9,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              border: `1px dashed ${isDark ? '#3a3a3a' : '#d4d0c8'}`,
              borderRadius: 3,
              background: 'none',
              color: isDark ? '#555' : '#aaa',
              cursor: 'pointer',
              textAlign: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = isDark ? '#4ade80' : '#16a34a'
              e.currentTarget.style.borderColor = isDark ? '#4ade80' : '#16a34a'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = isDark ? '#555' : '#aaa'
              e.currentTarget.style.borderColor = isDark ? '#3a3a3a' : '#d4d0c8'
            }}
          >
            + New Column
          </button>
        )}
      </div>
    </div>
  )
}

// ── SortableShotRow ───────────────────────────────────────────────────────────
function SortableShotRow({
  shot, shotIndex, scene, visibleColumns,
  c, isDark, handleShotChange, updateScene, onDelete,
}) {
  const [hovered, setHovered] = useState(false)
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: shot.id })

  const customDropdownOptions = useStore(s => s.customDropdownOptions)
  const addCustomDropdownOption = useStore(s => s.addCustomDropdownOption)

  const isChecked = !!shot.checked
  const rowBg = isChecked
    ? (isDark ? '#1a2a1a' : '#f0fdf4')
    : (shotIndex % 2 === 0 ? c.tableBg : c.rowAlt)

  return (
    <tr
      ref={setNodeRef}
      style={{
        height: ROW_H,
        backgroundColor: rowBg,
        opacity: isChecked ? 0.5 : isDragging ? 0.35 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle + delete utility cell */}
      <td style={{
        width: DRAG_COL_WIDTH,
        padding: 0,
        borderBottom: `1px solid ${c.border}`,
        borderRight: `1px solid ${c.border}`,
        verticalAlign: 'middle',
        overflow: 'hidden',
        userSelect: 'none',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: ROW_H,
          padding: '0 3px',
        }}>
          {/* Drag grip — tabIndex={-1} overrides dnd-kit's tabIndex:0 so the
               handle cannot steal focus when a cell is clicked nearby.       */}
          <div
            {...attributes}
            {...listeners}
            tabIndex={-1}
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              outline: 'none',
              width: 16,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? '#555' : '#c0bdb8',
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.12s',
              flexShrink: 0,
            }}
          >
            <DragHandleIcon />
          </div>

          {/* Delete button */}
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(shot.id) }}
            title="Delete shot"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: isDark ? '#f87171' : '#dc2626',
              fontSize: 15,
              lineHeight: 1,
              padding: '0 1px',
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.12s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 14,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      </td>

      {/* Data cells */}
      {visibleColumns.map((col, colIdx) => {
        const isLastCol = colIdx === visibleColumns.length - 1
        const cellStyle = {
          borderBottom: `1px solid ${c.border}`,
          borderRight: !isLastCol ? `1px solid ${c.border}` : 'none',
          padding: 0,
          height: ROW_H,
          overflow: 'hidden',
          verticalAlign: 'middle',
          userSelect: 'none',
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

        // I/E (Interior/Exterior) — scene-level
        if (col.type === 'intExt') {
          return (
            <td key={col.key} style={cellStyle}>
              <SceneLevelDropdownCell
                value={scene.intOrExt}
                options={INT_EXT_OPTIONS}
                customOptions={customDropdownOptions['int'] || []}
                onAddCustomOption={(v) => addCustomDropdownOption('int', v)}
                isDark={isDark}
                onChange={(val) => updateScene(scene.id, { intOrExt: val })}
              />
            </td>
          )
        }

        // D/N (Day/Night) — scene-level
        if (col.type === 'dayNight') {
          return (
            <td key={col.key} style={cellStyle}>
              <SceneLevelDropdownCell
                value={scene.dayNight || 'DAY'}
                options={DAY_NIGHT_OPTIONS}
                customOptions={customDropdownOptions['dn'] || []}
                onAddCustomOption={(v) => addCustomDropdownOption('dn', v)}
                isDark={isDark}
                onChange={(val) => updateScene(scene.id, { dayNight: val })}
              />
            </td>
          )
        }

        // Compute value for regular cells
        const val = col.key.startsWith('specs.')
          ? (shot.specs?.[col.key.split('.')[1]] ?? '')
          : (shot[col.key] ?? '')

        const customOpts = col.customOptionsField
          ? (customDropdownOptions[col.customOptionsField] || [])
          : []

        return (
          <td key={col.key} style={cellStyle}>
            <EditableCell
              type={col.type}
              options={col.options}
              customOptions={customOpts}
              onAddCustomOption={col.customOptionsField
                ? (v) => addCustomDropdownOption(col.customOptionsField, v)
                : undefined
              }
              value={val}
              isDark={isDark}
              onChange={(newVal) => handleShotChange(shot.id, col.key, newVal)}
            />
          </td>
        )
      })}
    </tr>
  )
}

// ── Main ShotlistTab ──────────────────────────────────────────────────────────
export default function ShotlistTab() {
  const scenes                  = useStore(s => s.scenes)
  const getShotsForScene        = useStore(s => s.getShotsForScene)
  const updateShot              = useStore(s => s.updateShot)
  const updateShotSpec          = useStore(s => s.updateShotSpec)
  const updateScene             = useStore(s => s.updateScene)
  const addShot                 = useStore(s => s.addShot)
  const deleteShot              = useStore(s => s.deleteShot)
  const reorderShots            = useStore(s => s.reorderShots)
  const addScene                = useStore(s => s.addScene)
  const theme                   = useStore(s => s.theme)
  const shotlistColumnConfig    = useStore(s => s.shotlistColumnConfig)
  const setShotlistColumnConfig = useStore(s => s.setShotlistColumnConfig)
  const customColumns           = useStore(s => s.customColumns)
  const addCustomColumn         = useStore(s => s.addCustomColumn)
  const removeCustomColumn      = useStore(s => s.removeCustomColumn)
  const isDark = theme === 'dark'

  const [configPanelOpen, setConfigPanelOpen] = useState(false)

  // Shared sensors for row drag-and-drop (one per scene DndContext)
  const rowSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Merge built-in columns with custom columns into a unified lookup map
  const allColumnsMap = useMemo(() => {
    const map = {}
    BUILTIN_COLUMNS.forEach(col => { map[col.key] = col })
    customColumns.forEach(c => {
      map[c.key] = {
        key: c.key,
        label: c.label,
        width: 100,
        type: c.fieldType === 'dropdown' ? 'dropdown' : 'text',
        options: [],
        customOptionsField: c.fieldType === 'dropdown' ? c.key : undefined,
        isCustom: true,
      }
    })
    return map
  }, [customColumns])

  // Compute visible columns in config order
  const visibleColumns = useMemo(() => {
    return (shotlistColumnConfig || [])
      .filter(c => c.visible)
      .map(c => allColumnsMap[c.key])
      .filter(Boolean)
  }, [shotlistColumnConfig, allColumnsMap])

  const totalTableWidth = DRAG_COL_WIDTH + visibleColumns.reduce((sum, col) => sum + col.width, 0)

  const c = {
    pageBg:      isDark ? '#141414' : '#e8e4db',
    tableBg:     isDark ? '#1e1e1e' : '#ffffff',
    rowAlt:      isDark ? '#252525' : '#faf8f5',
    headerBg:    isDark ? '#2a2a2a' : '#f0ede4',
    border:      isDark ? '#2e2e2e' : '#e0dbd0',
    thickBorder: isDark ? '#444'    : '#c4bfb5',
    text:        isDark ? '#e0e0e0' : '#1a1a1a',
    muted:       isDark ? '#555'    : '#aaa',
  }

  const handleShotChange = useCallback((shotId, key, value) => {
    if (key.startsWith('specs.')) {
      updateShotSpec(shotId, key.split('.')[1], value)
    } else {
      updateShot(shotId, { [key]: value })
    }
  }, [updateShot, updateShotSpec])

  const handleRowDragEnd = useCallback((event, sceneId) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorderShots(sceneId, active.id, over.id)
  }, [reorderShots])

  // Match the storyboard's behaviour exactly: call addScene() directly.
  // The new scene immediately appears in both tabs; the user can rename it
  // by clicking on the scene label in the Storyboard header.
  const handleAddScene = useCallback(() => {
    addScene()
  }, [addScene])

  // Close config panel when clicking outside
  useEffect(() => {
    if (!configPanelOpen) return
    const handler = () => setConfigPanelOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [configPanelOpen])

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: c.pageBg,
    }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '5px 16px',
        borderBottom: `1px solid ${c.thickBorder}`,
        backgroundColor: c.pageBg,
        position: 'relative',
        zIndex: 20,
        flexShrink: 0,
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); setConfigPanelOpen(p => !p) }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            border: `1px solid ${isDark ? '#383838' : '#c4bfb5'}`,
            borderRadius: 4,
            background: configPanelOpen
              ? (isDark ? '#2a2a2a' : '#e4e0d8')
              : (isDark ? '#1e1e1e' : '#f0ede4'),
            color: isDark ? '#aaa' : '#555',
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'monospace',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            transition: 'background 0.1s',
          }}
        >
          {/* Settings gear icon */}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="2.5" />
            <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.27 1.27M11.33 11.33l1.27 1.27M12.6 3.4l-1.27 1.27M4.67 11.33l-1.27 1.27" />
          </svg>
          Configure Columns
        </button>

        {configPanelOpen && (
          <ColumnConfigPanel
            config={shotlistColumnConfig || []}
            isDark={isDark}
            onChange={setShotlistColumnConfig}
            onClose={() => setConfigPanelOpen(false)}
            customColumns={customColumns}
            onAddCustomColumn={addCustomColumn}
            onRemoveCustomColumn={removeCustomColumn}
          />
        )}
      </div>

      {/* ── Table + Add Scene ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <table style={{
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          width: totalTableWidth,
          minWidth: '100%',
          backgroundColor: c.tableBg,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.08)',
          fontSize: 11,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
        }}>
          <colgroup>
            {/* Drag/delete utility column */}
            <col style={{ width: DRAG_COL_WIDTH }} />
            {visibleColumns.map(col => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>

          {/* ── Sticky column header ── */}
          <thead>
            <tr style={{ height: ROW_H }}>
              {/* Drag col header (empty) */}
              <th style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: c.headerBg,
                borderBottom: `2px solid ${c.thickBorder}`,
                borderRight: `1px solid ${c.thickBorder}`,
                width: DRAG_COL_WIDTH,
              }} />

              {visibleColumns.map((col, i) => (
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
                    borderRight: i < visibleColumns.length - 1 ? `1px solid ${c.thickBorder}` : 'none',
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

          {/* ── Body ── */}
          <tbody>
            {scenes.map(scene => {
              const shots = getShotsForScene(scene.id)
              const timeTotal = sumScriptTimes(shots)
              const totalCols = visibleColumns.length + 1 // +1 for drag/delete col

              return (
                <React.Fragment key={scene.id}>

                  {/* Scene header row */}
                  <tr>
                    <td
                      colSpan={totalCols}
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
                          <span style={{ fontWeight: 300, opacity: 0.45, margin: '0 6px' }}>·</span>
                          {scene.dayNight || 'DAY'}
                        </span>
                        <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.6, letterSpacing: '0.05em' }}>
                          {shots.length} SHOT{shots.length !== 1 ? 'S' : ''}
                          {timeTotal ? ` · ${timeTotal} TOTAL` : ''}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Sortable shot rows — one DndContext per scene */}
                  <DndContext
                    sensors={rowSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => handleRowDragEnd(e, scene.id)}
                  >
                    <SortableContext
                      items={shots.map(s => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {shots.map((shot, idx) => (
                        <SortableShotRow
                          key={shot.id}
                          shot={shot}
                          shotIndex={idx}
                          scene={scene}
                          visibleColumns={visibleColumns}
                          c={c}
                          isDark={isDark}
                          handleShotChange={handleShotChange}
                          updateScene={updateScene}
                          onDelete={deleteShot}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>

                  {/* Empty scene placeholder */}
                  {shots.length === 0 && (
                    <tr>
                      <td
                        colSpan={totalCols}
                        style={{
                          height: 36,
                          padding: '0 16px',
                          fontSize: 11,
                          color: c.muted,
                          fontStyle: 'italic',
                          borderBottom: `1px solid ${c.border}`,
                        }}
                      >
                        No shots yet — use the button below or add from the Storyboard tab
                      </td>
                    </tr>
                  )}

                  {/* ＋ Add Shot row */}
                  <tr>
                    <td
                      colSpan={totalCols}
                      style={{
                        height: 30,
                        padding: 0,
                        borderBottom: `2px solid ${c.thickBorder}`,
                      }}
                    >
                      <button
                        onClick={() => addShot(scene.id)}
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          color: isDark ? '#3a3a3a' : '#c0bdb8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '0 12px',
                          transition: 'color 0.12s, background 0.12s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.color = isDark ? '#4ade80' : '#16a34a'
                          e.currentTarget.style.background = isDark ? 'rgba(74,222,128,0.06)' : 'rgba(22,163,74,0.05)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.color = isDark ? '#3a3a3a' : '#c0bdb8'
                          e.currentTarget.style.background = 'none'
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <line x1="5" y1="1" x2="5" y2="9" />
                          <line x1="1" y1="5" x2="9" y2="5" />
                        </svg>
                        Add Shot
                      </button>
                    </td>
                  </tr>

                </React.Fragment>
              )
            })}
          </tbody>
        </table>

        {/* ── Add Scene button ── */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 8px' }}>
          <button
            onClick={handleAddScene}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 22px',
              background: 'none',
              border: `1.5px dashed ${isDark ? '#3a3a3a' : '#c4bfb5'}`,
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: isDark ? '#444' : '#b0ada8',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = isDark ? '#4ade80' : '#16a34a'
              e.currentTarget.style.borderColor = isDark ? '#4ade80' : '#16a34a'
              e.currentTarget.style.background = isDark ? 'rgba(74,222,128,0.06)' : 'rgba(22,163,74,0.05)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = isDark ? '#444' : '#b0ada8'
              e.currentTarget.style.borderColor = isDark ? '#3a3a3a' : '#c4bfb5'
              e.currentTarget.style.background = 'none'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="1" x2="6" y2="11" />
              <line x1="1" y1="6" x2="11" y2="6" />
            </svg>
            Add Scene
          </button>
        </div>
      </div>
    </div>
  )
}
