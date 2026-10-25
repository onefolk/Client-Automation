import pytest
from src.email_validator import validate_email_body, parse_email_paragraphs, BANNED_PHRASES

OBSERVATION = 'Your BCA course outcomes page displays “Website Under Construction.”'
RELEVANCE = 'Adding the relevant programme outcomes and syllabus information could help prospective students access essential course details more easily.'
CAPABILITY = 'At OneFolk, we help institutions improve website content and structure.'
CTA = 'Could you direct us to the person responsible for website updates?'
BODY = "\n\n".join([OBSERVATION, RELEVANCE, CAPABILITY, CTA])


def test_reference_sample_and_four_paragraphs():
    combined = OBSERVATION + ' ' + RELEVANCE + "\n\n" + CAPABILITY + "\n\n" + CTA
    for copy in (BODY, combined):
        full = 'Dear Swarnandhra College Team,\n\n' + copy + '\n\nRegards,\nTeam OneFolk\nhttps://onefolk.in/'
        ok, reason, details = validate_email_body(full)
        assert ok, reason
        assert details['word_count'] == len(copy.split())
        assert details['word_count'] == 48


@pytest.mark.parametrize('count,expected', [(39,False),(40,True),(50,True),(90,True),(120,True),(121,False)])
def test_body_word_boundaries(count, expected):
    parts = ['Your website lists course details.', 'This could help students find information.', CAPABILITY, CTA]
    base = sum(len(p.split()) for p in parts)
    parts[1] += ' details' * (count-base)
    body = '\n\n'.join(parts)
    assert validate_email_body(body)[0] is expected


@pytest.mark.parametrize('phrase', ['I', "I'm", "I've", "I'd", 'I’m', 'I’ve', 'my team', 'MY COMPANY', 'myself'])
def test_no_singular_voice(phrase):
    assert not validate_email_body(BODY.replace('Your BCA', phrase + ' saw your BCA'))[0]


@pytest.mark.parametrize('phrase', BANNED_PHRASES)
def test_banned_phrases(phrase):
    assert not validate_email_body(BODY.replace(RELEVANCE, RELEVANCE + ' ' + phrase.upper()))[0]


@pytest.mark.parametrize('cta', ['Let us discuss this.', 'Could we talk? Who owns this?', 'Book a meeting now?'])
def test_requires_one_low_pressure_question(cta):
    assert not validate_email_body(BODY.replace(CTA, cta))[0]


def test_intro_order_and_missing_relevance():
    assert not validate_email_body(BODY.replace(OBSERVATION, 'At OneFolk, ' + OBSERVATION))[0]
    assert not validate_email_body(BODY.replace(CAPABILITY, 'We can help with this website change.'))[0]
    assert not validate_email_body('\n\n'.join([OBSERVATION, CAPABILITY, CTA]))[0]


def test_signature_does_not_hide_extra_content():
    malicious = BODY + '\n\nRegards, we guarantee exponential growth and I want a meeting.'
    assert not validate_email_body(malicious)[0]


@pytest.mark.parametrize('replacement', ['me', 'myself', 'streamline', 'seamless', 'cutting-edge', 'synergy', 'game-changer', 'exponential', 'unlock'])
def test_official_voice_and_buzzwords(replacement):
    assert not validate_email_body(BODY.replace(RELEVANCE, RELEVANCE + ' ' + replacement))[0]


def test_python_apps_script_official_format_parity():
    import json
    import subprocess
    from pathlib import Path
    reference = (
        "Dear St. Xavier's College Team,\n\n"
        "Your postgraduate diploma admissions process asks applicants to download Form A, complete it by hand, and email it to the admissions team. "
        "An online application and document-upload system could simplify submissions and make applications easier to manage.\n\n"
        "At OneFolk, we build online applications and document-management systems for institutions.\n\n"
        "Could you direct us to the person responsible for admissions technology?\n\n"
        "Regards,\nTeam OneFolk\nhttps://onefolk.in/"
    )
    cases = [(reference, True), (BODY, True), (reference.replace('\n', '\r\n'), True)]
    cases.extend([(BODY.replace('Your BCA', '\u03b1I saw your BCA'), False),
                  (BODY.replace(' ', '\x1c'), True), (BODY.replace(' ', '\u00a0'), True),
                  (BODY.replace(' ', '\u0085'), True)])
    for phrase in ['me', 'myself', 'streamline', 'seamless', 'cutting-edge', 'synergy', 'game-changer', 'exponential', 'unlock']:
        cases.append((BODY.replace(RELEVANCE, RELEVANCE + ' ' + phrase), False))
    # Single sentence with St. Xavier's must fail (abbreviation must not count as a sentence break)
    single_sentence_with_abbr = reference.replace(" An online application and document-upload system could simplify submissions and make applications easier to manage.", "")
    cases.append((single_sentence_with_abbr, False))
    cases.extend([
        (BODY.replace(RELEVANCE, RELEVANCE + ' https://example.com/?page=1'), False),
        (BODY.replace(CTA, 'Could you help. Please contact us?'), False),
        (BODY.replace(CTA, 'Could!!! you direct us to the right person?'), False),
        (BODY.replace(CTA, 'Could you help? Would you reply?'), False),
    ])
    script = """const fs=require('fs'),vm=require('vm');const c={};vm.createContext(c);
vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),c);
console.log(JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')).map(body=>c.validateEmailStructure(body).isValid)));"""
    result = subprocess.run(['node', '-e', script], input=json.dumps([body for body, _ in cases]),
                            capture_output=True, text=True, encoding='utf-8', check=True,
                            cwd=Path(__file__).resolve().parents[1])
    assert json.loads(result.stdout) == [expected for _, expected in cases]
    assert [validate_email_body(body)[0] for body, _ in cases] == [expected for _, expected in cases]
