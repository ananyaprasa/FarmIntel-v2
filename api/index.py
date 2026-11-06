import sys
from pathlib import Path

# Add root and backend directory to sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

for d in [str(root_dir), str(backend_dir)]:
    if d not in sys.path:
        sys.path.insert(0, d)

try:
    from main import app
except Exception:
    from backend.main import app  # noqa: F401
