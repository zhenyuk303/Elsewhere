package com.elsewhere;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

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
    private static final Pattern REGISTRATION_PASSWORD =
            Pattern.compile("(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[\\p{P}\\p{S}]).+", Pattern.DOTALL);
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder(10);
    private final SecureRandom random = new SecureRandom();
    private final String unknownUserHash = passwords.encode(newToken());

    public AuthService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public SignedIn register(String username, String password, String previousToken) {
        validateNewPassword(password);
        String clean = username.trim();
        String key = clean.toLowerCase(Locale.ROOT);
        try {
            jdbc.update("INSERT INTO users(username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?)",
                    clean, key, passwords.encode(password), Timestamp.from(Instant.now()));
        } catch (DuplicateKeyException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username is already taken");
        }
        return createSession(findByKey(key).orElseThrow(), previousToken);
    }

    @Transactional
    public SignedIn login(String usernameKey, String password, String previousToken) {
        var credentials = jdbc.query("""
                SELECT id, username, password_hash FROM users WHERE username_key = ?
                """, (rs, row) -> new Credentials(new User(rs.getLong(1), rs.getString(2)), rs.getString(3)),
                usernameKey).stream().findFirst().orElse(null);
        boolean validInput = password != null && !password.isBlank()
                && password.length() <= 72 && password.getBytes(StandardCharsets.UTF_8).length <= 72;
        // Unknown accounts go through the same cost-10 BCrypt verification as regular accounts.
        String hash = credentials == null ? unknownUserHash : credentials.hash();
        boolean matches = passwords.matches(validInput ? password : "", hash);
        if (!validInput || !matches || credentials == null) throw badCredentials();
        return createSession(credentials.user(), previousToken);
    }

    private record Credentials(User user, String hash) {}

    private static void validateNewPassword(String password) {
        if (password == null || password.codePointCount(0, password.length()) < 8
                || password.codePointCount(0, password.length()) > 72
                || !REGISTRATION_PASSWORD.matcher(password).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Use 8–72 characters with an uppercase letter, a lowercase letter, a number and a special character");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must fit within 72 UTF-8 bytes");
        }
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
    public SignedIn loginExternal(String provider, String appId, String providerUserId, String previousToken) {
        User user = jdbc.query("SELECT u.id, u.username FROM oauth_identities i JOIN users u ON u.id = i.user_id "
                        + "WHERE i.provider = ? AND i.app_id = ? AND i.provider_user_id = ?",
                (rs, row) -> new User(rs.getLong(1), rs.getString(2)), provider, appId, providerUserId)
                .stream().findFirst().orElseGet(() -> createExternalUser(provider, appId, providerUserId));
        return createSession(user, previousToken);
    }

    private User createExternalUser(String provider, String appId, String providerUserId) {
        byte[] suffix = new byte[8];
        random.nextBytes(suffix);
        String username = provider + "_" + HexFormat.of().formatHex(suffix);
        byte[] secret = new byte[32];
        random.nextBytes(secret);
        jdbc.update("INSERT INTO users(username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?)",
                username, username, passwords.encode(Base64.getUrlEncoder().withoutPadding().encodeToString(secret)),
                Timestamp.from(Instant.now()));
        User user = findByKey(username).orElseThrow();
        jdbc.update("INSERT INTO oauth_identities(provider, app_id, provider_user_id, user_id, created_at) "
                        + "VALUES (?, ?, ?, ?, ?)", provider, appId, providerUserId, user.id(), Timestamp.from(Instant.now()));
        return user;
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

    private SignedIn createSession(User user, String previousToken) {
        logout(previousToken);
        String token = newToken();
        jdbc.update("INSERT INTO auth_sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)",
                tokenHash(token), user.id(), Timestamp.from(Instant.now().plus(AuthCookies.SESSION_DURATION)));
        return new SignedIn(user, token);
    }

    private String newToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
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
