const state = { type: 'sale', role: 'Svetlana' };
const tabs = document.querySelectorAll('.tab');
const customerField = document.querySelector('#customerField');
const projectField = document.querySelector('#projectField');
const categoryField = document.querySelector('#categoryField');
const allocationField = document.querySelector('#allocationField');
const splitField = document.querySelector('#splitField');
const form = document.querySelector('#transactionForm');
const message = document.querySelector('#formMessage');

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

tabs.forEach((tab) => tab.addEventListener('click', () => setType(tab.dataset.type)));
document.querySelector('#roleSelect').addEventListener('change', (event) => {
  state.role = event.target.value;
  message.textContent = `${state.role} selected. Backend permissions will be enforced when Supabase is connected.`;
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const amount = Number(document.querySelector('#amount').value);
  const reference = document.querySelector('#reference').value.trim().toUpperCase();
  const description = document.querySelector('#description').value.trim();
  if (!reference || !description || !Number.isFinite(amount) || amount <= 0) {
    message.textContent = 'Enter a unique reference, description, and amount greater than zero.';
    return;
  }
  if (state.type === 'sale') {
    const split = [...splitField.querySelectorAll('input')].reduce((total, input) => total + Number(input.value || 0), 0);
    if (split !== 100) {
      message.textContent = `Commission shares must total 100%. Current total: ${split}%.`;
      return;
    }
  }
  message.textContent = `${reference} is ready to save. Connect Supabase to persist the transaction.`;
});

setType('sale');
fetch('/api/dashboard',{cache:'no-store'}).then(r=>r.json()).then(d=>{document.querySelector('#companyResult').textContent=`€${d.result.toFixed(2)}`;document.querySelector('.metric:nth-child(2) strong').textContent=`€${d.income.toFixed(2)}`;document.querySelector('.metric:nth-child(3) strong').textContent=`€${d.commission.toFixed(2)}`;document.querySelector('.metric:nth-child(4) strong').textContent=d.transactions.filter(t=>t.status!=='approved').length;}).catch(()=>{});
document.querySelector('#approveButton').addEventListener('click',async()=>{const r=await fetch('/api/approve',{method:'POST',headers:{'Content-Type':'application/json','x-manager-passcode':document.querySelector('#managerPasscode').value},body:JSON.stringify({reference:document.querySelector('#approvalReference').value,role:document.querySelector('#roleSelect').value})});document.querySelector('#approvalMessage').textContent=r.ok?'Approved.':(await r.json()).error;});
