"""Regression tests for the end-to-end automation audit; no live service writes."""
import io
import json
import time
from unittest.mock import Mock, patch
import pytest
from src.network import SafeFetcher, read_bounded
from src.quality import validate_queued_draft, eligible_queue
from src.suppression import SuppressionManager
from tests.test_morning_queue import valid_record


def response(data=b'', status=200, headers=None):
    stream = io.BytesIO(data)
    raw = Mock()
    raw._connection = None
    raw.read1.side_effect = lambda n, **kw: stream.read(n)
    result = Mock(status_code=status, headers=headers or {'Content-Type':'text/html'}, raw=raw)
    return result


def test_payload_bounds_and_deadline():
    assert read_bounded(response(b'abc'), 3, time.monotonic()+1) == b'abc'
    for r in (response(b'abcd'), response(b'abc', headers={'Content-Length':'4'}),
              response(b'abc', headers={'Content-Encoding':'gzip'})):
        with pytest.raises(ValueError): read_bounded(r, 3, time.monotonic()+1)
    with pytest.raises(TimeoutError): read_bounded(response(b'a'), 3, time.monotonic()-1)


def test_pinned_connections_remain_isolated_after_second_fetcher():
    first = SafeFetcher(); first.dns_map['fixture.test'] = '8.8.8.8'
    second = SafeFetcher(); second.dns_map['fixture.test'] = '1.1.1.1'
    with patch('src.network.urllib3_conn.create_connection') as connect:
        for fetcher, expected in [(first,'8.8.8.8'), (second,'1.1.1.1')]:
            pool = fetcher.session.get_adapter('http://').poolmanager.connection_from_url('http://fixture.test')
            pool._new_conn()._new_conn()
            assert connect.call_args.args[0] == (expected,80)


def test_redirect_rechecks_robots_and_never_fetches_denied_path(monkeypatch):
    from src.permitted_fetcher import PermittedFetcher
    monkeypatch.setattr('socket.getaddrinfo', lambda *a: [(2,1,6,'',('8.8.8.8',443))])
    fetcher = PermittedFetcher()
    responses = [response(b'User-agent: *\nDisallow: /blocked'), response(status=302,headers={'Location':'/blocked'})]
    fetcher.session.get = Mock(side_effect=responses)
    assert fetcher.fetch_html('https://fixture.test/start') is None
    assert fetcher.session.get.call_count == 2
    assert all(r.close.called for r in responses)


def test_oversized_robots_never_fetches_html(monkeypatch):
    from src.permitted_fetcher import PermittedFetcher
    monkeypatch.setattr('socket.getaddrinfo', lambda *a: [(2,1,6,'',('8.8.8.8',443))])
    fetcher = PermittedFetcher(); r = response(b'x'*100001)
    fetcher.session.get = Mock(return_value=r)
    assert fetcher.fetch_html('https://fixture.test/') is None
    assert fetcher.session.get.call_count == 1 and r.close.called


@pytest.mark.parametrize('key', ['email_body','public_email','website','industry','last_verified_at'])
@pytest.mark.parametrize('value', [False, 42, [], {}])
def test_malformed_row_is_quarantined(key, value):
    row = {**valid_record(), key:value}
    assert not validate_queued_draft(row)[0]
    ready, issues = eligible_queue([row], SuppressionManager())
    assert not ready and len(issues)==1


def test_writer_policy_requires_designated_workflow(monkeypatch):
    from src.writer_policy import require_production_writer
    for key in ('GITHUB_ACTIONS','GITHUB_REPOSITORY','GITHUB_WORKFLOW_REF','GITHUB_RUN_ID'):
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(RuntimeError): require_production_writer()
    monkeypatch.setenv('GITHUB_ACTIONS','true')
    monkeypatch.setenv('GITHUB_REPOSITORY','onefolk/Client-Automation')
    monkeypatch.setenv('GITHUB_WORKFLOW_REF','onefolk/Client-Automation/.github/workflows/morning_queue.yml@refs/heads/main')
    monkeypatch.setenv('GITHUB_RUN_ID','123')
    require_production_writer()
    monkeypatch.setenv('GITHUB_WORKFLOW_REF','onefolk/Client-Automation/.github/workflows/ci.yml@refs/heads/main')
    with pytest.raises(RuntimeError): require_production_writer()


