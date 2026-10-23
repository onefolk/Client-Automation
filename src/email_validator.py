"""Team OneFolk cold-email rules; envelope text is excluded from body counts."""
import re
from typing import Tuple, List, Dict, Any, Optional

MIN_WORD_COUNT = 40
MAX_WORD_COUNT = 120
TARGET_WORD_MIN = 45
TARGET_WORD_MAX = 70
REQUIRED_CONTENT_PARAS = 3
BANNED_PHRASES = [
    "unlock your business potential", "enhance your digital ecosystem",
    "optimise the customer journey", "optimize the customer journey",
    "reduce enquiry friction", "transform your digital presence",
    "drive exponential growth", "take your business to the next level",
    "we have some exciting ideas", "enquiry friction", "opportunity worth exploring",
    "guaranteed", "urgent", "limited time",
    "streamline", "seamless", "cutting-edge", "synergy", "game-changer", "exponential", "unlock",
]
def normalize_whitespace(text: str) -> str:
    s = re.sub(r'[\ufeff\u200b\u200c\u200d\u2060]', '', str(text or ''))
    s = s.replace('\r\n', '\n')
    s = re.sub(r'[\r\u0085\u2028\u2029]', '\n', s)
    s = re.sub(r'[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]', ' ', s)
    return s


FIRST_PERSON_SINGULAR = re.compile(r"(?<![\w\u00c0-\u024f])(?:i(?:['’](?:m|ve|d|ll))?|my|mine|myself|me)(?![\w\u00c0-\u024f])", re.I)


def voice_error(text):
    text_norm = normalize_whitespace(text)
    if FIRST_PERSON_SINGULAR.search(text_norm):
        return "First-person singular is forbidden; write as Team OneFolk."
    normalized = " ".join(text_norm.lower().split())
    for phrase in BANNED_PHRASES:
        if re.search(r"(?<![\w\u00c0-\u024f])" + re.escape(phrase) + r"(?![\w\u00c0-\u024f])", normalized):
            return "Prohibited phrasing: " + phrase
    return ""


def parse_email_paragraphs(raw_body: str) -> Tuple[Optional[str], List[str]]:
    raw = normalize_whitespace(raw_body).strip()
    salutation = None
    match = re.match(r"^(Dear[^\n]+,)\s*\n+", raw, re.I)
    if match:
        salutation = match.group(1).strip()
        raw = raw[match.end():].strip()
    # Strip only a trailing, recognized envelope, never arbitrary body paragraphs.
    raw = re.sub(r"(?:\n\s*)+Regards,?\s*\nTeam OneFolk\s*\nhttps://onefolk\.in/?\s*$", "", raw, flags=re.I)
    return salutation, [p.strip() for p in re.split(r"\n\s*\n", raw) if p.strip()]


def split_sentences(text: str) -> List[str]:
    protected = re.sub(r'\b(St|Dr|Mr|Mrs|Ms|Prof|vs|etc|e\.g|i\.e)\.', r'\1__DOT__', str(text or ''), flags=re.I)
    return [s.replace('__DOT__', '.').strip() for s in re.split(r'[.!?][”"’\']?(?:\s+|$)', protected) if s.strip()]


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
        return False, f"Body has {count} words; target 45-70, allowed 40-120 excluding greeting/sign-off.", details
    opening = paragraphs[:-2]
    capability, cta = paragraphs[-2:]
    if any(re.search(r"\bonefolk\b", p, re.I) for p in opening):
        return False, "Introduce OneFolk only after the observation and relevance.", details
    if len(paragraphs) == 3 and len(split_sentences(paragraphs[0])) < 2:
        return False, "The combined opening needs both an observation and a relevance sentence.", details
    if not re.search(r"\bonefolk\b", capability, re.I):
        return False, "The capability paragraph must introduce OneFolk and one relevant service.", details
    body_copy = " ".join(paragraphs)
    if body_copy.count('?') != 1 or not cta.endswith('?'):
        return False, "End with exactly one low-pressure question.", details
    if (not re.match(r"^(?:could|would|may|can)\s+", cta, re.I)
            or len(split_sentences(cta)) > 1):
        return False, "Use a low-pressure CTA asking for the appropriate contact or a conversation.", details
    return True, "VALID", details

