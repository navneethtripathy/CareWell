(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { user: null, page: 'dashboard', overview: null, workers: [], interventions: [], outcomes: [], online: navigator.onLine, forcedOffline: false, cache: null };
  const pageTitles = { dashboard: 'Overview', 'my-health': 'My well-being', department: 'Department insights', recommendations: 'Interventions', 'follow-up': 'Follow-up', governance: 'Trust & governance' };
  const roleLabels = { worker: 'Worker', manager: 'Department manager', occupational_health: 'Occupational health', admin: 'Administrator' };
  let toastTimer;
  let renderVersion = 0;

  function toast(message, error = false) {
    const el = $('#toast'); el.textContent = message; el.classList.toggle('error', error); el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }
  function initials(name = '') { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'CW'; }
  function esc(value = '') { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  function formatDate(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { day:'numeric', month:'short' }); }
  function riskTag(level) { const key = String(level || 'neutral').toLowerCase(); return `<span class="tag ${['low','moderate','high'].includes(key) ? key : 'neutral'}">${esc(level || 'Unknown')}</span>`; }
  function setPage(page) {
    state.page = page; $$('.nav-item[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page));
    $('#breadcrumb-current').textContent = pageTitles[page] || 'Overview'; $('#sidebar').classList.remove('open'); renderPage();
  }
  function api(path, options = {}) {
    if (state.forcedOffline || !navigator.onLine) return Promise.reject(new Error('You are offline. This action will be queued when possible.'));
    return fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      return data;
    });
  }
  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
      const request = indexedDB.open('carewell-cache-v1', 1);
      request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache'); if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true }); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  }
  async function dbGet(store, key) { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction(store, 'readonly'); const req = tx.objectStore(store).get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
  async function dbPut(store, value, key) { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); const req = key === undefined ? tx.objectStore(store).put(value) : tx.objectStore(store).put(value, key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
  async function queueAction(action) { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction('queue', 'readwrite'); tx.objectStore('queue').add({ ...action, queued_at: new Date().toISOString() }); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
  async function queueItems() { try { const db = await openDb(); return await new Promise((resolve, reject) => { const tx = db.transaction('queue', 'readonly'); const req = tx.objectStore('queue').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); } catch { return []; } }
  async function removeQueueItem(id) { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction('queue', 'readwrite'); tx.objectStore('queue').delete(id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
  async function cacheState() { try { await dbPut('cache', { saved_at: new Date().toISOString(), overview: state.overview, workers: state.workers, interventions: state.interventions, outcomes: state.outcomes }, 'latest'); } catch { /* Browser storage can be disabled; online app still works. */ } }
  async function loadCachedState() { try { state.cache = await dbGet('cache', 'latest'); if (state.cache) { state.overview = state.cache.overview; state.workers = state.cache.workers || []; state.interventions = state.cache.interventions || []; state.outcomes = state.cache.outcomes || []; } } catch { state.cache = null; } }
  async function syncQueue() {
    if (state.forcedOffline || !navigator.onLine) return;
    const items = await queueItems();
    for (const item of items) {
      try {
        if (item.type === 'intervention-status') await api(`/api/interventions/${encodeURIComponent(item.intervention_id)}`, { method: 'PATCH', body: JSON.stringify({ status: item.status, note: item.note || '' }) });
        await removeQueueItem(item.id);
      } catch { break; }
    }
    updateConnectionLabel();
  }
  function updateConnectionLabel() {
    const offline = state.forcedOffline || !navigator.onLine;
    const button = $('#offline-toggle'); button.classList.toggle('is-offline', offline);
    $('#connection-label').textContent = offline ? 'Offline · actions queued' : 'Online · synced';
    const dot = $('.status-dot', button); dot.className = `status-dot ${offline ? 'amber' : 'teal'}`;
  }
  async function loadData() {
    try {
      const [overview, workers, interventions, outcomes] = await Promise.all([api('/api/overview'), api('/api/workers'), api('/api/interventions'), api('/api/outcomes')]);
      state.overview = overview; state.workers = workers.workers || []; state.interventions = interventions.interventions || []; state.outcomes = outcomes.outcomes || [];
      await cacheState(); $('#footer-storage').textContent = overview.storage || 'Demo storage'; $('#nav-count').textContent = state.interventions.filter(item => item.status === 'Proposed').length;
      await syncQueue();
    } catch (error) {
      if (!state.overview) await loadCachedState();
      if (state.overview) toast('Showing the most recent cached demo view.'); else toast(error.message, true);
    }
    renderPage(); updateConnectionLabel();
  }
  function showShell() {
    $('#login-screen').classList.add('hidden'); $('#app-shell').classList.remove('hidden');
    $('#user-name').textContent = state.user.name; $('#user-role').textContent = roleLabels[state.user.role] || state.user.role; $('#user-avatar').textContent = initials(state.user.name);
    $$('.nav-item[data-page="my-health"]').forEach(button => button.classList.toggle('hidden', state.user.role === 'manager'));
    $$('.nav-item[data-page="department"]').forEach(button => button.classList.toggle('hidden', state.user.role === 'worker'));
    $$('.nav-item[data-page="governance"]').forEach(button => button.classList.toggle('hidden', !['admin','occupational_health'].includes(state.user.role)));
    setPage(state.user.role === 'worker' ? 'my-health' : 'dashboard'); loadData();
  }
  async function login() {
    const role = $('#role-select').value;
    try { const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ role }) }); state.user = result.user; showShell(); toast('Workspace ready. Demo data is active.'); }
    catch (error) { toast(error.message, true); }
  }
  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); } catch { /* Allow local sign-out even when offline. */ }
    state.user = null; state.overview = null; state.workers = []; state.interventions = []; state.outcomes = []; $('#app-shell').classList.add('hidden'); $('#login-screen').classList.remove('hidden');
  }
  function pageHeading(kicker, title, subtitle, action = '') { return `<div class="page-heading"><div><div class="page-kicker">${kicker}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${action}</div></div>`; }
  function metric(label, value, foot, icon, color = '') { return `<article class="metric-card"><div class="metric-top"><span class="metric-label">${label}</span><span class="metric-icon ${color}">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></article>`; }
  function chartBars() {
    const weeks = [{day:'W1',a:48,b:39},{day:'W2',a:62,b:45},{day:'W3',a:55,b:51},{day:'W4',a:77,b:58},{day:'W5',a:68,b:54},{day:'W6',a:83,b:63},{day:'W7',a:72,b:61}];
    return `<div class="bar-chart">${weeks.map(w => `<div class="bar-group"><div class="bar-pair"><div class="bar" style="height:${w.a}%" title="Workload ${w.a}"></div><div class="bar secondary" style="height:${w.b}%" title="Staff capacity ${w.b}"></div></div><span class="bar-label">${w.day}</span></div>`).join('')}</div><div class="chart-legend"><span class="legend-key"><i class="legend-dot"></i>Workload index</span><span class="legend-key"><i class="legend-dot green"></i>Staff capacity</span></div>`;
  }
  function riskDistribution() {
    const dist = state.overview?.risk_distribution || {Low:2,Moderate:2,High:1}; const total = Object.values(dist).reduce((sum,value)=>sum+value,0)||1;
    return `<div class="risk-breakdown">${[['Low', 'teal'],['Moderate','moderate'],['High','high']].map(([label,cls]) => `<div class="risk-row"><span>${label} risk</span><div class="progress-track"><div class="progress-fill ${cls}" style="width:${Math.round((dist[label]||0)/total*100)}%"></div></div><strong>${dist[label]||0}</strong></div>`).join('')}</div>`;
  }
  function workerTable(rows, includeAction = false) {
    if (!rows.length) return `<div class="empty-state">No worker records available for this role.</div>`;
    return `<div class="table-wrap"><table><thead><tr><th>Team member</th><th>Weekly hours</th><th>Night shifts</th><th>Demo risk</th>${includeAction?'<th>Action</th>':''}</tr></thead><tbody>${rows.map(w=>`<tr><td><div class="person-cell"><span class="mini-avatar">${initials(w.name)}</span><span><strong>${esc(w.name)}</strong><br><span class="muted">${esc(w.role)}</span></span></div></td><td>${w.weekly_hours}h</td><td>${w.night_shifts_28d}</td><td>${w.risk_percent == null ? riskTag('Insufficient evidence') : riskTag(w.risk_level)} <span class="muted">${w.risk_percent == null?'':`${w.risk_percent}%`}</span></td>${includeAction?`<td><button class="button ghost small" data-generate="${esc(w.id)}">Review</button></td>`:''}</tr>`).join('')}</tbody></table></div>`;
  }
  function interventionCards(items = state.interventions) {
    if (!items.length) return `<div class="empty-state">No interventions yet. Generate a plan from a worker record.</div>`;
    const iconFor = category => category === 'Schedule' ? '◷' : category === 'Workload' ? '▥' : category === 'Well-being' ? '♡' : '✳';
    return `<div class="recommendation-list">${items.map(item=>`<article class="recommendation-card"><div class="rec-icon ${item.priority==='High'?'amber':item.category==='Well-being'?'teal':''}">${iconFor(item.category)}</div><div class="rec-body"><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><div class="rec-meta">${riskTag(item.priority==='High'?'High':item.priority==='Medium'?'Moderate':'Low')}<span>${esc(item.category)} · ${esc(item.scope === 'department' ? (item.department || 'Department team') : (item.worker_name || 'Team'))}</span><span>Created ${formatDate(item.created_at)}</span></div>${item.note?`<p><strong>Review note:</strong> ${esc(item.note)}</p>`:''}</div><div class="rec-actions">${canReview() ? `<select class="select-small" data-status-select="${esc(item.id)}" aria-label="Change intervention status"><option ${item.status==='Proposed'?'selected':''}>Proposed</option><option ${item.status==='Approved'?'selected':''}>Approved</option><option ${item.status==='Modified'?'selected':''}>Modified</option><option ${item.status==='Deferred'?'selected':''}>Deferred</option><option ${item.status==='Completed'?'selected':''}>Completed</option></select><button class="button primary small" data-save-status="${esc(item.id)}">Save</button>` : riskTag(item.status)}</div></article>`).join('')}</div>`;
  }
  function canReview() { return ['manager','occupational_health','admin'].includes(state.user?.role); }
  function dashboardPage() {
    const m = state.overview?.metrics || {}; const workers = state.workers;
    return `${pageHeading('WORKFORCE SNAPSHOT','A clearer view of team well-being.','Early signals, understandable context and human-led next steps.',`<span class="date-label">Updated ${new Date().toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}</span>`)}
      <div class="alert-strip"><span class="alert-symbol">✳</span><div><strong>Start with the context, not just the score.</strong><p>Use shift recovery, workload and team conditions to guide a supportive review.</p></div><button class="button secondary small" data-page-link="department">Explore insights ↗</button></div>
      <div class="grid metrics-grid">${metric('Team members',m.workers ?? '—','Demo workforce records','♙','blue')}${metric('Average demo risk',m.average_risk == null?'—':`${m.average_risk}%`,'Synthetic model output','◉','amber')}${metric('High demo risk',m.high_risk ?? '—','Requires context and human review','△','violet')}${metric('Open interventions',m.proposed_interventions ?? '—','Awaiting human review','✳','teal')}</div>
      <div class="grid main-grid"><section class="panel"><div class="panel-header"><div><h2>Workload & capacity trend</h2><p>Illustrative trend · not live hospital data</p></div><span class="tag neutral">7 periods</span></div>${chartBars()}</section><section class="panel"><div class="panel-header"><div><h2>Risk distribution</h2><p>Current synthetic demo records</p></div><span class="tag neutral">${state.overview?.metrics?.workers ?? workers.length} records</span></div>${riskDistribution()}<div class="insight-card"><span class="insight-icon">✧</span><div><strong>What the model cannot tell you</strong><p>Feature contributions describe the model's output; they do not prove cause. Check staffing context and speak with people before acting.</p></div></div></section></div>
      ${state.user.role === 'manager' ? '' : `<section class="panel"><div class="panel-header"><div><h2>Workforce overview</h2><p>Individual records are available only to authorized support roles.</p></div><button class="text-link" data-page-link="department">View department →</button></div>${workerTable(workers, ['occupational_health','admin'].includes(state.user.role))}</section>`}`;
  }
  async function myHealthPage() {
    let detail = null;
    try { const result = await api('/api/workers/worker-001'); detail = result; } catch { /* Use cached list summary if offline. */ }
    const w = detail?.worker || {name:state.user.name,weekly_hours:48,night_shifts_28d:7,consecutive_shifts:3,rest_hours:9,sleep_hours:6.2,workload_index:.82};
    const p = detail?.prediction || null; const pct = p?.risk_percent; const deg = pct == null ? 180 : Math.round(pct*3.6);
    const factors = p?.explanation || [];
    return `${pageHeading('YOUR WELL-BEING','Your well-being matters.','A private, supportive view of your own patterns and available next steps.')}
      <div class="grid main-grid"><section class="panel"><div class="panel-header"><div><h2>Your current demo overview</h2><p>Based on synthetic sample records</p></div>${riskTag(p?.risk_level || 'Demo view')}</div><div class="risk-hero"><div class="gauge" style="background:conic-gradient(${pct>=67?'var(--red)':pct>=38?'var(--amber)':'var(--teal)'} 0deg ${deg}deg,#edf1f5 ${deg}deg 360deg)"><div class="gauge-content"><strong>${pct==null?'—':`${pct}%`}</strong><span>${esc(p?.risk_level || 'No estimate')}</span></div></div><div><h2 style="font-size:17px;margin:0 0 7px">Understand the pattern, not just the number.</h2><p class="muted" style="font-size:11px;line-height:1.7">A risk estimate is only a prompt for supportive review. It is not a diagnosis or a measure of your value at work.</p><div class="grid two-col" style="margin-top:18px">${metric('Weekly hours',`${w.weekly_hours}h`,'Current demo record','◷','blue')}${metric('Sleep duration',`${w.sleep_hours}h`,'Self-reported demo value','☾','violet')}</div></div></div><div class="notice warning" style="margin-top:18px">${esc(p?.disclaimer || 'Illustrative prototype data only. No validated model result is available.')}</div></section><section class="panel"><div class="panel-header"><div><h2>Contributing factors</h2><p>Model attribution · not causal evidence</p></div></div>${factors.length?`<div class="factor-list">${factors.map(f=>`<div class="factor-row"><span>${esc(f.feature)}</span><div class="progress-track"><div class="progress-fill ${f.direction.startsWith('increases')?'high':'blue'}" style="width:${Math.min(100,Math.round(f.magnitude*35))}%"></div></div><small>${esc(f.direction)}</small></div>`).join('')}</div>`:`<p class="muted">Open the app while online to retrieve the latest demo explanation.</p>`}<div class="insight-card"><span class="insight-icon">♡</span><div><strong>Support should be voluntary</strong><p>You can request a schedule review, workload conversation or confidential support without treating the score as a diagnosis.</p></div></div></section></div>
      <section class="panel"><div class="panel-header"><div><h2>Patterns worth discussing</h2><p>Use these as conversation starters, not instructions.</p></div></div><div class="grid two-col"><div class="system-row"><div><strong>Shift recovery</strong><small>${w.consecutive_shifts} consecutive shifts · ${w.rest_hours}h rest interval</small></div><span class="tag ${w.rest_hours<11?'moderate':'low'}">${w.rest_hours<11?'Review':'Monitor'}</span></div><div class="system-row"><div><strong>Workload</strong><small>${w.weekly_hours} weekly hours · index ${Number(w.workload_index).toFixed(2)}</small></div><span class="tag ${w.weekly_hours>48?'moderate':'low'}">${w.weekly_hours>48?'Review':'Monitor'}</span></div></div><button class="button primary" data-page-link="recommendations" style="margin-top:16px">View recommendations ↗</button></section>`;
  }
  function departmentPage() {
    const workers = state.workers; const role = state.user.role;
    return `${pageHeading('DEPARTMENT INTELLIGENCE','See the conditions around the team.','Aggregate patterns can point to workload or staffing issues that need a shared response.',`<span class="tag neutral">${esc(state.user.department || 'Department')}</span>`)}
      <div class="notice" style="margin-bottom:18px">Privacy by design: this page shows limited workforce indicators. Do not use individual scores for performance appraisal, discipline, hiring or termination.</div>
      <div class="grid metrics-grid">${metric('Team members',state.overview?.metrics?.workers ?? workers.length,'Synthetic demo records','♙','blue')}${metric('Average demo risk',state.overview?.metrics?.average_risk == null?'—':`${state.overview.metrics.average_risk}%`,'Not validated','◉','amber')}${metric('High demo risk',state.overview?.metrics?.high_risk ?? '—','Review the wider context','△','violet')}${metric('Follow-ups recorded',state.overview?.metrics?.followups ?? 0,'Outcome tracking entries','↗','teal')}</div>
      <div class="grid main-grid"><section class="panel"><div class="panel-header"><div><h2>${state.user.role==='manager'?'Aggregate risk distribution':'Risk by role'}</h2><p>${state.user.role==='manager'?'Department-level demo counts; no individual scores shown':'Demo estimate distribution across seeded records'}</p></div></div>${state.user.role==='manager' ? riskDistribution() : workers.map(w=>`<div class="risk-row" style="grid-template-columns:105px 1fr 60px;margin:18px 0"><span>${esc(w.role)}</span><div class="progress-track"><div class="progress-fill ${String(w.risk_level).toLowerCase()}" style="width:${w.risk_percent||0}%"></div></div><strong>${w.risk_percent==null?'—':`${w.risk_percent}%`}</strong></div>`).join('')}</section><section class="panel"><div class="panel-header"><div><h2>What to investigate</h2><p>Suggested review sequence</p></div></div><div class="system-list"><div class="system-row"><div><strong>1. Check staffing coverage</strong><small>Is workload elevated across multiple shifts?</small></div><span class="tag moderate">Review</span></div><div class="system-row"><div><strong>2. Review night-shift sequences</strong><small>Check recovery intervals and roster constraints.</small></div><span class="tag moderate">Review</span></div><div class="system-row"><div><strong>3. Reduce avoidable admin burden</strong><small>Look for team-wide process changes.</small></div><span class="tag low">Explore</span></div></div></section></div>
      ${role === 'manager' ? '<section class="panel"><div class="empty-state">Individual worker records are hidden in the manager workspace. Use aggregate trends and department-level interventions to plan supportive changes.</div></section>' : `<section class="panel"><div class="panel-header"><div><h2>Workforce list</h2><p>Individual detail access is limited to authorized support roles.</p></div></div>${workerTable(workers, ['occupational_health','admin'].includes(role))}</section>`}`;
  }
  function recommendationsPage() {
    const managerNote = state.user.role === 'manager' ? `<div class="notice warning" style="margin-bottom:16px">Managers can review proposed operational actions. Individual well-being details remain restricted.</div>` : '';
    const generator = ['occupational_health','admin'].includes(state.user.role) ? `<section class="panel" style="margin-bottom:18px"><div class="panel-header"><div><h2>Generate a review plan</h2><p>Create recommendations from a seeded demo record.</p></div></div><div class="form-grid"><div class="form-field"><label for="generate-worker">Worker record</label><select id="generate-worker" class="field">${state.workers.map(w=>`<option value="${esc(w.id)}">${esc(w.name)} · ${esc(w.role)}</option>`).join('')}</select></div><div class="form-field" style="display:flex;align-items:end"><button id="generate-button" class="button primary">Generate recommendations ↗</button></div></div></section>` : '';
    return `${pageHeading('PREVENTIVE ACTION','Make the next step practical.','Recommendations are proposals. A human reviewer must check coverage, fairness and worker preference.',`<span class="tag neutral">${state.interventions.length} records</span>`)}${managerNote}${generator}<section class="panel"><div class="panel-header"><div><h2>Intervention centre</h2><p>Review status and notes are saved to the configured database.</p></div><span class="tag neutral">Human review required</span></div>${interventionCards()}</section>`;
  }
  function followUpPage() {
    const form = ['occupational_health','admin'].includes(state.user.role) ? `<section class="panel" style="margin-bottom:18px"><div class="panel-header"><div><h2>Record a follow-up</h2><p>Capture an outcome measure after a supportive action.</p></div></div><form id="outcome-form"><div class="form-grid"><div class="form-field"><label for="outcome-worker">Worker</label><select id="outcome-worker" class="field" required>${state.workers.map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select></div><div class="form-field"><label for="outcome-measure">Measure</label><select id="outcome-measure" class="field"><option>Well-being check-in</option><option>Workload review</option><option>Schedule recovery</option><option>Intervention outcome</option></select></div><div class="form-field"><label for="outcome-value">Observed value / status</label><input id="outcome-value" class="field" placeholder="e.g. follow-up completed" required maxlength="100"></div><div class="form-field"><label for="outcome-notes">Notes (avoid sensitive details)</label><input id="outcome-notes" class="field" placeholder="Short operational note" maxlength="500"></div></div><div class="form-actions"><button class="button primary" type="submit">Save follow-up</button></div></form></section>` : '';
    return `${pageHeading('CLOSED-LOOP LEARNING','Check whether support helped.','Track follow-up measures without claiming that a model score proves causation.')}${form}<section class="panel"><div class="panel-header"><div><h2>Follow-up history</h2><p>Recorded measures and intervention outcomes</p></div><span class="tag neutral">${state.outcomes.length} entries</span></div>${state.outcomes.length?`<div class="system-list">${state.outcomes.map(o=>`<div class="system-row"><div><strong>${esc(o.measure)}</strong><small>${esc(o.worker_id)} · ${esc(o.value)} ${o.notes?`· ${esc(o.notes)}`:''}</small></div><span class="tag neutral">${formatDate(o.created_at)}</span></div>`).join('')}</div>`:`<div class="empty-state">No follow-up records yet. Use the form above with demo data to test the closed loop.</div>`}</section>`;
  }
  async function governancePage() {
    let audit = [];
    try { const data = await api('/api/audit'); audit = data.events || []; } catch { /* Role or offline limitation */ }
    const checks = [{name:'Data sufficiency gate',desc:'Missing inputs or short history can suppress the risk label.',status:'Enabled'},{name:'Human-reviewed interventions',desc:'Actions remain proposals until an authorized person reviews them.',status:'Enabled'},{name:'Role-aware access',desc:'Individual details are restricted by the API role checks.',status:'Demo controls'},{name:'Persistence adapter',desc:state.overview?.storage || 'Storage status pending.',status:'Connected'},{name:'Model provenance',desc:state.overview?.model_name || 'Synthetic demo model.',status:'Synthetic data'},{name:'Browser offline queue',desc:'Pending actions are stored in IndexedDB until sync is possible.',status:'Available'}];
    return `${pageHeading('TRUST & GOVERNANCE','Understand the boundaries.','Transparency about data, access and model limitations is part of the product.')}
      <div class="grid main-grid"><section class="panel"><div class="panel-header"><div><h2>System status</h2><p>Current local demo configuration</p></div><span class="tag low">Running</span></div><div class="system-list">${checks.map(c=>`<div class="system-row"><div><strong>${esc(c.name)}</strong><small>${esc(c.desc)}</small></div><span class="tag ${c.status==='Enabled'||c.status==='Connected'?'low':'neutral'}">${esc(c.status)}</span></div>`).join('')}</div></section><section class="panel"><div class="panel-header"><div><h2>Model card</h2><p>What powers this demonstration</p></div><span class="tag moderate">Not validated</span></div><div class="notice warning">${esc(state.overview?.model_name || 'Synthetic demo logistic regression')}<br><br>Trained on synthetic examples with synthetic labels. Percentages are illustrative and must not be presented as real-world performance or validated burnout probability.</div><div class="system-list" style="margin-top:12px"><div class="system-row"><div><strong>Inputs</strong><small>Workload, shifts, rest, sleep, staffing and well-being demo values</small></div></div><div class="system-row"><div><strong>Explanation</strong><small>Standardized feature contributions; not causal proof</small></div></div><div class="system-row"><div><strong>Real validation</strong><small>Requires a validated future target, temporal/grouped split and calibration.</small></div></div></div></section></div>
      <section class="panel" style="margin-top:18px"><div class="panel-header"><div><h2>Recent audit events</h2><p>Role-limited activity trail for the demo.</p></div><button class="button ghost small" id="refresh-audit">Refresh</button></div>${audit.length?audit.map(event=>`<div class="audit-row"><time>${formatDate(event.created_at)}</time><span><strong>${esc(event.action)}</strong><br><span class="muted">${esc(event.actor)}</span></span><span class="tag neutral">Logged</span></div>`).join(''):`<div class="empty-state">No audit events available, or your role cannot view them.</div>`}</section>
      <section class="panel" style="margin-top:18px"><div class="panel-header"><div><h2>Responsible use commitments</h2><p>These boundaries are not optional.</p></div></div><div class="grid two-col"><div class="insight-card"><span class="insight-icon">◇</span><div><strong>Privacy-first</strong><p>Collect only what is necessary, document consent where applicable, define retention and restrict access.</p></div></div><div class="insight-card"><span class="insight-icon">♡</span><div><strong>Non-punitive</strong><p>Never use outputs for hiring, firing, discipline, promotion or performance appraisal.</p></div></div></div></section>`;
  }
  async function renderPage() {
    if (!state.user) return;
    const version = ++renderVersion;
    const page = state.page;
    const content = $('#page-content');
    if (!state.overview && !state.cache && state.online) content.innerHTML = '<div class="grid metrics-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
    let html = '';
    if (page === 'dashboard') html = dashboardPage();
    else if (page === 'my-health') html = await myHealthPage();
    else if (page === 'department') html = departmentPage();
    else if (page === 'recommendations') html = recommendationsPage();
    else if (page === 'follow-up') html = followUpPage();
    else if (page === 'governance') html = await governancePage();
    if (version !== renderVersion || page !== state.page) return;
    content.innerHTML = html;
    updateConnectionLabel();
  }
  async function saveInterventionStatus(id) {
    const select = $(`[data-status-select="${CSS.escape(id)}"]`); if (!select) return;
    const status = select.value;
    if (state.forcedOffline || !navigator.onLine) {
      try {
        await queueAction({ type:'intervention-status', intervention_id:id, status, note:'Queued offline; human review status change.' });
        const item = state.interventions.find(i=>i.id===id); if (item) item.status = status;
        toast('Action queued. It will sync when you reconnect.'); renderPage();
      } catch (error) { toast('Offline storage is unavailable. Reconnect before saving this change.', true); }
      return;
    }
    try { await api(`/api/interventions/${encodeURIComponent(id)}`, {method:'PATCH',body:JSON.stringify({status,note:'Updated from CareWell interface.'})}); toast('Intervention status saved.'); await loadData(); }
    catch(error) { toast(error.message,true); }
  }
  async function generatePlan() {
    const id = $('#generate-worker')?.value; if (!id) return;
    try { await api(`/api/interventions/generate/${encodeURIComponent(id)}`,{method:'POST',body:'{}'}); toast('Recommendations generated for human review.'); await loadData(); setPage('recommendations'); }
    catch(error) { toast(error.message,true); }
  }
  async function saveOutcome(event) {
    event.preventDefault(); const payload = {worker_id:$('#outcome-worker').value,measure:$('#outcome-measure').value,value:$('#outcome-value').value.trim(),notes:$('#outcome-notes').value.trim()};
    try { await api('/api/outcomes',{method:'POST',body:JSON.stringify(payload)}); toast('Follow-up saved.'); await loadData(); setPage('follow-up'); }
    catch(error) { toast(error.message,true); }
  }
  async function boot() {
    try { const me = await api('/api/auth/me'); if (me.user) { state.user = me.user; showShell(); return; } } catch { /* Server may not be available yet. */ }
    $('#login-screen').classList.remove('hidden'); $('#app-shell').classList.add('hidden');
  }

  $('#login-button').addEventListener('click', login);
  $('#logout-button').addEventListener('click', logout);
  $('#refresh-button').addEventListener('click', loadData);
  $('#offline-toggle').addEventListener('click', async () => { state.forcedOffline = !state.forcedOffline; updateConnectionLabel(); if (!state.forcedOffline) { await syncQueue(); await loadData(); toast('Connection restored. Sync attempted.'); } else toast('Offline simulation enabled. Actions will queue.'); });
  $('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#main-nav').addEventListener('click', event => { const button = event.target.closest('[data-page]'); if (button) setPage(button.dataset.page); });
  $('#page-content').addEventListener('click', async event => {
    const pageButton = event.target.closest('[data-page-link]'); if (pageButton) { setPage(pageButton.dataset.pageLink); return; }
    const statusButton = event.target.closest('[data-save-status]'); if (statusButton) { await saveInterventionStatus(statusButton.dataset.saveStatus); return; }
    const generateButton = event.target.closest('[data-generate]'); if (generateButton) { if (['occupational_health','admin'].includes(state.user.role)) { setPage('recommendations'); setTimeout(()=>{const select=$('#generate-worker'); if(select) select.value=generateButton.dataset.generate;},0); } else toast('Your role cannot generate individual intervention plans.',true); return; }
    if (event.target.closest('#generate-button')) { await generatePlan(); return; }
    if (event.target.closest('#refresh-audit')) { await renderPage(); }
  });
  $('#page-content').addEventListener('submit', event => { if (event.target.id === 'outcome-form') saveOutcome(event); });
  window.addEventListener('online', async () => { state.online = true; updateConnectionLabel(); await syncQueue(); if (state.user) await loadData(); });
  window.addEventListener('offline', () => { state.online = false; updateConnectionLabel(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.user && navigator.onLine && !state.forcedOffline) loadData(); });
  boot();
})();
