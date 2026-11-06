FROM python:3.10-slim

# Install system deps (libgomp for PyTorch OpenMP, libssl/libgcc for primp/ddgs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libssl-dev \
    libgcc-s1 \
    && rm -rf /var/lib/apt/lists/*

# Set up a new user named "user" with UID 1000 (recommended by Hugging Face Spaces)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Install Python deps
COPY --chown=user backend/requirements.txt $HOME/app/requirements.txt
RUN pip install --no-cache-dir --user -r requirements.txt \
    && pip install --no-cache-dir --user \
        torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Copy backend source + model files
COPY --chown=user backend/ $HOME/app/backend/

# Hugging Face Spaces uses 7860 (README.md: app_port: 7860)
# Render dynamically injects $PORT at runtime, overriding this
ENV PORT=7860

EXPOSE 7860

# Use shell form so $PORT is expanded at runtime
CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT
