import { randomBytes, pbkdf2Sync, randomUUID } from 'node:crypto';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || 'Administrator';
const passwordBytes = password ? Buffer.byteLength(password, 'utf8') : 0;

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running this command.');
  process.exit(1);
}

if (email.length > 254 || !email.includes('@')) {
  console.error('ADMIN_EMAIL is invalid.');
  process.exit(1);
}

if (passwordBytes < 12 || passwordBytes > 256) {
  console.error('ADMIN_PASSWORD must be between 12 and 256 UTF-8 bytes.');
  process.exit(1);
}

const iterations = 600_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
const adminId = randomUUID();
const now = Math.floor(Date.now() / 1000);

const encode = (value) => value.toString('base64url');
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

process.stdout.write(
  `INSERT INTO admin_users (id, email, normalized_email, display_name, password_hash, password_salt, password_iterations, status, created_at, updated_at) VALUES (${quote(adminId)}, ${quote(email)}, ${quote(email)}, ${quote(displayName)}, ${quote(encode(hash))}, ${quote(encode(salt))}, ${iterations}, 'active', ${now}, ${now});\n`,
);
process.stdout.write(
  `INSERT INTO admin_user_roles (admin_user_id, role_key, assigned_at, assigned_by) VALUES (${quote(adminId)}, 'super_admin', ${now}, NULL);\n`,
);
