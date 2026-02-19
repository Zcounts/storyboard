import useStore from '../store/useStore'

const FOCAL_LENGTHS = ['24mm', '28mm', '35mm', '50mm', '85mm', '100mm', '135mm', '200mm']

function SettingRow({ label, children }) {
  return (
    <div className="mb-3">
      <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

function ToggleButton({ value, options, onChange }) {
  return (
    <div className="flex rounded overflow-hidden border border-gray-200 dark:border-gray-600">
      {options.map(opt => (
        <button
          key={opt}
          className={`flex-1 py-1 text-xs font-bold tracking-wide transition-colors ${
            value === opt
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
              : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
          }`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export default function Sidebar({ onSave, onOpenFile, onNewProject, lastAutoSaved, isDirty, sizeWarning }) {
  const settings = useStore(s => s.settings)
  const updateSettings = useStore(s => s.updateSettings)
  const toggleTheme = useStore(s => s.toggleTheme)
  const currentProjectPath = useStore(s => s.currentProjectPath)
  const setShowHomeScreen = useStore(s => s.setShowHomeScreen)
  const setShowNewProjectModal = useStore(s => s.setShowNewProjectModal)

  const formatAutoSaved = (ts) => {
    if (!ts) return null
    try {
      return new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' }).format(new Date(ts))
    } catch {
      return null
    }
  }

  return (
    <aside className="flex flex-col h-full bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] overflow-hidden" style={{ width: 220 }}>
      {/* App title */}
      <div className="px-4 py-4 border-b border-[var(--border-color)]">
        <div className="text-base font-black tracking-widest dark:text-gray-100">SHOTLIST</div>
        <div className="text-[9px] text-gray-400 dark:text-gray-500 tracking-widest uppercase mt-0.5">
          Film Storyboard
        </div>
      </div>

      {/* File Actions */}
      <div className="px-3 py-3 border-b border-[var(--border-color)] flex flex-col gap-1.5">
        <button
          className="w-full py-1.5 px-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold rounded hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors tracking-wide text-left"
          onClick={onNewProject}
        >
          + New Project
        </button>
        <button
          className="w-full py-1.5 px-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
          onClick={onOpenFile}
        >
          Open...
        </button>
        <button
          className={`w-full py-1.5 px-3 text-xs font-semibold rounded transition-colors text-left ${
            isDirty
              ? 'border-2 border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
              : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          onClick={onSave}
        >
          {isDirty ? 'Save*' : 'Save'}
          {currentProjectPath && (
            <span className="block text-[9px] text-gray-400 dark:text-gray-500 font-normal truncate">
              {currentProjectPath.split(/[\\/]/).pop()}
            </span>
          )}
        </button>
        <button
          className="w-full py-1.5 px-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
          onClick={() => setShowHomeScreen(true)}
        >
          Home
        </button>
      </div>

      {/* Auto-save indicator */}
      <div className="px-4 py-2 border-b border-[var(--border-color)]">
        {lastAutoSaved ? (
          <div className="text-[9px] text-gray-400 dark:text-gray-500">
            Auto-saved at {formatAutoSaved(lastAutoSaved)}
          </div>
        ) : (
          <div className="text-[9px] text-gray-300 dark:text-gray-600">Auto-save: every 60s</div>
        )}
      </div>

      {/* Size warning */}
      {sizeWarning && (
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700">
          <div className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold">
            ⚠ Project file exceeds 50MB. Consider removing large images.
          </div>
        </div>
      )}

      {/* Settings Panel */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
          Document Settings
        </div>

        <SettingRow label="Scene Name">
          <TextInput
            value={settings.sceneName}
            onChange={(v) => updateSettings({ sceneName: v, sceneNumber: parseInt(v.match(/\d+/)?.[0]) || 1 })}
            placeholder="Scene 1"
          />
        </SettingRow>

        <SettingRow label="Location">
          <TextInput
            value={settings.location}
            onChange={(v) => updateSettings({ location: v })}
            placeholder="CLUB"
          />
        </SettingRow>

        <SettingRow label="INT / EXT">
          <ToggleButton
            value={settings.intExt}
            options={['INT', 'EXT', 'INT/EXT']}
            onChange={(v) => updateSettings({ intExt: v })}
          />
        </SettingRow>

        <SettingRow label="Camera Name">
          <TextInput
            value={settings.cameraName}
            onChange={(v) => updateSettings({ cameraName: v })}
            placeholder="Camera 1"
          />
        </SettingRow>

        <SettingRow label="Camera Body">
          <TextInput
            value={settings.cameraBody}
            onChange={(v) => updateSettings({ cameraBody: v })}
            placeholder="fx30"
          />
        </SettingRow>

        <SettingRow label="Default Focal Length">
          <select
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-gray-200 outline-none focus:border-blue-400"
            value={settings.defaultFocalLength}
            onChange={(e) => updateSettings({ defaultFocalLength: e.target.value })}
          >
            {FOCAL_LENGTHS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
            <option value={settings.defaultFocalLength}>{settings.defaultFocalLength}</option>
          </select>
        </SettingRow>

        <SettingRow label="Columns">
          <ToggleButton
            value={String(settings.columnCount)}
            options={['2', '3', '4']}
            onChange={(v) => updateSettings({ columnCount: parseInt(v) })}
          />
        </SettingRow>

        <SettingRow label="Specs Input">
          <ToggleButton
            value={settings.dropdownMode ? 'Dropdown' : 'Text'}
            options={['Dropdown', 'Text']}
            onChange={(v) => updateSettings({ dropdownMode: v === 'Dropdown' })}
          />
        </SettingRow>

        <SettingRow label="Theme">
          <ToggleButton
            value={settings.theme === 'light' ? 'Light' : 'Dark'}
            options={['Light', 'Dark']}
            onChange={(v) => updateSettings({ theme: v.toLowerCase() })}
          />
        </SettingRow>
      </div>
    </aside>
  )
}
