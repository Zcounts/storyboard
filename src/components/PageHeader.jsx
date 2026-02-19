import React, { useRef } from 'react'
import useStore from '../store'

export default function PageHeader() {
  const sceneLabel = useStore(s => s.sceneLabel)
  const location = useStore(s => s.location)
  const intOrExt = useStore(s => s.intOrExt)
  const cameraName = useStore(s => s.cameraName)
  const cameraBody = useStore(s => s.cameraBody)
  const pageNotes = useStore(s => s.pageNotes)
  const setSceneLabel = useStore(s => s.setSceneLabel)
  const setLocation = useStore(s => s.setLocation)
  const setIntOrExt = useStore(s => s.setIntOrExt)
  const setCameraName = useStore(s => s.setCameraName)
  const setCameraBody = useStore(s => s.setCameraBody)
  const setPageNotes = useStore(s => s.setPageNotes)

  return (
    <div className="page-header">
      {/* Left: Scene Label */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <input
            type="text"
            value={sceneLabel}
            onChange={e => setSceneLabel(e.target.value)}
            className="text-2xl font-black tracking-tight bg-transparent border-none outline-none p-0"
            style={{ minWidth: 80, width: `${Math.max(sceneLabel.length, 6)}ch` }}
            placeholder="SCENE 1"
          />
          <span className="text-2xl font-black">|</span>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="text-2xl font-black tracking-tight bg-transparent border-none outline-none p-0"
            style={{ minWidth: 60, width: `${Math.max(location.length, 4)}ch` }}
            placeholder="LOCATION"
          />
          <span className="text-2xl font-black">|</span>
          <button
            onClick={() => setIntOrExt(intOrExt === 'INT' ? 'EXT' : intOrExt === 'EXT' ? 'INT/EXT' : 'INT')}
            className="text-2xl font-black bg-transparent border-none outline-none cursor-pointer hover:opacity-70 p-0"
          >
            {intOrExt}
          </button>
        </div>
      </div>

      {/* Center: Notes block */}
      <div className="text-xs leading-relaxed border-l border-r border-gray-200 px-4">
        <textarea
          value={pageNotes}
          onChange={e => setPageNotes(e.target.value)}
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
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <div className="text-3xl font-black tracking-tight text-right">SHOTLIST</div>
        <div className="border-2 border-black px-3 py-1 text-xs font-semibold text-center whitespace-nowrap">
          <input
            type="text"
            value={cameraName}
            onChange={e => setCameraName(e.target.value)}
            className="bg-transparent border-none outline-none text-xs font-semibold text-center p-0"
            style={{ width: `${Math.max(cameraName.length, 8)}ch` }}
            placeholder="Camera 1"
          />
          <span className="mx-1">=</span>
          <input
            type="text"
            value={cameraBody}
            onChange={e => setCameraBody(e.target.value)}
            className="bg-transparent border-none outline-none text-xs font-semibold text-center p-0"
            style={{ width: `${Math.max(cameraBody.length, 4)}ch` }}
            placeholder="fx30"
          />
        </div>
      </div>
    </div>
  )
}
