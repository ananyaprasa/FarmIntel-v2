"""
Terra·AI — app.py

With sdk: docker, HF runs the Dockerfile CMD directly:
  uvicorn backend.main:app --host 0.0.0.0 --port 7860

This file is kept for local dev convenience only.
"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=7860, reload=True)
