package com.elsewhere;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.time.Duration;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth/oauth")
public class OAuthController {
    static final String STATE_COOKIE = "elsewhere_oauth_state";
    private final OAuthService oauth;

    public OAuthController(OAuthService oauth) {
        this.oauth = oauth;
    }

    @PostMapping("/{provider}/start")
    public ResponseEntity<Map<String, String>> start(@PathVariable String provider, HttpServletRequest http) {
        OAuthService.Started started = oauth.start(provider);
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, stateCookie(started.state(), http, false))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(Map.of("authorizationUrl", started.authorizationUrl()));
    }

    @GetMapping("/{provider}/callback")
    public ResponseEntity<Void> callback(@PathVariable String provider,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @CookieValue(name = STATE_COOKIE, required = false) String cookieState,
            HttpServletRequest http) {
        if (error != null || code == null || code.isBlank()) return redirect("cancelled", null, http);
        try {
            AuthService.SignedIn signedIn = oauth.complete(provider, code, state, cookieState);
            return redirect(null, signedIn.token(), http);
        } catch (ResponseStatusException ex) {
            return redirect(ex.getStatusCode().value() == 400 ? "invalid" : "failed", null, http);
        }
    }

    private static ResponseEntity<Void> redirect(String error, String sessionToken, HttpServletRequest http) {
        URI location = URI.create(error == null ? "/" : "/?oauthError=" + error);
        var response = ResponseEntity.status(HttpStatus.SEE_OTHER).location(location)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.SET_COOKIE, stateCookie("", http, true));
        if (sessionToken != null)
            response.header(HttpHeaders.SET_COOKIE, AuthController.cookie(sessionToken, http, false));
        return response.build();
    }

    private static String stateCookie(String state, HttpServletRequest http, boolean clear) {
        return ResponseCookie.from(STATE_COOKIE, state).httpOnly(true).secure(http.isSecure())
                .sameSite("Lax").path("/api/auth/oauth")
                .maxAge(clear ? Duration.ZERO : Duration.ofMinutes(10)).build().toString();
    }
}
