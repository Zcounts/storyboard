import React from 'react'
import useStore from '../store'

export default function ShotlistTab() {
  const scenes = useStore(s => s.scenes)
  const totalShots = scenes.reduce((acc, s) => acc + s.shots.length, 0)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: '12px',
        color: '#888',
        fontFamily: 'monospace',
        padding: '48px 24px',
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
      <p style={{ fontSize: '16px', fontWeight: 600, color: '#666', margin: 0 }}>
        Shotlist View — Coming Soon
      </p>
      <p style={{ fontSize: '13px', margin: 0 }}>
        {totalShots} shot{totalShots !== 1 ? 's' : ''} across {scenes.length} scene{scenes.length !== 1 ? 's' : ''} ready to display
      </p>
      <p style={{ fontSize: '12px', margin: 0, maxWidth: '360px', textAlign: 'center', lineHeight: 1.6 }}>
        AD fields (Script Time, Setup Time, Predicted Takes, Shoot Time, Take Number)
        are stored on each shot and will appear here.
      </p>
    </div>
  )
}
