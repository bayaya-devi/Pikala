-- DEVELOPMENT ONLY. Administrator fixture for the phase 9 local crash-test.
INSERT OR IGNORE INTO users
  (first_name,last_name,email,phone,password_hash,role,status,locale,email_verified,email_verified_at,password_changed_at,updated_at)
VALUES
  ('Admin','Pikala','admin-phase9@example.test',NULL,
   'pbkdf2$100000$jUggMv3whYe_wwiTLfig5g$JVYPdZJv20U38Xqo6OtbPSqRzX1bZetmmqfmPYZVBi0',
   'admin','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
