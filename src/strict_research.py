"""Qualify only a concrete, source-backed workflow improvement."""
import re
from bs4 import BeautifulSoup
from src.research import ProspectResearcher
from src.config import load_portfolio
from src.open_discovery import company_id

RESEARCH_VERSION = 3


def workflow_opportunity(industry, observation_type, observation):
    if observation_type == "TECHNICAL_DEFECT":
        return "Modernize the web portal with mobile responsiveness and secure web architecture."
    if observation_type not in ("MANUAL_WORKFLOW", "DIRECT_EMAIL_INTAKE"):
        return ""
    text = observation.lower()
    if any(word in text for word in ("menu", "table", "catering")) or industry == "restaurant":
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
    return bool(words) and all(w in observed for w in words)


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
        # 1. Manual / offline document or form workflow
        manual_pattern = re.compile(
            r'[^.!?]{0,100}(?:download[^.!?]{0,50}(?:application|registration|booking|admission|enrollment|membership|prospectus|brochure|menu|catalog|catalogue|rate card|tariff) form|'
            r'(?:email|send|submit|forward)[^.!?]{0,65}(?:completed|filled|duly filled)[^.!?]{0,25}form|'
            r'(?:print|collect|submit in person)[^.!?]{0,50}(?:form|application)|'
            r'submit (?:the )?(?:application|form) (?:in person|to the (?:admission|office)|by post|by courier)|'
            r'download (?:the )?(?:admission|registration|application|menu|tariff|brochure|catalogue) (?:form|prospectus|brochure|pdf)|'
            r'download (?:our |the )?(?:food |dining |takeaway |room |banquet |catering )?menu(?: pdf)?)[^.!?]{0,80}',
            re.I
        )
        for text, url in contexts:
            match = manual_pattern.search(text)
            if match:
                return 'Your site states: "' + match.group(0).strip()[:160] + '".', url, 'MANUAL_WORKFLOW'

        # 2. Direct email intake for admissions, inquiries, orders, bookings, reservations
        intake_pattern = re.compile(
            r'[^.!?]{0,80}(?:(?:email|send|forward|submit|mail)\s+(?:all\s+)?(?:inquir(?:y|ies)|enquir(?:y|ies)|admissions?|applications?|queries|orders?|reservations?|bookings?|feedback)\s+to\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|'
            r'for (?:admissions?|enquir(?:y|ies)|inquir(?:y|ies)|bookings?|reservations?|table bookings?|room bookings?|orders?|quotations?|feedback|events?|banquets?|catering)(?:\s+inquiries)?(?:,\s*|\s+)?(?:please\s+)?(?:contact|email|reach us at|mail)\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|'
            r'(?:table|room|banquet|event|hall|catering)\s+reservations?(?:\s+or\s+inquiries)?(?:,\s*|\s+)?(?:please\s+)?(?:contact|email|reach us at|mail)\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|'
            r'contact us (?:for|at)\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\s+(?:for|to)\s+(?:reservations?|bookings?|orders?|inquiries|quotes?))[^.!?]{0,80}',
            re.I
        )
        for text, url in contexts:
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
        if not result: return None
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
        result['proof_project'] = project.get('project','')
        result['proof_line'] = project.get('proof','')
        result['proof_url'] = project.get('evidence_url','')
        if result['proof_url'] not in self.proof_cache:
            html = self.fetcher.fetch_html(result['proof_url']) if result['proof_url'] else None
            text = BeautifulSoup(html or '', 'html.parser').get_text(' ',strip=True).lower()
            from urllib.parse import urlsplit
            anchor = urlsplit(result['proof_url']).fragment
            soup = BeautifulSoup(html or '', 'html.parser')
            supported = (not anchor or soup.find(id=anchor) is not None
                         or project['project'].lower() in text)
            self.proof_cache[result['proof_url']] = bool(html and 'onefolk' in text and supported)
        result['proof_verified'] = 'YES' if self.proof_cache.get(result['proof_url']) else 'NO'
        # Require the business name to be corroborated by the fetched official page.
        page_text = ' '.join(t for t,_ in result['page_contexts']).lower()
        identity = corroborated_identity(candidate.get('name',''), page_text)
        is_evidenced = bool(identity and result['opportunity'] and result['proof_verified']=='YES')
        result['qualification_status'] = 'QUALIFIED' if is_evidenced else 'NEEDS_RESEARCH'
        score = int(result.get('priority_score', result.get('qualification_score', 80)) or 0)
        result['priority_score'] = score
        result['priority_tier'] = ('TOP_10_PRIORITY' if (is_evidenced and score >= 80)
                                   else ('SECONDARY_BACKLOG' if is_evidenced else 'NEEDS_RESEARCH'))
        return result
