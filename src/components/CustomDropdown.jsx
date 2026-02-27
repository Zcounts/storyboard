import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * CustomDropdown — replaces native <datalist> with a fully-controlled dropdown.
 *
 * Unlike <datalist>, this component:
 *   - Always shows ALL options when opened (browser datalist filters by input)
 *   - Filters options as the user types (typeahead), but clearing the input
 *     or clicking the chevron restores the full list
 *   - Commits the value on blur, Enter, or option click
 *   - Cancels on Escape (restores previous value)
 *   - Saves new custom values via onAddCustomOption on blur
 *
 * The options panel is rendered into document.body via createPortal with
 * position:fixed so it is never clipped by overflow:hidden ancestors such as
 * table cells. The panel's position is recomputed whenever isOpen becomes true.
 *
 * Used by both SpecsTable (storyboard cards) and ShotlistTab (table cells).
 */
export default function CustomDropdown({
  value,
  options = [],
  onChange,
  onAddCustomOption,
  inputStyle = {},
  focusBg = '',
  isDark = false,
  placeholder = '',
}) {
  const [inputVal, setInputVal] = useState(value ?? '')
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  // Position of the panel (computed from the container's bounding rect)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, minWidth: 0 })

  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const escapingRef = useRef(false)
  // Tracks the value selected via option click so handleBlur can commit it
  // even if the async setInputVal hasn't flushed yet.
  const pendingValueRef = useRef(null)

  // Keep input in sync with external value whenever the field is not focused.
  useEffect(() => {
    if (!isFocused) setInputVal(value ?? '')
  }, [value, isFocused])

  // Recompute the panel's fixed-position coordinates each time it opens.
  // Using position:fixed + getBoundingClientRect means the panel is always
  // positioned relative to the viewport and is never clipped by any
  // overflow:hidden ancestor (including table cells).
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      // If the panel would extend below the viewport, open upward instead.
      const spaceBelow = window.innerHeight - rect.bottom
      const panelMaxH = 200
      const openUpward = spaceBelow < panelMaxH && rect.top > panelMaxH

      setPanelPos({
        top: openUpward ? undefined : rect.bottom,
        bottom: openUpward ? window.innerHeight - rect.top : undefined,
        left: rect.left,
        minWidth: rect.width,
      })
    }
  }, [isOpen])

  // Options to display: all when input empty, filtered when user is typing.
  const displayOpts = inputVal.trim()
    ? options.filter(o => o.toLowerCase().includes(inputVal.toLowerCase()))
    : options

  // ── Event handlers ──────────────────────────────────────────────────────────

  const handleFocus = () => {
    setIsFocused(true)
    escapingRef.current = false
    setIsOpen(true)
  }

  const handleBlur = (e) => {
    // If focus moved to another element inside our container (shouldn't happen
    // normally since chevron uses onMouseDown+preventDefault, but guard it).
    if (containerRef.current?.contains(e.relatedTarget)) return

    setIsFocused(false)
    setIsOpen(false)

    if (escapingRef.current) {
      escapingRef.current = false
      setInputVal(value ?? '')
      return
    }

    // Use pendingValueRef if set by handleSelect, otherwise use inputVal.
    const val = (pendingValueRef.current ?? inputVal).trim()
    pendingValueRef.current = null

    if (val && !options.includes(val) && onAddCustomOption) {
      onAddCustomOption(val)
    }
    if (val !== (value ?? '')) onChange(val)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      escapingRef.current = true
      inputRef.current?.blur()
    } else if (e.key === 'Enter') {
      inputRef.current?.blur()
    } else if (e.key === 'ArrowDown' && !isOpen) {
      setIsOpen(true)
    }
  }

  // Called when user clicks an option in the dropdown list.
  const handleSelect = (opt) => {
    pendingValueRef.current = opt
    setInputVal(opt)
    setIsOpen(false)
    // Blur triggers handleBlur which commits via pendingValueRef.
    inputRef.current?.blur()
  }

  // Chevron button toggles the dropdown open/closed.
  // Uses onMouseDown + preventDefault to avoid stealing focus from the input.
  const handleChevronMouseDown = (e) => {
    e.preventDefault()
    if (isOpen) {
      setIsOpen(false)
    } else {
      // Clear filter so all options are visible.
      setInputVal('')
      setIsOpen(true)
      inputRef.current?.focus()
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const dropdownBg     = isDark ? '#1e1e1e' : '#ffffff'
  const dropdownBorder = isDark ? '#3a3a3a' : '#d1ccc3'
  const itemHoverBg    = isDark ? '#2a2a2a' : '#f0ede4'
  const itemColor      = isDark ? '#e0e0e0' : '#1a1a1a'
  const chevronColor   = isDark ? '#555'    : '#bbb'

  // The options panel — rendered into document.body so it is never clipped.
  const panelEl = isOpen && displayOpts.length > 0
    ? createPortal(
        <div
          style={{
            position: 'fixed',
            top: panelPos.top,
            bottom: panelPos.bottom,
            left: panelPos.left,
            zIndex: 9999,
            background: dropdownBg,
            border: `1px solid ${dropdownBorder}`,
            borderRadius: 3,
            boxShadow: `0 4px 14px rgba(0,0,0,${isDark ? '0.45' : '0.15'})`,
            maxHeight: 200,
            overflowY: 'auto',
            minWidth: panelPos.minWidth,
            width: 'max-content',
          }}
        >
          {displayOpts.map(opt => (
            <div
              key={opt}
              // preventDefault keeps input focused; click selects the option.
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleSelect(opt)}
              style={{
                padding: '5px 10px',
                cursor: 'pointer',
                fontSize: 10,
                fontFamily: 'monospace',
                color: itemColor,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = itemHoverBg }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {opt}
            </div>
          ))}
        </div>,
        document.body
      )
    : null

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {/* Input row with chevron */}
      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); setIsOpen(true) }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            ...inputStyle,
            flex: 1,
            minWidth: 0,
            ...(focusBg && isFocused ? { background: focusBg } : {}),
          }}
        />
        <button
          tabIndex={-1}
          onMouseDown={handleChevronMouseDown}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: '0 3px',
            color: chevronColor,
            fontSize: 9,
            lineHeight: 1,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            userSelect: 'none',
          }}
        >
          ▾
        </button>
      </div>

      {/* Options panel rendered into document.body via portal */}
      {panelEl}
    </div>
  )
}
