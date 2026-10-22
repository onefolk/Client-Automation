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
        # Absence of a form, presence of booking, or keywords are not sales evidence.
        pattern = re.compile(r'[^.!?]{0,100}(?:download[^.!?]{0,50}(?:application|registration|booking) form|'
                             r'(?:email|send|submit)[^.!?]{0,65}(?:completed|filled)[^.!?]{0,25}form|'
                             r'(?:print|submit in person)[^.!?]{0,50}(?:form|application))[^.!?]{0,80}', re.I)
        for text, url in contexts:
            match = pattern.search(text)
            if match:
                return 'Your site states: "' + match.group(0).strip()[:160] + '".', url, 'MANUAL_WORKFLOW'
        return '', '', 'NEEDS_RESEARCH'

    def investigate(self, candidate):
        result = super().investigate(candidate)
        if not result: return None
        result['company_id'] = company_id(result['website'])
        result['last_verified_at'] = result['timestamp']
        result['mail_domain_status'] = 'MX_VALID_MAILBOX_UNCONFIRMED'
        result['verification_confidence'] = 'Public website + syntax + MX; mailbox and inbox delivery unconfirmed'
        result['strict_grounding'] = True
        result['opportunity'] = ('Offer an online submission workflow for the explicitly documented manual form process.'
                                 if result['observation_type'] == 'MANUAL_WORKFLOW' else '')
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
