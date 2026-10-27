package com.elsewhere;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OAuthService {
    public record Started(String authorizationUrl, String state) {}

    private final OAuthSettings settings;
    private final OAuthClient client;
    private final AuthService auth;
    private final JdbcTemplate jdbc;
    private final SecureRandom random = new SecureRandom();

    public OAuthService(OAuthSettings settings, OAuthClient client, AuthService auth, JdbcTemplate jdbc) {
        this.settings = settings;
        this.client = client;
        this.auth = auth;
        this.jdbc = jdbc;
    }

    public Started start(String providerName) {
        OAuthSettings.Provider provider = configured(providerName);
        jdbc.update("DELETE FROM oauth_login_states WHERE expires_at <= ?", Timestamp.from(Instant.now()));
        String state = randomToken();
        String verifier = randomToken();
        jdbc.update("INSERT INTO oauth_login_states(state_hash, provider, code_verifier, expires_at) VALUES (?, ?, ?, ?)",
                hash(state), providerName, verifier, Timestamp.from(Instant.now().plus(10, ChronoUnit.MINUTES)));
        String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(digest(verifier));
        return new Started(client.authorizationUrl(provider, state, challenge), state);
    }

    public AuthService.SignedIn complete(String providerName, String code, String state, String cookieState) {
        OAuthSettings.Provider provider = configured(providerName);
        if (code == null || code.isBlank() || state == null || state.isBlank() || cookieState == null ||
                !MessageDigest.isEqual(state.getBytes(StandardCharsets.UTF_8), cookieState.getBytes(StandardCharsets.UTF_8)))
            throw invalidState();
        String stateHash = hash(state);
        String verifier = jdbc.query("SELECT code_verifier FROM oauth_login_states "
                        + "WHERE state_hash = ? AND provider = ? AND code_verifier IS NOT NULL AND expires_at > ?",
                (rs, row) -> rs.getString(1), stateHash, providerName, Timestamp.from(Instant.now()))
                .stream().findFirst().orElseThrow(OAuthService::invalidState);
        int consumed = jdbc.update("DELETE FROM oauth_login_states WHERE state_hash = ? AND provider = ? AND expires_at > ?",
                stateHash, providerName, Timestamp.from(Instant.now()));
        if (consumed != 1) throw invalidState();
        String providerUserId = client.exchangeUserId(provider, code, verifier);
        return auth.loginExternal(providerName, provider.clientId(), providerUserId);
    }

    private OAuthSettings.Provider configured(String name) {
        OAuthSettings.Provider provider;
        try {
            provider = settings.get(name);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown login provider");
        }
        if (!provider.configured())
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    (name.equals("google") ? "Google" : "GitHub") + " login is not configured yet");
        return provider;
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String value) {
        return HexFormat.of().formatHex(digest(value));
    }

    private static byte[] digest(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static ResponseStatusException invalidState() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Login request expired or invalid");
    }
}
