import { create } from 'zustand'

type ActiveView = 'shotlist' | 'scenes' | 'storyboard' | 'settings'

interface AppState {
  // Project
  projectName: string
  projectPath: string | null

  // UI State
  activeView: ActiveView
  sidebarCollapsed: boolean
  settingsPanelOpen: boolean

  // Actions
  setProjectName: (name: string) => void
  setActiveView: (view: ActiveView) => void
  toggleSidebar: () => void
  setSettingsPanelOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  projectName: 'Untitled Project',
  projectPath: null,
  activeView: 'shotlist',
  sidebarCollapsed: false,
  settingsPanelOpen: false,

  // Actions
  setProjectName: (name) => set({ projectName: name }),
  setActiveView: (view) => set({ activeView: view }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSettingsPanelOpen: (open) => set({ settingsPanelOpen: open }),
}))