def test_cli_shortfall_exit_code(monkeypatch):
    from src.cli import main
    monkeypatch.setattr('sys.argv',['onefolk','morning-queue'])
    monkeypatch.setattr('src.morning_queue.MorningQueueManager.run',lambda *a,**kw:{'status':'SHORTFALL'})
    with pytest.raises(SystemExit) as exc: main()
    assert exc.value.code == 2


def test_legacy_live_entry_uses_current_orchestrator(monkeypatch):
    from src.cli import run_pipeline
    call = Mock(return_value={'status':'READY'})
    monkeypatch.setattr('src.morning_queue.MorningQueueManager.run',call)
    assert run_pipeline(target_count=10)['status']=='READY'
    call.assert_called_once()


def test_identity_and_workflow_portfolio():
    from src.strict_research import corroborated_identity, workflow_project
    assert not corroborated_identity('Example College','Welcome to Another College')
    assert corroborated_identity("St Xavier College", "Welcome to St Xavier College")
    assert workflow_project('Download our catering menu')['project']=='Campus Kiosk'
    assert workflow_project('Room reservations by email')['project']=='Hostel Room Allocation Suite'
    assert workflow_project('Event tickets by email')['project']=='Event Operations Platform'
    assert workflow_project('Invoice requests by email')['project']=='Enterprise Invoicing Suite'
    assert workflow_project('Staff attendance records')['project']=='Internal Workforce Operations Suite'
    assert workflow_project('Admissions information')['project']=='OneFolk website'


def test_dashboard_reply_metrics_and_fail_closed():
    from src.sheets import SheetsManager
    manager=SheetsManager(); manager.spreadsheet=Mock(); dash=Mock()
    manager.ensure_tab=Mock(return_value=dash)
    manager.spreadsheet.worksheet.return_value.get_all_records.return_value=[
        {'status':'POSITIVE_REPLY'},{'status':'BOUNCED'},{'status':'DECLINED'},{'status':'SENT'}]
    manager.update_dashboard()
    metrics=dict((r[0],r[1]) for r in dash.update.call_args.kwargs['values'][1:])
    assert metrics['Emails sent']==4 and metrics['Positive replies']==1
    dash.reset_mock()
    manager.spreadsheet.worksheet.side_effect=RuntimeError('unavailable')
    with pytest.raises(RuntimeError):manager.update_dashboard()
    dash.update.assert_not_called()
    dash.clear.assert_not_called()


def test_robots_redirect_to_www_is_followed_and_page_fetched(monkeypatch):
    from src.permitted_fetcher import PermittedFetcher
    monkeypatch.setattr('socket.getaddrinfo', lambda *a: [(2,1,6,'',('8.8.8.8',443))])
    fetcher = PermittedFetcher()
    monkeypatch.setattr('time.sleep', lambda s: None)
    responses = [
        response(status=301, headers={'Location': 'https://www.fixture.test/robots.txt'}),
        response(b'User-agent: *\nAllow: /'),
        response(b'<html>ok</html>'),
    ]
    fetcher.session.get = Mock(side_effect=responses)
    assert fetcher.fetch_html('https://fixture.test/') == '<html>ok</html>'


def test_robots_redirect_to_another_company_is_denied(monkeypatch):
    from src.permitted_fetcher import PermittedFetcher
    monkeypatch.setattr('socket.getaddrinfo', lambda *a: [(2,1,6,'',('8.8.8.8',443))])
    fetcher = PermittedFetcher()
    fetcher.session.get = Mock(side_effect=[response(status=301, headers={'Location': 'https://other.example/robots.txt'})])
    assert fetcher.fetch_html('https://fixture.test/') is None
    assert fetcher.session.get.call_count == 1


def test_http_only_site_is_reached_and_reported_without_https():
    from src.research import ProspectResearcher
    html = '<html><head><title>Old College</title></head><body>Welcome</body></html>'

    class Fetcher:
        last_url = None
        count = 0
        def fetch_html(self, url):
            if url.startswith('https://'):
                return None
            self.last_url = url
            return html

    research = ProspectResearcher(Fetcher()).investigate(
        {'website': 'https://oldcollege.in', 'name': 'Old College', 'industry': 'education'})
    assert research['qualification_status'] != 'WEBSITE_UNAVAILABLE'
    assert research['website'].startswith('http://')
