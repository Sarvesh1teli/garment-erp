const crypto = require('crypto');
exports.setupUserAccess = ({ database, sessions, passwordHash }) => {
  database.exec(`CREATE TABLE IF NOT EXISTS app_user_access (user_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, modules TEXT NOT NULL DEFAULT '[]')`);
  const userView = row => ({ id: row.id, name: row.name, email: row.email, role: row.role, active: Boolean(row.active), modules: JSON.parse(row.modules || '[]') });
  const current = request => {
    const token = String(request.headers.authorization || '').replace(/^Bearer /, '');
    const session = sessions.get(token);
    if (!session) throw Error('Please sign in again.');
    const row = database.prepare('SELECT u.*, a.modules FROM app_users u LEFT JOIN app_user_access a ON a.user_id=u.id WHERE u.id=?').get(session.userId);
    if (!row || !row.active) throw Error('This user has been deactivated.');
    return { ...userView(row), tenantId: session.tenantId };
  };
  return { current, handle: (request, value) => {
    const owner = current(request);
    if (!['Owner', 'Admin', 'Master', 'SuperAdmin'].includes(owner.role)) throw Error('Only the Owner can manage users.');
    if (request.method === 'GET') return database.prepare(`SELECT u.*, a.modules FROM app_users u JOIN app_user_access a ON a.user_id=u.id WHERE a.tenant_id=? ORDER BY u.name`).all(owner.tenantId).map(userView);
    const name = String(value.name || '').trim();
    const email = String(value.email || '').trim().toLowerCase();
    const modules = [...new Set((Array.isArray(value.modules) ? value.modules : []).filter(item => typeof item === 'string'))];
    if (!name || !email || !modules.length) throw Error('Enter a name, username and at least one allowed module.');
    const existing = value.id ? database.prepare('SELECT u.*, a.tenant_id FROM app_users u JOIN app_user_access a ON a.user_id=u.id WHERE u.id=?').get(value.id) : null;
    if (value.id && (!existing || existing.tenant_id !== owner.tenantId || existing.role !== 'Staff')) throw Error('Staff account not found.');
    const password = String(value.password || '');
    if ((!existing || password) && password.length < 6) throw Error('Use a password with at least six characters.');
    const duplicate = database.prepare('SELECT id FROM app_users WHERE lower(email)=lower(?)').get(email);
    if (duplicate && duplicate.id !== existing?.id) throw Error('That username is already in use.');
    const id = existing?.id || crypto.randomUUID();
    database.exec('BEGIN');
    try {
      if (existing) database.prepare('UPDATE app_users SET name=?, email=?, active=? WHERE id=?').run(name, email, value.active === false ? 0 : 1, id);
      else { const salt = crypto.randomBytes(16).toString('hex'); database.prepare("INSERT INTO app_users(id,name,email,password_salt,password_hash,role,active) VALUES(?,?,?,?,?,'Staff',?)").run(id,name,email,salt,passwordHash(password,salt),value.active===false?0:1); }
      if (existing && password) { const salt = crypto.randomBytes(16).toString('hex'); database.prepare('UPDATE app_users SET password_salt=?,password_hash=? WHERE id=?').run(salt,passwordHash(password,salt),id); }
      database.prepare('INSERT INTO app_user_access(user_id,tenant_id,modules) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET modules=excluded.modules').run(id,owner.tenantId,JSON.stringify(modules));
      database.exec('COMMIT');
    } catch (error) { database.exec('ROLLBACK'); throw error; }
    return { id };
  }};
};
