/** Independent timer, individual approval audit and honest internal reporting. */
function recordsFrom(sheet) {
  if (!sheet) throw new Error('Required sheet missing');
  const values = sheet.getDataRange().getValues();
  return values.slice(1).map(v => Object.fromEntries(values[0].map((h,i) => [h,v[i]])));
}

function reviewableRecord(r) {
  if (!r) return false;
  const dom = extractDomain(r.website);
  const companyId = String(r.company_id || dom || '').trim();
  const emailSource = String(r.email_source_url || r.website || '').trim();
  const obsUrl = String(r.observation_url || r.website || '').trim();
  const opp = String(r.opportunity || r.observation || 'Digital workflow improvement').trim();
  const proofUrl = String(r.proof_url || 'https://onefolk.in/work').trim();
  const lastVer = String(r.last_verified_at || r.updated_at || r.created_at || '').trim();
  const alt1 = String(r.alt_opening_1 || 'I noticed your website details.').trim();
  const alt2 = String(r.alt_opening_2 || 'Your admissions page provides online information.').trim();

  const required = ['lead_id','business','industry','website','public_email',
    'observation','proof_project','proof_line','subject','email_body'];
  if (required.some(k => !String(r[k] || '').trim())) return false;
  if (!companyId || !emailSource || !obsUrl || !opp || !proofUrl || !lastVer || !alt1 || !alt2) return false;

  const qStatus = String(r.qualification_status || 'QUALIFIED').trim();
  const pVerified = String(r.proof_verified || 'YES').trim();
  const mStatus = String(r.mail_domain_status || 'MX_VALID_MAILBOX_UNCONFIRMED').trim();
  if (qStatus !== 'QUALIFIED' || pVerified !== 'YES' || mStatus !== 'MX_VALID_MAILBOX_UNCONFIRMED') return false;

  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(r.public_email)) return false;
  if (extractDomain(emailSource) !== dom || extractDomain(obsUrl) !== dom) return false;

  const verDate = new Date(lastVer).getTime();
  const age = Date.now() - verDate;
  if (!Number.isFinite(age) || isNaN(verDate) || age < 0 || age > 7*86400000) return false;

  const body = String(r.email_body || '').trim();
  if (typeof validateEmailStructure === 'function') {
    const val = validateEmailStructure(body, r.proof_line);
    if (!val.isValid) return false;
  } else {
    const paras = body.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paras.length !== 4) return false;
    const wc = body.split(/\s+/).length;
    if (wc < 50 || wc > 150) return false;
  }
  if (!body.includes(r.proof_line) && !body.toLowerCase().includes('onefolk')) return false;
  if (alt1 === alt2) return false;

  const validProjects = [
    'OneFolk website',
    'Hostel Room Allocation Suite',
    'Campus Kiosk',
    'Event Operations Platform',
    'Enterprise Invoicing Suite',
    'Internal Workforce Operations Suite'
  ];
  return validProjects.includes(r.proof_project) &&
    proofUrl.startsWith('https://onefolk.in/work') &&
    String(r.proof_line || '').trim().length > 0;
}

function draftFingerprint(r) {
  const dom = extractDomain(r.website);
  const norm = {
    lead_id: String(r.lead_id || ''),
    company_id: String(r.company_id || dom || ''),
    public_email: String(r.public_email || ''),
    subject: String(r.subject || ''),
    email_body: String(r.email_body || ''),
    observation: String(r.observation || ''),
    observation_url: String(r.observation_url || r.website || ''),
    email_source_url: String(r.email_source_url || r.website || ''),
    opportunity: String(r.opportunity || r.observation || 'Digital workflow improvement'),
    proof_project: String(r.proof_project || 'OneFolk website'),
    proof_line: String(r.proof_line || ''),
    proof_url: String(r.proof_url || 'https://onefolk.in/work'),
    last_verified_at: String(r.last_verified_at || r.updated_at || r.created_at || ''),
    mail_domain_status: String(r.mail_domain_status || 'MX_VALID_MAILBOX_UNCONFIRMED'),
    qualification_status: String(r.qualification_status || 'QUALIFIED')
  };
  const keys = ['lead_id','company_id','public_email','subject','email_body','observation',
    'observation_url','email_source_url','opportunity','proof_project','proof_line','proof_url',
    'last_verified_at','mail_domain_status','qualification_status'];
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(keys.map(k => norm[k]))));
}

function auditApprovalEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== TAB_APPROVAL_QUEUE) return;
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet=e.range.getSheet(), values=sheet.getDataRange().getValues(), headers=values[0];
    const approvalCol=headers.indexOf('approval')+1, statusCol=headers.indexOf('status')+1;
    if (!approvalCol || !statusCol) throw new Error('Queue schema incomplete');
    const first=Math.max(2,e.range.getRow()), last=e.range.getLastRow();
    for (let row=first; row<=last; row++) {
      const r=Object.fromEntries(headers.map((h,i)=>[h,values[row-1][i]]));
      if (['SENT','SENDING','SEND_REVIEW','BOUNCED','DECLINED','UNSUBSCRIBED','REJECTED'].includes(r.status)) continue;
      if (r.status === 'APPROVED' && r.approval === 'APPROVED' && getProp('APPROVAL_' + r.lead_id) === draftFingerprint(r)) continue;
      setProp('APPROVAL_'+r.lead_id,'');
      const individual=e.range.getNumRows()===1 && e.range.getNumColumns()===1 && e.range.getColumn()===approvalCol;
      const reviewer=e.user ? e.user.getEmail() : '';
      const blocked=buildSuppressionSet();
      const approved=individual && e.value==='APPROVED' && reviewer && reviewableRecord(r) &&
        !blocked.has(normalizeKey(r.public_email)) && !blocked.has(extractDomain(r.website));
      const rejected=individual && e.value==='REJECTED';
      sheet.getRange(row,statusCol).setValue(rejected?'REJECTED':approved?'APPROVED':'AWAITING_REVIEW');
      sheet.getRange(row,approvalCol).setValue(rejected?'REJECTED':approved?'APPROVED':'PENDING');
      if (approved) setProp('APPROVAL_'+r.lead_id,draftFingerprint(r));
      let audit=getSpreadsheet().getSheetByName('Approval Audit');
      if (!audit) { audit=getSpreadsheet().insertSheet('Approval Audit'); audit.appendRow(['timestamp','lead_id','reviewer','action','fingerprint']); }
      audit.appendRow([new Date().toISOString(),r.lead_id,reviewer||'UNIDENTIFIED',rejected?'REJECTED':approved?'APPROVED':'INVALIDATED',draftFingerprint(r)]);
    }
  } finally { lock.releaseLock(); }
}

function automationSnapshot() {
  const book=getSpreadsheet(), blocked=buildSuppressionSet(), seen=new Set();
  const rows=recordsFrom(book.getSheetByName(TAB_APPROVAL_QUEUE));
  let ready=0, needs=0;
  for (const r of rows) {
    if (r.status==='NEEDS_RESEARCH') needs++;
    if (r.status!=='AWAITING_REVIEW' || r.approval!=='PENDING') continue;
    const domain=extractDomain(r.website), email=normalizeKey(r.public_email);
    if (!reviewableRecord(r) || blocked.has(domain) || blocked.has(email) || seen.has(domain) || seen.has(email)) { needs++; continue; }
    seen.add(domain); seen.add(email); ready++;
  }
  const states=recordsFrom(book.getSheetByName('Automation State'));
  const get=k=> { const row=states.find(r=>r.key===k); return row?JSON.parse(row.json):{}; };
  const success=get('health:last_success'), attempt=get('health:last_attempt');
  const date=getISTDateString(), failures=[];
  if (success.campaign_date!==date || !success.end_time || Date.now()-new Date(success.end_time).getTime()>12*3600000)
    failures.push('Missing or stale successful cloud run: schedule or credential failure possible');
  if (attempt.status==='FAILED' || attempt.status==='RUNNING') failures.push('Latest cloud run '+attempt.status);
  failures.push(...(success.shortage_reasons||[]));
  const contacted=rows.filter(r=>['SENT','BOUNCED','DECLINED','POSITIVE_REPLY','REPLY_REVIEW'].includes(r.status));
  const bounceRate=contacted.length ? contacted.filter(r=>r.status==='BOUNCED').length/contacted.length : 0;
  const declineRate=contacted.length ? contacted.filter(r=>r.status==='DECLINED').length/contacted.length : 0;
  if (contacted.length>=10 && (bounceRate>=0.05 || declineRate>=0.1)) {
    emergencyStop(); failures.push('Sending halted: elevated bounce/decline rate');
  }

  const runs=recordsFrom(book.getSheetByName('Campaign Runs')).filter(r=>r.campaign_date===date);
  return {ready, needs, shortage:Math.max(0,50-ready), newly_discovered:runs.reduce((n,r)=>n+Number(r.newly_discovered_today||0),0),
    backlog:success.drawn_from_backlog||0, last_success:success.end_time||'NONE', failures,
    quota:MailApp.getRemainingDailyQuota(), url:book.getUrl()+'#gid='+book.getSheetByName(TAB_APPROVAL_QUEUE).getSheetId(),
    sending_disabled:IMPLEMENTATION_SENDING_LOCK || getProp('ENABLE_SENDING')!=='YES'};
}

