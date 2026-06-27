import time
import base64
from io import BytesIO
import cv2
import numpy as np
from PIL import Image
import urllib.request
import os
import torch
import torchvision.transforms as T
import torchvision.models as models
from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
from contextlib import asynccontextmanager

# --- CORE LOGIC: IMAGENET LABELS & PYTORCH MODEL LOADING ---

LABELS_URL = "https://raw.githubusercontent.com/pytorch/hub/master/imagenet_classes.txt"
LABELS_PATH = "imagenet_classes.txt"

def load_imagenet_labels():
    if not os.path.exists(LABELS_PATH):
        try:
            print("Downloading ImageNet labels...")
            urllib.request.urlretrieve(LABELS_URL, LABELS_PATH)
        except Exception as e:
            print(f"Failed to download ImageNet labels: {e}")
            return [f"Marine Object {i}" for i in range(1000)]
            
    with open(LABELS_PATH, "r") as f:
        categories = [line.strip() for line in f.readlines()]
    return categories

# Global model state
model = None
imagenet_categories = []
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, imagenet_categories
    imagenet_categories = load_imagenet_labels()
    try:
        print("Loading MobileNetV3 Large...")
        try:
            # Try newer torchvision Weights API
            weights = models.MobileNet_V3_Large_Weights.DEFAULT
            model = models.mobilenet_v3_large(weights=weights)
        except AttributeError:
            # Fallback to deprecated API
            model = models.mobilenet_v3_large(pretrained=True)
            
        model.to(device)
        model.eval()
        print(f"Model loaded successfully on device: {device}")
    except Exception as e:
        print(f"Failed to load PyTorch model: {e}")
    yield

# --- FASTAPI SETUP ---
app = FastAPI(
    title="AquaVision Backend API",
    description="AI-powered underwater image enhancement and object classification.",
    lifespan=lifespan
)

