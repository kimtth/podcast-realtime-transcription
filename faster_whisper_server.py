import warnings
import logging
import io
import os
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Suppress pkg_resources deprecation warning from ctranslate2
warnings.filterwarnings("ignore", category=UserWarning)

# Auto-detect GPU availability
GPU_AVAILABLE = False
try:
    import torch
    GPU_AVAILABLE = torch.cuda.is_available()
except ImportError:
    pass

# Only enable GPU if available
if GPU_AVAILABLE:
    os.environ["CT2_USE_GPU"] = "1"
else:
    os.environ["CT2_USE_GPU"] = "0"

from faster_whisper import WhisperModel  # noqa: E402

# Device configuration for model loading
DEVICE = "cuda" if GPU_AVAILABLE else "cpu"
COMPUTE_TYPE = "float16" if GPU_AVAILABLE else "int8"

"""
Faster-Whisper API Server
GPU-accelerated speech-to-text transcription service
"""

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if GPU_AVAILABLE:
    logger.info("GPU detected and enabled")
else:
    logger.info("GPU not available, using CPU")


# Global model cache for reuse within same process
_model_cache = None

# Global flag to abort ongoing transcription
_abort_transcription = False
_transcription_lock = threading.Lock()
_transcription_count = 0  # Track transcription requests
_current_transcription_id = None  # Track which transcription is currently running


def set_abort_transcription(value: bool):
    """Thread-safe setter for abort flag"""
    global _abort_transcription
    with _transcription_lock:
        _abort_transcription = value
        if value:
            logger.info("Abort flag set to True")


def should_abort_transcription() -> bool:
    """Thread-safe getter for abort flag"""
    global _abort_transcription
    with _transcription_lock:
        return _abort_transcription


def get_transcription_id():
    """Get a unique ID for this transcription request"""
    global _transcription_count, _current_transcription_id
    with _transcription_lock:
        _transcription_count += 1
        _current_transcription_id = _transcription_count
        return _transcription_count


def set_current_transcription_id(transcription_id: int):
    """Set the current running transcription ID"""
    global _current_transcription_id
    with _transcription_lock:
        _current_transcription_id = transcription_id
        logger.info(f"Current transcription ID set to {transcription_id}")


def is_current_transcription(transcription_id: int) -> bool:
    """Check if this is the current transcription being run"""
    global _current_transcription_id
    with _transcription_lock:
        return _current_transcription_id == transcription_id and _abort_transcription


def _cleanup_model():
    """Cleanup model from memory"""
    global _model_cache
    if _model_cache is not None:
        logger.info("Unloading model...")
        del _model_cache
        _model_cache = None
        # Force garbage collection
        import gc
        gc.collect()
        if DEVICE == "cuda":
            import torch
            torch.cuda.empty_cache()
        logger.info("Model unloaded and cache cleared")


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    """Manage app lifecycle - startup and shutdown"""
    # Startup
    logger.info("Faster-Whisper API server starting...")
    yield
    # Shutdown
    logger.info("Faster-Whisper API server shutting down...")
    _cleanup_model()


app = FastAPI(
    title="Faster-Whisper API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_NAME = "base.en"  # Options: tiny, base, small, medium, large


def get_model():
    """Load model once and cache for reuse within same request lifecycle"""
    global _model_cache
    if _model_cache is None:
        logger.info(f"Loading {MODEL_NAME} model on {DEVICE} ({COMPUTE_TYPE})...")
        try:
            _model_cache = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)
            logger.info(f"Model loaded successfully on {DEVICE}")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    return _model_cache


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "Faster-Whisper API",
        "model": MODEL_NAME,
        "device": DEVICE,
        "gpu_available": GPU_AVAILABLE,
        "model_loaded": _model_cache is not None,
    }


@app.post("/unload-model")
async def unload_model():
    """Manually unload model from memory"""
    global _model_cache
    if _model_cache is not None:
        logger.info("Unloading model on request...")
        del _model_cache
        _model_cache = None
        import gc
        gc.collect()
        if DEVICE == "cuda":
            import torch
            torch.cuda.empty_cache()
        logger.info("Model unloaded successfully")
        return {"status": "unloaded"}
    return {"status": "already unloaded"}


@app.post("/cancel-transcription")
async def cancel_transcription():
    """Cancel ongoing transcription"""
    logger.info("Cancel transcription requested")
    # Set abort flag to signal cancellation
    set_abort_transcription(True)
    return {"status": "cancellation requested"}


