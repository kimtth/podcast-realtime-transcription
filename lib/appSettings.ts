// App settings and preferences management

export interface AppSettings {
  enableTranscription: boolean
  autoResume: boolean
  transcriptionEngine: 'azure' | 'fasterwhisper'
  azureSpeechKey?: string
  azureSpeechEndpoint?: string
  searchProvider: 'itunes' | 'podcastindex'
  podcastIndexKey?: string
  podcastIndexSecret?: string
  listeningHistory: {
    episodeId: number | string
    podcastId: number
    lastPosition: number
    lastPlayedAt: number
  }[]
  maxHistoryItems: number
  // Color preferences
  accentColor: 'purple' | 'blue' | 'green' | 'red' | 'orange' | 'pink' | 'indigo' | 'cyan'
  buttonStyle: 'solid' | 'outline' | 'ghost'
  iconColor: 'primary' | 'muted' | 'accent'
}

const SETTINGS_KEY = 'podcast_app_settings'

const DEFAULT_SETTINGS: AppSettings = {
  enableTranscription: true,
  autoResume: true,
  transcriptionEngine: 'azure',
  azureSpeechKey: '',
  azureSpeechEndpoint: 'https://eastus.api.cognitive.microsoft.com/',
  searchProvider: 'itunes',
  podcastIndexKey: '',
  podcastIndexSecret: '',
  listeningHistory: [],
  maxHistoryItems: 50,
  accentColor: 'purple',
  buttonStyle: 'solid',
  iconColor: 'primary',
}

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const data = localStorage.getItem(SETTINGS_KEY)
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Partial<AppSettings>): void {
  if (typeof window === 'undefined') return
  const current = getSettings()
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }))
}

export function toggleTranscription(enabled: boolean): void {
  saveSettings({ enableTranscription: enabled })
}

export function toggleAutoResume(enabled: boolean): void {
  saveSettings({ autoResume: enabled })
}

export function updateAccentColor(color: 'blue' | 'purple' | 'green' | 'red' | 'orange' | 'pink' | 'indigo' | 'cyan'): void {
  saveSettings({ accentColor: color })
}

export function updateButtonStyle(style: 'solid' | 'outline' | 'ghost'): void {
  saveSettings({ buttonStyle: style })
}

export function updateIconColor(color: 'primary' | 'muted' | 'accent'): void {
  saveSettings({ iconColor: color })
}

export function updateTranscriptionEngine(engine: 'azure' | 'fasterwhisper'): void {
  saveSettings({ transcriptionEngine: engine })
}

export function updateSearchProvider(provider: 'itunes' | 'podcastindex'): void {
  saveSettings({ searchProvider: provider })
}

export function updatePodcastIndexCredentials(key: string, secret: string): void {
  saveSettings({ podcastIndexKey: key, podcastIndexSecret: secret })
}

export function updateAzureSpeechCredentials(key: string, endpoint: string): void {
  saveSettings({ azureSpeechKey: key, azureSpeechEndpoint: endpoint })
}

// Listening history
export function addToListeningHistory(episodeId: number | string, podcastId: number, lastPosition: number): void {
  const settings = getSettings()
  const updated = {
    episodeId,
    podcastId,
    lastPosition,
    lastPlayedAt: Date.now(),
  }
  
  // Remove if already exists, then add to top
  const filtered = settings.listeningHistory.filter(item => item.episodeId !== episodeId)
  const newHistory = [updated, ...filtered].slice(0, settings.maxHistoryItems)
  
  saveSettings({ listeningHistory: newHistory })
}

export function getLastPlayedEpisode(): { episodeId: number | string; podcastId: number; lastPosition: number } | null {
  const settings = getSettings()
  return settings.listeningHistory[0] || null
}

export function getListeningHistory(limit = 10) {
  const settings = getSettings()
  return settings.listeningHistory.slice(0, limit)
}

export function clearListeningHistory(): void {
  saveSettings({ listeningHistory: [] })
}

// Settings export/import
export function exportSettings(): string {
  const settings = getSettings()
  
  // Create export data excluding listening history (sensitive, device-specific)
  const exportData: Partial<AppSettings> = {
    enableTranscription: settings.enableTranscription,
    autoResume: settings.autoResume,
    transcriptionEngine: settings.transcriptionEngine,
    azureSpeechKey: settings.azureSpeechKey || '',
    azureSpeechEndpoint: settings.azureSpeechEndpoint || '',
    searchProvider: settings.searchProvider,
    podcastIndexKey: settings.podcastIndexKey || '',
    podcastIndexSecret: settings.podcastIndexSecret || '',
    maxHistoryItems: settings.maxHistoryItems,
    accentColor: settings.accentColor,
    buttonStyle: settings.buttonStyle,
    iconColor: settings.iconColor,
  }
  
  return JSON.stringify(exportData, null, 2)
}

export function importSettings(json: string): boolean {
  try {
    const parsed = JSON.parse(json)
    // Remove any deprecated properties during import (transcribeMode, localWhisperUrl, etc.)
    const { transcribeMode, localWhisperUrl, fasterWhisperUrl, listeningHistory, ...cleanSettings } = parsed
    saveSettings(cleanSettings)
    return true
  } catch {
    return false
  }
}

export function resetSettings(): void {
  localStorage.removeItem(SETTINGS_KEY)
}
