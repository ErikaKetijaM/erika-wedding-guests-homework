const state = { type: 'sale', role: sessionStorage.getItem('friendsIncludedRole') || '', session: sessionStorage.getItem('friendsIncludedSession') || '' };
const authHeaders = () => state.session ? { 'x-demo-session': state.session } : {};
const tabs = document.querySelectorAll('.tab');
const customerField = document.querySelector('#customerField');
const projectField = document.querySelector('#projectField');
const categoryField = document.querySelector('#categoryField');
const allocationField = document.querySelector('#allocationField');
const splitField = document.querySelector('#splitField');
const form = document.querySelector('#transactionForm');
const message = document.querySelector('#formMessage');
const euro = (number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(Number(number || 0));

function setType(type) {
  state.type = type;
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.type === type));
  const expense = type === 'expense';
  customerField.classList.toggle('hidden', expense);
  projectField.classList.toggle('hidden', expense);
  categoryField.classList.toggle('hidden', !expense);
  allocationField.classList.toggle('hidden', !expense);
  splitField.classList.toggle('hidden', expense);
}

function titleStatus(status) {
  return status === 'pending_approval' ? 'Pending approval' : status === 'awaiting_allocation' ? 'Awaiting allocation' : 'Approved';
}

function typeLabel(item) {
  if (item.kind === 'sale') return `Sale · Project ${item.project}`;
  return `Expense · ${item.final_allocation || `Proposed ${item.proposed_allocation}`}`;
}

