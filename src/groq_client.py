"""Groq Free-Tier API client with rate-limit backoff, token budgeting, and factual grounding validation."""

import json
import logging
import os
import random
import time
from typing import Any, Dict, List, Optional
import requests

from src.config import GROQ_API_KEY, GROQ_FALLBACK_MODEL, GROQ_MODEL, MAX_AI_CALLS
from src.email_validator import validate_email_body, parse_email_paragraphs

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

    def test_connection(self) -> bool:
        """Verifies API key validity and connectivity to Groq without consuming chat tokens."""
        if not self.api_key:
            return False
        try:
            resp = requests.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=10,
            )
            return resp.status_code == 200
        except Exception as e:
            logger.warning("Groq connection test failed: %s", str(e))
            return False

    def draft_outreach(
        self,
        lead: Dict[str, Any],
        research_data: Dict[str, Any],
        max_retries: int = 5,
    ) -> Optional[Dict[str, Any]]:
        """Drafts a grounded, 4-paragraph cold email (70-120 words target) with 2 alternative openings."""
        if not self.is_available():
            logger.info("Groq API unavailable or budget reached (%d/%d calls used)", self.calls_used, self.max_calls)
            return None

        # Build prompt instructions
        proof_project = research_data.get("proof_project", "OneFolk website")
        proof_line = research_data.get("proof_line", "Our team designed and built the OneFolk website.")
        observation = research_data.get("observation", "")
        observation_url = research_data.get("observation_url", lead.get("website", ""))

        contexts_summary = [
            {"url": url, "snippet": text[:1000]}
            for text, url in research_data.get("page_contexts", [])[:2]
        ]

        system_prompt = (
            "You are a factual B2B sales-operations assistant for OneFolk. "
            "Never invent, assume, or fabricate any facts, client results, conversion losses, or website issues. "
            "Always write from the company perspective ('we', 'our', 'Team OneFolk'). Never use first-person singular ('I', 'I noticed', 'I came across', 'I found'). "
            "Avoid awkward phrasing (e.g., 'move easily from treatment pages', 'treatments across spine', 'with a way to request appointments') and technical UX jargon (e.g., 'enquiry friction', 'an opportunity worth exploring'). "
            "Use natural, grammatically correct, client-friendly language. Keep personalization strictly factual to the prospect. "
            "You must return valid JSON strictly complying with the schema."
        )

        user_prompt = {
            "task": "Draft a personalized, truthful 4-paragraph cold email and two alternative opening lines following the approved OneFolk structure.",
            "prospect": {
                "name": lead.get("business") or lead.get("name"),
                "industry": lead.get("industry"),
                "website": lead.get("website"),
            },
            "verified_observation": observation,
            "verified_opportunity": research_data.get('opportunity',''),
            "observation_url": observation_url,
            "approved_portfolio_proof": proof_line,
            "approved_project": proof_project,
            "scraped_pages": contexts_summary,
            "strict_rules": [
                "Return JSON with keys: subject, email_body, alt_opening_1, alt_opening_2, skip",
                "email_body MUST consist of EXACTLY FOUR paragraphs separated by two newlines (\\n\\n):",
                "Paragraph 1: One specific, verified observation about the prospect's website, business information, or digital experience. Open directly without preamble. Never use first-person singular ('I', 'I noticed').",
                "Paragraph 2: A practical improvement recommendation explaining how this could benefit their customers, visitors, students, or business operations.",
                "Paragraph 3: Briefly introduce OneFolk and connect the relevant service or approved portfolio experience (e.g. 'At OneFolk, we help institutions improve website structure, usability, and content management.').",
                "Paragraph 4: One straightforward, low-pressure question requesting the appropriate contact or a brief discussion (e.g. 'Could you direct us to the person responsible for website updates?').",
                "Target word count: approximately 70–120 words before signature, without padding.",
                "Do NOT include salutation ('Dear ...') or signature ('Regards ...') in email_body — they are applied automatically by the platform.",
                "Tone: Professional, respectful, specific and natural. No flattery, hype, urgency tricks or generic marketing language.",
                "Recommendations must be relevant to the observation and presented as opportunities, not unverified facts.",
                "Match the pitch to OneFolk's actual capabilities and portfolio. Do not make unsupported claims that OneFolk previously built websites for specific institutions.",
                "alt_opening_1 and alt_opening_2: Two alternative single-sentence opening lines for internal human review following the same strict tone guidelines.",
                "If no genuine, verifiable opportunity is supported by the scraped pages, return {\"skip\": true}.",
                "NO fluff, NO attachments, NO PDFs, NO claims of lost revenue or broken sales.",
            ],
        }

        if research_data.get('strict_grounding'):
            user_prompt['strict_rules'] += [
                'Paragraph 1 MUST equal verified_observation verbatim. Do not add or change claims.',
                'Paragraph 2 MUST be the practical recommendation.',
                'Paragraph 3 MUST include the approved portfolio proof verbatim.',
                'Paragraph 4 MUST be: Would online submission help your team?',
                'Alternative openings must introduce the same observed manual form workflow without new facts.'
            ]

        payload = {
            "model": self.model,
            "temperature": 0.2,
            "max_completion_tokens": 1024,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_prompt)},
            ],
        }

        if self.model.startswith('openai/gpt-oss'):
            payload['reasoning_effort'] = 'low'
            payload['response_format'] = {'type':'json_schema', 'json_schema':{
                'name':'outreach_draft', 'strict':True, 'schema':{
                    'type':'object','additionalProperties':False,
                    'properties':{**{k:{'type':'string'} for k in ('subject','email_body','alt_opening_1','alt_opening_2')},'skip':{'type':'boolean'}},
                    'required':['subject','email_body','alt_opening_1','alt_opening_2','skip']
                }}}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        attempt = 0
        backoff = 2.0

        while attempt < max_retries and self.is_available():
            attempt += 1
            self.calls_used += 1

            try:
                response = requests.post(GROQ_ENDPOINT, headers=headers, json=payload, timeout=35)

                if response.status_code == 429:
                    retry_after = float(response.headers.get("Retry-After", backoff))
                    logger.warning("Groq 429 Rate Limit encountered. Backing off for %.1f seconds...", retry_after)
                    if retry_after > 60:
                        self.quota_exhausted = True
                        return None
                    time.sleep(min(60, retry_after + random.uniform(0.5, 1.5)))
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

        # Check paragraph structure (strictly 4 content paragraphs separated by double newline)
        salutation, paragraphs = parse_email_paragraphs(body)
        if len(paragraphs) != 4:
            # Try single newlines if double wasn't used
            alt_paras = [p.strip() for p in body.split("\n") if p.strip()]
            _, parsed_alt = parse_email_paragraphs("\n\n".join(alt_paras))
            if len(parsed_alt) == 4:
                paragraphs = parsed_alt
                body = "\n\n".join(paragraphs)
            else:
                return None

        # Validate structure, word count (70-120 target), and content rules
        valid, err, details = validate_email_body(body, approved_proof)
        if not valid:
            # If proof line was missing, attempt injection into paragraph 3
            if approved_proof not in body and len(paragraphs) == 4:
                paragraphs[2] = approved_proof
                body = "\n\n".join(paragraphs)
                valid, err, details = validate_email_body(body, approved_proof)
            if not valid:
                logger.info("Draft validation failed: %s", err)
                return None

        if research_data.get('strict_grounding'):
            if paragraphs[0] != research_data.get('observation'):
                return None
            if approved_proof not in body:
                return None
            if 'Would online submission help your team?' not in paragraphs[3]:
                return None

        words = body.split()

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
