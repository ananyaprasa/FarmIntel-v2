import pickle
import numpy as np
import os
from pathlib import Path

# Get the absolute path to the models directory
BASE_DIR = Path(__file__).parent.parent
CROP_MODEL_PATH = BASE_DIR / "dataset" / "agri_ai_dataset" / "models" / "crop_model.pkl"
LABEL_ENCODER_PATH = BASE_DIR / "dataset" / "agri_ai_dataset" / "models" / "label_enoder_crop.pkl"

def load_models_safely():
    """
    Safely load crop recommendation models
    """
    try:
        with open(str(CROP_MODEL_PATH), "rb") as f:
            model = pickle.load(f)
        
        with open(str(LABEL_ENCODER_PATH), "rb") as f:
            label_encoder = pickle.load(f)
            
        return model, label_encoder
        
    except Exception as e:
        print(f"Error loading crop models: {e}")
        return None, None

# Load models
model, label_encoder = load_models_safely()

def predict_crop(N, P, K, temp, humidity, ph, rainfall):
    """
    Predict crop based on soil and climate parameters
    """
    if model is None or label_encoder is None:
        # Return a default prediction if models failed to load
        return "rice"  # Default crop
    
    try:
        features = np.array([[N, P, K, temp, humidity, ph, rainfall]])
        pred = model.predict(features)
        crop = label_encoder.inverse_transform(pred)
        return crop[0]
    except Exception as e:
        print(f"Error in crop prediction: {e}")
        return "rice"  # Default crop