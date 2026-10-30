"""Loads the editable Markdown writer skills from the repository's skills/ directory."""

from pathlib import Path
from typing import List

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"


def load_skill(name: str) -> str:
    """Returns a skill file's text without trailing whitespace."""
    return (SKILLS_DIR / f"{name}.md").read_text(encoding="utf-8").strip()


def load_rules(name: str) -> List[str]:
    """Returns a skill file split into rules on lines containing only '---'."""
    blocks = [block.strip() for block in load_skill(name).split("\n---\n")]
    return [block for block in blocks if block]
