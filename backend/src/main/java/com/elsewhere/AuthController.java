package com.elsewhere;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    static final String COOKIE = "elsewhere_session";
    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    public record RegisterRequest(
            @NotBlank @Pattern(regexp = "[A-Za-z0-9_.-]{2,30}", message = "Use 2–30 letters, numbers, dots, underscores or hyphens") String username,
            @NotBlank @Size(min = 8, max = 72, message = "Use 8–72 characters") String password,
            @AssertTrue(message = "Please accept the terms to continue") boolean agreementAccepted) {}

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}

    @PostMapping("/register")
    public ResponseEntity<AuthService.User> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest http) {
        var signedIn = auth.register(request.username(), request.password());
        return ResponseEntity.status(HttpStatus.CREATED).header(HttpHeaders.SET_COOKIE, cookie(signedIn.token(), http, false))
                .body(signedIn.user());
    }

    @PostMapping("/login")
    public ResponseEntity<AuthService.User> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        var signedIn = auth.login(request.username(), request.password());
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie(signedIn.token(), http, false)).body(signedIn.user());
    }

    @GetMapping("/me")
    public AuthService.User me(@CookieValue(name = COOKIE, required = false) String token) {
        return auth.requireUser(token);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = COOKIE, required = false) String token, HttpServletRequest http) {
        auth.logout(token);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie("", http, true)).build();
    }

    private static String cookie(String token, HttpServletRequest http, boolean clear) {
        return ResponseCookie.from(COOKIE, token).httpOnly(true).secure(http.isSecure())
                .sameSite("Lax").path("/api").maxAge(clear ? Duration.ZERO : Duration.ofDays(7)).build().toString();
    }
}
