"""Restrict supported production write entry points to the serialized workflow."""
import os


def require_production_writer():
    repo = os.getenv('GITHUB_REPOSITORY', '')
    expected = repo + '/.github/workflows/morning_queue.yml@refs/heads/main'
    if (os.getenv('GITHUB_ACTIONS') != 'true'
            or repo not in ('onefolk/Client-Automation', 'Giridharan-E/Client-Automation')
            or os.getenv('GITHUB_WORKFLOW_REF') != expected
            or not os.getenv('GITHUB_RUN_ID')):
        raise RuntimeError('Production pipeline writes must run through the serialized Morning Queue workflow on main. Local execution is read-only/test-only.')
