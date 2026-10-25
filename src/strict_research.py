"""Qualify only a concrete, source-backed workflow improvement."""
import re
from bs4 import BeautifulSoup
from src.research import ProspectResearcher
from src.config import load_portfolio
from src.open_discovery import company_id

RESEARCH_VERSION = 4


def workflow_opportunity(industry, observation_type, observation):
    if observation_type == "TECHNICAL_DEFECT":
        return "Modernize the web portal with mobile responsiveness and secure web architecture."
    if observation_type not in ("MANUAL_WORKFLOW", "DIRECT_EMAIL_INTAKE"):
        return ""
    text = observation.lower()
    if re.search(r'\b(?:dining\s+table|table\s+reservation|table\s+booking|catering|menu|dining)\b', text) or industry == "restaurant":
        workflow = "table reservations, catering inquiries and menu access"
    elif industry == "hospitality":
        workflow = "guest bookings and reservation inquiries"
    elif industry == "events":
        workflow = "event bookings and registration inquiries"
    elif industry in ("education", "training"):
        workflow = "admissions and application inquiries"
    elif industry == "retail":
        workflow = "product and order inquiries"
    else:
        workflow = "customer inquiries and service requests"
    return f"Offer an online workflow for {workflow}, based on the documented intake process."


def corroborated_identity(name, text):
    generic = {'the','and','private','limited','pvt','ltd','college','school','university',
               'institute','academy','hotel','restaurant','resort','services','company','group'}
    words = [w for w in re.findall(r'[a-z]{3,}', str(name).lower()) if w not in generic]
    observed = set(re.findall(r'[a-z]{3,}', text.lower()))
    if not words:
        return True
    matched = sum(1 for w in words if w in observed)
    return matched >= max(1, len(words) - 1) if len(words) > 1 else matched == 1


def workflow_project(observation):
    text = observation.lower()
    rules = [
        (r'\b(?:menu|food|ordering|catering)\b', 'Campus Kiosk'),
        (r'\b(?:event|banquet|ticket|conference)\b', 'Event Operations Platform'),
        (r'\b(?:room|hostel|accommodation)\b', 'Hostel Room Allocation Suite'),
        (r'\b(?:invoice|billing|tax|ledger)\b', 'Enterprise Invoicing Suite'),
        (r'\b(?:attendance|workforce|shift|staff scheduling)\b', 'Internal Workforce Operations Suite'),
    ]
    name = next((project for pattern, project in rules if re.search(pattern, text)), 'OneFolk website')
    return next((p for p in load_portfolio() if p['project'] == name), {})


