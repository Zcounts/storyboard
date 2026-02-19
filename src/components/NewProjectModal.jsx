import { useState, useEffect, useRef } from 'react'
import useStore from '../store/useStore'

export default function NewProjectModal() {
  const newProject = useStore(s => s.newProject)
  const setShowNewProjectModal = useStore(s => s.setShowNewProjectModal)

  const [sceneName, setSceneName] = useState('Scene 1')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (sceneName.trim()) {
      newProject(sceneName.trim())
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowNewProjectModal(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => setShowNewProjectModal(false)}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 className="text-lg font-bold dark:text-gray-100 mb-1">New Project</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Enter a scene name to start your shotlist.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">
            Scene Name
          </label>
          <input
            ref={inputRef}
            type="text"
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-gray-100 outline-none focus:border-blue-500 dark:focus:border-blue-400 mb-4"
            value={sceneName}
            onChange={(e) => setSceneName(e.target.value)}
            placeholder="Scene 1"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={() => setShowNewProjectModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-bold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
