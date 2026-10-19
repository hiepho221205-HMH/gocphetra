/**
 * Schema and Syntax Validators for GÓC Coffee POS Tests
 * Authoritative schema specifications derived from ORIGINAL_REQUEST.md & PROJECT.md
 */

export function validateAutoBackupSchema(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Backup payload must be a non-null object'] };
  }

  // 1. Validate exportMetadata
  const meta = payload.exportMetadata;
  if (!meta || typeof meta !== 'object') {
    errors.push('Missing or invalid exportMetadata object');
  } else {
    if (!meta.system || typeof meta.system !== 'string') errors.push('exportMetadata.system must be a non-empty string');
    if (!meta.version || typeof meta.version !== 'string') errors.push('exportMetadata.version must be a non-empty string');
    if (typeof meta.schemaVersion !== 'number') errors.push('exportMetadata.schemaVersion must be a number');
    if (!meta.backupType || meta.backupType !== 'pre_cleanup_auto_backup') {
      errors.push("exportMetadata.backupType must be 'pre_cleanup_auto_backup'");
    }
    if (!['range', 'before_date', 'all_completed'].includes(meta.cleanupMode)) {
      errors.push(`exportMetadata.cleanupMode '${meta.cleanupMode}' must be 'range', 'before_date', or 'all_completed'`);
    }
    if (!meta.exportedAt || isNaN(new Date(meta.exportedAt).getTime())) {
      errors.push('exportMetadata.exportedAt must be a valid ISO 8601 date string');
    }
    if (!meta.exportedAtVietnam || typeof meta.exportedAtVietnam !== 'string') {
      errors.push('exportMetadata.exportedAtVietnam must be a non-empty formatted date string');
    }
    if (typeof meta.totalOrders !== 'number' || meta.totalOrders < 0) {
      errors.push('exportMetadata.totalOrders must be a non-negative number');
    }
    if (typeof meta.totalRevenue !== 'number' || meta.totalRevenue < 0) {
      errors.push('exportMetadata.totalRevenue must be a non-negative number');
    }
    if (!meta.performedBy || typeof meta.performedBy !== 'string') {
      errors.push('exportMetadata.performedBy must be a non-empty string');
    }
  }

  // 2. Validate orders array
  if (!Array.isArray(payload.orders)) {
    errors.push('payload.orders must be an array');
  } else {
    if (meta && payload.orders.length !== meta.totalOrders) {
      errors.push(`payload.orders length (${payload.orders.length}) does not match meta.totalOrders (${meta.totalOrders})`);
    }
    const computedTotal = payload.orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    if (meta && computedTotal !== meta.totalRevenue) {
      errors.push(`payload.orders sum (${computedTotal}) does not match meta.totalRevenue (${meta.totalRevenue})`);
    }
    for (const [idx, ord] of payload.orders.entries()) {
      if (!ord.id) errors.push(`Order at index ${idx} is missing 'id'`);
      if (ord.status !== 'completed') {
        errors.push(`Order ${ord.id || idx} has status '${ord.status}'; only 'completed' orders allowed in sales backup`);
      }
      if (typeof ord.total !== 'number' && isNaN(Number(ord.total))) {
        errors.push(`Order ${ord.id || idx} has invalid 'total'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateSqlMigrationContent(sqlContent) {
  const errors = [];
  const normalized = sqlContent.toLowerCase();

  // 1. Check staff_profiles table creation
  if (!normalized.includes('create table if not exists public.staff_profiles') &&
      !normalized.includes('create table if not exists staff_profiles')) {
    errors.push("Missing 'CREATE TABLE IF NOT EXISTS public.staff_profiles'");
  }
  if (!normalized.includes('status') || !normalized.includes('role')) {
    errors.push("Table staff_profiles missing 'status' or 'role' columns");
  }

  // 2. Check data_cleanup_jobs table creation
  if (!normalized.includes('create table if not exists public.data_cleanup_jobs') &&
      !normalized.includes('create table if not exists data_cleanup_jobs')) {
    errors.push("Missing 'CREATE TABLE IF NOT EXISTS public.data_cleanup_jobs'");
  }
  if (!normalized.includes('cleanup_mode') || !normalized.includes('orders_count') || !normalized.includes('backup_file_name')) {
    errors.push("Table data_cleanup_jobs missing required audit columns");
  }

  // 3. Check Row Level Security
  if (!normalized.includes('alter table public.staff_profiles enable row level security') &&
      !normalized.includes('alter table staff_profiles enable row level security')) {
    errors.push("Missing RLS enablement on staff_profiles");
  }
  if (!normalized.includes('alter table public.data_cleanup_jobs enable row level security') &&
      !normalized.includes('alter table data_cleanup_jobs enable row level security')) {
    errors.push("Missing RLS enablement on data_cleanup_jobs");
  }

  // 4. Immutability of audit logs: must NOT permit DELETE or UPDATE on data_cleanup_jobs
  if (normalized.includes('create policy') && normalized.includes('data_cleanup_jobs')) {
    if (normalized.includes('for delete to') && normalized.includes('data_cleanup_jobs')) {
      errors.push("Security violation: data_cleanup_jobs must be append-only and not allow DELETE policy");
    }
    if (normalized.includes('for update to') && normalized.includes('data_cleanup_jobs')) {
      errors.push("Security violation: data_cleanup_jobs must be append-only and not allow UPDATE policy");
    }
  }

  // 5. Check Realtime publication
  if (!normalized.includes('alter publication supabase_realtime add table') ||
      !normalized.includes('staff_profiles')) {
    errors.push("Missing Realtime publication for staff_profiles");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
