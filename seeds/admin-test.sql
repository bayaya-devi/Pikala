-- DEVELOPMENT ONLY. Administrator fixture for the phase 9 local crash-test.
INSERT OR IGNORE INTO users
  (first_name,last_name,email,phone,password_hash,role,status,locale,email_verified,email_verified_at,password_changed_at,updated_at)
VALUES
  ('Admin','Pikala','admin-phase9@example.test',NULL,
   'pbkdf2$600000$oM3AxIK1byfJop8ixGACUg$5JlxTFw_R6XsZvOCtMy_4-INmOBPs5wm0Yye0PrOca8',
   'admin','active','fr',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
