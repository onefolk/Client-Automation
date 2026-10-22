"""Qualify only a concrete, source-backed workflow improvement."""
import re
from bs4 import BeautifulSoup
from src.research import ProspectResearcher
from src.config import load_portfolio
from src.open_discovery import company_id

class StrictResearcher(ProspectResearcher):
    def __init__(self, fetcher):
        super().__init__(fetcher)
        self.proof_cache = {}

    def _formulate_observation(self, base_url, contexts, signals):
        # 1. Manual / offline document or form workflow
        manual_pattern = re.compile(
            r'[^.!?]{0,100}(?:download[^.!?]{0,50}(?:application|registration|booking|admission|enrollment|membership|prospectus|brochure) form|'
            r'(?:email|send|submit|forward)[^.!?]{0,65}(?:completed|filled|duly filled)[^.!?]{0,25}form|'
            r'(?:print|collect|submit in person)[^.!?]{0,50}(?:form|application)|'
            r'submit (?:the )?(?:application|form) (?:in person|to the (?:admission|office)|by post|by courier)|'
            r'download (?:the )?(?:admission|registration|application) (?:form|prospectus|brochure))[^.!?]{0,80}',
            re.I
        )
        for text, url in contexts:
            match = manual_pattern.search(text)
            if match:
                return 'Your site states: "' + match.group(0).strip()[:160] + '".', url, 'MANUAL_WORKFLOW'

        # 2. Direct email intake for admissions or inquiries
        intake_pattern = re.compile(
            r'[^.!?]{0,80}(?:(?:email|send|forward|submit|mail)\s+(?:all\s+)?(?:inquir(?:y|ies)|enquir(?:y|ies)|admissions?|applications?|queries)\s+to\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|'
            r'for admissions?(?:\s+inquiries)?(?:,\s*|\s+)?(?:please\s+)?(?:contact|email|reach us at)\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|'
            r'for enquiries?(?:\s+and admissions?)?(?:,\s*|\s+)?(?:please\s+)?(?:contact|email|reach us at)\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})[^.!?]{0,80}',
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
        if result['observation_type'] == 'MANUAL_WORKFLOW':
            result['opportunity'] = 'Offer an online submission workflow for the explicitly documented manual form process.'
        elif result['observation_type'] == 'DIRECT_EMAIL_INTAKE':
            result['opportunity'] = 'Offer an automated digital admissions and inquiry portal to replace manual email routing.'
        elif result['observation_type'] == 'TECHNICAL_DEFECT':
            result['opportunity'] = 'Modernize the web portal with mobile responsiveness and secure web architecture.'
        else:
            result['opportunity'] = ''
        # Match workflow evidence to relevant proof, not an unrelated industry product.
        project = next((p for p in load_portfolio() if p['project']=='OneFolk website'), {})
        result['proof_project'] = project.get('project','')
        result['proof_line'] = project.get('proof','')
        result['proof_url'] = project.get('evidence_url','')
        if result['proof_url'] not in self.proof_cache:
            html = self.fetcher.fetch_html(result['proof_url']) if result['proof_url'] else None
            text = BeautifulSoup(html or '', 'html.parser').get_text(' ',strip=True).lower()
            self.proof_cache[result['proof_url']] = bool(html and 'onefolk' in text)
        result['proof_verified'] = 'YES' if self.proof_cache.get(result['proof_url']) else 'NO'
        # Require the business name to be corroborated by the fetched official page.
        name_words = [w.lower() for w in re.findall(r'[A-Za-z]{3,}', candidate.get('name',''))
                      if w.lower() not in ('the','and','private','limited','pvt','ltd')]
        page_text = ' '.join(t for t,_ in result['page_contexts']).lower()
        identity = bool(name_words and any(w in page_text for w in name_words))
        is_evidenced = bool(identity and result['opportunity'] and result['proof_verified']=='YES')
        result['qualification_status'] = 'QUALIFIED' if is_evidenced else 'NEEDS_RESEARCH'
        score = int(result.get('priority_score', result.get('qualification_score', 80)) or 0)
        result['priority_score'] = score
        result['priority_tier'] = ('TOP_10_PRIORITY' if (is_evidenced and score >= 80)
                                   else ('SECONDARY_BACKLOG' if is_evidenced else 'NEEDS_RESEARCH'))
        return result
