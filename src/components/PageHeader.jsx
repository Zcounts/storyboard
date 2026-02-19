import useStore from '../store/useStore'

export default function PageHeader({ pageNum, totalPages }) {
  const settings = useStore(s => s.settings)
  const updateSettings = useStore(s => s.updateSettings)

  const sceneLabel = `${settings.sceneName.toUpperCase()} | ${settings.location.toUpperCase()} | ${settings.intExt}`

  return (
    <div
      className="flex items-stretch border border-gray-300 dark:border-gray-600 mb-2"
      style={{ minHeight: 64 }}
    >
      {/* Left: Scene Label */}
      <div className="flex-1 flex items-center px-3 py-2 border-r border-gray-300 dark:border-gray-600">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-widest mb-0.5">Scene</div>
          <div className="text-lg font-extrabold leading-tight dark:text-gray-100 tracking-tight">
            {sceneLabel}
          </div>
        </div>
      </div>

      {/* Center: Notes block */}
      <div className="flex-1 flex flex-col justify-center px-3 py-1 border-r border-gray-300 dark:border-gray-600">
        <div className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">
          *NOTE &amp; *SHOOT ORDER
        </div>
        <textarea
          className="w-full text-[11px] bg-transparent dark:text-gray-200 border-0 outline-none resize-none leading-relaxed placeholder-gray-300 dark:placeholder-gray-600"
          rows={2}
          placeholder="Director / AD notes..."
          value={settings.pageNotes || ''}
          onChange={(e) => updateSettings({ pageNotes: e.target.value })}
        />
      </div>

      {/* Right: Camera + Shotlist title */}
      <div className="flex flex-col items-end justify-between px-3 py-2" style={{ minWidth: 180 }}>
        <div className="text-right">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
            {settings.cameraName} = {settings.cameraBody}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tracking-widest dark:text-gray-100">SHOTLIST</div>
          <div className="text-[10px] text-gray-400 dark:text-gray-500">
            Page {pageNum} of {totalPages}
          </div>
        </div>
      </div>
    </div>
  )
}
