"""Mock JSON fixtures, exported from the frontend mock layer.

Regenerate with `npm run export:fixtures` in frontend/ so both sides stay identical.
"""

import copy
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

FIXTURE_DIR = Path(__file__).parent / "fixtures"


@lru_cache(maxsize=None)
def _load(name: str) -> Any:
    with (FIXTURE_DIR / f"{name}.json").open(encoding="utf-8") as f:
        return json.load(f)


def fixture(name: str) -> Any:
    """Return a deep copy, so handlers can modify it freely."""
    return copy.deepcopy(_load(name))
