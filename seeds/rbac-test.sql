-- DEVELOPMENT ONLY. Staff role fixtures for RBAC crash tests.
INSERT OR IGNORE INTO users (first_name,last_name,email,password_hash,role,status,locale,email_verified,email_verified_at,password_changed_at,updated_at)
VALUES
('Super','Admin','rbac-super@example.test','pbkdf2$100000$jUggMv3whYe_wwiTLfig5g$JVYPdZJv20U38Xqo6OtbPSqRzX1bZetmmqfmPYZVBi0','admin','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('Admin','Réseau','rbac-admin@example.test','pbkdf2$100000$jUggMv3whYe_wwiTLfig5g$JVYPdZJv20U38Xqo6OtbPSqRzX1bZetmmqfmPYZVBi0','admin','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('Manager','Opérations','rbac-operations@example.test','pbkdf2$100000$jUggMv3whYe_wwiTLfig5g$JVYPdZJv20U38Xqo6OtbPSqRzX1bZetmmqfmPYZVBi0','operator','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('Manager','Station','rbac-station@example.test','pbkdf2$100000$jUggMv3whYe_wwiTLfig5g$JVYPdZJv20U38Xqo6OtbPSqRzX1bZetmmqfmPYZVBi0','operator','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('Technicien','Pikala','rbac-technician@example.test','pbkdf2$100000$jUggMv3whYe_wwiTLfig5g$JVYPdZJv20U38Xqo6OtbPSqRzX1bZetmmqfmPYZVBi0','operator','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('Agent','Terrain','rbac-field@example.test','pbkdf2$100000$jUggMv3whYe_wwiTLfig5g$JVYPdZJv20U38Xqo6OtbPSqRzX1bZetmmqfmPYZVBi0','operator','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('Agent','Support','rbac-support@example.test','pbkdf2$100000$jUggMv3whYe_wwiTLfig5g$JVYPdZJv20U38Xqo6OtbPSqRzX1bZetmmqfmPYZVBi0','operator','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('Agent','Finance','rbac-finance@example.test','pbkdf2$100000$jUggMv3whYe_wwiTLfig5g$JVYPdZJv20U38Xqo6OtbPSqRzX1bZetmmqfmPYZVBi0','operator','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('Analyste','Pikala','rbac-analyst@example.test','pbkdf2$100000$jUggMv3whYe_wwiTLfig5g$JVYPdZJv20U38Xqo6OtbPSqRzX1bZetmmqfmPYZVBi0','operator','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('Employé','Suspendu','rbac-suspended@example.test','pbkdf2$100000$jUggMv3whYe_wwiTLfig5g$JVYPdZJv20U38Xqo6OtbPSqRzX1bZetmmqfmPYZVBi0','operator','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('Utilisateur','Normal','rbac-user@example.test','pbkdf2$100000$jUggMv3whYe_wwiTLfig5g$JVYPdZJv20U38Xqo6OtbPSqRzX1bZetmmqfmPYZVBi0','user','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO staff_members (user_id,employee_code,role,status,hire_date)
SELECT id,'RBAC-'||upper(replace(substr(email,6,instr(email,'@')-6),'-','_')),CASE substr(email,6,instr(email,'@')-6) WHEN 'super' THEN 'super_admin' WHEN 'admin' THEN 'admin' WHEN 'operations' THEN 'operations_manager' WHEN 'station' THEN 'station_manager' WHEN 'technician' THEN 'technician' WHEN 'field' THEN 'field_agent' WHEN 'support' THEN 'support_agent' WHEN 'finance' THEN 'finance' WHEN 'analyst' THEN 'analyst' ELSE 'technician' END,CASE WHEN email='rbac-suspended@example.test' THEN 'suspended' ELSE 'active' END,date('now')
FROM users
WHERE email LIKE 'rbac-%@example.test'
  AND email <> 'rbac-user@example.test';

INSERT OR IGNORE INTO staff_member_zones (staff_member_id,zone_id)
SELECT staff_members.id,staff_zones.id FROM staff_members CROSS JOIN staff_zones WHERE staff_zones.code='RABAT' AND staff_members.employee_code LIKE 'RBAC-%';

INSERT OR IGNORE INTO missions (public_code,mission_type,priority,status,assigned_to_user_id,title,created_by_user_id)
SELECT 'MIS-RBAC-TECH','maintenance','high','assigned',technician.id,'Mission technicien RBAC',supervisor.id FROM users technician CROSS JOIN users supervisor
WHERE technician.email='rbac-technician@example.test' AND supervisor.email='rbac-super@example.test';
INSERT OR IGNORE INTO missions (public_code,mission_type,priority,status,assigned_to_user_id,title,created_by_user_id)
SELECT 'MIS-RBAC-FIELD','rebalancing','normal','assigned',agent.id,'Mission terrain RBAC',supervisor.id FROM users agent CROSS JOIN users supervisor
WHERE agent.email='rbac-field@example.test' AND supervisor.email='rbac-super@example.test';
