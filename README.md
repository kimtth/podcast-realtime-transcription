# Podcast Player

Lean podcast player with multi-engine transcription and switchable search providers.

## What it does
- Play, subscribe, download, and resume podcasts
- Live transcripts: ☁️ Azure Speech, ⚡ Faster-Whisper
- Choose search source: iTunes (no auth) or Podcast Index (user key/secret)

## Run it
```bash
npm install
npm run dev
# open http://localhost:3000
# Optional (Faster-Whisper):
# cd infra && uv sync && uv run faster_whisper_server.py
```

## Screen

<img src="./docs/main.png" width="400px" />

## Search sources
- **iTunes (default):** free, no credentials
- **Podcast Index:** add your key + secret in Settings → Search

## Transcription engines
- **Azure Speech:** cloud accuracy, needs your Azure key/region (saved locally)
- **Faster-Whisper:** self-hosted FastAPI server (python) then set URL in Settings

## Privacy
- API keys and server URLs live in your browser storage only. (no .env file)
- Azure sends to Microsoft; Faster-Whisper stays local.

## Deploy
- See [AGENTS.md](AGENTS.md#deployment-to-azure) for cloud deployment options.  
- Deployment in Azure Container Apps vs Azure Container Instances vs Azure Kubernetes Service vs Azure App Service.
