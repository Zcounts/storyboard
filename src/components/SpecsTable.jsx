import React from 'react'
import useStore from '../store'
import CustomDropdown from './CustomDropdown'

const SIZE_OPTIONS = ['WIDE SHOT', 'MEDIUM', 'CLOSE UP', 'OTS', 'ECU', 'INSERT', 'ESTABLISHING']
const TYPE_OPTIONS = ['EYE LVL', 'SHOULDER LVL', 'CROWD LVL', 'HIGH ANGLE', 'LOW ANGLE', 'DUTCH']
const MOVE_OPTIONS = ['STATIC', 'PUSH', 'PULL', 'PAN', 'TILT', 'STATIC or PUSH', 'TRACKING', 'CRANE']
const EQUIP_OPTIONS = ['STICKS', 'GIMBAL', 'HANDHELD', 'STICKS or GIMBAL', 'CRANE', 'DOLLY', 'STEADICAM']

const SPEC_OPTIONS = {
  size: SIZE_OPTIONS,
  type: TYPE_OPTIONS,
  move: MOVE_OPTIONS,
  equip: EQUIP_OPTIONS,
}

function SpecCell({ shotId, specKey, value, useDropdowns }) {
  const updateShotSpec = useStore(s => s.updateShotSpec)
  const customDropdownOptions = useStore(s => s.customDropdownOptions)
  const addCustomDropdownOption = useStore(s => s.addCustomDropdownOption)

  if (useDropdowns) {
    const defaultOpts = SPEC_OPTIONS[specKey] || []
    const customOpts = customDropdownOptions[specKey] || []
    const allOpts = [...new Set([...defaultOpts, ...customOpts])]

    return (
      <CustomDropdown
        value={value}
        options={allOpts}
        onChange={val => updateShotSpec(shotId, specKey, val)}
        onAddCustomOption={opt => addCustomDropdownOption(specKey, opt)}
        inputStyle={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          textAlign: 'center',
          fontSize: 10,
          padding: 0,
          outline: 'none',
          fontFamily: 'inherit',
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      />
    )
  }

  return (
    <input
      type="text"
      value={value}
      onChange={e => updateShotSpec(shotId, specKey, e.target.value)}
      placeholder="—"
    />
  )
}

export default function SpecsTable({ shotId, specs, useDropdowns }) {
  return (
    <table className="specs-table">
      <thead>
        <tr>
          <th>SIZE</th>
          <th>TYPE</th>
          <th>MOVE</th>
          <th>EQUIP</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <SpecCell shotId={shotId} specKey="size" value={specs.size} useDropdowns={useDropdowns} />
          </td>
          <td>
            <SpecCell shotId={shotId} specKey="type" value={specs.type} useDropdowns={useDropdowns} />
          </td>
          <td>
            <SpecCell shotId={shotId} specKey="move" value={specs.move} useDropdowns={useDropdowns} />
          </td>
          <td>
            <SpecCell shotId={shotId} specKey="equip" value={specs.equip} useDropdowns={useDropdowns} />
          </td>
        </tr>
      </tbody>
    </table>
  )
}
