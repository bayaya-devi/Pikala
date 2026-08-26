-- DEVELOPMENT ONLY. Administrator fixture for the phase 9 local crash-test.
INSERT OR IGNORE INTO users
  (first_name,last_name,email,phone,password_hash,role,status,locale,email_verified,email_verified_at,password_changed_at,updated_at)
VALUES
  ('Admin','Pikala','admin-phase9@example.test',NULL,
   'pbkdf2$100000$jUggMv3whYe_wwiTLfig5g$JVYPdZJv20U38Xqo6OtbPSqRzX1bZetmmqfmPYZVBi0',
   'admin','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO staff_members (user_id,employee_code,role,status,hire_date)
SELECT id,'TEST-ADMIN-001','admin','active',date('now') FROM users WHERE email='admin-phase9@example.test';
INSERT OR IGNORE INTO staff_member_zones (staff_member_id,zone_id)
SELECT staff_members.id,staff_zones.id FROM staff_members CROSS JOIN staff_zones WHERE staff_members.employee_code='TEST-ADMIN-001' AND staff_zones.code='RABAT';