async function loadDashboard() {
  const response = await fetch('/api/dashboard', { cache: 'no-store', headers: authHeaders() });
  const data = await response.json();
  if (response.status === 401) return showLogin(data.error);
  if (!response.ok) throw new Error(data.error || 'Could not load the dashboard.');
  const { metrics, transactions, viewer } = data;
  document.querySelector('#integrationStatus').innerHTML = `<span><i class="dot"></i> Live Supabase data</span><span>Telegram: connected</span><span>Google Sheets: ${data.integrations.googleSheets ? 'connected' : 'not connected'}</span>`;
  const financialSections = document.querySelectorAll('#dashboard .metric-grid, #dashboard .table-panel');
  financialSections.forEach((section) => section.classList.toggle('hidden', !viewer.canViewFinancials));
  document.querySelector('#reviewQueue').closest('.queue-panel').classList.toggle('hidden', !viewer.canViewFinancials);
  document.querySelector('.manager-panel').classList.toggle('hidden', !viewer.canViewFinancials);
  if (!viewer.canViewFinancials) document.querySelector('#dashboard .hero-card p:not(.eyebrow)').textContent = 'Your private submission view. Only Svetlana can access company financial results.';
  else document.querySelector('#dashboard .hero-card p:not(.eyebrow)').textContent = 'A curated financial overview for the company’s most memorable occasions.';
  if (!metrics) {
    document.querySelector('#recordsBody').innerHTML = transactions.map((item) => `<tr><td>${item.reference}</td><td>${typeLabel(item)}</td><td>${item.submitted_by_name}</td><td>${euro(item.amount)}</td><td>${item.kind === 'sale' ? `Project ${item.project}` : `${item.final_allocation ? 'Final' : 'Proposed'} ${item.final_allocation || item.proposed_allocation}`}</td><td><span class="status ${item.status === 'approved' ? 'approved' : 'pending'}">${titleStatus(item.status)}</span></td><td><span class="status ${item.sheets_sync_status === 'synced' ? 'synced' : 'pending'}">${item.sheets_sync_status === 'synced' ? 'Synced' : item.sheets_sync_status === 'failed' ? 'Sync failed' : 'Sync pending'}</span></td><td><span class="status ${item.notification_status === 'sent' ? 'synced' : 'pending'}">${item.notification_status}</span></td></tr>`).join('') || '<tr><td colspan="8">No transactions yet.</td></tr>';
    return;
  }
  document.querySelector('#companyResult').textContent = euro(metrics.companyResult);
  document.querySelector('#companyResultNote').textContent = `Project A ${euro(metrics.projectAResult)} · Project B ${euro(metrics.projectBResult)}`;
  document.querySelector('#approvedIncome').textContent = euro(metrics.income);
  document.querySelector('#approvedIncomeNote').textContent = `${euro(metrics.incomeA)} Project A · ${euro(metrics.incomeB)} Project B`;
  document.querySelector('#commissionEarned').textContent = euro(metrics.commission);
  document.querySelector('#commissionNote').textContent = `Richard ${euro(metrics.commissionByPerson.Richard)} · Anastasia ${euro(metrics.commissionByPerson.Anastasia)} · Jean-Claude ${euro(metrics.commissionByPerson['Jean-Claude'])}`;
  document.querySelector('#pendingDecisions').textContent = metrics.pendingSales + metrics.awaitingAllocation;
  document.querySelector('#pendingNote').textContent = `${metrics.pendingSales} sale · ${metrics.awaitingAllocation} expense allocation`;
  document.querySelector('#breakdownIncomeA').textContent = euro(metrics.incomeA);
  document.querySelector('#breakdownIncomeB').textContent = euro(metrics.incomeB);
  document.querySelector('#breakdownIncomeCompany').textContent = euro(metrics.income);
  document.querySelector('#breakdownCommissionA').textContent = euro(metrics.incomeA - metrics.projectAResult - metrics.expenseA);
  document.querySelector('#breakdownCommissionB').textContent = euro(metrics.incomeB - metrics.projectBResult - metrics.expenseB);
  document.querySelector('#breakdownCommissionCompany').textContent = euro(metrics.commission);
  document.querySelector('#breakdownExpenseA').textContent = euro(metrics.expenseA);
  document.querySelector('#breakdownExpenseB').textContent = euro(metrics.expenseB);
  document.querySelector('#breakdownExpenseCompany').textContent = euro(metrics.expenseA + metrics.expenseB + metrics.overhead + metrics.awaitingExpenseAmount);
  document.querySelector('#breakdownResultA').textContent = euro(metrics.projectAResult);
  document.querySelector('#breakdownResultB').textContent = euro(metrics.projectBResult);
  document.querySelector('#breakdownResultCompany').textContent = euro(metrics.companyResult);
  document.querySelector('#companyCostNote').textContent = `Company overhead: ${euro(metrics.overhead)} · Awaiting allocation: ${euro(metrics.awaitingExpenseAmount)}`;
  document.querySelector('#recordsBody').innerHTML = transactions.map((item) => `<tr><td>${item.reference}</td><td>${typeLabel(item)}</td><td>${item.submitted_by_name}</td><td>${euro(item.amount)}</td><td>${item.kind === 'sale' ? `Project ${item.project}` : `${item.final_allocation ? 'Final' : 'Proposed'} ${item.final_allocation || item.proposed_allocation}`}</td><td><span class="status ${item.status === 'approved' ? 'approved' : 'pending'}">${titleStatus(item.status)}</span></td><td><span class="status ${item.sheets_sync_status === 'synced' ? 'synced' : 'pending'}">${item.sheets_sync_status === 'synced' ? 'Synced' : item.sheets_sync_status === 'failed' ? 'Sync failed' : 'Sync pending'}</span></td><td><span class="status ${item.notification_status === 'sent' ? 'synced' : 'pending'}">${item.notification_status}</span></td></tr>`).join('') || '<tr><td colspan="8">No transactions yet.</td></tr>';
  const queue = transactions.filter((item) => item.status !== 'approved');
  document.querySelector('#reviewQueue').innerHTML = queue.length ? queue.map((item) => `<div class="queue-item"><div><strong>${item.reference} · ${item.description}</strong><p>${euro(item.amount)} · ${titleStatus(item.status)}</p></div><button class="text-button" data-reference="${item.reference}">Review</button></div>`).join('') : '<div class="empty-note">Nothing is waiting for a manager decision.</div>';
  document.querySelectorAll('[data-reference]').forEach((button) => button.addEventListener('click', () => { document.querySelector('#approvalReference').value = button.dataset.reference; document.querySelector('#approvalReference').focus(); }));
}

