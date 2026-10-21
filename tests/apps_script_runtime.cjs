// Execute shipped Apps Script source, not a Python reimplementation.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const props=new Map(); let sent=0;
const context={console,Logger:{log(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>crypto.createHash('sha256').update(s).digest(),base64Encode:b=>Buffer.from(b).toString('base64')},
  GmailApp:{sendEmail(){sent++},createDraft(){sent++;throw Error('Must not reach Gmail')}},Date};
vm.createContext(context);
vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8')+'\n'+fs.readFileSync('apps-script/Morning.gs','utf8'),context);
props.set('ENABLE_SENDING','YES');
vm.runInContext('approvedSender()',context); assert.equal(sent,0,'Implementation interlock must defeat runtime enable flag');
const r={lead_id:'test',company_id:'test-co',business:'Fixture',industry:'education',website:'https://fixture.edu/',public_email:'info@fixture.edu',
  email_source_url:'https://fixture.edu/contact',observation:'Download application form',observation_url:'https://fixture.edu/admission',opportunity:'Online form',
  proof_project:'OneFolk website',proof_line:'Our team designed and built the OneFolk website.',proof_url:'https://onefolk.in/work',
  last_verified_at:new Date().toISOString(),subject:'Application process',email_body:'Your application form is downloadable.\n\nOur team designed and built the OneFolk website.\n\nWould online submission help?',
  alt_opening_1:'Your site provides an application form.',alt_opening_2:'I saw your downloadable form.',qualification_status:'QUALIFIED',
  mail_domain_status:'MX_VALID_MAILBOX_UNCONFIRMED',proof_verified:'YES',status:'APPROVED',approval:'APPROVED'};
context.record=r;
assert.equal(vm.runInContext('reviewableRecord(record)',context),true);
context.headers=Object.fromEntries(Object.keys(r).map((k,i)=>[k,i]));context.row=Object.values(r);
assert.equal(vm.runInContext('isValidApprovedDraft(row,headers)',context),false,'Dual keys without durable audit cannot send');
props.set('APPROVAL_test',vm.runInContext('draftFingerprint(record)',context));
assert.equal(vm.runInContext('isValidApprovedDraft(row,headers)',context),true);
context.row[context.headers.subject]='Changed after approval';
assert.equal(vm.runInContext('isValidApprovedDraft(row,headers)',context),false,'Edits invalidate approval');
context.record={...r,last_verified_at:'invalid'};
assert.equal(vm.runInContext('reviewableRecord(record)',context),false);
console.log('Apps Script runtime: interlock, evidence, auditable approval and post-approval edit checks passed');

// A separate sandbox lifts ONLY the compile-time lock to exercise Gmail outcomes with mocks.
const testContext={...context,LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
  MailApp:{getRemainingDailyQuota:()=>20}};
testContext.Utilities={...context.Utilities,formatDate:()=> '2026-10-22',sleep(){}};
let attempts=0;
testContext.GmailApp={createDraft:()=>({send:()=>{attempts++;throw Error('Ambiguous provider timeout');}})};
vm.createContext(testContext);
vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8').replace('const IMPLEMENTATION_SENDING_LOCK = true;','const IMPLEMENTATION_SENDING_LOCK = false;')+'\n'+fs.readFileSync('apps-script/Morning.gs','utf8'),testContext);
const fields=Object.keys(r), r2={...r,lead_id:'test2',company_id:'second',website:'https://second.edu',public_email:'info@second.edu',email_source_url:'https://second.edu/contact',observation_url:'https://second.edu/apply'};
const sheet={getDataRange:()=>({getValues:()=>[fields,Object.values(r),Object.values(r2)]}),getRange:()=>({setValue(){}})};
testContext.book={getSheetByName:()=>sheet};
testContext.SpreadsheetApp={flush(){}};
vm.runInContext('getSpreadsheet=()=>book; buildSuppressionSet=()=>new Set();',testContext);
props.set('APPROVAL_test',context.draftFingerprint(r));
props.set('APPROVAL_test2',context.draftFingerprint(r2));
props.set('SENT_2026-10-22','49');
vm.runInContext('approvedSender()',testContext);
assert.equal(attempts,1,'One remaining recipient budget permits only one uncertain attempt');
assert.equal(Number(props.get('SENT_2026-10-22')),50);
console.log('Apps Script runtime: ambiguous provider outcomes respect the 50-recipient cap');
