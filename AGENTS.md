# Agents & System Notes

## Architecture

```mermaid
graph TB
  Browser["Browser (Next.js 15)"]
  Settings["Settings UI<br/>localStorage"]
  Search["Search API"]
  Episodes["Episodes API"]
  Transcriber["Transcriber Component"]
  Learning["Language Learning<br/>Extract Expressions"]
  
  Browser --> Settings
  Browser --> Search
  Browser --> Episodes
  Browser --> Transcriber
  Browser --> Learning
  
  Search -->|Provider| iTunes["iTunes API<br/>No Auth"]
  Search -->|Provider| PodIndex["Podcast Index<br/>Auth"]
  
  Transcriber -->|Engine| AzureSpeech["Azure Speech<br/>REST API"]
  Transcriber -->|Engine| FastWS["Faster-Whisper<br/>FastAPI"]
  
  Learning -->|Provider| OpenAI["OpenAI API"]
  Learning -->|Provider| AzureOpenAI["Azure OpenAI<br/>REST API"]
  
  FastWS --> GPU["GPU: CUDA 12.1<br/>PyTorch 2.3.1"]
  FastWS --> CPU["CPU: PyTorch 2.3.1"]
  
  Settings -->|Credentials| Store["Browser Storage<br/>Never disk/env"]
```

## Audio Transcription Flow (Bypassing Next.js Size Limits)

**Problem**: Next.js Server Actions have a 1MB default body size limit, podcast episodes are 50-500MB

**Solution**: Stream audio directly through Next.js API routes (not Server Actions) to transcription services

```mermaid
sequenceDiagram
    participant Browser
    participant NextJS as Next.js API<br/>(Port 3000)
    participant FastAPI as FastAPI Server<br/>(Port 8000, internal)
    participant CDN as Podcast CDN
    
    Browser->>NextJS: POST /api/proxy-transcribe?url=podcast.mp3&server=localhost:8000
    NextJS->>CDN: Download audio file
    CDN-->>NextJS: Audio stream (50-500MB)
    NextJS->>FastAPI: POST /transcribe with FormData
    FastAPI-->>NextJS: Transcription result (segments)
    NextJS-->>Browser: JSON response
```

**Key Points**:
- **Port 3000** (Next.js): Exposed publicly in Azure Container Apps/ACI/App Service/AKS
- **Port 8000** (FastAPI): Internal only, accessible via `localhost:8000` within container
- Audio never touches Next.js Server Actions (no size limit)
- Works for both Azure deployments and local development

## Transcription Engines Comparison

| Feature | Azure Speech | Faster-Whisper |
|---------|-------------|----------------|
| **Latency** | ~1-3s | 5-15s (GPU), 30-60s (CPU) |
| **Accuracy** | ✓✓ Excellent | ✓✓ Excellent |
| **Cost** | $$ (pay-per-minute) | Free (local) |
| **Privacy** | Cloud | On-machine |
| **Dependencies** | Network + API key | Docker + GPU optional |
| **Multi-language** | ✓✓ Excellent | ✓✓ Excellent |
| **Best for** | Production + accuracy | Privacy + accuracy |

## Search Providers Comparison

| Aspect | iTunes | Podcast Index |
|--------|--------|---------------|
| **Authentication** | None | API Key + Secret (SHA1) |
| **Storage** | N/A | localStorage (browser only) |
| **Coverage** | ~2M podcasts | ~3M podcasts + metadata |
| **Rate Limit** | Generous (~200/min) | Pro: unlimited |
| **Setup** | Zero config | User-configured in Settings |

## Request Flow: Search with Podcast Index

```
1. User enters query + credentials in Settings
   ↓ Stored in browser localStorage
   ↓
2. Frontend: /api/search?q=term
   Headers: x-podcastindex-key, x-podcastindex-secret
   ↓
3. Backend: Validates headers, computes HMAC-SHA1(key+secret+timestamp)
   ↓
4. Calls Podcast Index API with auth header
   ↓
5. Returns normalized feed objects (id, title, author, image, url)
```

## Privacy & Data Flow

- **Azure Speech**: Audio → Microsoft cloud, transcripts returned locally, credentials never disk-stored
- **Faster-Whisper**: Audio → your GPU/CPU, transcripts local, zero cloud calls
- **Search Keys**: Browser localStorage only (JSON stringify), never sent to app server
- **Podcast Index Auth**: via headers, keys sent only to Podcast Index
- **Language Learning**: Credentials stored in browser, sent directly to OpenAI/Azure OpenAI, never routed through app server

## Frontend Stack

- **Framework**: Next.js 15.5.7 + React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **APIs**:  Azure Speech (REST), Faster-Whisper (FastAPI)
- **State**: React hooks + localStorage
- **UI Components**: Button, Card, Input, Switch, Tabs, Badge, Slider, Skeleton, ScrollArea

