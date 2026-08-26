export const STAFF_ROLES = Object.freeze(['super_admin','admin','operations_manager','station_manager','technician','field_agent','support_agent','finance','analyst']);
export const STAFF_ROLE_SET = new Set(STAFF_ROLES);

export function hasPermission(actor, permission) {
  const permissions = actor?.permissions instanceof Set ? actor.permissions : new Set(actor?.permissions || []);
  return permissions.has('*') || permissions.has(permission);
}

export function hasAnyPermission(actor, permissions) {
  return permissions.some((permission) => hasPermission(actor, permission));
}

export async function loadStaffActor(DB, user, { touch = false } = {}) {
  if (!user) return null;
  const staff = await DB.prepare(`SELECT staff_members.id staff_id,staff_members.employee_code,staff_members.role staff_role,
    staff_members.status staff_status,staff_members.hire_date,staff_members.last_activity_at
    FROM staff_members WHERE staff_members.user_id=?`).bind(user.id).first();
  if (!staff || staff.staff_status !== 'active') return null;
  const [roleRows, overrideRows, zoneRows] = await DB.batch([
    DB.prepare('SELECT permission FROM staff_role_permissions WHERE role=?').bind(staff.staff_role),
    DB.prepare(`SELECT permission,effect FROM staff_permission_overrides WHERE staff_member_id=? AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) ORDER BY id`).bind(staff.staff_id),
    DB.prepare(`SELECT staff_zones.id,staff_zones.code,staff_zones.name,staff_zones.city FROM staff_member_zones
      JOIN staff_zones ON staff_zones.id=staff_member_zones.zone_id WHERE staff_member_zones.staff_member_id=? AND staff_zones.is_active=1 ORDER BY staff_zones.name`).bind(staff.staff_id)
  ]);
  const permissions = new Set((roleRows.results || []).map((row) => row.permission));
  const denied = new Set();
  for (const override of overrideRows.results || []) {
    if (override.effect === 'deny') denied.add(override.permission);
    else permissions.add(override.permission);
  }
  for (const permission of denied) permissions.delete(permission);
  if (touch) await DB.prepare(`UPDATE staff_members SET last_activity_at=CURRENT_TIMESTAMP WHERE id=?
    AND (last_activity_at IS NULL OR last_activity_at<datetime('now','-5 minutes'))`).bind(staff.staff_id).run();
  return { ...user, ...staff, role: staff.staff_role, permissions, zones: zoneRows.results || [] };
}

export function publicStaffActor(actor) {
  if (!actor) return null;
  return {
    id: actor.id, first_name: actor.first_name, last_name: actor.last_name, email: actor.email, phone: actor.phone,
    role: actor.role, locale: actor.locale, employee_code: actor.employee_code, staff_id: actor.staff_id,
    hire_date: actor.hire_date, last_activity_at: actor.last_activity_at,
    permissions: [...actor.permissions].sort(), zones: actor.zones
  };
}

export function adminRoutePermission(method, path) {
  if (path === '/api/admin/session') return 'staff.access';
  if (path === '/api/admin/control-center') return 'dashboard.view';
  const control = path.match(/^\/api\/admin\/control-center\/([a-z-]+)$/)?.[1];
  if (control) return ({employees:'employees.read',docks:'docks.read',inspections:'inspections.read',missions:'missions.read',rebalancing:'rebalancing.read',automations:'automations.read',devices:'devices.read',alerts:'alerts.read',entitlements:'entitlements.manage',overrides:'audit.read'})[control] || 'dashboard.view';
  if (path === '/api/admin/control-center/actions') return 'staff.access';
  if (path === '/api/admin/overview') return 'dashboard.view';
  if (path.startsWith('/api/admin/workshop')) return method === 'GET' ? 'maintenance.read' : 'maintenance.manage';
  if (path.startsWith('/api/admin/field/')) return 'staff.access';
  if (path.startsWith('/api/admin/users')) return method === 'GET' ? 'users.read_limited' : 'users.manage';
  if (path.startsWith('/api/admin/stations')) return method === 'GET' ? 'stations.read' : 'stations.manage';
  if (path.startsWith('/api/admin/bikes')) return method === 'GET' ? 'bikes.read' : 'bikes.manage';
  if (path.startsWith('/api/admin/rides')) return 'rides.read';
  if (path.startsWith('/api/admin/plans')) return method === 'GET' ? 'plans.read' : 'plans.manage';
  if (path.startsWith('/api/admin/subscriptions')) return method === 'GET' ? 'subscriptions.read' : 'subscriptions.manage';
  if (path.startsWith('/api/admin/payments')) return 'payments.read';
  if (path.startsWith('/api/admin/incidents')) return method === 'GET' ? 'incidents.read' : 'incidents.manage';
  if (path.startsWith('/api/admin/maintenance')) return method === 'GET' ? 'maintenance.read' : 'maintenance.manage';
  if (path.startsWith('/api/admin/support')) return method === 'GET' ? 'support.read' : 'support.manage';
  if (path.startsWith('/api/admin/notifications')) return method === 'GET' ? 'notifications.read' : 'notifications.send';
  if (path.startsWith('/api/admin/settings')) return method === 'GET' ? 'settings.read' : 'settings.manage';
  if (path.startsWith('/api/admin/audit-logs')) return 'audit.read';
  if (path.startsWith('/api/admin/staff')) return method === 'GET' ? 'employees.read' : 'employees.manage';
  if (path.startsWith('/api/admin/docks')) return method === 'GET' ? 'docks.read' : 'docks.manage';
  if (path.startsWith('/api/admin/twins') || path.startsWith('/api/admin/bulk')) return 'staff.access';
  return 'staff.access';
}

export const CONTROL_ACTION_PERMISSIONS = Object.freeze({
  'station.open':'stations.manage','station.close':'stations.manage','bike.block':'bikes.manage','bike.restore':'bikes.manage',
  'bike.maintenance':'maintenance.manage','bike.move':'bikes.move','dock.correct':'docks.manage','user.suspend':'users.manage','user.reactivate':'users.manage',
  'ride.force_end':'rides.force_end','maintenance.assign':'maintenance.manage','employee.upsert':'employees.manage','inspection.create':'inspections.manage',
  'mission.create':'missions.manage','mission.assign':'missions.manage','notification.send':'notifications.send','service.maintenance':'service.override','service.restore':'service.override',
  'alert.acknowledge':'alerts.manage','alert.resolve':'alerts.manage','automation.toggle':'automations.manage','device.status':'devices.manage',
  'entitlement.grant':'entitlements.manage','entitlement.revoke':'entitlements.manage'
});
