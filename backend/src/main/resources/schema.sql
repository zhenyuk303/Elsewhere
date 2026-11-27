CREATE TABLE IF NOT EXISTS users (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(30) NOT NULL,
  username_key VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS oauth_login_states (
  state_hash VARCHAR(64) PRIMARY KEY,
  provider VARCHAR(16) NOT NULL,
  code_verifier VARCHAR(128) NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL
);



CREATE TABLE IF NOT EXISTS oauth_identities (
  provider VARCHAR(16) NOT NULL,
  app_id VARBINARY(255) NOT NULL,
  provider_user_id VARBINARY(255) NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL,
  PRIMARY KEY (provider, app_id, provider_user_id),
  CONSTRAINT fk_oauth_identity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS footprint_libraries (
  user_id BIGINT PRIMARY KEY,
  CONSTRAINT fk_footprint_library_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS footprints (
  id VARCHAR(128) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  province VARCHAR(40) NOT NULL,
  city VARCHAR(120) NOT NULL,
  photo_date DATE,
  note TEXT NOT NULL,
  themes VARCHAR(200) NOT NULL,
  image_path VARCHAR(255),
  image_data MEDIUMBLOB,
  image_type VARCHAR(30),
  created_at TIMESTAMP(3) NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL,
  CONSTRAINT fk_footprint_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_footprint_owner (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS footprint_imports (
  user_id BIGINT NOT NULL,
  source_id VARCHAR(128) NOT NULL,
  PRIMARY KEY (user_id, source_id),
  CONSTRAINT fk_footprint_import_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
