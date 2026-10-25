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
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class TencentOAuthClient {
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper json;

    public TencentOAuthClient(ObjectMapper json) {
        this.json = json;
    }

    public String authorizationUrl(OAuthSettings.Provider provider, String state) {
        if (provider.name().equals("qq")) {
            return url("https://graph.qq.com/oauth2.0/authorize", Map.of(
                    "response_type", "code", "client_id", provider.appId(), "redirect_uri", provider.redirectUri(),
                    "state", state, "scope", "get_user_info"));
        }
        return url("https://open.weixin.qq.com/connect/qrconnect", Map.of(
                "appid", provider.appId(), "redirect_uri", provider.redirectUri(), "response_type", "code",
                "scope", "snsapi_login", "state", state)) + "#wechat_redirect";
    }

    public String exchangeOpenId(OAuthSettings.Provider provider, String code) {
        if (provider.name().equals("qq")) return qqOpenId(provider, code);
        return wechatOpenId(provider, code);
    }

    private String qqOpenId(OAuthSettings.Provider provider, String code) {
        JsonNode token = getJson(url("https://graph.qq.com/oauth2.0/token", Map.of(
                "grant_type", "authorization_code", "client_id", provider.appId(),
                "client_secret", provider.appSecret(), "code", code,
                "redirect_uri", provider.redirectUri(), "fmt", "json")));
        String accessToken = required(token, "access_token");
        JsonNode identity = getJson(url("https://graph.qq.com/oauth2.0/me", Map.of(
                "access_token", accessToken, "fmt", "json")));
        if (!provider.appId().equals(required(identity, "client_id"))) throw providerFailure();
        return required(identity, "openid");
    }

    private String wechatOpenId(OAuthSettings.Provider provider, String code) {
        JsonNode token = getJson(url("https://api.weixin.qq.com/sns/oauth2/access_token", Map.of(
                "appid", provider.appId(), "secret", provider.appSecret(), "code", code,
                "grant_type", "authorization_code")));
        required(token, "access_token");
        return required(token, "openid");
    }

    private JsonNode getJson(String uri) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(uri))
                    .timeout(Duration.ofSeconds(8)).header("Accept", "application/json").GET().build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) throw providerFailure();
            JsonNode body = json.readTree(response.body());
            if (body == null || body.has("error") || body.has("errcode")) throw providerFailure();
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

    private static String url(String base, Map<String, String> query) {
        Map<String, String> ordered = new LinkedHashMap<>(query);
        StringBuilder result = new StringBuilder(base).append('?');
        ordered.forEach((key, value) -> {
            if (result.charAt(result.length() - 1) != '?') result.append('&');
            result.append(URLEncoder.encode(key, StandardCharsets.UTF_8)).append('=')
                    .append(URLEncoder.encode(value, StandardCharsets.UTF_8));
        });
        return result.toString();
    }
}
