const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));

// Helpers
const dataPath = f => path.join(__dirname, 'data', f);
const load = f => JSON.parse(fs.readFileSync(dataPath(f)));
const save = (f,d) => fs.writeFileSync(dataPath(f), JSON.stringify(d,null,2));

// Load JSON data (users, groups, challenges, etc.)
function loadData() {
    return {
        users: JSON.parse(fs.readFileSync('users.json')),
        groups: JSON.parse(fs.readFileSync('groups.json')),
        challenges: JSON.parse(fs.readFileSync('challenges.json')),
        invites: JSON.parse(fs.readFileSync('invites.json'))
    };
}

// Save Data to JSON
function saveData(data) {
    fs.writeFileSync('users.json', JSON.stringify(data.users, null, 2));
    fs.writeFileSync('groups.json', JSON.stringify(data.groups, null, 2));
    fs.writeFileSync('challenges.json', JSON.stringify(data.challenges, null, 2));
    fs.writeFileSync('invites.json', JSON.stringify(data.invites, null, 2));
}

// Delete Habit or To-Do
app.post('/delete-task', (req, res) => {
    const { type, id, username } = req.body;
    const data = loadData();

    // Remove Habit or To-Do
    if (type === 'habit') {
        data.users.forEach(user => {
            if (user.username === username) {
                user.habits = user.habits.filter(habit => habit.id !== id);
            }
        });
    } else if (type === 'todo') {
        data.users.forEach(user => {
            if (user.username === username) {
                user.todos = user.todos.filter(todo => todo.id !== id);
            }
        });
    }

    saveData(data);
    res.send({ success: true });
});

// Leave Group or Challenge
app.post('/leave-group-challenge', (req, res) => {
    const { type, groupId, challengeId, username } = req.body;
    const data = loadData();

    // Leave Group
    if (type === 'group') {
        data.groups.forEach(group => {
            if (group.id === groupId) {
                group.members = group.members.filter(member => member !== username);
            }
        });
    }

    // Leave Challenge
    if (type === 'challenge') {
        data.challenges.forEach(challenge => {
            if (challenge.id === challengeId) {
                challenge.members = challenge.members.filter(member => member !== username);
            }
        });
    }

    saveData(data);
    res.send({ success: true });
});

// --- AUTH & USERDATA ---
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  let users = load('users.json');
  if (users.find(u=>u.username===username))
    return res.status(400).json({ message:'Username exists' });
  users.push({
    username,
    password,
    habits: [],
    habitCompletion: {},      // { "2025-04-27": ["Drink Water", ...], ... }
    todos: {},                // { "2025-04-27": [{ text, done }, ...], ... }
    groups: [],
    challenges: [],
  });
  save('users.json', users);
  res.json({ message:'Registered' });
});

app.post('/api/login', (req,res) => {
  const { username,password } = req.body;
  const users = load('users.json');
  if (users.find(u=>u.username===username&&u.password===password)) {
    req.session.user = username;
    return res.json({ message:'OK' });
  }
  res.status(400).json({ message:'Invalid creds' });
});

app.get('/api/logout',(req,res)=>{
  req.session.destroy();
  res.json({ message:'Logged out' });
});

app.get('/api/userdata',(req,res)=>{
  if (!req.session.user) return res.status(401).json({ message:'Unauthorized' });

  const username = req.session.user;
  const users = load('users.json');
  const invites = load('invites.json');
  const groups = load('groups.json');
  const challenges = load('challenges.json');

  const user = users.find(u=>u.username===username);
  const invitesReceived = invites.filter(inv=>inv.to===username);
  const invitesSent     = invites.filter(inv=>inv.from===username);
  const groupsInfo      = groups.filter(g=>g.members.includes(username));
  const challengesInfo  = challenges
    .filter(c=>c.members.some(m=>m.username===username));

  // strip password
  const { password, ...safeUser } = user;
  res.json({
    ...safeUser,
    invitesReceived,
    invitesSent,
    groupsInfo,
    challengesInfo
  });
});

// --- HABITS ---
app.post('/api/addHabit', (req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'Auth'});
  const { habit } = req.body;
  const users = load('users.json');
  const u = users.find(u=>u.username===req.session.user);
  if (!u.habits.includes(habit)) u.habits.push(habit);
  save('users.json', users);
  res.json({ message:'Added' });
});

