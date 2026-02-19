import useStore from '../store/useStore'

const SIZE_OPTIONS = ['WIDE SHOT', 'MEDIUM', 'CLOSE UP', 'OTS', 'INSERT', 'AERIAL', 'POV', 'ECU']
const TYPE_OPTIONS = ['EYE LVL', 'SHOULDER LVL', 'HIP LVL', 'CROWD LVL', 'HIGH ANGLE', 'LOW ANGLE', 'DUTCH']
const MOVE_OPTIONS = ['STATIC', 'PUSH', 'PULL', 'PAN', 'TILT', 'TRACK', 'CRANE', 'HANDHELD']
const EQUIP_OPTIONS = ['STICKS', 'GIMBAL', 'HANDHELD', 'DOLLY', 'JIB', 'SLIDER', 'DRONE']

const COLUMNS = [
  { key: 'size', label: 'SIZE', options: SIZE_OPTIONS },
  { key: 'type', label: 'TYPE', options: TYPE_OPTIONS },
  { key: 'move', label: 'MOVE', options: MOVE_OPTIONS },
  { key: 'equip', label: 'EQUIP', options: EQUIP_OPTIONS },
]

export default function SpecsTable({ shotId, specs, dropdownMode = true }) {
  const updateShotSpecs = useStore(s => s.updateShotSpecs)

  return (
    <table className="w-full border-collapse text-[10px] leading-tight">
      <thead>
        <tr>
          {COLUMNS.map(col => (
            <th
              key={col.key}
              className="font-bold text-center py-0.5 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 uppercase tracking-wide"
              style={{ width: '25%' }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {COLUMNS.map(col => (
            <td key={col.key} className="border border-gray-300 dark:border-gray-600 p-0">
              {dropdownMode ? (
                <select
                  className="w-full text-[10px] text-center bg-transparent dark:bg-transparent dark:text-gray-200 border-0 cursor-pointer py-0.5 px-0.5"
                  value={specs[col.key] || ''}
                  onChange={(e) => updateShotSpecs(shotId, col.key, e.target.value)}
                >
                  {col.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="w-full text-[10px] text-center bg-transparent dark:text-gray-200 border-0 outline-none py-0.5 px-1"
                  value={specs[col.key] || ''}
                  onChange={(e) => updateShotSpecs(shotId, col.key, e.target.value)}
                />
              )}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}
