package com.elsewhere;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
class AuthCookies {
    static final Duration SESSION_DURATION = Duration.ofDays(7);
    private final boolean forceSecure;

    AuthCookies(@Value("${elsewhere.auth.secure-cookies:false}") boolean forceSecure) {
        this.forceSecure = forceSecure;
    }

    String session(String token, HttpServletRequest request, boolean clear) {
        return cookie(AuthController.COOKIE, token, request, "/api", clear ? Duration.ZERO : SESSION_DURATION);
    }

    String oauthState(String state, HttpServletRequest request, boolean clear) {
        return cookie(OAuthController.STATE_COOKIE, state, request, "/api/auth/oauth",
                clear ? Duration.ZERO : Duration.ofMinutes(10));
    }

    private String cookie(String name, String value, HttpServletRequest request, String path, Duration maxAge) {
        return ResponseCookie.from(name, value).httpOnly(true).secure(forceSecure || request.isSecure())
                .sameSite("Lax").path(path).maxAge(maxAge).build().toString();
    }
}
