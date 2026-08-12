const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { SOFTWARE_OWNER_PASSWORD, COMMON_CUSTOMER_PASSWORD } = require('./license-config.cjs');

const DEFAULT_PORT = 47831;
const MASTER_USERNAME = 'master';
const MASTER_PASSWORD = 'admin@123';

function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
  });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 15 * 1024 * 1024) request.destroy();
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || 'null')); } catch (error) { reject(error); }
    });
    request.on('error', reject);
  });
}

function startLocalApi({ dataDirectory, port = DEFAULT_PORT }) {
  const databaseDirectory = path.join(dataDirectory, 'database');
  const assetsDirectory = path.join(dataDirectory, 'assets');
  const backupsDirectory = path.join(dataDirectory, 'backups');
  fs.mkdirSync(databaseDirectory, { recursive: true });
  fs.mkdirSync(assetsDirectory, { recursive: true });
  fs.mkdirSync(backupsDirectory, { recursive: true });
  const database = new DatabaseSync(path.join(databaseDirectory, 'threadflow.db'));
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS app_state (
      resource_key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      customer_type TEXT NOT NULL,
      phone TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      phone TEXT NOT NULL,
      location TEXT NOT NULL,
      uniform TEXT NOT NULL,
      status TEXT NOT NULL,
      logo TEXT NOT NULL DEFAULT '',
      dress_versions_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      admission TEXT NOT NULL,
      name TEXT NOT NULL,
      school TEXT NOT NULL,
      class_name TEXT NOT NULL,
      section TEXT NOT NULL,
      gender TEXT NOT NULL,
      year TEXT NOT NULL DEFAULT '',
      sizes_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      address TEXT NOT NULL,
      joining_date TEXT NOT NULL,
      employee_type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS work_types (
      id TEXT PRIMARY KEY,
      code TEXT,
      name TEXT NOT NULL,
      rate REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      unit TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS work_assignments (
      id TEXT PRIMARY KEY,
      assignment_date TEXT NOT NULL,
      cutting_no TEXT NOT NULL,
      cutting_qty REAL NOT NULL DEFAULT 0,
      customer_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      works_json TEXT NOT NULL DEFAULT '[]',
      remarks TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS work_entries (
      id TEXT PRIMARY KEY,
      entry_date TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      work_type_id TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      remarks TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS salary_advances (
      id TEXT PRIMARY KEY,
      advance_date TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      payment_mode TEXT NOT NULL,
      remarks TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS salary_payments (
      id TEXT PRIMARY KEY,
      paid_date TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      period_from TEXT NOT NULL,
      period_to TEXT NOT NULL,
      recover REAL NOT NULL DEFAULT 0,
      payment_mode TEXT NOT NULL,
      remarks TEXT NOT NULL DEFAULT '',
      gross REAL NOT NULL DEFAULT 0,
      opening_advance REAL NOT NULL DEFAULT 0,
      advance_during REAL NOT NULL DEFAULT 0,
      pending_advance REAL NOT NULL DEFAULT 0,
      net_payable REAL NOT NULL DEFAULT 0,
      closing_advance REAL NOT NULL DEFAULT 0,
      pieces REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subcategory TEXT NOT NULL DEFAULT '-',
      unit TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS stock_receipts (
      id TEXT PRIMARY KEY,
      receipt_date TEXT NOT NULL,
      item_name TEXT NOT NULL,
      subcategory TEXT NOT NULL DEFAULT '-',
      quantity REAL NOT NULL DEFAULT 0,
      vendor TEXT NOT NULL DEFAULT '-',
      remarks TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS stock_issues (
      id TEXT PRIMARY KEY,
      issue_date TEXT NOT NULL,
      item_name TEXT NOT NULL,
      subcategory TEXT NOT NULL DEFAULT '-',
      quantity REAL NOT NULL DEFAULT 0,
      purpose TEXT NOT NULL DEFAULT '-',
      department TEXT NOT NULL DEFAULT '-',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS expense_vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      vendor_type TEXT NOT NULL,
      contact TEXT NOT NULL DEFAULT '-',
      phone TEXT NOT NULL DEFAULT '-',
      gst TEXT NOT NULL DEFAULT '-',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      payee TEXT NOT NULL,
      financial_year TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      expense_date TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      payment_mode TEXT NOT NULL,
      bill_reference TEXT NOT NULL DEFAULT '-',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      gst TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      logo TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS module_settings (
      module_label TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS local_subscription (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      license_key TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      activated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Owner',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS school_collections (
      id TEXT PRIMARY KEY,
      collection_date TEXT NOT NULL,
      school_name TEXT NOT NULL,
      payment_mode TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      remarks TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS invoices (
      invoice_no TEXT PRIMARY KEY,
      invoice_date TEXT NOT NULL,
      due_date TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      reverse_charge TEXT NOT NULL DEFAULT 'NO',
      customer TEXT NOT NULL,
      customer_phone TEXT NOT NULL DEFAULT '',
      customer_gst TEXT NOT NULL DEFAULT '',
      customer_address TEXT NOT NULL DEFAULT '',
      ship_to TEXT NOT NULL DEFAULT '',
      ship_address TEXT NOT NULL DEFAULT '',
      ship_gst TEXT NOT NULL DEFAULT '',
      product TEXT NOT NULL,
      hsn TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '',
      rate REAL NOT NULL DEFAULT 0,
      cgst REAL NOT NULL DEFAULT 0,
      sgst REAL NOT NULL DEFAULT 0,
      taxable_amount REAL NOT NULL DEFAULT 0,
      amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Pending',
      terms TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id TEXT PRIMARY KEY,
      payment_date TEXT NOT NULL,
      invoice_no TEXT NOT NULL,
      customer TEXT NOT NULL,
      payment_mode TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      reference TEXT NOT NULL DEFAULT '-',
      remarks TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS delivery_challans (
      challan_no TEXT PRIMARY KEY,
      challan_date TEXT NOT NULL,
      customer TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      gst TEXT NOT NULL DEFAULT '',
      vehicle TEXT NOT NULL DEFAULT '',
      driver TEXT NOT NULL DEFAULT '',
      delivery_mode TEXT NOT NULL DEFAULT '',
      product TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '',
      quantity_text TEXT NOT NULL DEFAULT '',
      remarks TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Ready',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ready_school_stock (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      class_name TEXT NOT NULL,
      gender TEXT NOT NULL,
      garment TEXT NOT NULL,
      size TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      remarks TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      school_id TEXT,
      category TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      relative_path TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const ensureColumn = (table, column, definition) => {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(item => item.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  for (const [column, definition] of Object.entries({
    due_date:"TEXT NOT NULL DEFAULT ''", state:"TEXT NOT NULL DEFAULT ''", reverse_charge:"TEXT NOT NULL DEFAULT 'NO'",
    customer_phone:"TEXT NOT NULL DEFAULT ''", customer_gst:"TEXT NOT NULL DEFAULT ''", customer_address:"TEXT NOT NULL DEFAULT ''",
    ship_to:"TEXT NOT NULL DEFAULT ''", ship_address:"TEXT NOT NULL DEFAULT ''", ship_gst:"TEXT NOT NULL DEFAULT ''", hsn:"TEXT NOT NULL DEFAULT ''",
    unit:"TEXT NOT NULL DEFAULT ''", rate:'REAL NOT NULL DEFAULT 0', cgst:'REAL NOT NULL DEFAULT 0', sgst:'REAL NOT NULL DEFAULT 0',
    taxable_amount:'REAL NOT NULL DEFAULT 0', terms:"TEXT NOT NULL DEFAULT ''",
  })) ensureColumn('invoices', column, definition);
  for (const [column, definition] of Object.entries({
    phone:"TEXT NOT NULL DEFAULT ''", address:"TEXT NOT NULL DEFAULT ''", gst:"TEXT NOT NULL DEFAULT ''", vehicle:"TEXT NOT NULL DEFAULT ''",
    driver:"TEXT NOT NULL DEFAULT ''", delivery_mode:"TEXT NOT NULL DEFAULT ''", quantity:'REAL NOT NULL DEFAULT 0', unit:"TEXT NOT NULL DEFAULT ''", quantity_text:"TEXT NOT NULL DEFAULT ''",
    remarks:"TEXT NOT NULL DEFAULT ''",
  })) ensureColumn('delivery_challans', column, definition);
  ensureColumn('ready_school_stock', 'date', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('students', 'year', "TEXT NOT NULL DEFAULT ''");
  const studentIndexes = database.prepare("PRAGMA index_list('students')").all();
  if (studentIndexes.some(index => index.name === 'sqlite_autoindex_students_2')) {
    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec('ALTER TABLE students RENAME TO students_legacy');
      database.exec(`CREATE TABLE students (
        id TEXT PRIMARY KEY,
        admission TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        school TEXT NOT NULL,
        class_name TEXT NOT NULL,
        section TEXT NOT NULL,
        gender TEXT NOT NULL,
        year TEXT NOT NULL DEFAULT '',
        sizes_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      database.exec('INSERT INTO students (id, admission, name, school, class_name, section, gender, year, sizes_json, created_at, updated_at) SELECT id, admission, name, school, class_name, section, gender, year, sizes_json, created_at, updated_at FROM students_legacy');
      database.exec('DROP TABLE students_legacy');
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  database.exec(`UPDATE ready_school_stock SET date = substr(created_at, 1, 10) WHERE date = ''`);
  const nextReadyStockId = () => {
    const { m } = database.prepare("SELECT COALESCE(MAX(CAST(SUBSTR(id, 4) AS INTEGER)), 0) AS m FROM ready_school_stock WHERE id GLOB 'RS-[0-9]*'").get();
    return `RS-${String(Number(m) + 1).padStart(4, '0')}`;
  };
  const renameReadyStockId = database.prepare('UPDATE ready_school_stock SET id = ? WHERE id = ?');
  for (const legacy of database.prepare("SELECT id FROM ready_school_stock WHERE id NOT GLOB 'RS-[0-9]*' ORDER BY rowid").all()) {
    renameReadyStockId.run(nextReadyStockId(), legacy.id);
  }

  const findState = database.prepare(
    'SELECT payload_json, version, updated_at FROM app_state WHERE resource_key = ?'
  );
  const saveState = database.prepare(`
    INSERT INTO app_state (resource_key, payload_json)
    VALUES (?, ?)
    ON CONFLICT(resource_key) DO UPDATE SET
      payload_json = excluded.payload_json,
      version = app_state.version + 1,
      updated_at = CURRENT_TIMESTAMP
  `);
  const deleteState = database.prepare('DELETE FROM app_state WHERE resource_key = ?');
  const findMedia = database.prepare('SELECT id, school_id, category, original_filename, relative_path, mime_type, file_size, sha256, created_at FROM media_assets WHERE id = ?');
  const insertMedia = database.prepare('INSERT INTO media_assets (id, school_id, category, original_filename, relative_path, mime_type, file_size, sha256) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const deleteMedia = database.prepare('DELETE FROM media_assets WHERE id = ?');

  const listReadyStock = database.prepare('SELECT id, school_id, class_name, gender, garment, size, quantity, remarks, date FROM ready_school_stock ORDER BY rowid');
  const findReadyStock = database.prepare('SELECT id, school_id, class_name, gender, garment, size, quantity, remarks, date FROM ready_school_stock WHERE id = ?');
  const insertReadyStock = database.prepare('INSERT INTO ready_school_stock (id, school_id, class_name, gender, garment, size, quantity, remarks, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const updateReadyStock = database.prepare('UPDATE ready_school_stock SET school_id=?, class_name=?, gender=?, garment=?, size=?, quantity=?, remarks=?, date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?');
  const deleteReadyStock = database.prepare('DELETE FROM ready_school_stock WHERE id = ?');
  const readyStockJsonToParams = value => [String(value.school || ''), String(value.className || ''), String(value.gender || ''), String(value.garment || ''), String(value.size || ''), numericValue(value.count), String(value.remarks || ''), String(value.date || '')];
  const readyStockRowToJson = row => ({ id: row.id, school: row.school_id, className: row.class_name, gender: row.gender, garment: row.garment, size: row.size, count: Number(row.quantity), remarks: row.remarks, date: row.date });
  function validateReadyStock(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid ready stock payload');
    if (!String(value.school || '').trim()) throw new Error('School is required');
    if (!String(value.className || '').trim()) throw new Error('Class is required');
    if (!String(value.garment || '').trim()) throw new Error('Garment is required');
    if (!String(value.size || '').trim()) throw new Error('Size is required');
    return value;
  }
  function loadReadyStockList() {
    let rows = listReadyStock.all();
    if (!rows.length) {
      const legacy = findState.get('garment-ready-stock');
      if (legacy) {
        database.exec('BEGIN IMMEDIATE');
        try {
          for (const row of JSON.parse(legacy.payload_json)) {
            if (!row || !row.school || !row.className || !row.garment || !row.size) continue;
            insertReadyStock.run(nextReadyStockId(), String(row.school), String(row.className), String(row.gender || ''), String(row.garment), String(row.size), numericValue(row.count), String(row.remarks || ''), String(row.date || new Date().toISOString().slice(0, 10)));
          }
          deleteState.run('garment-ready-stock');
          database.exec('COMMIT');
        } catch (error) {
          database.exec('ROLLBACK');
          throw error;
        }
        rows = listReadyStock.all();
      }
    }
    return rows.map(readyStockRowToJson);
  }

  const findStudent = database.prepare('SELECT id, admission, name, school, class_name, section, gender, year, sizes_json FROM students WHERE id = ?');
  const insertStudent = database.prepare('INSERT INTO students (id, admission, name, school, class_name, section, gender, year, sizes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const updateStudent = database.prepare('UPDATE students SET id=?, admission=?, name=?, school=?, class_name=?, section=?, gender=?, year=?, sizes_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?');
  const deleteStudent = database.prepare('DELETE FROM students WHERE id = ?');
  const studentJsonToParams = value => [String(value.id || `${String(value.school || '')}:${String(value.admission || '')}`), String(value.admission || ''), String(value.name || '').trim(), String(value.school || ''), String(value.className || ''), String(value.section || ''), String(value.gender || ''), String(value.year || ''), JSON.stringify(value.sizes || {})];
  const studentRowToJson = row => ({ id: row.id, name: row.name, admission: row.admission, school: row.school, className: row.class_name, section: row.section, gender: row.gender, year: row.year || '', sizes: JSON.parse(row.sizes_json) });
  function validateStudent(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid student payload');
    if (!String(value.name || '').trim()) throw new Error('Student name is required');
    if (!String(value.school || '').trim()) throw new Error('School is required');
    return value;
  }

  const mediaTypes = {
    'image/jpeg': { extension: 'jpg', valid: buffer => buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
    'image/png': { extension: 'png', valid: buffer => buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) },
    'image/webp': { extension: 'webp', valid: buffer => buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
  };
  const mediaCategories = new Set(['school-logo', 'boys-dress', 'girls-dress']);

  function absoluteMediaPath(relativePath) {
    const resolved = path.resolve(assetsDirectory, relativePath);
    const root = path.resolve(assetsDirectory) + path.sep;
    if (!resolved.startsWith(root)) throw new Error('Invalid media path');
    return resolved;
  }

  function storeMedia(payload) {
    const { schoolId, category, filename, dataUrl } = payload || {};
    if (!schoolId || !category || !filename || !dataUrl) throw new Error('schoolId, category, filename and dataUrl are required');
    if (!mediaCategories.has(category)) throw new Error('Invalid media category');
    const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\r\n]+)$/i);
    if (!match) throw new Error('Only JPEG, PNG and WebP images are supported');
    const mimeType = match[1].toLowerCase();
    const mediaType = mediaTypes[mimeType];
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error('Image must be between 1 byte and 10 MB');
    if (!mediaType.valid(buffer)) throw new Error('File content does not match its image type');

    const id = crypto.randomUUID();
    const safeSchoolId = String(schoolId).replace(/[^a-z0-9_-]/gi, '_');
    const relativePath = path.join('schools', safeSchoolId, category, `${id}.${mediaType.extension}`);
    const filePath = absoluteMediaPath(relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer, { flag: 'wx' });
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    try {
      insertMedia.run(id, String(schoolId), category, path.basename(String(filename)), relativePath, mimeType, buffer.length, checksum);
    } catch (error) {
      fs.rmSync(filePath, { force: true });
      throw error;
    }
    return { id, schoolId, category, filename: path.basename(String(filename)), mimeType, fileSize: buffer.length, sha256: checksum, url: `/api/media/${id}` };
  }

  const backupTables = ['app_state', 'customers', 'schools', 'students', 'employees', 'work_types', 'work_assignments', 'work_entries', 'salary_advances', 'salary_payments', 'inventory_items', 'stock_receipts', 'stock_issues', 'expense_vendors', 'expense_categories', 'expenses', 'company_settings', 'module_settings', 'school_collections', 'invoices', 'invoice_payments', 'delivery_challans', 'ready_school_stock', 'media_assets'];
  const backupCountStatements = Object.fromEntries(backupTables.map(table => [table, database.prepare(`SELECT COUNT(*) AS count FROM ${table}`)]));
  const backupId = () => {
    const date = new Date();
    const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '-');
    return `${stamp}-${crypto.randomBytes(3).toString('hex')}`;
  };
  const safeBackupDirectory = id => {
    if (!/^[a-z0-9-]+$/i.test(id)) throw new Error('Invalid backup ID');
    const resolved = path.resolve(backupsDirectory, id);
    if (!resolved.startsWith(path.resolve(backupsDirectory) + path.sep)) throw new Error('Invalid backup path');
    return resolved;
  };

  function createBackup() {
    const id = backupId();
    const directory = safeBackupDirectory(id);
    const snapshotPath = path.join(directory, 'threadflow.db');
    const backupAssets = path.join(directory, 'assets');
    fs.mkdirSync(directory, { recursive: false });
    try {
      const escapedSnapshot = snapshotPath.replace(/'/g, "''");
      database.exec(`VACUUM INTO '${escapedSnapshot}'`);
      fs.cpSync(assetsDirectory, backupAssets, { recursive: true, force: true });
      const counts = Object.fromEntries(backupTables.map(table => [table, Number(backupCountStatements[table].get().count)]));
      const manifest = {
        format: 'threadflow-backup',
        formatVersion: 1,
        applicationVersion: '0.1.0',
        id,
        createdAt: new Date().toISOString(),
        counts,
      };
      fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
      return manifest;
    } catch (error) {
      fs.rmSync(directory, { recursive: true, force: true });
      throw error;
    }
  }

  function listBackups() {
    return fs.readdirSync(backupsDirectory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => {
        try {
          return JSON.parse(fs.readFileSync(path.join(backupsDirectory, entry.name, 'manifest.json'), 'utf8'));
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function restoreBackup(id) {
    const directory = safeBackupDirectory(id);
    const manifestPath = path.join(directory, 'manifest.json');
    const snapshotPath = path.join(directory, 'threadflow.db');
    const backupAssets = path.join(directory, 'assets');
    if (!fs.existsSync(manifestPath) || !fs.existsSync(snapshotPath) || !fs.existsSync(backupAssets)) throw new Error('Backup package is incomplete');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.format !== 'threadflow-backup' || manifest.formatVersion !== 1) throw new Error('Unsupported backup format');

    const validationDatabase = new DatabaseSync(snapshotPath, { readOnly: true });
    let snapshotTables;
    try {
      const integrity = validationDatabase.prepare('PRAGMA integrity_check').get();
      if (!integrity || Object.values(integrity)[0] !== 'ok') throw new Error('Backup database integrity check failed');
      snapshotTables = new Set(validationDatabase.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name));
      for (const required of ['app_state', 'customers', 'schools', 'students', 'employees', 'media_assets']) {
        if (!snapshotTables.has(required)) throw new Error(`Backup is missing required table: ${required}`);
      }
    } finally {
      validationDatabase.close();
    }

    const stagedAssets = path.join(dataDirectory, `.restore-assets-${id}`);
    const previousAssets = path.join(dataDirectory, `.previous-assets-${id}`);
    fs.rmSync(stagedAssets, { recursive: true, force: true });
    fs.rmSync(previousAssets, { recursive: true, force: true });
    fs.cpSync(backupAssets, stagedAssets, { recursive: true, force: true });

    let oldAssetsCopied = false;
    let assetsReplaced = false;
    database.prepare('ATTACH DATABASE ? AS restore_db').run(snapshotPath);
    try {
      database.exec('BEGIN IMMEDIATE');
      database.exec('PRAGMA foreign_keys = OFF');
      for (const table of backupTables) {
        database.exec(`DELETE FROM main.${table}`);
        if (snapshotTables.has(table)) {
          const mainColumns=database.prepare(`PRAGMA main.table_info(${table})`).all().map(row=>row.name);
          const restoreColumns=new Set(database.prepare(`PRAGMA restore_db.table_info(${table})`).all().map(row=>row.name));
          const commonColumns=mainColumns.filter(column=>restoreColumns.has(column));
          if(commonColumns.length){const names=commonColumns.map(column=>`"${column}"`).join(',');database.exec(`INSERT INTO main.${table} (${names}) SELECT ${names} FROM restore_db.${table}`)}
        }
      }
      fs.cpSync(assetsDirectory, previousAssets, { recursive: true, force: true });
      oldAssetsCopied = true;
      fs.rmSync(assetsDirectory, { recursive: true, force: true });
      assetsReplaced = true;
      fs.cpSync(stagedAssets, assetsDirectory, { recursive: true, force: true });
      database.exec('COMMIT');
      fs.rmSync(previousAssets, { recursive: true, force: true });
      fs.rmSync(stagedAssets, { recursive: true, force: true });
      return { ...manifest, restoredAt: new Date().toISOString(), restartRequired: true };
    } catch (error) {
      try { database.exec('ROLLBACK'); } catch {}
      if (assetsReplaced) fs.rmSync(assetsDirectory, { recursive: true, force: true });
      if (oldAssetsCopied) fs.cpSync(previousAssets, assetsDirectory, { recursive: true, force: true });
      fs.rmSync(previousAssets, { recursive: true, force: true });
      fs.rmSync(stagedAssets, { recursive: true, force: true });
      throw error;
    } finally {
      try { database.exec('PRAGMA foreign_keys = ON'); } catch {}
      try { database.exec('DETACH DATABASE restore_db'); } catch {}
    }
  }

  const numericValue = value => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const match = String(value ?? '').match(/-?\d[\d,]*(?:\.\d+)?/);
    const parsed = match ? Number(match[0].replace(/,/g, '')) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const moneyValue = value => `Rs. ${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const findCompanySettings = database.prepare('SELECT name, gst, address, phone, logo FROM company_settings WHERE id = 1');
  const saveCompanySettings = database.prepare(`
    INSERT INTO company_settings (id, name, gst, address, phone, logo) VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, gst=excluded.gst, address=excluded.address, phone=excluded.phone, logo=excluded.logo, updated_at=CURRENT_TIMESTAMP
  `);
  const findModuleSettings = database.prepare('SELECT module_label, enabled FROM module_settings ORDER BY rowid');
  const clearModuleSettings = database.prepare('DELETE FROM module_settings');
  const insertModuleSetting = database.prepare('INSERT INTO module_settings (module_label, enabled) VALUES (?, ?)');
  const findSubscription = database.prepare('SELECT license_key, plan_name, activated_at, expires_at, status FROM local_subscription WHERE id = 1');
  const saveSubscription = database.prepare(`INSERT INTO local_subscription (id, license_key, plan_name, activated_at, expires_at, status) VALUES (1, ?, ?, ?, ?, 'Active') ON CONFLICT(id) DO UPDATE SET license_key=excluded.license_key, plan_name=excluded.plan_name, activated_at=excluded.activated_at, expires_at=excluded.expires_at, status='Active', updated_at=CURRENT_TIMESTAMP`);
  const countUsers = database.prepare('SELECT COUNT(*) AS count FROM app_users');
  const findUserByEmail = database.prepare('SELECT id, name, email, password_salt, password_hash, role, active FROM app_users WHERE lower(email) = lower(?)');
  const insertUser = database.prepare('INSERT INTO app_users (id, name, email, password_salt, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)');
  const salaryPaymentDelete = database.prepare('DELETE FROM salary_payments WHERE id = ?');
  const findUserByUsername = (username) => findUserByEmail.get(String(username || '').trim());
  const authenticateUser = (user, password) => { if (!user || !user.active) return false; const actual = Buffer.from(passwordHash(String(password || ''), user.password_salt), 'hex'); const expected = Buffer.from(user.password_hash, 'hex'); return actual.length === expected.length && crypto.timingSafeEqual(actual, expected); };
  const ensureMasterUser = () => { if (!findUserByUsername(MASTER_USERNAME)) { const salt = crypto.randomBytes(16).toString('hex'); insertUser.run(crypto.randomUUID(), 'Master', MASTER_USERNAME, salt, passwordHash(MASTER_PASSWORD, salt), 'Master'); } };
  const findOwnerUser = () => database.prepare('SELECT id FROM app_users WHERE role = ? LIMIT 1').get('Owner');
  const ensureOwnerUser = () => { if (!findOwnerUser()) { const salt = crypto.randomBytes(16).toString('hex'); insertUser.run(crypto.randomUUID(), 'Admin', 'admin', salt, passwordHash(COMMON_CUSTOMER_PASSWORD, salt), 'Owner'); } };

  const subscriptionView = () => {
    const row=findSubscription.get();
    if(!row)return null;
    const now=Date.now();const startsAt=new Date(row.activated_at).getTime();const endsAt=new Date(row.expires_at).getTime();
    const status=now<startsAt?'Not Started':now>endsAt?'Expired':row.status;
    return {planName:row.plan_name,fromDate:row.activated_at,toDate:row.expires_at,status,licenseHint:`••••${String(row.license_key).slice(-4)}`};
  };
  const passwordHash=(password,salt)=>crypto.scryptSync(password,salt,64).toString('hex');
  const safeTextEqual=(left,right)=>{const a=Buffer.from(String(left));const b=Buffer.from(String(right));return a.length===b.length&&crypto.timingSafeEqual(a,b)};
  function activateSubscription(value){
    const activationMode=value?.activationMode==='password'?'password':'license';const licenseKey=String(value?.licenseKey||'').trim().toUpperCase();const softwarePassword=String(value?.softwarePassword||'');const planName=String(value?.planName||'Desktop Annual').trim();
    const fromDate=String(value?.fromDate||'');const toDate=String(value?.toDate||'');const datePattern=/^\d{4}-\d{2}-\d{2}$/;
    if(activationMode==='license'&&licenseKey.length<6)throw new Error('A valid license key is required');
    if(activationMode==='password'){
      if(SOFTWARE_OWNER_PASSWORD==='CHANGE-THIS-SOFTWARE-OWNER-PASSWORD')throw new Error('Set SOFTWARE_OWNER_PASSWORD in electron/license-config.cjs before using password activation');
      if(!safeTextEqual(softwarePassword,SOFTWARE_OWNER_PASSWORD))throw new Error('Invalid software owner password');
    }
    if(!datePattern.test(fromDate)||!datePattern.test(toDate))throw new Error('From date and to date are required');
    const startsAt=new Date(`${fromDate}T00:00:00.000Z`);const endsAt=new Date(`${toDate}T23:59:59.999Z`);
    if(Number.isNaN(startsAt.getTime())||Number.isNaN(endsAt.getTime())||startsAt.getTime()>endsAt.getTime())throw new Error('To date must be on or after from date');
    const owner = findOwnerUser();
    database.exec('BEGIN IMMEDIATE');
    try{
      if(!owner){const name=String(value?.ownerName||'Admin').trim();const email=String(value?.email||'admin').trim().toLowerCase();if(!name||(!email.includes('@')&&email!=='admin'))throw new Error('Use the default admin username or enter a valid owner email');const salt=crypto.randomBytes(16).toString('hex');insertUser.run(crypto.randomUUID(),name,email,salt,passwordHash(COMMON_CUSTOMER_PASSWORD,salt),'Owner')}
      saveSubscription.run(activationMode==='license'?licenseKey:'PASSWORD-ACTIVATED',planName,startsAt.toISOString(),endsAt.toISOString());database.exec('COMMIT');return subscriptionView();
    }catch(error){database.exec('ROLLBACK');throw error}
  }
  function login(value){const subscription=subscriptionView();if(!subscription||subscription.status!=='Active')throw new Error('Subscription activation or renewal is required');const user=findUserByEmail.get(String(value?.email||'').trim());if(!user||!user.active)throw new Error('Invalid email or password');const actual=Buffer.from(passwordHash(String(value?.password||''),user.password_salt),'hex');const expected=Buffer.from(user.password_hash,'hex');if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))throw new Error('Invalid email or password');return{token:crypto.randomBytes(32).toString('hex'),user:{id:user.id,name:user.name,email:user.email,role:user.role}}}

  function putCompanySettings(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !String(value.name || '').trim()) throw new Error('Company name is required');
    saveCompanySettings.run(String(value.name).trim(), String(value.gst || ''), String(value.address || ''), String(value.phone || ''), String(value.logo || ''));
    deleteState.run('garment-company-settings');
    saveState.run('domain-initialized:garment-company-settings', 'true');
    return getCompanySettings();
  }

  function getCompanySettings() {
    let row = findCompanySettings.get();
    if (!row) {
      const legacy = findState.get('garment-company-settings');
      if (legacy) return putCompanySettings(JSON.parse(legacy.payload_json));
      if (!findState.get('domain-initialized:garment-company-settings')) return null;
      return null;
    }
    return { name: row.name, gst: row.gst, address: row.address, phone: row.phone, logo: row.logo };
  }

  function putModuleSettings(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Module settings must be an object');
    database.exec('BEGIN IMMEDIATE');
    try {
      clearModuleSettings.run();
      for (const [label, enabled] of Object.entries(value)) insertModuleSetting.run(label, enabled === false ? 0 : 1);
      deleteState.run('garment-module-settings');
      saveState.run('domain-initialized:garment-module-settings', 'true');
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return getModuleSettings();
  }

  function getModuleSettings() {
    const rows = findModuleSettings.all();
    if (!rows.length) {
      const legacy = findState.get('garment-module-settings');
      if (legacy) return putModuleSettings(JSON.parse(legacy.payload_json));
      if (!findState.get('domain-initialized:garment-module-settings')) return null;
    }
    return Object.fromEntries(rows.map(row => [row.module_label, Boolean(row.enabled)]));
  }

  const domains = {
    customers: {
      legacyKey: 'garment-customers',
      select: database.prepare('SELECT id, name, customer_type, phone, location, status FROM customers ORDER BY rowid'),
      clear: database.prepare('DELETE FROM customers'),
      insert: database.prepare('INSERT INTO customers (id, name, customer_type, phone, location, status) VALUES (?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => [row.id, row.name, row.customer_type, row.phone, row.location, row.status]),
      insertRow: row => [row[0], row[1], row[2], row[3], row[4], row[5]],
    },
    schools: {
      legacyKey: 'garment-schools',
      select: database.prepare('SELECT id, name, contact, phone, location, uniform, status, logo, dress_versions_json FROM schools ORDER BY rowid'),
      clear: database.prepare('DELETE FROM schools'),
      insert: database.prepare('INSERT INTO schools (id, name, contact, phone, location, uniform, status, logo, dress_versions_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => ({ id: row.id, name: row.name, contact: row.contact, phone: row.phone, location: row.location, uniform: row.uniform, status: row.status, logo: row.logo, dressVersions: JSON.parse(row.dress_versions_json) })),
      insertRow: row => [row.id, row.name, row.contact, row.phone, row.location, row.uniform, row.status, row.logo || '', JSON.stringify(row.dressVersions || [])],
    },
    students: {
      legacyKey: 'garment-students',
      select: database.prepare('SELECT id, admission, name, school, class_name, section, gender, year, sizes_json FROM students ORDER BY rowid'),
      clear: database.prepare('DELETE FROM students'),
      insert: database.prepare('INSERT INTO students (id, admission, name, school, class_name, section, gender, year, sizes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => ({ id: row.id, name: row.name, admission: row.admission, school: row.school, className: row.class_name, section: row.section, gender: row.gender, year: row.year || '', sizes: JSON.parse(row.sizes_json) })),
      insertRow: row => [row.id || `${row.school}:${row.admission}`, row.admission, row.name, row.school, row.className, row.section, row.gender, row.year || '', JSON.stringify(row.sizes || {})],
    },
    employees: {
      legacyKey: 'garment-employees',
      select: database.prepare('SELECT id, name, mobile, address, joining_date, employee_type, status FROM employees ORDER BY rowid'),
      clear: database.prepare('DELETE FROM employees'),
      insert: database.prepare('INSERT INTO employees (id, name, mobile, address, joining_date, employee_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => ({ id: row.id, name: row.name, mobile: row.mobile, address: row.address, joiningDate: row.joining_date, type: row.employee_type, status: row.status })),
      insertRow: row => [row.id, row.name, row.mobile, row.address, row.joiningDate, row.type, row.status],
    },
    'work-types': {
      legacyKey: 'garment-work-types',
      select: database.prepare('SELECT id, code, name, rate, status, unit FROM work_types ORDER BY rowid'),
      clear: database.prepare('DELETE FROM work_types'),
      insert: database.prepare('INSERT INTO work_types (id, code, name, rate, status, unit) VALUES (?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => ({ id: row.id, code: row.code || undefined, name: row.name, rate: Number(row.rate), status: row.status, unit: row.unit })),
      insertRow: row => [row.id, row.code || null, row.name, Number(row.rate) || 0, row.status, row.unit],
    },
    assignments: {
      legacyKey: 'garment-assignments',
      select: database.prepare('SELECT id, assignment_date, cutting_no, cutting_qty, customer_id, employee_id, works_json, remarks FROM work_assignments ORDER BY rowid'),
      clear: database.prepare('DELETE FROM work_assignments'),
      insert: database.prepare('INSERT INTO work_assignments (id, assignment_date, cutting_no, cutting_qty, customer_id, employee_id, works_json, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => ({ id: row.id, date: row.assignment_date, cuttingNo: row.cutting_no, cuttingQty: Number(row.cutting_qty), customerId: row.customer_id, employeeId: row.employee_id, works: JSON.parse(row.works_json), remarks: row.remarks })),
      insertRow: row => [row.id, row.date, row.cuttingNo, Number(row.cuttingQty) || 0, row.customerId, row.employeeId, JSON.stringify(row.works || []), row.remarks || ''],
    },
    'work-entries': {
      legacyKey: 'garment-work-entries',
      select: database.prepare('SELECT id, entry_date, employee_id, work_type_id, quantity, remarks FROM work_entries ORDER BY rowid'),
      clear: database.prepare('DELETE FROM work_entries'),
      insert: database.prepare('INSERT INTO work_entries (id, entry_date, employee_id, work_type_id, quantity, remarks) VALUES (?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => ({ id: row.id, date: row.entry_date, employeeId: row.employee_id, workTypeId: row.work_type_id, quantity: Number(row.quantity), remarks: row.remarks })),
      insertRow: row => [row.id, row.date, row.employeeId, row.workTypeId, Number(row.quantity) || 0, row.remarks || ''],
    },
    advances: {
      legacyKey: 'garment-advances',
      select: database.prepare('SELECT id, advance_date, employee_id, amount, payment_mode, remarks FROM salary_advances ORDER BY rowid'),
      clear: database.prepare('DELETE FROM salary_advances'),
      insert: database.prepare('INSERT INTO salary_advances (id, advance_date, employee_id, amount, payment_mode, remarks) VALUES (?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => ({ id: row.id, date: row.advance_date, employeeId: row.employee_id, amount: Number(row.amount), mode: row.payment_mode, remarks: row.remarks })),
      insertRow: row => [row.id, row.date, row.employeeId, Number(row.amount) || 0, row.mode, row.remarks || ''],
    },
    'salary-payments': {
      legacyKey: 'garment-salary-history',
      select: database.prepare('SELECT id, paid_date, employee_id, period_from, period_to, recover, payment_mode, remarks, gross, opening_advance, advance_during, pending_advance, net_payable, closing_advance, pieces FROM salary_payments ORDER BY rowid'),
      clear: database.prepare('DELETE FROM salary_payments'),
      insert: database.prepare('INSERT INTO salary_payments (id, paid_date, employee_id, period_from, period_to, recover, payment_mode, remarks, gross, opening_advance, advance_during, pending_advance, net_payable, closing_advance, pieces) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => ({ id: row.id, paidDate: row.paid_date, employeeId: row.employee_id, from: row.period_from, to: row.period_to, recover: Number(row.recover), mode: row.payment_mode, remarks: row.remarks, gross: Number(row.gross), openingAdvance: Number(row.opening_advance), advanceDuring: Number(row.advance_during), pendingAdvance: Number(row.pending_advance), netPayable: Number(row.net_payable), closingAdvance: Number(row.closing_advance), pieces: Number(row.pieces) })),
      insertRow: row => [row.id, row.paidDate, row.employeeId, row.from, row.to, Number(row.recover) || 0, row.mode, row.remarks || '', Number(row.gross) || 0, Number(row.openingAdvance) || 0, Number(row.advanceDuring) || 0, Number(row.pendingAdvance) || 0, Number(row.netPayable) || 0, Number(row.closingAdvance) || 0, Number(row.pieces) || 0],
    },
    'inventory-items': {
      legacyKey: 'garment-inventory-items',
      select: database.prepare('SELECT id, name, subcategory, unit, quantity FROM inventory_items ORDER BY rowid'),
      clear: database.prepare('DELETE FROM inventory_items'),
      insert: database.prepare('INSERT INTO inventory_items (id, name, subcategory, unit, quantity) VALUES (?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => [row.id, row.name, row.subcategory, row.unit, String(Number(row.quantity))]),
      insertRow: row => row.length === 4
        ? [row[0], row[1], '-', row[2], numericValue(row[3])]
        : [row[0], row[1], row[2] || '-', row[3], numericValue(row[4])],
    },
    'stock-receipts': {
      legacyKey: 'garment-stock-in',
      select: database.prepare('SELECT id, receipt_date, item_name, subcategory, quantity, vendor, remarks FROM stock_receipts ORDER BY rowid'),
      clear: database.prepare('DELETE FROM stock_receipts'),
      insert: database.prepare('INSERT INTO stock_receipts (id, receipt_date, item_name, subcategory, quantity, vendor, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => [row.id, row.receipt_date, row.item_name, row.subcategory, String(Number(row.quantity)), row.vendor, row.remarks]),
      insertRow: row => row.length === 6
        ? [row[0], row[1], row[2], '-', numericValue(row[3]), row[4], row[5]]
        : [row[0], row[1], row[2], row[3] || '-', numericValue(row[4]), row[5], row[6]],
    },
    'stock-issues': {
      legacyKey: 'garment-stock-out',
      select: database.prepare('SELECT id, issue_date, item_name, subcategory, quantity, purpose, department FROM stock_issues ORDER BY rowid'),
      clear: database.prepare('DELETE FROM stock_issues'),
      insert: database.prepare('INSERT INTO stock_issues (id, issue_date, item_name, subcategory, quantity, purpose, department) VALUES (?, ?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => [row.id, row.issue_date, row.item_name, row.subcategory, String(Number(row.quantity)), row.purpose, row.department]),
      insertRow: row => row.length === 6
        ? [row[0], row[1], row[2], '-', numericValue(row[3]), row[4], row[5]]
        : [row[0], row[1], row[2], row[3] || '-', numericValue(row[4]), row[5], row[6]],
    },
    'expense-vendors': {
      legacyKey: 'garment-expense-vendors',
      select: database.prepare('SELECT id, name, vendor_type, contact, phone, gst FROM expense_vendors ORDER BY rowid'),
      clear: database.prepare('DELETE FROM expense_vendors'),
      insert: database.prepare('INSERT INTO expense_vendors (id, name, vendor_type, contact, phone, gst) VALUES (?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => [row.id, row.name, row.vendor_type, row.contact, row.phone, row.gst]),
      insertRow: row => [row[0], row[1], row[2], row[3] || '-', row[4] || '-', row[5] || '-'],
    },
    'expense-categories': {
      legacyKey: 'garment-expense-categories',
      select: database.prepare('SELECT id, name, description FROM expense_categories ORDER BY rowid'),
      clear: database.prepare('DELETE FROM expense_categories'),
      insert: database.prepare('INSERT INTO expense_categories (id, name, description) VALUES (?, ?, ?)'),
      fromRows: rows => rows.map(row => [row.id, row.name, row.description]),
      insertRow: row => [row[0], row[1], row[2] || '-'],
    },
    expenses: {
      legacyKey: 'garment-expenses',
      select: database.prepare('SELECT id, payee, financial_year, category, description, expense_date, amount, payment_mode, bill_reference FROM expenses ORDER BY rowid'),
      clear: database.prepare('DELETE FROM expenses'),
      insert: database.prepare('INSERT INTO expenses (id, payee, financial_year, category, description, expense_date, amount, payment_mode, bill_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => [row.id, row.payee, row.financial_year, row.category, row.description, row.expense_date, moneyValue(row.amount), row.payment_mode, row.bill_reference]),
      insertRow: row => [row[0], row[1], row[2], row[3], row[4] || '-', row[5], numericValue(row[6]), row[7], row[8] || '-'],
    },
    'school-collections': {
      legacyKey: 'garment-school-collections',
      select: database.prepare('SELECT id, collection_date, school_name, payment_mode, amount, remarks FROM school_collections ORDER BY rowid'),
      clear: database.prepare('DELETE FROM school_collections'),
      insert: database.prepare('INSERT INTO school_collections (id, collection_date, school_name, payment_mode, amount, remarks) VALUES (?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => [row.id, row.collection_date, row.school_name, row.payment_mode, moneyValue(row.amount), row.remarks]),
      insertRow: row => [row[0], row[1], row[2], row[3], numericValue(row[4]), row[5] || ''],
    },
    invoices: {
      legacyKey: 'garment-invoices',
      select: database.prepare('SELECT invoice_no, invoice_date, due_date, state, reverse_charge, customer, customer_phone, customer_gst, customer_address, ship_to, ship_address, ship_gst, product, hsn, quantity, unit, rate, cgst, sgst, taxable_amount, amount, status, terms FROM invoices ORDER BY rowid'),
      clear: database.prepare('DELETE FROM invoices'),
      insert: database.prepare('INSERT INTO invoices (invoice_no, invoice_date, due_date, state, reverse_charge, customer, customer_phone, customer_gst, customer_address, ship_to, ship_address, ship_gst, product, hsn, quantity, unit, rate, cgst, sgst, taxable_amount, amount, status, terms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => ({ invoiceNo:row.invoice_no, invoiceDate:row.invoice_date, dueDate:row.due_date, state:row.state, reverseCharge:row.reverse_charge, customer:row.customer, customerPhone:row.customer_phone, customerGst:row.customer_gst, customerAddress:row.customer_address, shipTo:row.ship_to, shipAddress:row.ship_address, shipGst:row.ship_gst, product:row.product, hsn:row.hsn, qty:Number(row.quantity), unit:row.unit, rate:Number(row.rate), cgst:Number(row.cgst), sgst:Number(row.sgst), taxableAmount:Number(row.taxable_amount), totalAmount:Number(row.amount), status:row.status, terms:row.terms })),
      insertRow: row => Array.isArray(row)
        ? [row[0],row[1],'','','NO',row[2],'','','',row[2],'','',row[3],'',numericValue(row[4]),'',0,0,0,numericValue(row[5]),numericValue(row[5]),row[6]||'Pending','']
        : [row.invoiceNo,row.invoiceDate,row.dueDate||'',row.state||'',row.reverseCharge||'NO',row.customer,row.customerPhone||'',row.customerGst||'',row.customerAddress||'',row.shipTo||'',row.shipAddress||'',row.shipGst||'',row.product,row.hsn||'',numericValue(row.qty),row.unit||'',numericValue(row.rate),numericValue(row.cgst),numericValue(row.sgst),numericValue(row.taxableAmount),numericValue(row.totalAmount),row.status||'Pending',row.terms||''],
    },
    'invoice-payments': {
      legacyKey: 'garment-invoice-payments',
      select: database.prepare('SELECT id, payment_date, invoice_no, customer, payment_mode, amount, reference, remarks FROM invoice_payments ORDER BY rowid'),
      clear: database.prepare('DELETE FROM invoice_payments'),
      insert: database.prepare('INSERT INTO invoice_payments (id, payment_date, invoice_no, customer, payment_mode, amount, reference, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => ({ id:row.id, date:row.payment_date, invoiceNo:row.invoice_no, customer:row.customer, mode:row.payment_mode, amount:Number(row.amount), reference:row.reference, remarks:row.remarks })),
      insertRow: row => Array.isArray(row) ? [row[0],row[1],row[2],row[3],row[4],numericValue(row[5]),row[6]||'-',row[7]||''] : [row.id,row.date,row.invoiceNo,row.customer,row.mode,numericValue(row.amount),row.reference||'-',row.remarks||''],
    },
    'delivery-challans': {
      legacyKey: 'garment-delivery-challans',
      select: database.prepare('SELECT challan_no, challan_date, customer, phone, address, gst, vehicle, driver, delivery_mode, product, quantity, unit, quantity_text, remarks, status FROM delivery_challans ORDER BY rowid'),
      clear: database.prepare('DELETE FROM delivery_challans'),
      insert: database.prepare('INSERT INTO delivery_challans (challan_no, challan_date, customer, phone, address, gst, vehicle, driver, delivery_mode, product, quantity, unit, quantity_text, remarks, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
      fromRows: rows => rows.map(row => ({ challanNo:row.challan_no, date:row.challan_date, customer:row.customer, phone:row.phone, address:row.address, gst:row.gst, vehicle:row.vehicle, driver:row.driver, deliveryMode:row.delivery_mode, product:row.product, qty:Number(row.quantity)||numericValue(row.quantity_text), unit:row.unit||String(row.quantity_text).replace(/^[-\d.,\s]+/,'').trim(), remarks:row.remarks, status:row.status })),
      insertRow: row => Array.isArray(row)
        ? [row[0],row[1],row[2],'','','','','','',row[3],numericValue(row[4]),String(row[4]).replace(/^[-\d.,\s]+/,'').trim(),row[4], '',row[5]||'Ready']
        : [row.challanNo,row.date,row.customer,row.phone||'',row.address||'',row.gst||'',row.vehicle||'',row.driver||'',row.deliveryMode||'',row.product,numericValue(row.qty),row.unit||'',`${numericValue(row.qty)} ${row.unit||''}`.trim(),row.remarks||'',row.status||'Ready'],
    },
  };

  function replaceDomain(domain, values) {
    if (!Array.isArray(values)) throw new Error('Domain payload must be an array');
    database.exec('BEGIN IMMEDIATE');
    try {
      domain.clear.run();
      for (const value of values) domain.insert.run(...domain.insertRow(value));
      deleteState.run(domain.legacyKey);
      saveState.run(`domain-initialized:${domain.legacyKey}`, 'true');
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function loadDomain(domain) {
    let rows = domain.select.all();
    if (!rows.length) {
      const legacy = findState.get(domain.legacyKey);
      if (legacy) {
        const legacyValue = JSON.parse(legacy.payload_json);
        if (Array.isArray(legacyValue)) {
          replaceDomain(domain, legacyValue);
          rows = domain.select.all();
        } else {
          deleteState.run(domain.legacyKey);
        }
      }
      if (!rows.length && !findState.get(`domain-initialized:${domain.legacyKey}`)) {
        return null;
      }
    }
    return domain.fromRows(rows);
  }

  ensureMasterUser();
  ensureOwnerUser();
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === 'OPTIONS') return json(response, 204, null);
    const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json(response, 200, { status: 'ok', database: 'sqlite' });
    }

    if(url.pathname==='/api/bootstrap'&&request.method==='GET')return json(response,200,{data:{subscription:subscriptionView(),hasUser:Number(countUsers.get().count)>0}});
    if(url.pathname==='/api/subscription'){
      if(request.method==='GET')return json(response,200,{data:subscriptionView()});
      if(request.method==='POST'){try{return json(response,200,{data:activateSubscription(await readJson(request))})}catch(error){return json(response,400,{message:error.message||'Subscription activation failed'})}}
      return json(response,405,{message:'Method not allowed'});
    }
     if(url.pathname==='/api/auth/login'&&request.method==='POST'){try{return json(response,200,{data:login(await readJson(request))})}catch(error){return json(response,401,{message:error.message||'Login failed'})}}
     if(url.pathname==='/api/auth/verify-master'&&request.method==='POST'){try{const value=await readJson(request);const user=findUserByUsername(value?.username);if(!user||user.role!=='Master'||!authenticateUser(user,value?.password))throw new Error('Master authentication failed');return json(response,200,{data:{username:user.email,role:user.role}})}catch(error){return json(response,401,{message:error.message||'Master authentication failed'})}}
     if(/^\/api\/salary-payments\/[^/]+$/.test(url.pathname)&&request.method==='DELETE'){try{const value=await readJson(request);const user=findUserByUsername(value?.username);if(!user||user.role!=='Master'||!authenticateUser(user,value?.password))throw new Error('Only master can delete salary slips');const id=decodeURIComponent(url.pathname.split('/').pop()||'');const result=salaryPaymentDelete.run(id);if(result.changes===0)throw new Error('Salary slip not found');return json(response,200,{data:loadDomain(domains['salary-payments'])})}catch(error){return json(response,401,{message:error.message||'Only master can delete salary slips'})}}

    const settingsHandlers = {
      '/api/company-settings': { get: getCompanySettings, put: putCompanySettings },
      '/api/module-settings': { get: getModuleSettings, put: putModuleSettings },
    };
    const settingsHandler = settingsHandlers[url.pathname];
    if (settingsHandler) {
      if (request.method === 'GET') {
        const data = settingsHandler.get();
        return data === null ? json(response, 404, { message: 'Resource not initialized' }) : json(response, 200, { data });
      }
      if (request.method === 'PUT') {
        try { return json(response, 200, { data: settingsHandler.put(await readJson(request)) }); }
        catch (error) { return json(response, 400, { message: error.message || 'Invalid settings payload' }); }
      }
      return json(response, 405, { message: 'Method not allowed' });
    }

    if (url.pathname === '/api/backups') {
      if (request.method === 'GET') return json(response, 200, { data: listBackups() });
      if (request.method === 'POST') {
        try { return json(response, 201, { data: createBackup() }); }
        catch (error) { return json(response, 500, { message: error.message || 'Backup failed' }); }
      }
      return json(response, 405, { message: 'Method not allowed' });
    }

    const restoreMatch = url.pathname.match(/^\/api\/backups\/([a-z0-9-]+)\/restore$/i);
    if (restoreMatch && request.method === 'POST') {
      try { return json(response, 200, { data: restoreBackup(restoreMatch[1]) }); }
      catch (error) { return json(response, 400, { message: error.message || 'Restore failed' }); }
    }

    if (url.pathname === '/api/media' && request.method === 'POST') {
      try {
        return json(response, 201, { data: storeMedia(await readJson(request)) });
      } catch (error) {
        return json(response, 400, { message: error.message || 'Unable to store image' });
      }
    }

    const mediaMatch = url.pathname.match(/^\/api\/media\/([0-9a-f-]+)$/i);
    if (mediaMatch) {
      const media = findMedia.get(mediaMatch[1]);
      if (!media) return json(response, 404, { message: 'Image not found' });
      const filePath = absoluteMediaPath(media.relative_path);
      if (request.method === 'GET') {
        if (!fs.existsSync(filePath)) return json(response, 404, { message: 'Image file not found' });
        response.writeHead(200, {
          'Content-Type': media.mime_type,
          'Content-Length': media.file_size,
          'Cache-Control': 'private, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
        });
        return fs.createReadStream(filePath).pipe(response);
      }
      if (request.method === 'DELETE') {
        deleteMedia.run(media.id);
        fs.rmSync(filePath, { force: true });
        return json(response, 200, { deleted: true });
      }
      return json(response, 405, { message: 'Method not allowed' });
    }

    const readyStockBase = url.pathname === '/api/ready-school-stock';
    const readyStockIdMatch = url.pathname.match(/^\/api\/ready-school-stock\/([A-Za-z0-9-]+)$/);
    if (readyStockBase || readyStockIdMatch) {
      if (readyStockBase) {
        if (request.method === 'GET') {
          try { return json(response, 200, { data: loadReadyStockList() }); }
          catch (error) { return json(response, 500, { message: error.message || 'Unable to load ready stock' }); }
        }
        if (request.method === 'POST') {
          try {
            const value = validateReadyStock(await readJson(request));
            const id = nextReadyStockId();
            insertReadyStock.run(id, ...readyStockJsonToParams(value));
            return json(response, 201, { data: readyStockRowToJson(findReadyStock.get(id)) });
          } catch (error) {
            return json(response, 400, { message: error.message || 'Invalid ready stock payload' });
          }
        }
        return json(response, 405, { message: 'Method not allowed' });
      }
      const existing = findReadyStock.get(readyStockIdMatch[1]);
      if (!existing) return json(response, 404, { message: 'Ready stock record not found' });
      if (request.method === 'PUT') {
        try {
          const value = validateReadyStock(await readJson(request));
          updateReadyStock.run(...readyStockJsonToParams(value), readyStockIdMatch[1]);
          return json(response, 200, { data: readyStockRowToJson(findReadyStock.get(readyStockIdMatch[1])) });
        } catch (error) {
          return json(response, 400, { message: error.message || 'Invalid ready stock payload' });
        }
      }
      if (request.method === 'DELETE') {
        deleteReadyStock.run(readyStockIdMatch[1]);
        return json(response, 200, { deleted: true });
      }
      return json(response, 405, { message: 'Method not allowed' });
    }

    const studentBase = url.pathname === '/api/students';
    const studentIdMatch = url.pathname.match(/^\/api\/students\/([^/]+)$/);
    if (studentBase || studentIdMatch) {
      if (studentBase) {
        if (request.method === 'GET') {
          try {
            const data = loadDomain(domains.students);
            return data === null ? json(response, 404, { message: 'Resource not initialized' }) : json(response, 200, { data });
          } catch (error) {
            return json(response, 500, { message: error.message || 'Unable to load students' });
          }
        }
        if (request.method === 'POST') {
          try {
            const value = validateStudent(await readJson(request));
            const params = studentJsonToParams(value);
            try { insertStudent.run(...params); }
            catch (error) {
              if (String(error.message).includes('UNIQUE')) return json(response, 409, { message: 'A student already exists for this school and admission number' });
              throw error;
            }
            saveState.run('domain-initialized:garment-students', 'true');
            return json(response, 201, { data: studentRowToJson(findStudent.get(params[0])) });
          } catch (error) {
            return json(response, 400, { message: error.message || 'Invalid student payload' });
          }
        }
        if (request.method === 'PUT') {
          try {
            replaceDomain(domains.students, await readJson(request));
            return json(response, 200, { data: loadDomain(domains.students) });
          } catch (error) {
            return json(response, 400, { message: error.message || 'Invalid students payload' });
          }
        }
        return json(response, 405, { message: 'Method not allowed' });
      }
      const decodedId = decodeURIComponent(studentIdMatch[1]);
      const existing = findStudent.get(decodedId);
      if (!existing) return json(response, 404, { message: 'Student not found' });
      if (request.method === 'PUT') {
        try {
          const value = validateStudent(await readJson(request));
          const params = studentJsonToParams(value);
          try { updateStudent.run(params[0], params[1], params[2], params[3], params[4], params[5], params[6], params[7], params[8], decodedId); }
          catch (error) {
            if (String(error.message).includes('UNIQUE')) return json(response, 409, { message: 'A student already exists for this school and admission number' });
            throw error;
          }
          return json(response, 200, { data: studentRowToJson(findStudent.get(params[0])) });
        } catch (error) {
          return json(response, 400, { message: error.message || 'Invalid student payload' });
        }
      }
      if (request.method === 'DELETE') {
        deleteStudent.run(decodedId);
        saveState.run('domain-initialized:garment-students', 'true');
        return json(response, 200, { deleted: true });
      }
      return json(response, 405, { message: 'Method not allowed' });
    }

    const domainMatch = url.pathname.match(/^\/api\/(customers|schools|students|employees|work-types|assignments|work-entries|advances|salary-payments|inventory-items|stock-receipts|stock-issues|expense-vendors|expense-categories|expenses|school-collections|invoices|invoice-payments|delivery-challans)$/);
    if (domainMatch) {
      const domain = domains[domainMatch[1]];
      if (request.method === 'GET') {
        const data = loadDomain(domain);
        return data===null
          ? json(response, 404, { message: 'Resource not initialized' })
          : json(response, 200, { data });
      }
      if (request.method === 'PUT') {
        try {
          replaceDomain(domain, await readJson(request));
          return json(response, 200, { data: loadDomain(domain) });
        } catch (error) {
          return json(response, 400, { message: error.message || 'Invalid domain payload' });
        }
      }
      return json(response, 405, { message: 'Method not allowed' });
    }

    const match = url.pathname.match(/^\/api\/state\/([a-z0-9-]+)$/i);
    if (!match) return json(response, 404, { message: 'Endpoint not found' });
    const key = match[1];

    if (request.method === 'GET') {
      const row = findState.get(key);
      if (!row) return json(response, 404, { message: 'Resource not initialized' });
      return json(response, 200, {
        data: JSON.parse(row.payload_json),
        version: row.version,
        updatedAt: row.updated_at,
      });
    }

    if (request.method === 'PUT') {
      try {
        const payload = await readJson(request);
        saveState.run(key, JSON.stringify(payload));
        const row = findState.get(key);
        return json(response, 200, {
          data: JSON.parse(row.payload_json),
          version: row.version,
          updatedAt: row.updated_at,
        });
      } catch {
        return json(response, 400, { message: 'Request body must be valid JSON' });
      }
    }

    return json(response, 405, { message: 'Method not allowed' });
    } catch (error) {
      console.error(error);
      if (!response.headersSent) return json(response, 500, { message: error.message || 'Internal server error' });
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, database, port }));
  });
}

module.exports = { DEFAULT_PORT, startLocalApi };
