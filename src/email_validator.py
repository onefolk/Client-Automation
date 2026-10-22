"""Single authoritative email structure validator for OneFolk Outreach OS.

Standardizes all cold emails to the approved 4-paragraph format:
- Paragraph 1: Specific, verified observation about prospect website/operations.
- Paragraph 2: Practical improvement recommendation and benefit.
- Paragraph 3: Brief OneFolk introduction connecting relevant service/portfolio.
- Paragraph 4: One straightforward, low-pressure question/CTA.

Target word count: 70-120 words before signature.
Acceptable bounds: 50-150 words.
"""

from typing import Tuple, List, Dict, Any, Optional
import re

MIN_WORD_COUNT = 50
MAX_WORD_COUNT = 150
TARGET_WORD_MIN = 70
TARGET_WORD_MAX = 120
REQUIRED_CONTENT_PARAS = 4

BANNED_PHRASES = [
    "enquiry friction",
    "opportunity worth exploring",
    "guaranteed",
    "urgent",
    "limited time",
    "i noticed",
    "i came across",
    "i was wondering",
    "i am writing",
    "i found",
]


def parse_email_paragraphs(raw_body: str) -> Tuple[Optional[str], List[str]]:
    """Splits raw body into optional salutation and list of content paragraphs,
    stripping any embedded signature footers.
    """
    raw = str(raw_body or "").strip()
    if not raw:
        return None, []

    paras = [p.strip() for p in re.split(r'\n\s*\n', raw) if p.strip()]
    if not paras:
        return None, []

    salutation = None
    if re.match(r'^dear\b', paras[0], re.I):
        salutation = paras[0]
        paras = paras[1:]

    # Filter out embedded signature lines if present
    content_paras = []
    for p in paras:
        if re.match(r'^(our\s+)?work:\s*https?://', p, re.I):
            continue
        if re.match(r'^regards,?', p, re.I):
            continue
        if re.match(r'^team\s+onefolk', p, re.I):
            continue
        if re.match(r'^https?://onefolk\.in/?$', p, re.I):
            continue
        content_paras.append(p)

    return salutation, content_paras


def validate_email_body(raw_body: str, proof_line: Optional[str] = None) -> Tuple[bool, str, Dict[str, Any]]:
    """Validates that the email body strictly conforms to the approved 4-paragraph structure."""
    salutation, content_paras = parse_email_paragraphs(raw_body)

    if len(content_paras) != REQUIRED_CONTENT_PARAS:
        return False, (
            f"Email body must contain exactly 4 content paragraphs (found {len(content_paras)}). "
            "Structure: 1) Observation, 2) Recommendation, 3) OneFolk capability, 4) CTA question."
        ), {
            "paragraph_count": len(content_paras),
            "word_count": len(raw_body.split()),
            "content_paragraphs": content_paras,
        }

    total_words = sum(len(p.split()) for p in content_paras)
    if total_words < MIN_WORD_COUNT:
        return False, f"Email body is too brief ({total_words} words; target is 70-120 words).", {
            "paragraph_count": len(content_paras),
            "word_count": total_words,
            "content_paragraphs": content_paras,
        }
    if total_words > MAX_WORD_COUNT:
        return False, f"Email body exceeds maximum length ({total_words} words; target is 70-120 words).", {
            "paragraph_count": len(content_paras),
            "word_count": total_words,
            "content_paragraphs": content_paras,
        }

    # Para 4 (CTA) should be a question or clear polite inquiry
    para4 = content_paras[3].strip()
    if not (para4.endswith("?") or re.search(r'\b(open|speak|connect|chat|discuss|who|person|direct)\b', para4, re.I)):
        return False, "Paragraph 4 must be a straightforward, low-pressure question requesting discussion or contact.", {
            "paragraph_count": len(content_paras),
            "word_count": total_words,
            "content_paragraphs": content_paras,
        }

    # Banned phrases check
    body_lower = " ".join(content_paras).lower()
    for phrase in BANNED_PHRASES:
        if phrase in body_lower:
            return False, f"Email body contains prohibited phrasing ('{phrase}'). Keep tone natural, respectful, and avoid generic marketing tropes.", {
                "paragraph_count": len(content_paras),
                "word_count": total_words,
                "content_paragraphs": content_paras,
            }

    # Capability/portfolio check (Para 3 or body should mention OneFolk, our team, or the proof line)
    has_onefolk_ref = "onefolk" in body_lower or "our team" in body_lower
    if proof_line and proof_line.lower() in body_lower:
        has_onefolk_ref = True

    if not has_onefolk_ref:
        return False, "Paragraph 3 must introduce OneFolk or connect relevant services/portfolio capabilities.", {
            "paragraph_count": len(content_paras),
            "word_count": total_words,
            "content_paragraphs": content_paras,
        }

    return True, "VALID", {
        "salutation": salutation,
        "paragraph_count": len(content_paras),
        "word_count": total_words,
        "content_paragraphs": content_paras,
    }
