"""Qualify only a concrete, source-backed workflow improvement."""
import re
from bs4 import BeautifulSoup
from src.research import ProspectResearcher
from src.config import load_portfolio
from src.open_discovery import company_id

RESEARCH_VERSION = 5


def workflow_opportunity(industry, observation_type, observation):
    if observation_type == "PAGE_UNDER_CONSTRUCTION":
        return "Improve website content and structure with complete program/service information."
    if observation_type in ("TECHNICAL_DEFECT", "MOBILE_VIEWPORT_DEFECT"):
        return "Modernize the web portal with mobile responsiveness and secure web architecture."
    if observation_type == "INSECURE_HTTP":
        return "Implement automatic HTTPS encryption and modern secure web architecture."
    if observation_type == "BROKEN_INTERNAL_LINK":
        return "Repair broken navigation pathways and optimize digital user experience."
    if observation_type == "BRANCH_EXPANSION":
        return "Launch a dedicated digital landing page and automated local enquiry system."
    if observation_type == "FRAGMENTED_JOURNEY":
        return "Streamline fragmented manual booking and registration into a unified online portal."
    if observation_type in ("MANUAL_WORKFLOW", "DIRECT_EMAIL_INTAKE"):
        text = observation.lower()
        if "timetable" in text or "time table" in text:
            return ""
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
    return ""


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
    if "timetable" in text or "time table" in text:
        return next((p for p in load_portfolio() if p['project'] == 'OneFolk website'), {})
    rules = [
        (r'\b(?:menu|food|ordering|catering|canteen)\b', 'Campus Kiosk'),
        (r'\b(?:event|banquet|ticket|conference|symposium)\b', 'Event Operations Platform'),
        (r'\b(?:room|hostel|accommodation|dormitory)\b', 'Hostel Room Allocation Suite'),
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
        # 1. Technical Opportunity: Under-construction or maintenance notices on internal pages
        construction_pattern = re.compile(
            r'[^.!?]{0,80}\b(?:website|page|section|curriculum|portal|outcomes?)\s+(?:is\s+)?(?:currently\s+)?(?:under\s+construction|under\s+maintenance|coming\s+soon|will\s+be\s+updated\s+soon)\b[^.!?]{0,80}|'
            r'[^.!?]{0,80}\b(?:under\s+construction|under\s+maintenance)\b[^.!?]{0,80}',
            re.I
        )
        for text, url in contexts:
            match = construction_pattern.search(text)
            if match:
                raw_phrase = match.group(0).strip().replace('\n', ' ')
                raw_phrase = re.sub(r'\s+', ' ', raw_phrase)
                return f'Your page displays "{raw_phrase[:140]}".', url, 'PAGE_UNDER_CONSTRUCTION'

        # 2. Technical Opportunity: Confirmed technical defects from verified page scan
        if signals.get('has_mobile_viewport') is False and 'has_mobile_viewport' in signals:
            return (
                "The homepage is missing standard mobile viewport configuration meta tags.",
                base_url,
                "MOBILE_VIEWPORT_DEFECT"
            )
        if signals.get('has_https') is False and 'has_https' in signals:
            return (
                "The site is currently served over insecure HTTP without automatic HTTPS redirection.",
                base_url,
                "INSECURE_HTTP"
            )

        # 3. Commercial Opportunity: Announced expansion / new branch
        expansion_pattern = re.compile(
            r'[^.!?]{0,80}\b(?:announcing\s+(?:our\s+)?new\s+(?:branch|campus|center|centre|facility|location)|'
            r'recently\s+opened\s+(?:our\s+)?new\s+(?:branch|campus|center|centre|facility|location)|'
            r'now\s+open\s+in\s+[A-Za-z]+)\b[^.!?]{0,80}',
            re.I
        )
        for text, url in contexts:
            match = expansion_pattern.search(text)
            if match:
                raw_phrase = re.sub(r'\s+', ' ', match.group(0).strip())
                return f'Your website announces: "{raw_phrase[:140]}".', url, 'BRANCH_EXPANSION'

        # 4. Commercial Opportunity: Fragmented payment / booking journey requiring manual transfer slips
        fragmented_pattern = re.compile(
            r'[^.!?]{0,80}\b(?:send|share|email|whatsapp)\s+(?:the\s+)?(?:payment\s+receipt|bank\s+slip|transaction\s+screenshot|counterfoil)\s+(?:to|via|on)\b[^.!?]{0,80}',
            re.I
        )
        for text, url in contexts:
            match = fragmented_pattern.search(text)
            if match:
                raw_phrase = re.sub(r'\s+', ' ', match.group(0).strip())
                return f'Your registration process states: "{raw_phrase[:140]}".', url, 'FRAGMENTED_JOURNEY'

        # 5. Commercial Opportunity: Manual / offline document or form workflow
        # Exclude: timetables, active online portal, centralized government admissions, syllabus downloads
        manual_pattern = re.compile(
            r'[^.!?]{0,100}(?:(?:submit|send|mail|courier)\s+(?:the\s+)?(?:application|registration|admission|booking)\s+(?:form\s+)?(?:in\s+person|to\s+the\s+(?:admission|office)|by\s+post|by\s+courier)|'
            r'(?:print|collect\s+in\s+person)\s+(?:the\s+)?(?:form|application|registration)|'
            r'(?:email|send|forward)\s+(?:the\s+)?(?:completed|filled|duly\s+filled)\s+(?:application|registration|admission)?\s*form\s+to\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|'
            r'download\s+(?:the\s+)?(?:admission|registration|application)\s+form\s+and\s+(?:submit|send|mail|courier|deposit))[^.!?]{0,80}',
            re.I
        )
        for text, url in contexts:
            # Exclude if context confirms an active online admission/application portal already exists
            if re.search(r'\b(?:apply\s+online|online\s+admission|online\s+application|admission\s+portal|admissions\s+portal|register\s+online|login\s+to\s+(?:the\s+)?admission)\b', text, re.I):
                continue
            # Exclude centralized statutory government entrance/counselling processes
            if re.search(r'\b(?:tnea|kcet|comedk|neet|jee\s+main|cet\s+cell|centralised\s+admission|counselling\s+code)\b', text, re.I):
                continue
            # Exclude if it is merely downloading informational syllabus / prospectus / academic calendar
            if re.search(r'\b(?:download\s+(?:the\s+)?(?:syllabus|prospectus|brochure|academic\s+calendar|curriculum|handbook))\b', text, re.I) and not re.search(r'\b(?:submit|courier|post|in\s+person)\b', text, re.I):
                continue
            # Exclude timetables
            if re.search(r'\b(?:time\s*table|examination\s+schedule)\b', text, re.I):
                continue

            match = manual_pattern.search(text)
            if match:
                raw_phrase = re.sub(r'\s+', ' ', match.group(0).strip())
                return 'Your site states: "' + raw_phrase[:160] + '".', url, 'MANUAL_WORKFLOW'

        # 6. Commercial Opportunity: Direct intake where offline email intake is specifically instructed for transactions/intake
        intake_pattern = re.compile(
            r'[^.!?]{0,80}(?:(?:email|send|forward|mail)\s+(?:all\s+)?(?:admissions?|applications?|orders?|reservations?|bookings?)\s+to\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|'
            r'for\s+(?:table\s+bookings?|room\s+bookings?|catering)\s+(?:please\s+)?(?:email|contact)\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})[^.!?]{0,80}',
            re.I
        )
        for text, url in contexts:
            if re.search(r'\b(?:apply\s+online|book\s+online|reserve\s+online|online\s+booking)\b', text, re.I):
                continue
            if re.search(r'\b(?:time\s*table|examination\s+schedule)\b', text, re.I):
                continue
            # A standard general contact info page is NOT an intake defect
            if re.search(r'\b(?:for\s+general\s+(?:queries|inquiries)|contact\s+details|office\s+hours)\b', text, re.I) and not re.search(r'\b(?:send\s+(?:all\s+)?(?:applications|bookings|orders))\b', text, re.I):
                continue
            match = intake_pattern.search(text)
            if match:
                raw_phrase = re.sub(r'\s+', ' ', match.group(0).strip())
                return 'Your portal states: "' + raw_phrase[:160] + '".', url, 'DIRECT_EMAIL_INTAKE'

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
        result['research_date'] = result['timestamp']
        result['mail_domain_status'] = 'MX_VALID_MAILBOX_UNCONFIRMED'
        result['verification_confidence'] = 'Public website + syntax + MX; mailbox and inbox delivery unconfirmed'
        result['strict_grounding'] = True

        opp_text = workflow_opportunity(
            result.get('industry', candidate.get('industry', 'other')),
            result['observation_type'], result['observation'])
        result['opportunity'] = opp_text

        obs_type = result['observation_type']
        is_tech = obs_type in ("PAGE_UNDER_CONSTRUCTION", "TECHNICAL_DEFECT", "MOBILE_VIEWPORT_DEFECT", "INSECURE_HTTP", "BROKEN_INTERNAL_LINK")
        opp_category = "TECHNICAL_OPPORTUNITY" if is_tech else "COMMERCIAL_OPPORTUNITY"
        result['opportunity_category'] = opp_category
        result['business_relevance'] = opp_text

        if obs_type == "PAGE_UNDER_CONSTRUCTION":
            rec_service = "Website content and UX improvements"
        elif obs_type in ("TECHNICAL_DEFECT", "MOBILE_VIEWPORT_DEFECT", "INSECURE_HTTP"):
            rec_service = "Website design and development"
        elif obs_type == "BRANCH_EXPANSION":
            rec_service = "Landing pages and enquiry management"
        else:
            rec_service = "Workflow and enquiry management automation"
        result['recommended_service'] = rec_service

        # Match workflow evidence to relevant proof, not an unrelated industry product.
        project = workflow_project(result['observation'])
        result['proof_project'] = project.get('project', 'OneFolk website')
        result['proof_line'] = project.get('proof', 'Our team designed and built the OneFolk website.')
        result['proof_url'] = project.get('evidence_url', 'https://onefolk.in/work')
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
        result['confidence_level'] = 'HIGH' if is_evidenced else 'LOW'
        result['qualification_reason'] = result.get('scoring_reasons', '')

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
