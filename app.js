const state = { type: 'sale', role: 'Svetlana', transactions: [], dashboardCache: {} };
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

function notificationLabel(status) {
  return { sent: 'Sent', pending: 'Awaiting Telegram', failed: 'Telegram failed', not_applicable: 'No Telegram recipient linked' }[status] || 'Awaiting Telegram';
}

function recordsHtml(transactions, canRetryNotifications) {
  return transactions.map((item) => {
    const retry = canRetryNotifications && item.notification_status === 'failed' ? ` <button class="text-button" data-retry-reference="${item.reference}" type="button">Retry</button>` : '';
    return `<tr><td>${item.reference}</td><td>${typeLabel(item)}</td><td>${item.submitted_by_name}</td><td>${euro(item.amount)}</td><td>${item.kind === 'sale' ? `Project ${item.project}` : `${item.final_allocation ? 'Final' : 'Proposed'} ${item.final_allocation || item.proposed_allocation}`}</td><td><span class="status ${item.status === 'approved' ? 'approved' : 'pending'}">${titleStatus(item.status)}</span></td><td><span class="status ${item.sheets_sync_status === 'synced' ? 'synced' : 'pending'}">${item.sheets_sync_status === 'synced' ? 'Synced' : item.sheets_sync_status === 'failed' ? 'Sync failed' : 'Sync pending'}</span></td><td><span class="status ${item.notification_status === 'sent' ? 'synced' : 'pending'}">${notificationLabel(item.notification_status)}</span>${retry}</td></tr>`;
  }).join('') || '<tr><td colspan="8">No transactions yet.</td></tr>';
}

async function loadDashboard(force = false) {
  let data = !force ? state.dashboardCache[state.role] : null;
  if (!data) {
    const response = await fetch(`/api/dashboard?role=${encodeURIComponent(state.role)}`, { cache: 'no-store' });
    data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load the dashboard.');
    state.dashboardCache[state.role] = data;
  }
  const { metrics, transactions, viewer } = data;
  state.transactions = transactions;
  document.querySelector('#integrationStatus').innerHTML = `<span><i class="dot"></i> Live Supabase data</span><span>Telegram: connected</span><span>Google Sheets: ${data.integrations.googleSheets ? 'connected' : 'not connected'}</span>`;
  const financialSections = document.querySelectorAll('#dashboard .metric-grid, #dashboard .table-panel');
  financialSections.forEach((section) => section.classList.toggle('hidden', !viewer.canViewFinancials));
  document.querySelector('#reviewQueue').closest('.queue-panel').classList.toggle('hidden', !viewer.canViewFinancials);
  document.querySelector('.manager-panel').classList.toggle('hidden', !viewer.canViewFinancials);
  if (!viewer.canViewFinancials) document.querySelector('#dashboard .hero-card p:not(.eyebrow)').textContent = 'Your private submission view. Only Svetlana can access company financial results.';
  else document.querySelector('#dashboard .hero-card p:not(.eyebrow)').textContent = 'A curated financial overview for the company’s most memorable occasions.';
  if (!metrics) {
    document.querySelector('#recordsBody').innerHTML = recordsHtml(transactions, false);
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
  document.querySelector('#recordsBody').innerHTML = recordsHtml(transactions, viewer.canViewFinancials);
  const queue = transactions.filter((item) => item.status !== 'approved');
  document.querySelector('#reviewQueue').innerHTML = queue.length ? queue.map((item) => `<div class="queue-item"><div><strong>${item.reference} · ${item.description}</strong><p>${euro(item.amount)} · ${titleStatus(item.status)}</p></div><button class="text-button" data-reference="${item.reference}">Review proposal</button></div>`).join('') : '<div class="empty-note">Nothing is waiting for a manager decision.</div>';
  document.querySelectorAll('[data-reference]').forEach((button) => button.addEventListener('click', () => showManagerReview(button.dataset.reference)));
  document.querySelectorAll('[data-retry-reference]').forEach((button) => button.addEventListener('click', () => {
    document.querySelector('[data-view="workspace"]').click();
    showManagerReview(button.dataset.retryReference);
  }));
}

function proposalText(item) {
  return item.kind === 'sale'
    ? `Original proposal: Project ${item.project}; Richard ${item.proposed_richard_pct}% · Anastasia ${item.proposed_anastasia_pct}% · Jean-Claude ${item.proposed_jean_claude_pct}%.`
    : `Original proposal: ${item.proposed_allocation === 'overhead' ? 'Company overhead' : `Project ${item.proposed_allocation}`}.`;
}

function showManagerReview(reference) {
  const item = state.transactions.find((record) => record.reference === reference);
  if (!item) return;
  document.querySelector('#approvalReference').value = item.reference;
  document.querySelector('#managerReviewDetail').textContent = `${proposalText(item)} Final decision: ${item.status === 'approved' ? 'approved' : 'not decided yet'}.`;
  document.querySelector('#retryReference').value = item.reference;
  document.querySelector('#retryEventType').value = item.notification_event_type || 'submission';
  document.querySelector('#retryNotificationPanel').classList.toggle('hidden', item.notification_status !== 'failed');
  document.querySelector('#approvalReference').focus();
}

tabs.forEach((tab) => tab.addEventListener('click', () => setType(tab.dataset.type)));
document.querySelector('#roleSelect').addEventListener('change', async (event) => { state.role = event.target.value; message.textContent = `${state.role} selected.`; await loadDashboard(); });

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
    const body = state.type === 'sale' ? { kind: 'sale', role: state.role, reference, description, amount, customer: document.querySelector('#customer').value, project: document.querySelector('#project').value.startsWith('A') ? 'A' : 'B', r: Number(splitField.querySelectorAll('input')[0].value), a: Number(splitField.querySelectorAll('input')[1].value), j: Number(splitField.querySelectorAll('input')[2].value) } : { kind: 'expense', role: state.role, reference, description, amount, category: document.querySelector('#category').value, allocation: document.querySelector('#allocation').value === 'Company overhead' ? 'overhead' : document.querySelector('#allocation').value.endsWith('A') ? 'A' : 'B' };
    const saved = await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await saved.json();
    message.textContent = saved.ok ? `${reference} saved successfully.` : (data.error || 'Could not save transaction.');
    if (saved.ok) { form.reset(); setType(state.type); state.dashboardCache = {}; await loadDashboard(true); }
  } catch { message.textContent = 'Could not reach the transaction service. Please try again.'; }
});

