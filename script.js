/* ---------------- AGENDA ---------------- */
function renderAgenda(){
  const filtered = agendamentos.filter(a=> agendaFilter==='todos' ? true : a.status===agendaFilter)
    .sort((a,b)=> (a.data+a.horario).localeCompare(b.data+b.horario));
  const groups = {};
  filtered.forEach(a=>{ (groups[a.data] = groups[a.data]||[]).push(a); });
  const dates = Object.keys(groups).sort();

  return `
    <div class="chips">
      ${['todos','pendente','confirmado','compareceu','nao_compareceu','cancelado'].map(f=>`
        <div class="chip ${agendaFilter===f?'active':''}" onclick="setAgendaFilter('${f}')">${f==='todos'?'Todos':STATUS_LABELS[f]}</div>
      `).join('')}
    </div>
    ${dates.length ? dates.map(d=>`
      <h2 class="section-title">${weekdayShort(d)}, ${fmtDateFull(d)}</h2>
      <div class="card">${groups[d].map(a=>apptRow(a)).join('')}</div>
    ).join('') : `<div class="card">${emptyState('📅','Nenhum agendamento','Toque no + para criar o primeiro')}</div>}
  `;
}
function setAgendaFilter(f){ agendaFilter = f; render(); }

/* ---------------- CLIENTES ---------------- */
function renderClientes(){
  const list = clientes.filter(c=>{
    const q = clientSearch.toLowerCase();
    return c.nome.toLowerCase().includes(q) || (c.telefone||'').includes(q);
  }).sort((a,b)=>a.nome.localeCompare(b.nome));

  return `
    <div class="search-box">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8C7278" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input type="text" placeholder="Buscar por nome ou telefone" value="${clientSearch}" oninput="clientSearch=this.value; render();">
    </div>
    <div class="card">
      ${list.length ? list.map(c=>`
        <div class="client-card" onclick="openClientDetail('${c.id}')">
          <div class="avatar">${initials(c.nome)}</div>
          <div>
            <div class="cname">${c.nome}</div>
            <div class="cphone">${fmtPhone(c.telefone)}</div>
          </div>
          <span class="chevron">›</span>
        </div>
      `).join('') : emptyState('👤','Nenhuma cliente cadastrada','Toque no + para cadastrar')}
    </div>
  `;
}

function openClientDetail(id){
  currentClientDetail = id;
  const c = getClient(id);
  const historico = agendamentos.filter(a=>a.clienteId===id).sort((a,b)=> (b.data+b.horario).localeCompare(a.data+a.horario));
  const totalGasto = historico.filter(a=>a.status==='compareceu').reduce((s,a)=>s+Number(a.valor||0),0);

  openSheet(`
    <h3>${c.nome}</h3>
    <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
      <button class="mini-btn ok" style="padding:8px 14px;" onclick="scheduleForClient('${c.id}')">Agendar horário</button>
      <button class="mini-btn whats" style="padding:8px 14px;" onclick="openWhatsClient('${c.id}')">WhatsApp</button>
      <button class="mini-btn edit" style="padding:8px 14px;" onclick="editClient('${c.id}')">Editar cliente</button>
    </div>
    <div class="stat-row" style="margin-bottom:18px;">
      <div class="stat"><span class="num">${historico.length}</span><span class="lbl">Atendimentos</span></div>
      <div class="stat"><span class="num">${fmtMoney(totalGasto)}</span><span class="lbl">Total gasto</span></div>
    </div>

    <label style="margin-top:0;">Observações</label>
    <div id="obsList">
      ${(c.observacoes && c.observacoes.length) ? c.observacoes.slice().reverse().map(o=>`
        <div class="obs-item"><div class="odate">${fmtDateFull(o.data)}</div><div class="otext">${o.texto}</div></div>
      ).join('') : `<p style="font-size:13px;color:var(--ink-soft);">Nenhuma observação ainda.</p>}
    </div>
    <textarea id="newObsText" placeholder="Adicionar observação (alergia, preferência, etc)"></textarea>
    <button class="btn-secondary" onclick="addObservation('${c.id}')">Adicionar observação</button>

    <label>Histórico de agendamentos</label>
    ${historico.length ? historico.map(a=>`
      <div class="obs-item">
        <div class="odate">${fmtDateFull(a.data)} · ${a.horario}</div>
        <div class="otext">${a.servico} — ${fmtMoney(a.valor)} <span class="badge ${a.status}" style="margin-top:4px;">${STATUS_LABELS[a.status]}</span></div>
      </div>
    ).join('') : `<p style="font-size:13px;color:var(--ink-soft);">Sem agendamentos ainda.</p>}

    <button class="btn-danger-text" onclick="deleteClient('${c.id}')">Excluir cliente</button>
  `);
}

