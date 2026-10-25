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
    private final TencentOAuthClient client;
    private final AuthService auth;
    private final JdbcTemplate jdbc;
    private final SecureRandom random = new SecureRandom();

    public OAuthService(OAuthSettings settings, TencentOAuthClient client, AuthService auth, JdbcTemplate jdbc) {
        this.settings = settings;
        this.client = client;
        this.auth = auth;
        this.jdbc = jdbc;
    }

    public Started start(String providerName) {
        OAuthSettings.Provider provider = configured(providerName);
        jdbc.update("DELETE FROM oauth_login_states WHERE expires_at <= ?", Timestamp.from(Instant.now()));
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.update("INSERT INTO oauth_login_states(state_hash, provider, expires_at) VALUES (?, ?, ?)",
                hash(state), providerName, Timestamp.from(Instant.now().plus(10, ChronoUnit.MINUTES)));
        return new Started(client.authorizationUrl(provider, state), state);
    }

    public AuthService.SignedIn complete(String providerName, String code, String state, String cookieState) {
        OAuthSettings.Provider provider = configured(providerName);
        if (code == null || code.isBlank() || state == null || state.isBlank() || cookieState == null ||
                !MessageDigest.isEqual(state.getBytes(StandardCharsets.UTF_8), cookieState.getBytes(StandardCharsets.UTF_8)))
            throw invalidState();
        int consumed = jdbc.update("DELETE FROM oauth_login_states WHERE state_hash = ? AND provider = ? AND expires_at > ?",
                hash(state), providerName, Timestamp.from(Instant.now()));
        if (consumed != 1) throw invalidState();
        String providerUserId = client.exchangeOpenId(provider, code);
        return auth.loginExternal(providerName, provider.appId(), providerUserId);
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
                    (name.equals("qq") ? "QQ" : "WeChat") + " login is not configured yet");
        return provider;
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static ResponseStatusException invalidState() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Login request expired or invalid");
    }
}
