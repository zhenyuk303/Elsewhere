-- Elsewhere safe development snapshot v1
-- Table definitions only. No live table rows are exported.
-- Fixtures come exclusively from database/dev-seeds.json.
-- Set @shared_owner_username to your own registered username before importing fixtures.
-- Existing tables and rows are preserved. No database name or credentials are embedded.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(30) NOT NULL,
  `username_key` varchar(30) NOT NULL,
  `password_hash` varchar(100) NOT NULL,
  `created_at` timestamp(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_key` (`username_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `auth_sessions` (
  `token_hash` varchar(64) NOT NULL,
  `user_id` bigint NOT NULL,
  `expires_at` timestamp(3) NOT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `fk_auth_session_user` (`user_id`),
  CONSTRAINT `fk_auth_session_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `oauth_login_states` (
  `state_hash` varchar(64) NOT NULL,
  `provider` varchar(16) NOT NULL,
  `code_verifier` varchar(128) NOT NULL,
  `expires_at` timestamp(3) NOT NULL,
  PRIMARY KEY (`state_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `oauth_identities` (
  `provider` varchar(16) NOT NULL,
  `app_id` varbinary(255) NOT NULL,
  `provider_user_id` varbinary(255) NOT NULL,
  `user_id` bigint NOT NULL,
  `created_at` timestamp(3) NOT NULL,
  PRIMARY KEY (`provider`,`app_id`,`provider_user_id`),
  KEY `fk_oauth_identity_user` (`user_id`),
  CONSTRAINT `fk_oauth_identity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `footprint_libraries` (
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_footprint_library_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `footprints` (
  `id` varchar(128) NOT NULL,
  `user_id` bigint NOT NULL,
  `province` varchar(40) NOT NULL,
  `city` varchar(120) NOT NULL,
  `photo_date` date DEFAULT NULL,
  `note` text NOT NULL,
  `themes` varchar(200) NOT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `image_data` mediumblob,
  `image_type` varchar(30) DEFAULT NULL,
  `created_at` timestamp(3) NOT NULL,
  `updated_at` timestamp(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_footprint_owner` (`user_id`,`created_at`),
  CONSTRAINT `fk_footprint_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `footprint_imports` (
  `user_id` bigint NOT NULL,
  `source_id` varchar(128) NOT NULL,
  PRIMARY KEY (`user_id`,`source_id`),
  CONSTRAINT `fk_footprint_import_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS footprint_upload_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  total_size INT NOT NULL,
  image_type VARCHAR(30) NOT NULL,
  sha256 CHAR(64) NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  INDEX idx_footprint_upload_expiry (expires_at),
  INDEX idx_footprint_upload_owner (user_id, completed, expires_at),
  CONSTRAINT fk_footprint_upload_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS footprint_upload_frames (
  upload_id CHAR(36) NOT NULL,
  frame_index INT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  payload MEDIUMBLOB NOT NULL,
  PRIMARY KEY (upload_id, frame_index),
  CONSTRAINT fk_footprint_upload_frame FOREIGN KEY (upload_id) REFERENCES footprint_upload_sessions(id) ON DELETE CASCADE
);

START TRANSACTION;
SELECT id FROM users WHERE username_key = @shared_owner_username FOR UPDATE;
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x416e687569 USING utf8mb4)),u.id,CONVERT(0x416e687569 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545352541452538392545352542452542442e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x416e687569 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4d61636175 USING utf8mb4)),u.id,CONVERT(0x4d61636175 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545362542452542332545392539372541382e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4d61636175 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4265696a696e67 USING utf8mb4)),u.id,CONVERT(0x4265696a696e67 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545352538432539372545342542412541432e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4265696a696e67 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x43686f6e6771696e67 USING utf8mb4)),u.id,CONVERT(0x43686f6e6771696e67 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545392538372538442545352542412538362e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x43686f6e6771696e67 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x46756a69616e USING utf8mb4)),u.id,CONVERT(0x46756a69616e USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545372541362538462545352542422542412e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x46756a69616e USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x47616e7375 USING utf8mb4)),u.id,CONVERT(0x47616e7375 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545372539342539382545382538322538332e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x47616e7375 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4775616e67646f6e67 USING utf8mb4)),u.id,CONVERT(0x4775616e67646f6e67 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545352542392542462545342542382539432e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4775616e67646f6e67 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4775616e677869 USING utf8mb4)),u.id,CONVERT(0x4775616e677869 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545352542392542462545382541352542462e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4775616e677869 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4775697a686f75 USING utf8mb4)),u.id,CONVERT(0x4775697a686f75 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545382542342542352545352542372539452e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4775697a686f75 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4861696e616e USING utf8mb4)),u.id,CONVERT(0x4861696e616e USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545362542352542372545352538442539372e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4861696e616e USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4865626569 USING utf8mb4)),u.id,CONVERT(0x4865626569 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545362542322542332545352538432539372e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4865626569 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x48656e616e USING utf8mb4)),u.id,CONVERT(0x48656e616e USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545362542322542332545352538442539372e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x48656e616e USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4865696c6f6e676a69616e67 USING utf8mb4)),u.id,CONVERT(0x4865696c6f6e676a69616e67 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545392542422539312545392542452539392545362542312539462e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4865696c6f6e676a69616e67 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4875626569 USING utf8mb4)),u.id,CONVERT(0x4875626569 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545362542392539362545352538432539372e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4875626569 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x48756e616e USING utf8mb4)),u.id,CONVERT(0x48756e616e USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545362542392539362545352538442539372e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x48756e616e USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4a696c696e USING utf8mb4)),u.id,CONVERT(0x4a696c696e USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545352539302538392545362539452539372e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4a696c696e USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4a69616e677375 USING utf8mb4)),u.id,CONVERT(0x4a69616e677375 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545362542312539462545382538422538462e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4a69616e677375 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4a69616e677869 USING utf8mb4)),u.id,CONVERT(0x4a69616e677869 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545362542312539462545382541352542462e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4a69616e677869 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4c69616f6e696e67 USING utf8mb4)),u.id,CONVERT(0x4c69616f6e696e67 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545382542452542442545352541452538312e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4c69616f6e696e67 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x496e6e6572204d6f6e676f6c6961 USING utf8mb4)),u.id,CONVERT(0x496e6e6572204d6f6e676f6c6961 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545352538362538352545382539322539392545352538462541342e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x496e6e6572204d6f6e676f6c6961 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x4e696e67786961 USING utf8mb4)),u.id,CONVERT(0x4e696e67786961 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545352541452538312545352541342538462e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x4e696e67786961 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x51696e67686169 USING utf8mb4)),u.id,CONVERT(0x51696e67686169 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545392539442539322545362542352542372e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x51696e67686169 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x5368616e646f6e67 USING utf8mb4)),u.id,CONVERT(0x5368616e646f6e67 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545352542312542312545342542382539432e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x5368616e646f6e67 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x5368616e7869 USING utf8mb4)),u.id,CONVERT(0x5368616e7869 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545352542312542312545382541352542462e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x5368616e7869 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x536861616e7869 USING utf8mb4)),u.id,CONVERT(0x536861616e7869 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545392539392539352545382541352542462e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x536861616e7869 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x5368616e67686169 USING utf8mb4)),u.id,CONVERT(0x5368616e67686169 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545342542382538412545362542352542372e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x5368616e67686169 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x5369636875616e USING utf8mb4)),u.id,CONVERT(0x5369636875616e USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545352539422539422545352542372539442e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x5369636875616e USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x54616977616e USING utf8mb4)),u.id,CONVERT(0x54616977616e USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545352538462542302545362542392542452e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x54616977616e USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x5469616e6a696e USING utf8mb4)),u.id,CONVERT(0x5469616e6a696e USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545352541342541392545362542342541352e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x5469616e6a696e USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x5469626574 USING utf8mb4)),u.id,CONVERT(0x5469626574 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545382541352542462545382539372538462e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x5469626574 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x486f6e67204b6f6e67 USING utf8mb4)),u.id,CONVERT(0x486f6e67204b6f6e67 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545392541362539392545362542382541462e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x486f6e67204b6f6e67 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x58696e6a69616e67 USING utf8mb4)),u.id,CONVERT(0x58696e6a69616e67 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545362539362542302545372539362538362e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x58696e6a69616e67 USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x59756e6e616e USING utf8mb4)),u.id,CONVERT(0x59756e6e616e USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545342542412539312545352538442539372e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x59756e6e616e USING utf8mb4)));
INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)
SELECT CONCAT('seed:', u.id, ':', CONVERT(0x5a68656a69616e67 USING utf8mb4)),u.id,CONVERT(0x5a68656a69616e67 USING utf8mb4),'',NULL,'','',CONVERT(0x2f696d616765732f6361726f7573656c2f2545362542352539392545362542312539462e77656270 USING utf8mb4),NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'
FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprints f WHERE f.id = CONCAT('seed:', u.id, ':', CONVERT(0x5a68656a69616e67 USING utf8mb4)));
INSERT INTO footprint_libraries (user_id) SELECT u.id FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS (SELECT 1 FROM footprint_libraries l WHERE l.user_id = u.id);
COMMIT;