origins = [
    "http://localhost:5173",  # Frontend Dev Server
    "http://127.0.0.1:5173",
    "http://localhost:3000",  # Frontend Production/Docker port
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EnhancedImageResponse(BaseModel):
    success: bool
    enhanced_image: str  # Base64 encoded image string (with data URI prefix)
    processing_time: str
    confidence: float
    classification_label: str

def classify_image(image_cv_bgr) -> tuple[str, float]:
    """
    Classifies the enhanced image using pre-trained MobileNetV3-Large.
    """
    if model is None:
        return "Unknown", 0.0
        
    try:
        # Convert OpenCV BGR to RGB PIL Image
        img_rgb = cv2.cvtColor(image_cv_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
        
        # ImageNet preprocessing
        transform = T.Compose([
            T.Resize(256),
            T.CenterCrop(224),
            T.ToTensor(),
            T.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
        
        input_tensor = transform(pil_img).unsqueeze(0).to(device)
        
        with torch.no_grad():
            output = model(input_tensor)
            probabilities = torch.nn.functional.softmax(output[0], dim=0)
            
        top_prob, top_catid = torch.topk(probabilities, 1)
        confidence = float(top_prob[0].item())
        class_idx = int(top_catid[0].item())
        
        label = imagenet_categories[class_idx] if class_idx < len(imagenet_categories) else f"Class {class_idx}"
        label = label.replace("_", " ").title()
        
        return label, confidence
    except Exception as e:
        print(f"Error during classification: {e}")
        return "Classification Error", 0.0

# --- CORE LOGIC: DATA PIPELINE LAYER (PREPROCESSING) ---

def guided_filter(I: np.ndarray, p: np.ndarray, r: int, eps: float) -> np.ndarray:
    """
    Fast guided filter implementation using OpenCV boxFilter.
    """
    mean_I = cv2.boxFilter(I, -1, (r, r))
    mean_p = cv2.boxFilter(p, -1, (r, r))
    mean_Ip = cv2.boxFilter(I * p, -1, (r, r))
    cov_Ip = mean_Ip - mean_I * mean_p
    
    mean_II = cv2.boxFilter(I * I, -1, (r, r))
    var_I = mean_II - mean_I * mean_I
    
    a = cov_Ip / (var_I + eps)
    b = mean_p - a * mean_I
    
    mean_a = cv2.boxFilter(a, -1, (r, r))
    mean_b = cv2.boxFilter(b, -1, (r, r))
    
    q = mean_a * I + mean_b
    return q

def apply_udcp_dehazing(img: np.ndarray, omega: float = 0.90, patch_size: int = 15) -> np.ndarray:
    """
    Applies Underwater Dark Channel Prior (UDCP) Dehazing.
    Uses Green and Blue channels to estimate the transmission map.
    """
    img_f = img.astype(np.float32)
    
    # 1. Compute UDCP (minimum of Green and Blue channels)
    # OpenCV BGR: 0=Blue, 1=Green
    g_b_min = np.minimum(img[:, :, 0], img[:, :, 1])
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (patch_size, patch_size))
    udcp = cv2.erode(g_b_min, kernel)
    
    # 2. Estimate Waterlight (A)
    # Find the top 0.1% brightest pixels in the UDCP map
    flat_udcp = udcp.flatten()
    num_pixels = flat_udcp.size
    num_brightest = max(1, int(num_pixels * 0.001))
    indices = np.argpartition(flat_udcp, -num_brightest)[-num_brightest:]
    
    # Get the brightest colors from original BGR image at these indices
    flat_img = img.reshape(-1, 3)
    brightest_pixels = flat_img[indices]
    A = np.max(brightest_pixels, axis=0) # [A_B, A_G, A_R]
    A = np.maximum(A, [1, 1, 1])
    
    # 3. Estimate Transmission Map
    normalized = img_f / A.astype(np.float32)
    norm_g_b_min = np.minimum(normalized[:, :, 0], normalized[:, :, 1])
    transmission = 1.0 - omega * cv2.erode(norm_g_b_min, kernel)
    transmission = np.clip(transmission, 0.1, 1.0)
    
    # 4. Refine Transmission Map using Guided Filter
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    refined_transmission = guided_filter(gray, transmission, r=40, eps=1e-3)
    
    # 5. Recover scene radiance: J = (I - A) / t + A
    res = np.zeros_like(img_f)
    for c in range(3):
        res[:, :, c] = (img_f[:, :, c] - A[c]) / refined_transmission + A[c]
        
    return np.clip(res, 0, 255).astype(np.uint8)

def apply_underwater_enhancement(
    image_cv: np.ndarray,
    enable_udcp: bool = True,
    enable_clahe: bool = True,
    enable_grayworld: bool = True
) -> np.ndarray:
    """
    Simulates the Preprocessing Pipeline: UDCP Dehazing, CLAHE, and White Balance.
    """
    current = image_cv.copy()
    
    # 1. UDCP Dehazing
    if enable_udcp:
        current = apply_udcp_dehazing(current)
    
    # 2. CLAHE (Contrast Limited Adaptive Histogram Equalization)
    if enable_clahe:
        lab = cv2.cvtColor(current, cv2.COLOR_BGR2LAB)
        l_channel = lab[:,:,0]
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        cl = clahe.apply(l_channel)
        lab[:,:,0] = cl
        current = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # 3. Simple Gray-World Color Correction (Simulates White Balance)
    if enable_grayworld:
        img_f = current.astype(np.float32) / 255.0
        
        # Calculate average of each color channel
        avg_b = np.average(img_f[:,:,0])
        avg_g = np.average(img_f[:,:,1])
        avg_r = np.average(img_f[:,:,2])
        
        # Calculate scale factors to normalize to the overall average
        avg_all = (avg_b + avg_g + avg_r) / 3.0
        
        if avg_b > 0 and avg_g > 0 and avg_r > 0:
            scale_b = avg_all / avg_b
            scale_g = avg_all / avg_g
            scale_r = avg_all / avg_r
            
            # Apply scaling
            img_f[:,:,0] = np.clip(img_f[:,:,0] * scale_b, 0, 1)
            img_f[:,:,1] = np.clip(img_f[:,:,1] * scale_g, 0, 1)
            img_f[:,:,2] = np.clip(img_f[:,:,2] * scale_r, 0, 1)
        
        current = (img_f * 255).astype(np.uint8)
    
    return current

# --- CORE LOGIC: COMBINED PIPELINE & MODEL SERVING LAYER ---

def run_aqua_vision_pipeline(image_bytes: bytes) -> tuple[str, str, float, str]:
    start_time = time.time()
    
    # 1. Data Ingestion (Read and Convert to OpenCV format)
    image_np = np.array(Image.open(BytesIO(image_bytes)).convert("RGB"))
    image_cv = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

    # 2. Data Pipeline Layer: Preprocessing / Enhancement (Use all enhancements by default)
    image_enhanced_cv = apply_underwater_enhancement(image_cv, enable_udcp=True, enable_clahe=True, enable_grayworld=True)
    
    # 3. Model Serving Layer: Real Inference
    label, confidence_score = classify_image(image_enhanced_cv)

    # 4. Prepare Final Output
    success, buffer = cv2.imencode('.png', image_enhanced_cv)
    if not success:
        raise Exception("Could not encode enhanced image.")
    
    enhanced_image_base64 = base64.b64encode(buffer).decode('utf-8')
    processing_time = f"{(time.time() - start_time):.2f}s"

    return enhanced_image_base64, processing_time, confidence_score, label

# --- FASTAPI ENDPOINTS ---

@app.post("/api/enhance-image", response_model=EnhancedImageResponse)
async def enhance_image_endpoint(file: UploadFile = File(...)):
    if file.content_type not in ["image/jpeg", "image/jpg", "image/png"]:
        raise HTTPException(status_code=400, detail="Invalid image format. Only JPEG and PNG are supported.")

    try:
        image_bytes = await file.read()
        
        # Check size (10MB limit)
        if len(image_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds the 10MB limit.")

        # Run the entire pipeline
        enhanced_base64, proc_time, confidence, label = run_aqua_vision_pipeline(image_bytes)

        # Base64 output uses PNG encoding from OpenCV
        data_uri_prefix = f"data:image/png;base64," 
        
        return EnhancedImageResponse(
            success=True,
            enhanced_image=data_uri_prefix + enhanced_base64,
            processing_time=proc_time,
            confidence=confidence,
            classification_label=label
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Server Error during processing: {e}")
        raise HTTPException(status_code=500, detail="Internal server error: AI pipeline failure.")

@app.websocket("/api/stream-enhance")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket client connected.")
    try:
        while True:
            # Receive frame payload
            data = await websocket.receive_text()
            payload = json.loads(data)
            base64_image = payload.get("image")
            
            # Extract toggle settings
            enable_udcp = payload.get("udcp", True)
            enable_clahe = payload.get("clahe", True)
            enable_grayworld = payload.get("grayworld", True)
            enable_inference = payload.get("inference", True)
            
            if not base64_image:
                continue
                
            # Strip data URI prefix if it exists
            if "," in base64_image:
                base64_image = base64_image.split(",")[1]
                
            frame_bytes = base64.b64decode(base64_image)
            frame_np = np.array(Image.open(BytesIO(frame_bytes)).convert("RGB"))
            frame_cv = cv2.cvtColor(frame_np, cv2.COLOR_RGB2BGR)
            
            start_time = time.time()
            
            # Apply enhancements
            enhanced_cv = apply_underwater_enhancement(
                frame_cv,
                enable_udcp=enable_udcp,
                enable_clahe=enable_clahe,
                enable_grayworld=enable_grayworld
            )
            
            # Run inference if requested
            if enable_inference:
                label, confidence = classify_image(enhanced_cv)
            else:
                label, confidence = "Inference Disabled", 0.0
                
            # Encode as JPEG (quality 80) for lightweight streaming performance
            success, buffer = cv2.imencode('.jpg', enhanced_cv, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not success:
                continue
                
            enhanced_base64 = base64.b64encode(buffer).decode('utf-8')
            proc_time_ms = f"{(time.time() - start_time) * 1000:.0f}ms"
            
            response = {
                "success": True,
                "image": f"data:image/jpeg;base64,{enhanced_base64}",
                "processing_time": proc_time_ms,
                "confidence": confidence,
                "label": label
            }
            await websocket.send_text(json.dumps(response))
            
    except WebSocketDisconnect:
        print("WebSocket client disconnected.")
    except Exception as e:
        print(f"WebSocket processing error: {e}")

# --- RUNNER ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)