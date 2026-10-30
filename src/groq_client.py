"""Groq Free-Tier API client with rate-limit backoff, token budgeting, and factual grounding validation."""

import math
from datetime import datetime, timezone
import json
import logging
import os
import random
import re
import time
from typing import Any, Dict, List, Optional
import requests

from src.config import (
    CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_MODEL, GROQ_API_KEY, GROQ_FALLBACK_MODEL, GROQ_MODEL, MAX_AI_CALLS,
)
from src.skills import load_rules, load_skill
from src.email_validator import validate_email_body, parse_email_paragraphs, voice_error, BANNED_PHRASES

logger = logging.getLogger(__name__)

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
CLOUDFLARE_ENDPOINT = "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions"

AUDIENCE_BY_INDUSTRY = {
    "education": "institutions", "training": "institutions", "healthcare": "clinics and hospitals",
    "hospitality": "hospitality businesses", "restaurant": "restaurants and caterers",
    "real-estate": "real estate firms", "creative": "creative studios", "architecture": "architecture studios",
    "professional-services": "professional firms", "finance": "professional firms",
    "events": "event businesses", "wedding": "event businesses", "manufacturing": "manufacturers",
    "retail": "retail brands", "nonprofit": "non-profit organisations", "wellness": "wellness businesses",
    "startup-tech": "growing companies", "logistics-travel": "travel and logistics businesses",
    "automotive": "automotive businesses",
}
SERVICE_PHRASE = {
    "Website content and UX improvements": "improve website content and structure",
    "Website design and development": "build fast, mobile-friendly and secure websites",
    "Landing pages and enquiry management": "set up landing pages and enquiry systems",
}


def capability_sentence(industry, service):
    """One approved OneFolk capability sentence matched to the prospect's industry and service."""
    audience = AUDIENCE_BY_INDUSTRY.get(str(industry or "").lower(), "businesses")
    phrase = SERVICE_PHRASE.get(service, "simplify online enquiries, bookings and workflows")
    return f"At OneFolk, we help {audience} {phrase}."