app.post('/api/toggleHabitCompletion',(req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'Auth'});
  const { date, habit } = req.body;
  const users = load('users.json');
  const u = users.find(u=>u.username===req.session.user);
  u.habitCompletion[date] = u.habitCompletion[date]||[];
  const idx = u.habitCompletion[date].indexOf(habit);
  if (idx>=0) u.habitCompletion[date].splice(idx,1);
  else        u.habitCompletion[date].push(habit);
  save('users.json', users);
  res.json({ message:'Toggled' });
});

// --- TODOS ---
app.post('/api/addTodo', (req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'Auth'});
  const { date, todo } = req.body;
  const users = load('users.json');
  const u = users.find(u=>u.username===req.session.user);
  u.todos[date] = u.todos[date]||[];
  u.todos[date].push({ text: todo, done: false });
  save('users.json', users);
  res.json({ message:'Added' });
});

app.post('/api/toggleTodo',(req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'Auth'});
  const { date, idx } = req.body;
  const users = load('users.json');
  const u = users.find(u=>u.username===req.session.user);
  const item = u.todos[date][idx];
  item.done = !item.done;
  save('users.json', users);
  res.json({ message:'Toggled' });
});

// --- GROUPS & INVITES ---
app.post('/api/createGroup',(req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'Auth'});
  const { groupName } = req.body;
  const groups = load('groups.json');
  if (groups.find(g=>g.name===groupName))
    return res.status(400).json({message:'Exists'});
  groups.push({ name: groupName, members: [req.session.user] });
  save('groups.json', groups);
  // add to user
  const users = load('users.json');
  users.find(u=>u.username===req.session.user).groups.push(groupName);
  save('users.json', users);
  res.json({ message:'Created' });
});

app.post('/api/sendInvite',(req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'Auth'});
  const { toUsername, type, name } = req.body;
  const users = load('users.json');
  if (!users.find(u=>u.username===toUsername))
    return res.status(400).json({message:'No user'});
  const invites = load('invites.json');
  invites.push({ from: req.session.user, to: toUsername, type, name });
  save('invites.json', invites);
  res.json({ message:'Sent' });
});

app.post('/api/acceptInvite',(req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'Auth'});
  const { from, type, name } = req.body;
  let invites = load('invites.json');
  invites = invites.filter(inv=>!(inv.from===from&&inv.to===req.session.user&&inv.type===type&&inv.name===name));
  save('invites.json', invites);

  if (type==='group') {
    const groups = load('groups.json');
    const grp = groups.find(g=>g.name===name);
    if (!grp.members.includes(req.session.user)) grp.members.push(req.session.user);
    save('groups.json', groups);
    const users = load('users.json');
    users.find(u=>u.username===req.session.user).groups.push(name);
    save('users.json', users);
  } else if (type==='challenge') {
    const challenges = load('challenges.json');
    const ch = challenges.find(c=>c.name===name);
    ch.members.push({ username: req.session.user, progressDates: [] });
    save('challenges.json', challenges);
    const users = load('users.json');
    users.find(u=>u.username===req.session.user).challenges.push(name);
    save('users.json', users);
  }
  res.json({ message:'Accepted' });
});

// --- CHALLENGES ---
app.post('/api/createChallenge',(req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'Auth'});
  const { challengeName, days } = req.body;
  const challenges = load('challenges.json');
  if (challenges.find(c=>c.name===challengeName))
    return res.status(400).json({message:'Exists'});
  challenges.push({
    name: challengeName,
    days,
    members: [{ username: req.session.user, progressDates: [] }]
  });
  save('challenges.json', challenges);
  const users = load('users.json');
  users.find(u=>u.username===req.session.user).challenges.push(challengeName);
  save('users.json', users);
  res.json({ message:'Created' });
});

app.post('/api/toggleChallenge',(req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'Auth'});
  const { challengeName, date } = req.body;
  const challenges = load('challenges.json');
  const ch = challenges.find(c=>c.name===challengeName);
  const member = ch.members.find(m=>m.username===req.session.user);
  member.progressDates = member.progressDates||[];
  const idx = member.progressDates.indexOf(date);
  if (idx>=0) member.progressDates.splice(idx,1);
  else          member.progressDates.push(date);
  save('challenges.json', challenges);
  res.json({ message:'Toggled' });
});

app.listen(PORT, ()=> console.log(`🚀 Listening http://localhost:${PORT}`));
