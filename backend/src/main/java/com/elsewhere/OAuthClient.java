package com.elsewhere;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class OAuthClient {
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper json;

    public OAuthClient(ObjectMapper json) {
        this.json = json;
    }

    public String authorizationUrl(OAuthSettings.Provider provider, String state, String codeChallenge) {
        if (provider.name().equals("github")) {
            return url("https://github.com/login/oauth/authorize", Map.of(
                    "client_id", provider.clientId(), "redirect_uri", provider.redirectUri(),
                    "scope", "read:user", "state", state,
                    "code_challenge", codeChallenge, "code_challenge_method", "S256"));
        }
        return url("https://accounts.google.com/o/oauth2/v2/auth", Map.of(
                "client_id", provider.clientId(), "redirect_uri", provider.redirectUri(),
                "response_type", "code", "scope", "openid profile", "state", state,
                "code_challenge", codeChallenge, "code_challenge_method", "S256"));
    }

    public String exchangeUserId(OAuthSettings.Provider provider, String code, String verifier) {
        JsonNode token;
        JsonNode identity;
        if (provider.name().equals("github")) {
            token = postForm("https://github.com/login/oauth/access_token", Map.of(
                    "client_id", provider.clientId(), "client_secret", provider.clientSecret(),
                    "code", code, "redirect_uri", provider.redirectUri(), "code_verifier", verifier));
            identity = getBearer("https://api.github.com/user", required(token, "access_token"));
            return required(identity, "id");
        }
        token = postForm("https://oauth2.googleapis.com/token", Map.of(
                "client_id", provider.clientId(), "client_secret", provider.clientSecret(),
                "code", code, "redirect_uri", provider.redirectUri(), "code_verifier", verifier,
                "grant_type", "authorization_code"));
        identity = getBearer("https://openidconnect.googleapis.com/v1/userinfo", required(token, "access_token"));
        return required(identity, "sub");
    }

    private JsonNode postForm(String endpoint, Map<String, String> form) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint)).timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Accept", "application/json").header("User-Agent", "Elsewhere/1.0")
                .POST(HttpRequest.BodyPublishers.ofString(query(form))).build();
        return send(request);
    }

    private JsonNode getBearer(String endpoint, String accessToken) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint)).timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + accessToken)
                .header("Accept", "application/json").header("User-Agent", "Elsewhere/1.0")
                .GET().build();
        return send(request);
    }

    private JsonNode send(HttpRequest request) {
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) throw providerFailure();
            JsonNode body = json.readTree(response.body());
            if (body == null || body.has("error") || body.has("errors")) throw providerFailure();
            return body;
        } catch (IOException ex) {
            throw providerFailure();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw providerFailure();
        }
    }

    private static String required(JsonNode body, String field) {
        String value = body.path(field).asText("");
        if (value.isBlank()) throw providerFailure();
        return value;
    }

    private static ResponseStatusException providerFailure() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Third-party login failed");
    }

    private static String url(String base, Map<String, String> parameters) {
        return base + "?" + query(parameters);
    }

    private static String query(Map<String, String> parameters) {
        return parameters.entrySet().stream()
                .map(entry -> URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8) + "="
                        + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
    }
}
