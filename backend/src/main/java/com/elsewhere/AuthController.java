package com.elsewhere;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.Locale;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    static final String COOKIE = "elsewhere_session";
    private static final java.util.regex.Pattern USERNAME_KEY = java.util.regex.Pattern.compile("[a-z0-9_.-]{2,30}");
    private final AuthService auth;
    private final AuthCookies cookies;
    private final LoginAttempts attempts;

    public AuthController(AuthService auth, AuthCookies cookies, LoginAttempts attempts) {
        this.auth = auth;
        this.cookies = cookies;
        this.attempts = attempts;
    }

    public record RegisterRequest(
            @NotBlank @Pattern(regexp = "[A-Za-z0-9_.-]{2,30}", message = "Use 2–30 letters, numbers, dots, underscores or hyphens") String username,
            String password,
            @AssertTrue(message = "Please accept the terms to continue") boolean agreementAccepted) {
        @Override
        public String toString() { return "RegisterRequest[credentials redacted]"; }
    }

    public record LoginRequest(String username, String password) {
        @Override
        public String toString() { return "LoginRequest[credentials redacted]"; }
    }

    @PostMapping("/register")
    public ResponseEntity<AuthService.User> register(@Valid @RequestBody RegisterRequest request,
            @CookieValue(name = COOKIE, required = false) String previousToken, HttpServletRequest http) {
        var signedIn = auth.register(request.username(), request.password(), previousToken);
        return ResponseEntity.status(HttpStatus.CREATED).header(HttpHeaders.SET_COOKIE, cookies.session(signedIn.token(), http, false))
                .body(signedIn.user());
    }

    @PostMapping("/login")
    public ResponseEntity<AuthService.User> login(@RequestBody LoginRequest request,
            @CookieValue(name = COOKIE, required = false) String previousToken, HttpServletRequest http) {
        String username = request.username();
        String key = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        if (!USERNAME_KEY.matcher(key).matches()) key = "";
        var attempt = attempts.begin(key, http.getRemoteAddr());
        if (attempt == null) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many login attempts. Please try again later.");
        }
        LoginAttempts.Outcome outcome = LoginAttempts.Outcome.ABORTED;
        try {
            var result = auth.login(key, request.password(), previousToken);
            outcome = LoginAttempts.Outcome.SIGNED_IN;
            return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookies.session(result.token(), http, false)).body(result.user());
        } catch (ResponseStatusException ex) {
            if (ex.getStatusCode().value() == 401) outcome = LoginAttempts.Outcome.REJECTED;
            throw ex;
        } finally {
            attempts.complete(attempt, outcome);
        }
    }

    @GetMapping("/me")
    public AuthService.User me(@CookieValue(name = COOKIE, required = false) String token) {
        return auth.requireUser(token);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = COOKIE, required = false) String token, HttpServletRequest http) {
        auth.logout(token);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.session("", http, true)).build();
    }
}