class GroqClient:
    """Manages AI completions over Groq's free tier, falling back to Cloudflare Workers AI, with strict grounding and budget limits."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_calls: int = MAX_AI_CALLS,
        cloudflare_account_id: Optional[str] = None,
        cloudflare_api_token: Optional[str] = None,
        cloudflare_model: Optional[str] = None,
    ):
        self.api_key = api_key or GROQ_API_KEY
        self.model = model or GROQ_MODEL
        self.fallback_model = GROQ_FALLBACK_MODEL
        self.cloudflare_account_id = CLOUDFLARE_ACCOUNT_ID if cloudflare_account_id is None else cloudflare_account_id
        self.cloudflare_api_token = CLOUDFLARE_API_TOKEN if cloudflare_api_token is None else cloudflare_api_token
        self.cloudflare_model = cloudflare_model or CLOUDFLARE_MODEL
        self.max_calls = max_calls
        self.calls_used = 0
        self.exhausted_providers: set = set()

    @property
    def quota_exhausted(self) -> bool:
        """True once every configured provider has run out of quota or been rejected."""
        return not self._providers()

    def _providers(self) -> List[Dict[str, str]]:
        """Configured providers still usable, in priority order (Groq first)."""
        providers = [
            {"name": "Groq", "key": self.api_key, "model": self.model, "endpoint": GROQ_ENDPOINT},
            {"name": "Cloudflare", "key": self.cloudflare_api_token if self.cloudflare_account_id else "",
             "model": self.cloudflare_model,
             "endpoint": CLOUDFLARE_ENDPOINT.format(account_id=self.cloudflare_account_id)},
        ]
        return [p for p in providers if p["key"] and p["name"] not in self.exhausted_providers]

    def is_available(self) -> bool:
        """Checks if any provider has a configured API key and budget remains."""
        return self.calls_used < self.max_calls and bool(self._providers())

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
        """Drafts a grounded, Team OneFolk cold email (50-90 body words target) with 2 alternative openings."""
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

        capability = capability_sentence(
            lead.get("industry") or research_data.get("industry"), research_data.get("recommended_service"))
        business = str(lead.get("business") or lead.get("name") or research_data.get("business") or "").strip()
        if not business or "\n" in business or "\r" in business:
            return None
        system_prompt = " ".join(load_skill("writer_system").split()).replace(
            "{banned_phrases}", "; ".join(BANNED_PHRASES))
        user_prompt = {
            "task": "Write a concise, natural email targeting 50-90 body words (allowed 40-120, excluding greeting and sign-off).",
            "prospect": {"name": business, "industry": lead.get("industry"), "website": lead.get("website")},
            "verified_observation": observation,
            "verified_opportunity": research_data.get("opportunity", ""),
            "observation_url": observation_url,
            "approved_capability_sentence": capability,
            "approved_portfolio_proof": proof_line,
            "approved_project": proof_project,
            "scraped_pages": contexts_summary,
            "style_reference_only": load_skill("style_reference"),
            "strict_rules": [rule.replace("{business}", business) for rule in load_rules("strict_rules")],
        }
        if research_data.get("strict_grounding"):
            user_prompt["strict_rules"].append(load_skill("strict_grounding"))

        def build_payload(model: str) -> Dict[str, Any]:
            payload = {
                "model": model,
                "temperature": 0.2,
                "max_completion_tokens": 1024,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_prompt)},
                ],
            }
            if 'gpt-oss' in model:
                payload['reasoning_effort'] = 'low'
                payload['response_format'] = {'type':'json_schema', 'json_schema':{
                    'name':'outreach_draft', 'strict':True, 'schema':{
                        'type':'object','additionalProperties':False,
                        'properties':{**{k:{'type':'string'} for k in ('subject','email_body','alt_opening_1','alt_opening_2','opportunity')},'skip':{'type':'boolean'}},
                        'required':['subject','email_body','alt_opening_1','alt_opening_2','opportunity','skip']
                    }}}
            return payload

        attempt = 0
        backoff = 2.0
        server_failures = 0

        while attempt < max_retries and self.is_available():
            provider = self._providers()[0]
            name = provider["name"]
            attempt += 1
            self.calls_used += 1

            try:
                response = requests.post(
                    provider["endpoint"],
                    headers={"Authorization": f"Bearer {provider['key']}", "Content-Type": "application/json"},
                    json=build_payload(provider["model"]),
                    timeout=35,
                )

                if response.status_code == 429:
                    raw_retry = response.headers.get("Retry-After", "")
                    try:
                        retry_after = float(raw_retry)
                    except ValueError:
                        from email.utils import parsedate_to_datetime
                        try:
                            dt = parsedate_to_datetime(raw_retry)
                            retry_after = max(0.0, (dt - datetime.now(timezone.utc)).total_seconds())
                        except Exception:
                            retry_after = backoff
                    if not math.isfinite(retry_after) or retry_after < 0:
                        retry_after = backoff
                    logger.warning("%s 429 Rate Limit encountered. Backing off for %.1f seconds...", name, retry_after)
                    if retry_after > 60:
                        self.exhausted_providers.add(name)
                        if self._providers():
                            logger.warning("%s quota exhausted; falling back to %s.", name, self._providers()[0]["name"])
                            continue
                        return None
                    time.sleep(min(60, retry_after + random.uniform(0.5, 1.5)))
                    backoff *= 2.0
                    continue


                if response.status_code in (500, 502, 503, 504):
                    logger.warning("%s temporary server error %d. Retrying...", name, response.status_code)
                    server_failures += 1
                    if server_failures >= 2 and len(self._providers()) > 1:
                        self.exhausted_providers.add(name)
                        server_failures = 0
                        logger.warning("%s keeps failing; falling back to %s.", name, self._providers()[0]["name"])
                        continue
                    time.sleep(backoff)
                    backoff *= 1.5
                    continue

                if response.status_code in (401, 402, 403, 404) and len(self._providers()) > 1:
                    logger.warning("%s rejected the request (HTTP %d); falling back to %s.",
                                   name, response.status_code, self._providers()[1]["name"])
                    self.exhausted_providers.add(name)
                    continue

                if response.status_code != 200:
                    logger.warning("%s API returned HTTP %d: %s", name, response.status_code, response.text[:200])
                    return None

                data = response.json()
                content_text = data["choices"][0]["message"]["content"]
                result = json.loads(content_text)

                if result.get("skip"):
                    logger.info("AI determined insufficient verifiable evidence for %s; skipping.", lead.get("name"))
                    return None

                # Deterministic validation of AI output
                validated = self._validate_and_sanitize(result, proof_line, observation_url, research_data, business)
                if not validated:
                    logger.debug("AI output failed deterministic grounding check for %s", lead.get("name"))
                    return None

                return validated

            except json.JSONDecodeError as e:
                logger.warning("%s returned malformed JSON on attempt %d: %s", name, attempt, str(e)[:100])
                continue
            except requests.Timeout:
                logger.warning("%s request timed out on attempt %d", name, attempt)
                server_failures += 1
                if server_failures >= 2 and len(self._providers()) > 1:
                    self.exhausted_providers.add(name)
                    server_failures = 0
                    continue
                time.sleep(backoff)
            except Exception as e:
                logger.warning("%s call exception: %s", name, str(e)[:160])
                return None

        logger.warning("Exhausted retries for AI drafting.")
        return None

    def _validate_and_sanitize(
        self,
        raw_result: Dict[str, Any],
        approved_proof: str,
        observation_url: str,
        research_data: Dict[str, Any],
        business: Optional[str] = None,
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

        keys = ('subject', 'email_body', 'alt_opening_1', 'alt_opening_2', 'opportunity')
        if not isinstance(raw_result, dict) or any(not isinstance(raw_result.get(k), str) for k in keys):
            return None
        subject, body, alt1, alt2, opportunity = [normalize_unicode(raw_result[k]).strip() for k in keys]
        if any(not value for value in (subject, body, alt1, alt2, opportunity)):
            return None
        if not 3 <= len(subject.split()) <= 7 or len(subject) > 100 or "\n" in subject or "\r" in subject:
            return None
        if any(voice_error(value) for value in (subject, body, alt1, alt2, opportunity)):
            return None
        if alt1.casefold() == alt2.casefold() or any(len(a) > 200 or "\n" in a or '?' in a for a in (alt1, alt2)):
            return None
        if any(re.search(r"[.!?]\s+\S", a) for a in (alt1, alt2)):
            return None
        valid, err, details = validate_email_body(body, approved_proof)
        if not valid:
            logger.info("Draft validation failed: %s", err)
            return None
        paragraphs = details['content_paragraphs']
        if research_data.get('strict_grounding'):
            if not research_data.get("page_contexts"):
                return None
            observation = normalize_unicode(str(research_data.get('observation', ''))).strip()
            if not observation or not (paragraphs[0] == observation or
                    (len(paragraphs) == 3 and paragraphs[0].startswith(observation + ' '))):
                return None
        # Disallow fabricated quantitative/financial claims
        if re.search(r'(?:(?<!\w)\d+(?:\.\d+)?%|(?<!\w)\d+\s*(?:percent|%|x\b)|[\$₹€£]\s*\d+)', body, re.I):
            logger.info("Draft rejected due to unsupported quantitative metrics or currency claims")
            return None
        valid_urls = [u for _, u in research_data.get("page_contexts", [])]
        if valid_urls and observation_url not in valid_urls:
            return None

        body = "\n\n".join(paragraphs)
        if business:
            body = f"Dear {business} Team,\n\n{body}\n\nRegards,\nTeam OneFolk\nhttps://onefolk.in/"
        return {
            "status": "SUCCESS",
            "subject": subject,
            "greeting": f"Dear {business} Team," if business else "",
            "observation": paragraphs[0],
            "recommendation": paragraphs[1] if len(paragraphs) == 4 else "",
            "service_introduction": paragraphs[-2],
            "cta": paragraphs[-1],
            "email_body": body,
            "alt_opening_1": alt1,
            "alt_opening_2": alt2,
            "alternative_openings": [alt1, alt2],
            "opportunity": opportunity,
            "evidence_url": observation_url,
            "observation_url": observation_url,
            "contact_source_url": research_data.get("email_source_url", ""),
            "research_timestamp": research_data.get("timestamp", ""),
            "validation_issues": [],
            "proof_line": approved_proof,
            "word_count": details['word_count'],
        }

