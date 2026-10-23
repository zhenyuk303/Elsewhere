package com.elsewhere;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
    public record User(long id, String username) {}
    public record SignedIn(User user, String token) {}

    private final JdbcTemplate jdbc;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    private final SecureRandom random = new SecureRandom();

    public AuthService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public SignedIn register(String username, String password) {
        String clean = username.trim();
        String key = clean.toLowerCase(Locale.ROOT);
        try {
            jdbc.update("INSERT INTO users(username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?)",
                    clean, key, passwords.encode(password), Timestamp.from(Instant.now()));
        } catch (DuplicateKeyException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username is already taken");
        }
        return createSession(findByKey(key).orElseThrow());
    }

    @Transactional
    public SignedIn login(String username, String password) {
        User user = findByKey(username.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(AuthService::badCredentials);
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, user.id());
        if (!passwords.matches(password, hash)) throw badCredentials();
        return createSession(user);
    }

    public User requireUser(String token) {
        if (token == null || token.isBlank()) throw unauthorized();
        return jdbc.query("SELECT u.id, u.username FROM auth_sessions s JOIN users u ON u.id = s.user_id "
                        + "WHERE s.token_hash = ? AND s.expires_at > ?",
                (rs, row) -> new User(rs.getLong(1), rs.getString(2)), tokenHash(token), Timestamp.from(Instant.now()))
                .stream().findFirst().orElseThrow(AuthService::unauthorized);
    }

    public void logout(String token) {
        if (token != null && !token.isBlank())
            jdbc.update("DELETE FROM auth_sessions WHERE token_hash = ?", tokenHash(token));
    }

    @Transactional
    public void createDemoUser(String username, String password) {
        String key = username.toLowerCase(Locale.ROOT);
        if (findByKey(key).isEmpty())
            jdbc.update("INSERT INTO users(username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?)",
                    username, key, passwords.encode(password), Timestamp.from(Instant.now()));
    }

    private Optional<User> findByKey(String key) {
        return jdbc.query("SELECT id, username FROM users WHERE username_key = ?",
                (rs, row) -> new User(rs.getLong(1), rs.getString(2)), key).stream().findFirst();
    }

    private SignedIn createSession(User user) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.update("INSERT INTO auth_sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)",
                tokenHash(token), user.id(), Timestamp.from(Instant.now().plus(7, ChronoUnit.DAYS)));
        return new SignedIn(user, token);
    }

    private static String tokenHash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static ResponseStatusException badCredentials() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
    }

    private static ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in");
    }
}
