"""The dashboard's Manual Search page: server behaviour, option lists and page wiring."""
import ast
import json
import re
import subprocess

from src.config import load_campaigns


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def gs_list(name):
    match = re.search(r'const ' + name + r' = (\[.*?\]);', read('apps-script/WebApp.gs'))
    return ast.literal_eval(match.group(1))


def workflow_options(name):
    text = read('.github/workflows/morning_queue.yml')
    block = re.search(r'^      ' + name + r':\n(.*?)\n        default', text, re.M | re.S).group(1)
    listed = re.search(r'options: \[(.*?)\]', block, re.S).group(1)
    return [o.strip() for o in listed.replace('\n', ' ').split(',')]


def test_server_runtime():
    result = subprocess.run(['node', 'tests/manual_search_runtime.cjs'], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr or result.stdout


def test_option_lists_match_workflow_and_campaign():
    campaign = load_campaigns()['campaigns']['all_industries_pilot']
    assert gs_list('MANUAL_SEARCH_CITIES') == ['all'] + campaign['target_cities'] == workflow_options('city')
    assert gs_list('MANUAL_SEARCH_INDUSTRIES') == ['all'] + campaign['industries'] == workflow_options('industry')
    assert gs_list('MANUAL_SEARCH_MODES') == workflow_options('mode')
    assert gs_list('MANUAL_SEARCH_LANES') == workflow_options('lane')


def test_page_is_wired_into_dashboard():
    html = read('apps-script/Index.html')
    for marker in ('id="tabBtn-manual"', 'id="tab-manual"', "loadManualSearch()", 'apiGetManualSearchConfig',
                   "api.call('apiTriggerManualSearch'", 'GITHUB_DISPATCH_TOKEN', 'manualHistoryBody'):
        assert marker in html, marker
    assert "else if (tabId === 'manual') loadManualSearch();" in html
    assert 'GITHUB_DISPATCH_TOKEN' not in re.sub(r'<code>GITHUB_DISPATCH_TOKEN</code>', '', html), \
        'the page may name the setting in help text only'


def test_dashboard_scripts_compile():
    html = read('apps-script/Index.html')
    # Apps Script fills <?= ?> and <?!= ?> tags on the server; stand in a harmless value to compile.
    scripts = [re.sub(r'<\?!?=.*?\?>', '0', s, flags=re.S) for s in re.findall(r'<script>(.*?)</script>', html, re.S)]
    assert scripts
    check = 'const vm=require("vm");for(const s of JSON.parse(require("fs").readFileSync(0,"utf8"))) new vm.Script(s);'
    result = subprocess.run(['node', '-e', check], input=json.dumps(scripts), capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


def test_manifest_allows_github_calls():
    scopes = json.loads(read('apps-script/appsscript.json'))['oauthScopes']
    assert 'https://www.googleapis.com/auth/script.external_request' in scopes