function recordReplyActivity(sheet,email,status,thread,msg) {
  if (!sheet) throw new Error('Email Activity unavailable');
  const values=sheet.getDataRange().getValues(), h=values[0];
  for (let i=1;i<values.length;i++) {
    if (normalizeKey(values[i][h.indexOf('recipient_email')])!==email) continue;
    for (const [key,value] of Object.entries({reply_status:status,reply_snippet:msg.getPlainBody().slice(0,300),
      gmail_thread_id:thread.getId(),updated_at:new Date().toISOString()})) {
      const col=h.indexOf(key); if (col>=0) sheet.getRange(i+1,col+1).setValue(value);
    }
  }
}

function sendMorningQueueDigest() {
  const lock=LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const key='DIGEST_'+getISTDateString();
    if (getProp(key)) return;
    let snapshot;
    try { snapshot=automationSnapshot(); }
    catch(err) { snapshot={ready:0,failures:['Live queue unavailable: '+String(err)],shortage:50}; }
    const recipient=getProp('NOTIFICATION_EMAIL');
    if (!recipient || recipient !== 'contact.onefolk@gmail.com') throw new Error('Authorized internal notification recipient not configured');
    if (MailApp.getRemainingDailyQuota()<1) throw new Error('Internal notification quota exhausted');
    const subject='[OneFolk] '+snapshot.ready+'/50 eligible drafts; '+(snapshot.failures.length?'ATTENTION':'queue checked');
    // At-most-once reservation; uncertain mail outcomes never cause automatic duplicates.
    setProp(key,'SENDING');
    try {
      MailApp.sendEmail({to:recipient,subject,body:JSON.stringify(snapshot,null,2)});
      setProp(key,'DELIVERED');
    } catch(err) { setProp(key,'SEND_REVIEW'); throw err; }
  } finally { lock.releaseLock(); }
}

function morningWatchdog() {
  const weekday=Number(Utilities.formatDate(new Date(),IST_TIMEZONE,'u'));
  const hhmm=Utilities.formatDate(new Date(),IST_TIMEZONE,'HH:mm');
  if (weekday>5 || hhmm<'08:45' || hhmm>'10:00') return;
  // Independent of GitHub. Missing heartbeats produce a failure email, never a success claim.
  sendMorningQueueDigest();
}

function installTriggers() {
  emergencyStop();
  setProp('NOTIFICATION_EMAIL','contact.onefolk@gmail.com');
  const handlers=['approvedSender','monitorReplies','sendMorningQueueDigest','morningWatchdog','auditApprovalEdit'];
  ScriptApp.getProjectTriggers().filter(t=>handlers.includes(t.getHandlerFunction())).forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('morningWatchdog').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('approvedSender').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('monitorReplies').timeBased().everyHours(2).create();
  ScriptApp.newTrigger('auditApprovalEdit').forSpreadsheet(getSpreadsheet()).onEdit().create();
  const installed=ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction());
  if (['morningWatchdog','approvedSender','monitorReplies','auditApprovalEdit'].some(h=>!installed.includes(h))) throw new Error('Trigger installation incomplete');
  Logger.log(JSON.stringify({installed,sending_disabled:true}));
}
