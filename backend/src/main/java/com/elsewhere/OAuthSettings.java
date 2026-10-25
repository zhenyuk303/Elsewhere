package com.elsewhere;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OAuthSettings {
    public record Provider(String name, String appId, String appSecret, String redirectUri) {
        public boolean configured() {
            if (appId.isBlank() || appSecret.isBlank() || redirectUri.isBlank()) return false;
            try {
                URI uri = URI.create(redirectUri);
                return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getFragment() == null;
            } catch (IllegalArgumentException ex) {
                return false;
            }
        }
    }

    private final Provider qq;
    private final Provider wechat;

    public OAuthSettings(
            @Value("${elsewhere.oauth.qq.app-id:}") String qqAppId,
            @Value("${elsewhere.oauth.qq.app-secret:}") String qqAppSecret,
            @Value("${elsewhere.oauth.qq.redirect-uri:}") String qqRedirectUri,
            @Value("${elsewhere.oauth.wechat.app-id:}") String wechatAppId,
            @Value("${elsewhere.oauth.wechat.app-secret:}") String wechatAppSecret,
            @Value("${elsewhere.oauth.wechat.redirect-uri:}") String wechatRedirectUri) {
        qq = new Provider("qq", qqAppId.trim(), qqAppSecret.trim(), qqRedirectUri.trim());
        wechat = new Provider("wechat", wechatAppId.trim(), wechatAppSecret.trim(), wechatRedirectUri.trim());
    }

    public Provider get(String name) {
        return switch (name) {
            case "qq" -> qq;
            case "wechat" -> wechat;
            default -> throw new IllegalArgumentException("Unknown provider");
        };
    }
}