## Development

**No environment files (.env) needed**:
- Podcast Index credentials → User enters in Settings UI
- Azure Speech credentials → User enters in Settings UI
- OpenAI/Azure OpenAI credentials → User enters in Settings UI (Language Learning)
- All credentials stored in browser (localStorage), sent via request headers or form data
- Docker: `docker-compose -f docker-compose.gpu.yml up` or `.cpu.yml`

**Model cache**: `/root/.cache/huggingface/hub` (mounted in Docker)

## Deployment to Azure

| Option | Use Case | GPU | Setup |
|--------|----------|-----|-------|
| **Container App** | MVP, Production | Optional | `infra/container-app/deploy.ps1` |
| **ACI** | Testing | ✗ (GPU retired July 2025) | `infra/aci/deploy.ps1` |
| **App Service** | CPU Production | ✗ | `infra/app-service/deploy.ps1` |
| **AKS** | Enterprise Scale | ✓ | `infra/aks/deploy.ps1` |

ACI: Azure Container Instances  
AKS: Azure Kubernetes Service

### Shared Resources (all deployments use)
- **Azure Container Registry** - Hosts CPU & GPU images
- **Azure Speech Service** - S0 tier for transcription
- **Log Analytics** (optional) - for monitoring and diagnostics

### Setup & Deployment (PowerShell)

**1. Setup shared resources (ACR + Speech Service)**
```powershell
./infra/setup.ps1 -ResourceGroup <rg> -Location <location> -AcrName <acr-name> -SpeechName <speech-name> [-BuildImages]
```
- Creates resource group, deploys ACR and Speech Service via Bicep
- Optional `-BuildImages` builds and pushes Docker images
- Example: `./infra/setup.ps1 -ResourceGroup podcast-ack -Location eastus -AcrName podcastack -SpeechName podcast-speech-ack -BuildImages`

**2. Deploy to compute platform (pick one)**
```powershell
# Container Apps (MVP, optional GPU via image)
./infra/container-app/deploy.ps1 -ResourceGroup <rg> -Location <location> -AcrName <acr-name> -ImageType cpu

# Azure Container Instances (CPU-only, GPU retired July 2025)
./infra/aci/deploy.ps1 -ResourceGroup <rg> -Location <location> -AcrName <acr-name>

# App Service (CPU production)
./infra/app-service/deploy.ps1 -ResourceGroup <rg> -Location <location> -AppName <app-name> -AcrName <acr-name>

# Azure Kubernetes Service (enterprise scale, GPU capable)
./infra/aks/deploy.ps1 -ResourceGroup <rg> -Location <location> -ClusterName <cluster-name> -AcrName <acr-name>
```

**3. Test all deployments**
```powershell
./test-all-deploy.ps1 -ResourceGroup <rg> -Location <location> -AcrName <acr-name> -SpeechName <speech-name> [-BuildImages] -Target container-app|aci|app-service|aks|all
```
- Runs setup and deploys to selected target(s)
- Example: `./test-all-deploy.ps1 -ResourceGroup podcast-ack -Location eastus -AcrName podcastack -SpeechName podcast-speech-ack -BuildImages -Target all`
- **The docker-compose files are only for local development.**

**4. Cleanup**
```powershell
./infra/cleanup.ps1 -ResourceGroup <rg> [-Force]
```
- Deletes resource group and all resources; `-Force` skips confirmation
- Example: `./infra/cleanup.ps1 -ResourceGroup podcast-ack -Force`

**5. (Optional) Update the container image**

```powershell
# Rebuild the image
az acr build --registry <acrName> --image <imageName> --file <DockerfileName> . --output none 
# Update the serving container
./scripts/update-serving-container.ps1 -ResourceGroup <rg> -Location <location> -AcrName <acrName> -Target aks -AksClusterName <clusterName>
```

### Scripts Overview
- `setup.ps1` - Deploy ACR and Speech Service via Bicep, optionally build images
- `test-all-deploy.ps1` - Test all 4 deployment methods in sequence
- `cleanup.ps1` - Delete resource group and all resources
- Individual `deploy.ps1` scripts in each platform folder orchestrate platform-specific deployment

## CUDA (GPU-enabled VM)

Why CUDA 12.1:

- Broader hardware support - Works with RTX 30xx, 40xx, A100, H100, L4, T4, and older GPUs  
- cuDNN 8 is production-proven - Stable, widely tested, known performance characteristics  
- Better driver compatibility - Works with a wider range of NVIDIA driver versions  
- Safer for production - Less risk of runtime surprises  

When to use CUDA 13.0:

✓ You have very new GPUs (H100/L40 clusters) requiring 13.0
✓ You need the latest cuDNN 9 performance optimizations
✓ Your infrastructure explicitly requires CUDA 13.0+
