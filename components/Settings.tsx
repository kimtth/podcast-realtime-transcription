'use client'
import { useState } from 'react'
import { X, RotateCcw, Download, Upload, Trash2, Palette } from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Switch } from './ui/switch'
import { Badge } from './ui/badge'
import {
  getSettings,
  toggleTranscription,
  toggleAutoResume,
  updateAccentColor,
  updateButtonStyle,
  updateIconColor,
  updateTranscriptionEngine,
  updateSearchProvider,
  updatePodcastIndexCredentials,
  updateAzureSpeechCredentials,
  exportSettings,
  importSettings,
  resetSettings,
  clearListeningHistory,
  getListeningHistory,
} from '@/lib/appSettings'

interface SettingsProps {
  onClose: () => void
}

export default function Settings({ onClose }: SettingsProps) {
  const [settings, setSettings] = useState(getSettings())
  const [saved, setSaved] = useState(false)
  const listeningHistory = getListeningHistory(5)

  const handleTranscriptionToggle = (enabled: boolean) => {
    toggleTranscription(enabled)
    setSettings({ ...settings, enableTranscription: enabled })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleAutoResumeToggle = (enabled: boolean) => {
    toggleAutoResume(enabled)
    setSettings({ ...settings, autoResume: enabled })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleExportSettings = () => {
    const json = exportSettings()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `podcast-settings-${new Date().toISOString().split('T')[0]}.json`
    a.click()
  }

  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        if (importSettings(reader.result as string)) {
          setSettings(getSettings())
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        }
      }
      reader.readAsText(file)
    }
  }

  const handleReset = () => {
    if (confirm('Reset all settings to default? This cannot be undone.')) {
      resetSettings()
      setSettings(getSettings())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleClearHistory = () => {
    if (confirm('Clear all listening history? This cannot be undone.')) {
      clearListeningHistory()
      setSettings(getSettings())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">App Settings</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {saved && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              ✓ Settings saved successfully
            </div>
          )}

          {/* Transcription Settings */}
          <div className="space-y-6">
            <div className="border-b border-border pb-6">
              <h3 className="font-semibold text-lg mb-4 text-foreground">Transcription</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-foreground">
                      Enable Live Transcription
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatically transcribe episodes as they play
                    </p>
                  </div>
                  <Switch
                    checked={settings.enableTranscription}
                    onCheckedChange={handleTranscriptionToggle}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Transcription Engine
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => {
                        updateTranscriptionEngine('azure')
                        setSettings({ ...settings, transcriptionEngine: 'azure' })
                        setSaved(true)
                        setTimeout(() => setSaved(false), 2000)
                      }}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        settings.transcriptionEngine === 'azure'
                          ? 'border-foreground bg-blue-50'
                          : 'border-border opacity-50 hover:opacity-75'
                      }`}
                    >
                      <div className="font-medium text-sm">☁️ Azure AI Speech</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Cloud-based • High accuracy • Paid • Multilingual
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        updateTranscriptionEngine('fasterwhisper')
                        setSettings({ ...settings, transcriptionEngine: 'fasterwhisper' })
                        setSaved(true)
                        setTimeout(() => setSaved(false), 2000)
                      }}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        settings.transcriptionEngine === 'fasterwhisper'
                          ? 'border-foreground bg-purple-50'
                          : 'border-border opacity-50 hover:opacity-75'
                      }`}
                    >
                      <div className="font-medium text-sm">⚡ Faster-Whisper (GPU)</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Local server • GPU-accelerated • Free • Self-hosted
                      </div>
                    </button>
                  </div>
                </div>

                {settings.transcriptionEngine === 'azure' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-700">
                        <strong>Azure AI Speech (Fast Transcription):</strong> Cloud-based speech recognition using Azure's fast transcription API for synchronous results. Requires API credentials from Azure Cognitive Services (paid, but has free tier).
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Subscription Key</label>
                      <Input
                        type="password"
                        value={settings.azureSpeechKey || ''}
                        onChange={(e) => {
                          const updated = { ...settings, azureSpeechKey: e.target.value }
                          setSettings(updated)
                          updateAzureSpeechCredentials(e.target.value, updated.azureSpeechEndpoint || 'https://eastus.api.cognitive.microsoft.com')
                          setSaved(true)
                          setTimeout(() => setSaved(false), 2000)
                        }}
                        placeholder="Enter your Azure Speech subscription key"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Endpoint</label>
                      <Input
                        type="text"
                        value={settings.azureSpeechEndpoint || 'https://eastus.api.cognitive.microsoft.com'}
                        onChange={(e) => {
                          const updated = { ...settings, azureSpeechEndpoint: e.target.value }
                          setSettings(updated)
                          updateAzureSpeechCredentials(updated.azureSpeechKey || '', e.target.value)
                          setSaved(true)
                          setTimeout(() => setSaved(false), 2000)
                        }}
                        placeholder="e.g., https://eastus.api.cognitive.microsoft.com"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get your endpoint at <a href="https://portal.azure.com" target="_blank" rel="noopener" className="underline">Azure Portal</a> → Cognitive Services → Speech. Format: <code className="bg-gray-100 px-1 rounded">https://REGION.api.cognitive.microsoft.com</code>
                    </p>
                  </div>
                )}

                {settings.transcriptionEngine === 'fasterwhisper' && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-xs text-purple-700">
                      <strong>Faster-Whisper:</strong> GPU-accelerated transcription running on your own server. Download Docker container, configure server URL, and transcribe locally with high accuracy. Requires Docker and GPU for optimal performance.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Search Settings */}
            <div className="border-b border-border pb-6">
              <h3 className="font-semibold text-lg mb-4 text-foreground">Search</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Search Provider</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => {
                        updateSearchProvider('itunes')
                        setSettings({ ...settings, searchProvider: 'itunes' })
                        setSaved(true)
                        setTimeout(() => setSaved(false), 2000)
                      }}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        settings.searchProvider === 'itunes'
                          ? 'border-foreground bg-blue-50'
                          : 'border-border opacity-50 hover:opacity-75'
                      }`}
                    >
                      <div className="font-medium text-sm">iTunes (default)</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Free, no credentials needed
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        updateSearchProvider('podcastindex')
                        setSettings({ ...settings, searchProvider: 'podcastindex' })
                        setSaved(true)
                        setTimeout(() => setSaved(false), 2000)
                      }}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        settings.searchProvider === 'podcastindex'
                          ? 'border-foreground bg-purple-50'
                          : 'border-border opacity-50 hover:opacity-75'
                      }`}
                    >
                      <div className="font-medium text-sm">Podcast Index</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Requires your API key & secret (stored locally)
                      </div>
                    </button>
                  </div>
                </div>

                {settings.searchProvider === 'podcastindex' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">API Key</label>
                      <Input
                        type="text"
                        value={settings.podcastIndexKey || ''}
                        onChange={(e) => {
                          const updated = { ...settings, podcastIndexKey: e.target.value }
                          setSettings(updated)
                          updatePodcastIndexCredentials(e.target.value, updated.podcastIndexSecret || '')
                          setSaved(true)
                          setTimeout(() => setSaved(false), 2000)
                        }}
                        placeholder="Enter your Podcast Index API key"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">API Secret</label>
                      <Input
                        type="password"
                        value={settings.podcastIndexSecret || ''}
                        onChange={(e) => {
                          const updated = { ...settings, podcastIndexSecret: e.target.value }
                          setSettings(updated)
                          updatePodcastIndexCredentials(updated.podcastIndexKey || '', e.target.value)
                          setSaved(true)
                          setTimeout(() => setSaved(false), 2000)
                        }}
                        placeholder="Enter your Podcast Index API secret"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Keys are stored locally in your browser and sent only to Podcast Index via the search API.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Playback Settings */}
            <div className="border-b border-border pb-6">
              <h3 className="font-semibold text-lg mb-4 text-foreground">Playback</h3>
              
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <label className="text-sm font-medium text-foreground">
                    Auto-Resume Playback
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically resume the last played episode and position
                  </p>
                </div>
                <Switch
                  checked={settings.autoResume}
                  onCheckedChange={handleAutoResumeToggle}
                />
              </div>
            </div>

            {/* Appearance Settings */}
            <div className="border-b border-border pb-6">
              <h3 className="font-semibold text-lg mb-4 text-foreground flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Appearance
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Accent Color
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['purple', 'blue', 'green', 'red', 'orange', 'pink', 'indigo', 'cyan'] as const).map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          updateAccentColor(color)
                          setSettings({ ...settings, accentColor: color })
                          setSaved(true)
                          setTimeout(() => setSaved(false), 2000)
                        }}
                        className={`p-3 rounded-lg border-2 transition-all capitalize text-sm font-medium ${
                          settings.accentColor === color
                            ? 'border-foreground'
                            : 'border-border opacity-50 hover:opacity-75'
                        }`}
                        style={{
                          backgroundColor:
                            color === 'purple'
                              ? '#a855f7'
                              : color === 'blue'
                                ? '#3b82f6'
                                : color === 'green'
                                  ? '#10b981'
                                  : color === 'red'
                                    ? '#ef4444'
                                    : color === 'orange'
                                      ? '#f97316'
                                      : color === 'pink'
                                        ? '#ec4899'
                                        : color === 'indigo'
                                          ? '#6366f1'
                                          : '#06b6d4',
                          color: 'white',
                        }}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Button Style
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['solid', 'outline', 'ghost'] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => {
                          updateButtonStyle(style)
                          setSettings({ ...settings, buttonStyle: style })
                          setSaved(true)
                          setTimeout(() => setSaved(false), 2000)
                        }}
                        className={`p-3 rounded-lg border-2 transition-all capitalize text-sm font-medium ${
                          settings.buttonStyle === style
                            ? 'border-foreground bg-primary text-primary-foreground'
                            : 'border-border opacity-50 hover:opacity-75'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Icon Color
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['primary', 'muted', 'accent'] as const).map((iconColor) => (
                      <button
                        key={iconColor}
                        onClick={() => {
                          updateIconColor(iconColor)
                          setSettings({ ...settings, iconColor })
                          setSaved(true)
                          setTimeout(() => setSaved(false), 2000)
                        }}
                        className={`p-3 rounded-lg border-2 transition-all capitalize text-sm font-medium ${
                          settings.iconColor === iconColor
                            ? 'border-foreground'
                            : 'border-border opacity-50 hover:opacity-75'
                        }`}
                      >
                        {iconColor}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Listening History */}
            {listeningHistory.length > 0 && (
              <div className="border-b border-border pb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg text-foreground">
                    Listening History ({listeningHistory.length})
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearHistory}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="space-y-2">
                  {listeningHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-muted/50 rounded text-sm text-muted-foreground"
                    >
                      Episode {item.episodeId} - Last played{' '}
                      {new Date(item.lastPlayedAt).toLocaleDateString()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Management */}
            <div className="border-b border-border pb-6">
              <h3 className="font-semibold text-lg mb-4 text-foreground">Data Management</h3>
              
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleExportSettings}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Settings as JSON
                </Button>
                <label className="block">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    asChild
                  >
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Settings from JSON
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportSettings}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Danger Zone */}
            <div>
              <h3 className="font-semibold text-lg mb-4 text-foreground">Danger Zone</h3>
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={handleReset}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset All Settings to Default
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This will reset all preferences but keep your subscriptions and downloads
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-border">
            <Button
              className="w-full"
              onClick={onClose}
            >
              Close Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
