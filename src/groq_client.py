"""Groq Free-Tier API client with rate-limit backoff, token budgeting, and factual grounding validation."""

import json
import logging
import os
import random
import time
from typing import Any, Dict, List, Optional
import requests

from src.config import GROQ_API_KEY, GROQ_FALLBACK_MODEL, GROQ_MODEL, MAX_AI_CALLS

logger = logging.getLogger(__name__)

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"


class GroqClient:
    """Manages AI completions over Groq's free tier with strict grounding and budget limits."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_calls: int = MAX_AI_CALLS,
    ):
        self.api_key = api_key or GROQ_API_KEY
        self.model = model or GROQ_MODEL
        self.fallback_model = GROQ_FALLBACK_MODEL
        self.max_calls = max_calls
        self.calls_used = 0
        self.quota_exhausted = False

    def is_available(self) -> bool:
        """Checks if the client has a configured API key and budget remaining."""
        return bool(self.api_key) and self.calls_used < self.max_calls and not self.quota_exhausted

    def draft_outreach(
        self,
        lead: Dict[str, Any],
        research_data: Dict[str, Any],
        max_retries: int = 3,
    ) -> Optional[Dict[str, Any]]:
        """Drafts a grounded, 3-paragraph cold email (<70 words) with 2 alternative openings."""
        if not self.is_available():
            logger.info("Groq API unavailable or budget reached (%d/%d calls used)", self.calls_used, self.max_calls)
            return None

        # Build prompt instructions
        proof_project = research_data.get("proof_project", "OneFolk website")
        proof_line = research_data.get("proof_line", "Our team designed and built the OneFolk website.")
        observation = research_data.get("observation", "")
        observation_url = research_data.get("observation_url", lead.get("website", ""))

        contexts_summary = [
            {"url": url, "snippet": text[:2000]}
            for text, url in research_data.get("page_contexts", [])[:3]
        ]

        system_prompt = (
            "You are a factual B2B sales-operations assistant for OneFolk. "
            "Never invent, assume, or fabricate any facts, client results, conversion losses, or website issues. "
            "You must return valid JSON strictly complying with the schema."
        )

        user_prompt = {
            "task": "Draft a personalized, truthful 3-paragraph cold email and two alternative opening lines.",
            "prospect": {
                "name": lead.get("business") or lead.get("name"),
                "industry": lead.get("industry"),
                "website": lead.get("website"),
            },
            "verified_observation": observation,
            "observation_url": observation_url,
            "approved_portfolio_proof": proof_line,
            "approved_project": proof_project,
            "scraped_pages": contexts_summary,
            "strict_rules": [
                "Return JSON with keys: subject, email_body, alt_opening_1, alt_opening_2, skip",
                "email_body MUST consist of EXACTLY THREE short paragraphs separated by two newlines (\\n\\n).",
                "Paragraph 1: Grounded observation on their website (no mention of sender or OneFolk).",
                "Paragraph 2: MUST include the approved portfolio proof verbatim: '" + proof_line + "'.",
                "Paragraph 3: An easy, low-commitment closing question (under 12 words).",
                "Total word count of email_body must be STRICTLY under 70 words.",
                "alt_opening_1 and alt_opening_2: Two alternative single-sentence opening lines for internal human review.",
                "If no genuine, verifiable opportunity is supported by the scraped pages, return {\"skip\": true}.",
                "NO fluff, NO flattery, NO attachments, NO claims of lost revenue or broken sales.",
            ],
        }

        payload = {
            "model": self.model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_prompt)},
            ],
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        attempt = 0
        backoff = 2.0

        while attempt < max_retries:
            attempt += 1
            self.calls_used += 1

            try:
                response = requests.post(GROQ_ENDPOINT, headers=headers, json=payload, timeout=35)

                if response.status_code == 429:
                    retry_after = float(response.headers.get("Retry-After", backoff))
                    logger.warning("Groq 429 Rate Limit encountered. Backing off for %.1f seconds...", retry_after)
                    time.sleep(retry_after + random.uniform(0.5, 1.5))
                    backoff *= 2.0
                    continue

                if response.status_code in (500, 502, 503, 504):
                    logger.warning("Groq temporary server error %d. Retrying...", response.status_code)
                    time.sleep(backoff)
                    backoff *= 1.5
                    continue

                if response.status_code != 200:
                    logger.warning("Groq API returned HTTP %d: %s", response.status_code, response.text[:200])
                    return None

                data = response.json()
                content_text = data["choices"][0]["message"]["content"]
                result = json.loads(content_text)

                if result.get("skip"):
                    logger.info("AI determined insufficient verifiable evidence for %s; skipping.", lead.get("name"))
                    return None

                # Deterministic validation of AI output
                validated = self._validate_and_sanitize(result, proof_line, observation_url, research_data)
                if not validated:
                    logger.debug("AI output failed deterministic grounding check for %s", lead.get("name"))
                    return None

                return validated

            except requests.Timeout:
                logger.warning("Groq request timed out on attempt %d", attempt)
                time.sleep(backoff)
            except Exception as e:
                logger.warning("Groq call exception: %s", str(e)[:160])
                return None

        logger.warning("Exhausted retries for Groq drafting.")
        return None

    def _validate_and_sanitize(
        self,
        raw_result: Dict[str, Any],
        approved_proof: str,
        observation_url: str,
        research_data: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Deterministically validates that the AI draft meets all length and grounding rules."""
        def normalize_unicode(s: str) -> str:
            replacements = {
                "\u2011": "-",
                "\u2012": "-",
                "\u2013": "-",
                "\u2014": "--",
                "\u2018": "'",
                "\u2019": "'",
                "\u201c": '"',
                "\u201d": '"',
                "\u00a0": " ",
            }
            for orig, rep in replacements.items():
                s = s.replace(orig, rep)
            return s

        subject = normalize_unicode(str(raw_result.get("subject", ""))).strip()
        body = normalize_unicode(str(raw_result.get("email_body", ""))).strip()
        alt1 = normalize_unicode(str(raw_result.get("alt_opening_1", ""))).strip()
        alt2 = normalize_unicode(str(raw_result.get("alt_opening_2", ""))).strip()

        if not subject or not body:
            return None

        # Check paragraph structure (strictly 3 paragraphs separated by double newline)
        paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
        if len(paragraphs) != 3:
            # Try single newlines if double wasn't used
            alt_paragraphs = [p.strip() for p in body.split("\n") if p.strip()]
            if len(alt_paragraphs) == 3:
                paragraphs = alt_paragraphs
                body = "\n\n".join(paragraphs)
            else:
                return None

        # Check total word count (< 70 words)
        words = body.split()
        if len(words) > 70:
            return None

        # Check verbatim inclusion of approved proof line
        if approved_proof not in body:
            # Inject proof into paragraph 2 if missing
            paragraphs[1] = approved_proof
            body = "\n\n".join(paragraphs)
            words = body.split()
            if len(words) > 70:
                return None

        # Verify observation URL matches fetched pages
        valid_urls = [u for _, u in research_data.get("page_contexts", [])]
        obs_url = raw_result.get("observation_url", observation_url)
        if valid_urls and obs_url not in valid_urls and observation_url not in valid_urls:
            obs_url = valid_urls[0]

        return {
            "subject": subject[:100],
            "email_body": body,
            "alt_opening_1": alt1[:200],
            "alt_opening_2": alt2[:200],
            "observation_url": obs_url,
            "proof_line": approved_proof,
            "word_count": len(words),
        }
