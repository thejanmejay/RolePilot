"""FastAPI App package for LinkedIn Hunter SaaS."""

import sys
from pathlib import Path

# Ensure project root and 'src/' directory are always on sys.path
_repo_root = Path(__file__).resolve().parent.parent.parent
_src_dir = _repo_root / "src"
for _path in (str(_repo_root), str(_src_dir)):
    if _path not in sys.path:
        sys.path.insert(0, _path)
