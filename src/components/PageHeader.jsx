import React from 'react'
import useStore from '../store'

export default function PageHeader({ scene, isContinuation = false, pageNum = 1 }) {
  const updateScene = useStore(s => s.updateScene)

  const set = (updates) => updateScene(scene.id, updates)

  const cycleIntExt = () => {
    const next = { INT: 'EXT', EXT: 'INT/EXT', 'INT/EXT': 'INT' }
    set({ intOrExt: next[scene.intOrExt] || 'INT' })
  }

  return (
    <div className="page-header">
      {/* Left: Scene Label */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <input
            type="text"
            value={scene.sceneLabel}
            onChange={e => set({ sceneLabel: e.target.value })}
            className="text-2xl font-black tracking-tight bg-transparent border-none outline-none p-0"
            style={{ minWidth: 80, width: `${Math.max((scene.sceneLabel || '').length, 6)}ch` }}
            placeholder="SCENE 1"
          />
          <span className="text-2xl font-black">|</span>
          <input
            type="text"
            value={scene.location}
            onChange={e => set({ location: e.target.value })}
            className="text-2xl font-black tracking-tight bg-transparent border-none outline-none p-0"
            style={{ minWidth: 60, width: `${Math.max((scene.location || '').length, 4)}ch` }}
            placeholder="LOCATION"
          />
          <span className="text-2xl font-black">|</span>
          <button
            onClick={cycleIntExt}
            className="text-2xl font-black bg-transparent border-none outline-none cursor-pointer hover:opacity-70 p-0"
          >
            {scene.intOrExt}
          </button>
        </div>
        {isContinuation && (
          <div className="text-xs text-gray-400 font-semibold tracking-wide">
            (CONTINUED — PAGE {pageNum})
          </div>
        )}
      </div>

      {/* Center: Notes block */}
      <div className="text-xs leading-relaxed border-l border-r border-gray-200 px-4">
        <textarea
          value={scene.pageNotes}
          onChange={e => set({ pageNotes: e.target.value })}
          className="w-full border-none outline-none resize-none text-xs leading-relaxed bg-transparent font-sans"
          rows={3}
          placeholder="*NOTE: &#10;*SHOOT ORDER: "
          style={{ minHeight: 60 }}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
        />
      </div>

      {/* Right: Camera badge + SHOTLIST */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <div className="text-3xl font-black tracking-tight text-right">SHOTLIST</div>
        <div
          className="flex items-center justify-center gap-1 px-3 py-1 text-xs font-semibold"
          style={{ border: '2px solid #1a1a1a', whiteSpace: 'nowrap' }}
        >
          <input
            type="text"
            value={scene.cameraName}
            onChange={e => set({ cameraName: e.target.value })}
            className="bg-transparent border-none outline-none text-xs font-semibold text-center p-0"
            style={{ width: `${Math.max((scene.cameraName || '').length, 8)}ch` }}
            placeholder="Camera 1"
          />
          <span>=</span>
          <input
            type="text"
            value={scene.cameraBody}
            onChange={e => set({ cameraBody: e.target.value })}
            className="bg-transparent border-none outline-none text-xs font-semibold text-center p-0"
            style={{ width: `${Math.max((scene.cameraBody || '').length, 4)}ch` }}
            placeholder="fx30"
          />
        </div>
      </div>
    </div>
  )
}
