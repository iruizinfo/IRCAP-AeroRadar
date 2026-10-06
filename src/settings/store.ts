// src/settings/store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  theme: 'dark' | 'light';
  soundEnabled: boolean;
  updateInterval: number;
  selectedProvider: string;
  setTheme: (theme: 'dark' | 'light') => void;
  setSoundEnabled: (enabled: boolean) => void;
  setUpdateInterval: (interval: number) => void;
  setSelectedProvider: (provider: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      soundEnabled: true,
      updateInterval: 5000,
      selectedProvider: 'fr24',
      setTheme: (theme) => set({ theme }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setUpdateInterval: (updateInterval) => set({ updateInterval }),
      setSelectedProvider: (selectedProvider) => set({ selectedProvider }),
    }),
    {
      name: 'ircap-aeroradar-settings-v1',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