@app.post("/reset-abort")
async def reset_abort():
    """Reset abort flag for next transcription"""
    logger.info("Resetting abort flag")
    set_abort_transcription(False)
    return {"status": "abort flag reset"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """
    Transcribe audio file
    
    Supports: WAV, MP3, M4A, FLAC, OGG
    
    Returns:
        {
            "text": "full transcription",
            "segments": [...]
        }
    """
    try:
        # Get unique ID for this transcription request
        transcription_id = get_transcription_id()
        logger.info(f"Starting transcription request #{transcription_id}")
        
        # Mark this as the current transcription
        set_current_transcription_id(transcription_id)
        
        # Read audio file
        contents = await file.read()
        audio_data = io.BytesIO(contents)
        
        # Check if cancellation was requested before we start
        if is_current_transcription(transcription_id):
            logger.info(f"Transcription #{transcription_id} cancelled before start")
            return {"text": "", "segments": [], "language": "", "duration": 0, "cancelled": True}
        
        # Get model
        model_instance = get_model()
        
        logger.info(f"Transcribing {file.filename}... (request #{transcription_id})")
        
        # Create a wrapper to check abort flag during transcription
        try:
            segments_list = []
            segment_count = 0
            
            # Transcribe with streaming (for real-time processing if needed)
            segments, info = model_instance.transcribe(
                audio_data,
                language="en",
                beam_size=5,
                vad_filter=True,  # Remove silence
                vad_parameters={
                    "threshold": 0.6,
                    "min_speech_duration_ms": 250,
                    "min_silence_duration_ms": 100,
                    "speech_pad_ms": 30,
                }
            )
            
            # Convert segments to list, checking for abort flag periodically
            for segment in segments:
                # Check if cancellation was requested for this specific transcription
                if is_current_transcription(transcription_id):
                    logger.info(f"Transcription #{transcription_id} cancelled during segment processing")
                    return {"text": "", "segments": [], "language": "", "duration": 0, "cancelled": True}
                
                segment_count += 1
                segments_list.append({
                    "id": segment.id,
                    "seek": segment.seek,
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip(),
                    "tokens": segment.tokens,
                    "temperature": segment.temperature,
                    "avg_logprob": segment.avg_logprob,
                    "compression_ratio": segment.compression_ratio,
                    "no_speech_prob": segment.no_speech_prob,
                })
            
            logger.info(f"Transcription #{transcription_id} yielded {segment_count} segments")
            
        except Exception as e:
            if is_current_transcription(transcription_id):
                logger.info(f"Transcription #{transcription_id} aborted during model processing: {e}")
                return {"text": "", "segments": [], "language": "", "duration": 0, "cancelled": True}
            raise
        
        # Check if cancellation was requested before merging
        if is_current_transcription(transcription_id):
            logger.info(f"Transcription #{transcription_id} cancelled before merge")
            return {"text": "", "segments": [], "language": "", "duration": 0, "cancelled": True}
        
        # Merge short segments to reduce segment count (target: ~10-20 segments per minute)
        merged_segments = []
        current_merged = None
        TARGET_SEGMENT_DURATION = 15.0  # Merge into ~15 second chunks
        
        for seg in segments_list:
            # Check if cancellation was requested during merging
            if is_current_transcription(transcription_id):
                logger.info(f"Transcription #{transcription_id} cancelled during merge")
                return {"text": "", "segments": [], "language": "", "duration": 0, "cancelled": True}
            
            if current_merged is None:
                # Start new merged segment
                current_merged = {
                    "id": seg["id"],
                    "seek": seg["seek"],
                    "start": seg["start"],
                    "end": seg["end"],
                    "text": seg["text"],
                    "tokens": seg["tokens"],
                    "temperature": seg["temperature"],
                    "avg_logprob": seg["avg_logprob"],
                    "compression_ratio": seg["compression_ratio"],
                    "no_speech_prob": seg["no_speech_prob"],
                }
            else:
                # Check if we should merge or start new segment
                duration = current_merged["end"] - current_merged["start"]
                
                if duration < TARGET_SEGMENT_DURATION:
                    # Merge into current segment
                    current_merged["end"] = seg["end"]
                    current_merged["text"] = current_merged["text"] + " " + seg["text"]
                    current_merged["tokens"].extend(seg["tokens"])
                    # Average the metrics
                    current_merged["avg_logprob"] = (current_merged["avg_logprob"] + seg["avg_logprob"]) / 2
                    current_merged["compression_ratio"] = (current_merged["compression_ratio"] + seg["compression_ratio"]) / 2
                    current_merged["no_speech_prob"] = (current_merged["no_speech_prob"] + seg["no_speech_prob"]) / 2
                else:
                    # Save current and start new
                    merged_segments.append(current_merged)
                    current_merged = {
                        "id": seg["id"],
                        "seek": seg["seek"],
                        "start": seg["start"],
                        "end": seg["end"],
                        "text": seg["text"],
                        "tokens": seg["tokens"],
                        "temperature": seg["temperature"],
                        "avg_logprob": seg["avg_logprob"],
                        "compression_ratio": seg["compression_ratio"],
                        "no_speech_prob": seg["no_speech_prob"],
                    }
        
        # Don't forget the last merged segment
        if current_merged is not None:
            merged_segments.append(current_merged)
        
        # Re-number segments
        for idx, seg in enumerate(merged_segments):
            seg["id"] = idx
        
        # Use merged segments
        segments_list = merged_segments
        
        # Get full text
        full_text = " ".join([seg["text"] for seg in segments_list])
        
        logger.info(f"Transcription #{transcription_id} complete: {len(segments_list)} segments, {len(full_text)} chars")
        
        return {
            "text": full_text,
            "segments": segments_list,
            "language": info.language,
            "duration": info.duration,
        }
        
    except Exception as e:
        # Check if this is an abort
        if is_current_transcription(transcription_id):
            logger.info(f"Transcription aborted: {str(e)}")
            return {"text": "", "segments": [], "language": "", "duration": 0, "cancelled": True}
        
        logger.error(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe-streaming")
async def transcribe_streaming(file: UploadFile = File(...)):
    """
    Transcribe audio file with streaming response for real-time display
    """
    try:
        contents = await file.read()
        audio_data = io.BytesIO(contents)
        
        model_instance = get_model()
        
        logger.info(f"Streaming transcription for {file.filename}...")
        
        segments, info = model_instance.transcribe(
            audio_data,
            language="en",
            beam_size=5,
            vad_filter=True,
        )
        
        # Stream results as they arrive
        def generate():
            segment_count = 0
            for segment in segments:
                segment_count += 1
                yield {
                    "id": segment.id,
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip(),
                    "is_final": True,
                }
                logger.info(f"Streamed segment {segment_count}")
        
        # Return streaming response
        from fastapi.responses import StreamingResponse
        return StreamingResponse(generate(), media_type="application/x-ndjson")
        
    except Exception as e:
        logger.error(f"Streaming transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
    )