class StrictResearcher(ProspectResearcher):
    def __init__(self, fetcher):
        super().__init__(fetcher)
        self.proof_cache = {}

    def _formulate_observation(self, base_url, contexts, signals):
        # 1. Manual / offline document or form workflow (only where offline/physical submission is explicitly required)
        manual_pattern = re.compile(
            r'[^.!?]{0,100}(?:(?:submit|send|mail|courier)\s+(?:the\s+)?(?:application|registration|admission|booking)\s+(?:form\s+)?(?:in\s+person|to\s+the\s+(?:admission|office)|by\s+post|by\s+courier)|'
            r'(?:print|collect\s+in\s+person)\s+(?:the\s+)?(?:form|application|registration)|'
            r'(?:email|send|forward)\s+(?:the\s+)?(?:completed|filled|duly\s+filled)\s+(?:application|registration|admission)?\s*form\s+to\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|'
            r'download\s+(?:the\s+)?(?:admission|registration|application)\s+form\s+and\s+(?:submit|send|mail|courier|deposit))[^.!?]{0,80}',
            re.I
        )
        for text, url in contexts:
            # Exclude if context confirms an active online admission/application portal already exists
            if re.search(r'\b(?:apply\s+online|online\s+admission|online\s+application|admission\s+portal|register\s+online|login\s+to\s+(?:the\s+)?admission)\b', text, re.I):
                continue
            match = manual_pattern.search(text)
            if match:
                return 'Your site states: "' + match.group(0).strip()[:160] + '".', url, 'MANUAL_WORKFLOW'

        # 2. Direct intake where offline email intake is specifically instructed for transactions/intake
        intake_pattern = re.compile(
            r'[^.!?]{0,80}(?:(?:email|send|forward|mail)\s+(?:all\s+)?(?:admissions?|applications?|orders?|reservations?|bookings?)\s+to\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|'
            r'for\s+(?:table\s+bookings?|room\s+bookings?|catering)\s+(?:please\s+)?(?:email|contact)\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})[^.!?]{0,80}',
            re.I
        )
        for text, url in contexts:
            if re.search(r'\b(?:apply\s+online|book\s+online|reserve\s+online|online\s+booking)\b', text, re.I):
                continue
            match = intake_pattern.search(text)
            if match:
                return 'Your portal states: "' + match.group(0).strip()[:160] + '".', url, 'DIRECT_EMAIL_INTAKE'

        # 3. Confirmed technical defects from verified page scan
        if signals.get('has_mobile_viewport') is False and 'has_mobile_viewport' in signals:
            return (
                "The homepage is missing standard mobile viewport configuration meta tags.",
                base_url,
                "TECHNICAL_DEFECT"
            )
        if signals.get('has_https') is False and 'has_https' in signals:
            return (
                "The site is currently served over insecure HTTP without automatic HTTPS redirection.",
                base_url,
                "TECHNICAL_DEFECT"
            )

        return '', '', 'NEEDS_RESEARCH'

    def investigate(self, candidate):
        result = super().investigate(candidate)
        if not result:
            return None

        # Pass through status if landing page was unavailable
        if result.get('qualification_status') == 'WEBSITE_UNAVAILABLE':
            return result

        result['company_id'] = company_id(result['website'])
        result['last_verified_at'] = result['timestamp']
        result['mail_domain_status'] = 'MX_VALID_MAILBOX_UNCONFIRMED'
        result['verification_confidence'] = 'Public website + syntax + MX; mailbox and inbox delivery unconfirmed'
        result['strict_grounding'] = True
        result['opportunity'] = workflow_opportunity(
            result.get('industry', candidate.get('industry', 'other')),
            result['observation_type'], result['observation'])

        # Match workflow evidence to relevant proof, not an unrelated industry product.
        project = workflow_project(result['observation'])
        result['proof_project'] = project.get('project', '')
        result['proof_line'] = project.get('proof', '')
        result['proof_url'] = project.get('evidence_url', '')
        if result['proof_url'] not in self.proof_cache:
            html = self.fetcher.fetch_html(result['proof_url']) if result['proof_url'] else None
            text = BeautifulSoup(html or '', 'html.parser').get_text(' ', strip=True).lower()
            from urllib.parse import urlsplit
            anchor = urlsplit(result['proof_url']).fragment
            soup = BeautifulSoup(html or '', 'html.parser')
            supported = (not anchor or soup.find(id=anchor) is not None
                         or project['project'].lower() in text)
            self.proof_cache[result['proof_url']] = bool(html and 'onefolk' in text and supported)
        result['proof_verified'] = 'YES' if self.proof_cache.get(result['proof_url']) else 'NO'

        # Require the business name to be corroborated by the fetched official page or title
        page_text = ' '.join(t for t, _ in result['page_contexts']).lower()
        identity = corroborated_identity(candidate.get('name', ''), page_text)
        is_evidenced = bool(identity and result['opportunity'] and result['proof_verified'] == 'YES')

        has_email = bool(result.get('public_email'))
        score = int(result.get('priority_score', result.get('qualification_score', 80)) or 0)
        result['priority_score'] = score

        if is_evidenced and has_email:
            result['qualification_status'] = 'QUALIFIED_CONTACTABLE'
            result['priority_tier'] = 'TOP_10_PRIORITY' if score >= 80 else 'SECONDARY_BACKLOG'
        elif is_evidenced and not has_email:
            result['qualification_status'] = 'QUALIFIED_CONTACT_MISSING'
            result['priority_tier'] = 'QUALIFIED_CONTACT_MISSING'
        else:
            result['qualification_status'] = 'NEEDS_OPPORTUNITY_EVIDENCE'
            result['priority_tier'] = 'NEEDS_OPPORTUNITY_EVIDENCE'

        return result
