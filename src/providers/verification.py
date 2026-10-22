"""Syntax/MX comparisons; neither implementation claims mailbox existence."""
import json
import subprocess
from pathlib import Path
from src.verifier import is_valid_business_email, is_valid_syntax
from src.network import extract_domain

class PythonVerificationProvider:
    name='python-dns'
    def verify(self,email,official_domain,source_url):
        source_valid=extract_domain(source_url)==official_domain
        valid=source_valid and is_valid_business_email(email,official_domain,check_dns=True)
        return {'provider':self.name,'email':email,'source_url':source_url,'valid':bool(valid),
                'mailbox_confirmed':False,'level':'SYNTAX_AND_MX'}

class TruemailVerificationProvider:
    name='truemail-mx'
    def verify(self,email,official_domain,source_url):
        # Keep provenance/domain rules identical; only the syntax/MX engine differs.
        if extract_domain(source_url)!=official_domain or not is_valid_business_email(email,official_domain,check_dns=False):
            return {'provider':self.name,'email':email,'source_url':source_url,'valid':False,'mailbox_confirmed':False}
        script=Path(__file__).with_name('truemail_check.rb')
        result=subprocess.run(['ruby',str(script)],input=json.dumps({'email':email}),text=True,
                              capture_output=True,timeout=20,check=True)
        result=json.loads(result.stdout)
        return {**result,'provider':self.name,'source_url':source_url,'mailbox_confirmed':False,'level':'SYNTAX_AND_MX'}