function openWhatsClient(id){
  const c = getClient(id);
  if(!c.telefone){ showToast('Cliente sem telefone cadastrado'); return; }
  const phone = c.telefone.replace(/\D/g,'');
  const full = phone.length<=11 ? '55'+phone : phone;
  window.open(https://wa.me/${full}, '_blank');
}

async function addObservation(id){
  const txt = document.getElementById('newObsText').value.trim();
  if(!txt) return;
  const c = getClient(id);
  c.observacoes = c.observacoes || [];
  c.observacoes.push({data: todayISO(), texto: txt});
  await saveClientes();
  showToast('Observação adicionada');
  openClientDetail(id);
}

async function deleteClient(id){
  if(!confirm('Excluir esta cliente? Os agendamentos vinculados continuarão no histórico.')) return;
  clientes = clientes.filter(c=>c.id!==id);
  await saveClientes();
  closeSheet();
  render();
  showToast('Cliente excluída');
}

function editClient(id){
  const c = getClient(id);
  openSheet(`
    <h3>Editar cliente</h3>
    <label>Nome</label>
    <input type="text" id="cNome" value="${c.nome}">
    <label>Telefone (WhatsApp)</label>
    <input type="tel" id="cTel" value="${c.telefone||''}" placeholder="43 99999-9999">
    <button class="btn-primary" onclick="saveClientEdit('${c.id}')">Salvar</button>
  `);
}
async function saveClientEdit(id){
  const c = getClient(id);
  const nome = document.getElementById('cNome').value.trim();
  if(!nome){ showToast('Informe o nome'); return; }
  c.nome = nome;
  c.telefone = document.getElementById('cTel').value.trim();
  await saveClientes();
  showToast('Cliente atualizada');
  openClientDetail(id);
}

function newClientForm(prefillName){
  openSheet(`
    <h3>Nova cliente</h3>
    <label>Nome</label>
    <input type="text" id="ncNome" value="${prefillName||''}" placeholder="Nome completo">
    <label>Telefone (WhatsApp)</label>
    <input type="tel" id="ncTel" placeholder="43 99999-9999">
    <label>Observação inicial (opcional)</label>
    <textarea id="ncObs" placeholder="Alergias, preferências..."></textarea>
    <button class="btn-primary" onclick="saveNewClient(false)">Cadastrar cliente</button>
    <button class="btn-secondary" onclick="saveNewClient(true)">Cadastrar e marcar horário</button>
  `);
}
async function saveNewClient(irParaAgenda){
  const nome = document.getElementById('ncNome').value.trim();
  if(!nome){ showToast('Informe o nome'); return; }
  const tel = document.getElementById('ncTel').value.trim();
  const obs = document.getElementById('ncObs').value.trim();
  const novo = {id:uid(), nome, telefone:tel, observacoes: obs?[{data:todayISO(), texto:obs}]:[]};
  clientes.push(novo);
  await saveClientes();
  showToast('Cliente cadastrada');
  if(irParaAgenda){
    currentTab='agenda';
    render();
    scheduleForClient(novo.id);
  }else{
    closeSheet();
    currentTab='clientes';
    render();
  }
}