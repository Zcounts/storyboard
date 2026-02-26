import React, { useState, useCallback, useRef, useEffect } from 'react'
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
const SIZE_OPTIONS = ['WIDE SHOT', 'MEDIUM', 'CLOSE UP', 'OTS', 'ECU', 'INSERT', 'ESTABLISHING']
const TYPE_OPTIONS = ['EYE LVL', 'SHOULDER LVL', 'CROWD LVL', 'HIGH ANGLE', 'LOW ANGLE', 'DUTCH']
const MOVE_OPTIONS = ['STATIC', 'PUSH', 'PULL', 'PAN', 'TILT', 'STATIC or PUSH', 'TRACKING', 'CRANE']
const EQUIP_OPTIONS = ['STICKS', 'GIMBAL', 'HANDHELD', 'STICKS or GIMBAL', 'CRANE', 'DOLLY', 'STEADICAM']
const INT_EXT_OPTIONS = ['INT', 'EXT', 'INT/EXT']

// ── All column definitions (source of truth for metadata) ────────────────────
const ALL_COLUMNS = [
  { key: 'checked',        label: 'X',                  width: 36,  type: 'checkbox' },
  { key: 'displayId',      label: 'SHOT#',              width: 54,  type: 'readonly' },
  { key: '__intExt__',     label: 'I/E D/N',            width: 76,  type: 'intExt' },
  { key: 'subject',        label: 'SUBJECT',            width: 130, type: 'text' },
  { key: 'specs.type',     label: 'ANGLE',              width: 96,  type: 'dropdown', options: TYPE_OPTIONS },
  { key: 'focalLength',    label: 'LENS',               width: 64,  type: 'text' },
  { key: 'specs.equip',    label: 'EQUIPMENT',          width: 100, type: 'dropdown', options: EQUIP_OPTIONS },
  { key: 'specs.move',     label: 'MOVEMENT',           width: 96,  type: 'dropdown', options: MOVE_OPTIONS },
  { key: 'specs.size',     label: 'COVERAGE',           width: 110, type: 'dropdown', options: SIZE_OPTIONS },
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
      // Commit immediately on selection to avoid the stale-closure bug where
      // onBlur fires in the same event flush as onChange, before draft state
      // has been committed to a new render cycle.
      const isCustom = options && !options.includes(value)
      return (
        <select
          ref={inputRef}
          value={draft}
          onChange={e => {
            const newVal = e.target.value
            setDraft(newVal)
            setEditing(false)
            if (newVal !== (value ?? '')) onChange(newVal)
          }}
          onBlur={() => setEditing(false)}
          style={{ ...editStyle, padding: '0 4px', cursor: 'pointer' }}
        >
          {isCustom && <option value={value ?? ''}>{value}</option>}
          {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }

    if (type === 'textarea') {
      return (
        <textarea
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            // Escape cancels; Enter is allowed for newlines in textarea
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

// ── IntExtCell — scene-level I/E D/N ─────────────────────────────────────────
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
function SortableColumnItem({ id, label, visible, onToggle, isDark }) {
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
    </div>
  )
}

// ── Column config panel ───────────────────────────────────────────────────────
function ColumnConfigPanel({ config, isDark, onChange, onClose }) {
  const panelSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

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

  return (
    <div
      style={{
        position: 'absolute',
        top: 34,
        right: 0,
        zIndex: 200,
        width: 230,
        background: isDark ? '#1a1a1a' : '#fff',
        border: `1px solid ${isDark ? '#3a3a3a' : '#d4d0c8'}`,
        borderRadius: 6,
        boxShadow: isDark
          ? '0 8px 28px rgba(0,0,0,0.7)'
          : '0 8px 28px rgba(0,0,0,0.18)',
        padding: '10px 8px 8px',
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
            const colDef = ALL_COLUMNS.find(col => col.key === c.key)
            if (!colDef) return null
            return (
              <SortableColumnItem
                key={c.key}
                id={c.key}
                label={colDef.label}
                visible={c.visible}
                onToggle={toggle}
                isDark={isDark}
              />
            )
          })}
        </SortableContext>
      </DndContext>
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
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: ROW_H,
          padding: '0 3px',
        }}>
          {/* Drag grip */}
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
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

        const val = col.key.startsWith('specs.')
          ? (shot.specs?.[col.key.split('.')[1]] ?? '')
          : (shot[col.key] ?? '')

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
}

// ── Main ShotlistTab ──────────────────────────────────────────────────────────
export default function ShotlistTab() {
  const scenes               = useStore(s => s.scenes)
  const getShotsForScene     = useStore(s => s.getShotsForScene)
  const updateShot           = useStore(s => s.updateShot)
  const updateShotSpec       = useStore(s => s.updateShotSpec)
  const updateScene          = useStore(s => s.updateScene)
  const addShot              = useStore(s => s.addShot)
  const deleteShot           = useStore(s => s.deleteShot)
  const reorderShots         = useStore(s => s.reorderShots)
  const theme                = useStore(s => s.theme)
  const shotlistColumnConfig = useStore(s => s.shotlistColumnConfig)
  const setShotlistColumnConfig = useStore(s => s.setShotlistColumnConfig)
  const isDark = theme === 'dark'

  const [configPanelOpen, setConfigPanelOpen] = useState(false)

  // Shared sensors for row drag-and-drop (one per scene DndContext)
  const rowSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Compute visible columns in config order
  const visibleColumns = (shotlistColumnConfig || [])
    .filter(c => c.visible)
    .map(c => ALL_COLUMNS.find(col => col.key === c.key))
    .filter(Boolean)

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
          />
        )}
      </div>

      {/* ── Table ── */}
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
      </div>
    </div>
  )
}
