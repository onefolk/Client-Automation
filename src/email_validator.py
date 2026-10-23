"""Team OneFolk cold-email rules; envelope text is excluded from body counts."""
import re
from typing import Tuple, List, Dict, Any, Optional

MIN_WORD_COUNT = 40
MAX_WORD_COUNT = 120
TARGET_WORD_MIN = 50
TARGET_WORD_MAX = 90
REQUIRED_CONTENT_PARAS = 4
BANNED_PHRASES = [
    "unlock your business potential", "enhance your digital ecosystem",
    "optimise the customer journey", "optimize the customer journey",
    "reduce enquiry friction", "transform your digital presence",
    "drive exponential growth", "take your business to the next level",
    "we have some exciting ideas", "enquiry friction", "opportunity worth exploring",
    "guaranteed", "urgent", "limited time",
]
FIRST_PERSON_SINGULAR = re.compile(r"\b(?:i(?:['’](?:m|ve|d|ll))?|my|mine|myself)\b", re.I)


def voice_error(text):
    if FIRST_PERSON_SINGULAR.search(text):
        return "First-person singular is forbidden; write as Team OneFolk."
    normalized = " ".join(text.lower().split())
    for phrase in BANNED_PHRASES:
        if re.search(r"\b" + re.escape(phrase) + r"\b", normalized):
            return "Prohibited phrasing: " + phrase
    return ""


def parse_email_paragraphs(raw_body: str) -> Tuple[Optional[str], List[str]]:
    raw = str(raw_body or "").strip()
    salutation = None
    match = re.match(r"^(Dear[^\n]+,)\s*\n", raw, re.I)
    if match:
        salutation = match.group(1)
        raw = raw[match.end():].strip()
    # Strip only a trailing, recognized envelope, never arbitrary body paragraphs.
    raw = re.sub(r"(?:\n\s*)+Regards,?\s*\nTeam OneFolk\s*\nhttps://onefolk\.in/?\s*$", "", raw, flags=re.I)
    return salutation, [p.strip() for p in re.split(r"\n\s*\n", raw) if p.strip()]


def validate_email_body(raw_body: str, proof_line: Optional[str] = None) -> Tuple[bool, str, Dict[str, Any]]:
    salutation, paragraphs = parse_email_paragraphs(raw_body)
    count = sum(len(p.split()) for p in paragraphs)
    details = dict(salutation=salutation, paragraph_count=len(paragraphs),
                   word_count=count, content_paragraphs=paragraphs)
    error = voice_error(str(raw_body or ""))
    if error:
        return False, error, details
    # The reference sample combines observation and relevance into one paragraph.
    if len(paragraphs) not in (3, 4):
        return False, "Use observation, relevance, OneFolk capability and one CTA (3 or 4 paragraphs).", details
    if not MIN_WORD_COUNT <= count <= MAX_WORD_COUNT:
        return False, f"Body has {count} words; target 50-90, allowed 40-120 excluding greeting/sign-off.", details
    opening = paragraphs[:-2]
    capability, cta = paragraphs[-2:]
    if any(re.search(r"\bonefolk\b", p, re.I) for p in opening):
        return False, "Introduce OneFolk only after the observation and relevance.", details
    if len(paragraphs) == 3 and len(re.split(r'[.!?][”"’]?(?:\s+|$)', paragraphs[0].strip())) < 3:
        return False, "The combined opening needs both an observation and a relevance sentence.", details
    if not re.search(r"\bonefolk\b", capability, re.I):
        return False, "The capability paragraph must introduce OneFolk and one relevant service.", details
    if sum(p.count('?') for p in paragraphs) != 1 or not cta.endswith('?'):
        return False, "End with exactly one low-pressure question.", details
    if not re.match(r"^(?:could|would|may|can)\b", cta, re.I):
        return False, "Use a low-pressure CTA asking for the appropriate contact or a conversation.", details
    return True, "VALID", details
