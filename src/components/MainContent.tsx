import React from 'react'
import { useAppStore } from '../store/appStore'

function PlaceholderView({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: '#2a2a2a' }}
      >
        <svg width="28" height="28" viewBox="0 0 16 16" fill="#4f8ef7">
          <path d="M4 .5a.5.5 0 0 0-1 0V1H2a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-1V.5a.5.5 0 0 0-1 0V1H4V.5zm-2 3.5H14v1H2V4zm0 2h12v8H2V6z"/>
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">{title}</h2>
      <p className="text-sm text-text-secondary max-w-sm">{description}</p>
    </div>
  )
}

const viewConfig: Record<string, { title: string; description: string }> = {
  shotlist: {
    title: 'Shot List',
    description: 'Your shot list will appear here. Add scenes and shots to get started.',
  },
  scenes: {
    title: 'Scenes',
    description: 'Manage your scenes and their properties here.',
  },
  storyboard: {
    title: 'Storyboard',
    description: 'Visual storyboard view for your project.',
  },
  settings: {
    title: 'Project Settings',
    description: 'Configure your project name, production details, and formatting preferences.',
  },
}

export function MainContent() {
  const { activeView, projectName } = useAppStore()
  const config = viewConfig[activeView]

  return (
    <main className="flex-1 flex flex-col min-w-0 min-h-0" style={{ background: '#1a1a1a' }}>
      {/* Content header */}
      <div
        className="flex items-center justify-between px-6 border-b border-border shrink-0"
        style={{ height: 48, background: '#212121' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-text-primary">{config.title}</h1>
          <span className="text-xs text-text-muted px-2 py-0.5 rounded" style={{ background: '#2a2a2a' }}>
            {projectName}
          </span>
        </div>
        {activeView === 'shotlist' && (
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors"
              style={{ background: '#4f8ef7', color: '#fff' }}
              onClick={() => {}}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
              </svg>
              Add Shot
            </button>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto p-6">
        <PlaceholderView title={config.title} description={config.description} />
      </div>
    </main>
  )
}
