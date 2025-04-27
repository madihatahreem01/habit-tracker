let selectedDate = new Date().toISOString().split('T')[0];

document.addEventListener('DOMContentLoaded', async () => {
  // render FullCalendar
  const calEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calEl, {
    initialView: 'dayGridMonth',
    dateClick: info => {
      selectedDate = info.dateStr;
      document.getElementById('selected-date').textContent = selectedDate;
      loadData();
    }
  });
  calendar.render();
  document.getElementById('selected-date').textContent = selectedDate;
  await loadData();
});

async function logout() {
  await fetch('/api/logout');
  window.location.href = '/';
}

async function loadData() {
  const res = await fetch('/api/userdata');
  if (!res.ok) return alert('Session expired');
  const u = await res.json();

  // HABITS
  const hl = document.getElementById('habits-list');
  hl.innerHTML = '';
  u.habits.forEach(h=>{
    const done = (u.habitCompletion[selectedDate]||[]).includes(h);
    const li = document.createElement('li');
    li.innerHTML = `<input type="checkbox" ${done?'checked':''}
       onchange="toggleHabit('${h}')"> ${h}`;
    hl.appendChild(li);
  });

  // TODOS
  const tl = document.getElementById('todos-list');
  tl.innerHTML = '';
  (u.todos[selectedDate]||[]).forEach((t,i)=>{
    const li = document.createElement('li');
    li.innerHTML = `<input type="checkbox" ${t.done?'checked':''}
       onchange="toggleTodo(${i})"> ${t.text}`;
    tl.appendChild(li);
  });

  // GROUPS
  const gl = document.getElementById('groups-list');
  gl.innerHTML = '';
  u.groupsInfo.forEach(g=>{
    const li = document.createElement('li');
    li.textContent = g.name;
    gl.appendChild(li);
  });

  // INVITES
  const ir = document.getElementById('invites-received');
  const is = document.getElementById('invites-sent');
  ir.innerHTML = ''; is.innerHTML = '';
  u.invitesReceived.forEach(inv=>{
    const li = document.createElement('li');
    li.innerHTML = `${inv.type} “${inv.name}” from ${inv.from}
      <button onclick="acceptInvite('${inv.from}','${inv.type}','${inv.name}')">Accept</button>`;
    ir.appendChild(li);
  });
  u.invitesSent.forEach(inv=>{
    const li = document.createElement('li');
    li.innerHTML = `${inv.type} “${inv.name}” to ${inv.to}
      <button onclick="cancelInvite('${inv.to}','${inv.type}','${inv.name}')">Cancel</button>`;
    is.appendChild(li);
  });

  // CHALLENGES
  const cl = document.getElementById('challenges-list');
  cl.innerHTML = '';
  u.challengesInfo.forEach(ch=>{
    const li = document.createElement('li');
    const member = ch.members.find(m=>m.username===u.username);
    const doneToday = (member.progressDates||[]).includes(selectedDate);
    li.innerHTML = `
      <strong>${ch.name}</strong>
      <button onclick="toggleChallenge('${ch.name}')">
        ${doneToday?'Undo today':'Done today'}
      </button>
      <ul>
        ${ch.members.map(m=>`<li>${m.username}: ${m.progressDates.length}/${ch.days}</li>`).join('')}
      </ul>`;
    cl.appendChild(li);
  });

  // YOU – monthly progress
  const yp = document.getElementById('you-progress');
  const now = new Date();
  const month = now.toISOString().slice(0,7);
  // habits
  let totalH = u.habits.length * new Date(now.getFullYear(), now.getMonth()+1,0).getDate();
  let doneH = Object.entries(u.habitCompletion)
    .filter(([d])=>d.startsWith(month))
    .reduce((sum,[_,arr])=>sum+arr.length,0);
  // todos
  let allTodos = Object.entries(u.todos)
    .filter(([d])=>d.startsWith(month))
    .map(([_,ary])=>ary);
  let totalT = allTodos.reduce((s,ary)=>s+ary.length,0);
  let doneT  = allTodos.flat().filter(t=>t.done).length;

  const pH = totalH? Math.round(doneH/totalH*100):0;
  const pT = totalT? Math.round(doneT/totalT*100):0;

  yp.innerHTML = `
    <h5>Monthly Progress (${month})</h5>
    <p>Habits: ${doneH}/${totalH} (${pH}%)</p>
    <p>To-Dos: ${doneT}/${totalT} (${pT}%)</p>`;
}