tabs.forEach((tab) => tab.addEventListener('click', () => setType(tab.dataset.type)));
document.querySelector('#roleSelect').addEventListener('change', () => { document.querySelector('#roleSelect').value = state.role; });

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const amount = Number(document.querySelector('#amount').value);
  const reference = document.querySelector('#reference').value.trim().toUpperCase();
  const description = document.querySelector('#description').value.trim();
  if (!reference || !description || !Number.isFinite(amount) || amount <= 0) return message.textContent = 'Enter a unique reference, description, and amount greater than zero.';
  if (state.type === 'sale') {
    const split = [...splitField.querySelectorAll('input')].reduce((total, input) => total + Number(input.value || 0), 0);
    if (split !== 100) return message.textContent = `Commission shares must total 100%. Current total: ${split}%.`;
  }
  try {
    const body = state.type === 'sale' ? { kind: 'sale', reference, description, amount, customer: document.querySelector('#customer').value, project: document.querySelector('#project').value.startsWith('A') ? 'A' : 'B', r: Number(splitField.querySelectorAll('input')[0].value), a: Number(splitField.querySelectorAll('input')[1].value), j: Number(splitField.querySelectorAll('input')[2].value) } : { kind: 'expense', reference, description, amount, category: document.querySelector('#category').value, allocation: document.querySelector('#allocation').value === 'Company overhead' ? 'overhead' : document.querySelector('#allocation').value.endsWith('A') ? 'A' : 'B' };
    const saved = await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) });
    const data = await saved.json();
    message.textContent = saved.ok ? `${reference} saved successfully.` : (data.error || 'Could not save transaction.');
    if (saved.ok) { form.reset(); setType(state.type); await loadDashboard(); }
  } catch { message.textContent = 'Could not reach the transaction service. Please try again.'; }
});

document.querySelector('#approveButton').addEventListener('click', async () => {
  const response = await fetch('/api/approve', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-manager-passcode': document.querySelector('#managerPasscode').value, ...authHeaders() }, body: JSON.stringify({ reference: document.querySelector('#approvalReference').value, decision: document.querySelector('#managerDecision').value }) });
  const data = await response.json();
  document.querySelector('#approvalMessage').textContent = response.ok ? (data.alreadyApproved ? 'This record is already approved.' : 'Decision saved successfully.') : (data.error || 'Could not save decision.');
  if (response.ok) await loadDashboard();
});

document.querySelector('#syncSheetsButton').addEventListener('click', async () => {
  const message = document.querySelector('#approvalMessage');
  message.textContent = 'Syncing records…';
  const response = await fetch('/api/sync-sheets', { method: 'POST', headers: { 'x-manager-passcode': document.querySelector('#managerPasscode').value, ...authHeaders() } });
  const data = await response.json();
  message.textContent = response.ok ? `${data.synced} record(s) synced to Google Sheets.` : (data.error || `${data.failed || 0} record(s) could not be synced.`);
  await loadDashboard();
});

const viewTitles = { dashboard: 'At a glance', workspace: 'The workroom', records: 'The ledger', guide: 'House guide' };
document.querySelectorAll('[data-view]').forEach((control) => control.addEventListener('click', (event) => {
  event.preventDefault();
  const view = control.dataset.view;
  document.querySelectorAll('.app-view').forEach((section) => section.classList.toggle('active', section.id === view));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  document.querySelector('#viewTitle').textContent = viewTitles[view];
  window.scrollTo({ top: 0, behavior: 'smooth' });
}));

setType('sale');
function showLogin(reason = '') { document.querySelector('#authGate').classList.remove('hidden'); document.querySelector('#loginMessage').textContent = reason; }
document.querySelector('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const role = document.querySelector('#loginRole').value;
  const loginMessage = document.querySelector('#loginMessage');
  const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, code: document.querySelector('#loginCode').value }) });
  const data = await response.json();
  if (!response.ok) { loginMessage.textContent = data.error || 'Could not sign in.'; return; }
  state.role = data.role; state.session = data.session;
  sessionStorage.setItem('friendsIncludedRole', state.role); sessionStorage.setItem('friendsIncludedSession', state.session);
  document.querySelector('#roleSelect').value = state.role;
  document.querySelector('#authGate').classList.add('hidden');
  await loadDashboard();
});
if (state.session) { document.querySelector('#roleSelect').value = state.role; loadDashboard().catch((error) => showLogin(error.message)); } else showLogin();
