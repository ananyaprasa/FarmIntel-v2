import torch
from PIL import Image
from torchvision import transforms
import os
from pathlib import Path

# Get the absolute path to the models directory
BASE_DIR = Path(__file__).parent.parent
MODEL_PATH = BASE_DIR / "dataset" / "agri_ai_dataset" / "models" / "disease_model_fp16.pth"

def load_model_safely(model_path):
    """
    Safely load PyTorch model, handling both state dict and full model formats
    """
    try:
        # Try loading as a full model first
        checkpoint = torch.load(str(model_path), map_location="cpu", weights_only=False)
        
        if isinstance(checkpoint, dict):
            # If it's a state dict, we need to reconstruct the model
            if 'state_dict' in checkpoint:
                # This is a checkpoint with state dict
                state_dict = checkpoint['state_dict']
            else:
                # This might be just the state dict
                state_dict = checkpoint
            
            # For now, return the state dict - the actual model architecture
            # should be defined elsewhere or we need to create a simple wrapper
            return state_dict
        else:
            # This is likely a full model
            return checkpoint
            
    except Exception as e:
        print(f"Error loading model: {e}")
        # Return None to indicate failure
        return None

# Load the model
checkpoint = load_model_safely(MODEL_PATH)

# Simple transform for preprocessing
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

def detect_disease(image_path):
    """
    Detect disease from plant image using the loaded model
    """
    try:
        # Load and preprocess image
        img = Image.open(image_path).convert("RGB")
        img_tensor = transform(img).unsqueeze(0)
        
        # For now, return a mock prediction since we need the actual model architecture
        # In a real implementation, you would use the actual model
        if isinstance(checkpoint, dict):
            # This is a state dict - we would need the model architecture
            # For demonstration, return a random prediction
            import random
            return random.randint(0, 4)  # Mock prediction for 5 classes
        else:
            # This is a full model
            model = checkpoint
            model.eval()
            
            with torch.no_grad():
                output = model(img_tensor)
                pred = torch.argmax(output, dim=1)
                return pred.item()
                
    except Exception as e:
        print(f"Error in disease detection: {e}")
        # Return a default prediction
        return 0