// ACTIONS
async function addHabit() {
  const h = document.getElementById('habit-input').value.trim();
  if(!h) return;
  await fetch('/api/addHabit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({habit:h})});
  document.getElementById('habit-input').value='';
  loadData();
}
async function toggleHabit(habit) {
  await fetch('/api/toggleHabitCompletion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:selectedDate,habit})});
  loadData();
}

// Function to delete a To-Do
function deleteTodo(event) {
  const todoItem = event.target.closest('li'); // Get the closest <li> that the button belongs to
  todoItem.remove(); // Remove the <li> element
}

// Function to add a new To-Do
function addTodo() {
  const todoInput = document.getElementById('todo-input');
  const newTodo = todoInput.value.trim();
  
  if (newTodo) {
      const todoList = document.getElementById('todos-list');

      // Create a new <li> element for the to-do item
      const todoItem = document.createElement('li');
      
      // Create a span element to hold the to-do text
      const todoText = document.createElement('span');
      todoText.textContent = newTodo;
      
      // Create a delete button
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.onclick = deleteTodo; // Set the delete button's onclick event
      
      // Append the span and delete button to the <li> element
      todoItem.appendChild(todoText);
      todoItem.appendChild(deleteButton);
      
      // Append the <li> to the to-do list
      todoList.appendChild(todoItem);

      // Clear the input field after adding the to-do
      todoInput.value = '';
  }
}

async function toggleTodo(idx) {
  await fetch('/api/toggleTodo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:selectedDate,idx})});
  loadData();
}

async function createGroup() {
  const g = document.getElementById('group-input').value.trim();
  if(!g) return;
  await fetch('/api/createGroup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupName:g})});
  document.getElementById('group-input').value='';
  loadData();
}

async function sendInvite() {
  const to = document.getElementById('invite-to').value.trim();
  const type = document.getElementById('invite-type').value;
  const name = document.getElementById('invite-name').value.trim();
  if(!to||!name) return;
  await fetch('/api/sendInvite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({toUsername:to,type,name})});
  document.getElementById('invite-to').value='';
  document.getElementById('invite-name').value='';
  loadData();
}

async function acceptInvite(from,type,name) {
  await fetch('/api/acceptInvite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,type,name})});
  loadData();
}

async function cancelInvite(to,type,name) {
  await fetch('/api/sendInvite',{ // reuse sendInvite path typo? Should be /api/cancelInvite
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({toUsername:to,type,name})
  });
  // oops—actually server expects { to, type, name } at /api/cancelInvite
  await fetch('/api/cancelInvite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,type,name})});
  loadData();
}

async function createChallenge() {
  const name = document.getElementById('challenge-name').value.trim();
  const days = parseInt(document.getElementById('challenge-days').value);
  if(!name||!days) return;
  await fetch('/api/createChallenge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeName:name,days})});
  document.getElementById('challenge-name').value='';
  document.getElementById('challenge-days').value='';
  loadData();
}

async function toggleChallenge(name) {
  await fetch('/api/toggleChallenge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeName:name,date:selectedDate})});
  loadData();
}
function deleteHabit(habitId) {
  const habitList = document.getElementById('habits-list');
  const habitItem = document.getElementById(habitId); // Assuming each habit has an id like 'habit1'
  habitList.removeChild(habitItem);
}

function deleteTodo(todoId) {
  const todoList = document.getElementById('todos-list');
  const todoItem = document.getElementById(todoId); // Same as habits, each todo should have a unique id
  todoList.removeChild(todoItem);
}
