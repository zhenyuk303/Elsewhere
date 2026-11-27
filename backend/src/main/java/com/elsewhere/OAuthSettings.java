package com.elsewhere;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OAuthSettings {
    public record Provider(String name, String clientId, String clientSecret, String redirectUri) {
        public boolean configured() {
            if (clientId.isBlank() || clientSecret.isBlank() || redirectUri.isBlank()) return false;
            try {
                URI uri = URI.create(redirectUri);
                boolean local = "http".equalsIgnoreCase(uri.getScheme())
                        && ("localhost".equalsIgnoreCase(uri.getHost()) || "127.0.0.1".equals(uri.getHost()));
                boolean secure = "https".equalsIgnoreCase(uri.getScheme());
                return (local || secure) && uri.getHost() != null && uri.getRawUserInfo() == null
                        && uri.getRawFragment() == null && uri.getRawQuery() == null
                        && uri.getPath().equals("/api/auth/oauth/" + name + "/callback");
            } catch (IllegalArgumentException ex) {
                return false;
            }
        }
    }

    private final Provider google;
    private final Provider github;

    public OAuthSettings(
            @Value("${elsewhere.oauth.google.client-id:}") String googleClientId,
            @Value("${elsewhere.oauth.google.client-secret:}") String googleClientSecret,
            @Value("${elsewhere.oauth.google.redirect-uri:}") String googleRedirectUri,
            @Value("${elsewhere.oauth.github.client-id:}") String githubClientId,
            @Value("${elsewhere.oauth.github.client-secret:}") String githubClientSecret,
            @Value("${elsewhere.oauth.github.redirect-uri:}") String githubRedirectUri) {
        google = new Provider("google", googleClientId.trim(), googleClientSecret.trim(), googleRedirectUri.trim());
        github = new Provider("github", githubClientId.trim(), githubClientSecret.trim(), githubRedirectUri.trim());
    }

    public Provider get(String name) {
        return switch (name) {
            case "google" -> google;
            case "github" -> github;
            default -> throw new IllegalArgumentException("Unknown provider");
        };
    }
}