document.querySelector('#approveButton').addEventListener('click', async () => {
  const response = await fetch('/api/approve', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-manager-passcode': document.querySelector('#managerPasscode').value }, body: JSON.stringify({ reference: document.querySelector('#approvalReference').value, role: document.querySelector('#roleSelect').value, decision: document.querySelector('#managerDecision').value }) });
  const data = await response.json();
  document.querySelector('#approvalMessage').textContent = response.ok ? (data.alreadyApproved ? 'This record is already approved.' : 'Decision saved successfully.') : (data.error || 'Could not save decision.');
  if (response.ok) { state.dashboardCache = {}; await loadDashboard(true); }
});

document.querySelector('#syncSheetsButton').addEventListener('click', async () => {
  const message = document.querySelector('#approvalMessage');
  message.textContent = 'Syncing records…';
  const response = await fetch('/api/sync-sheets', { method: 'POST', headers: { 'x-manager-passcode': document.querySelector('#managerPasscode').value } });
  const data = await response.json();
  message.textContent = response.ok ? `${data.synced} record(s) synced to Google Sheets.` : (data.error || `${data.failed || 0} record(s) could not be synced.`);
  state.dashboardCache = {}; await loadDashboard(true);
});

const managerDecisionField = document.querySelector('#managerDecision');
const managerReviewDetail = document.createElement('p');
managerReviewDetail.id = 'managerReviewDetail';
managerReviewDetail.className = 'form-message';
managerReviewDetail.textContent = 'Choose “Review proposal” to inspect the original decision before approving.';
managerDecisionField.parentElement.after(managerReviewDetail);
const retryPanel = document.createElement('div');
retryPanel.id = 'retryNotificationPanel';
retryPanel.className = 'hidden';
retryPanel.innerHTML = '<p class="form-message">Telegram delivery failed. Retry without changing this transaction.</p><input id="retryReference" type="hidden" /><input id="retryEventType" type="hidden" /><button class="text-button" id="retryNotificationButton" type="button">Retry Telegram notification</button>';
document.querySelector('#approvalMessage').before(retryPanel);
document.querySelector('#retryNotificationButton').addEventListener('click', async () => {
  const response = await fetch('/api/retry-notification', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-manager-passcode': document.querySelector('#managerPasscode').value }, body: JSON.stringify({ reference: document.querySelector('#retryReference').value, eventType: document.querySelector('#retryEventType').value }) });
  const result = await response.json();
  document.querySelector('#approvalMessage').textContent = response.ok ? `Telegram retry: ${result.status}.` : (result.error || 'Could not retry the Telegram notification.');
  if (response.ok) { state.dashboardCache = {}; await loadDashboard(true); }
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
loadDashboard().catch((error) => { document.querySelector('#integrationStatus').textContent = `Dashboard unavailable: ${error.message}`; });
