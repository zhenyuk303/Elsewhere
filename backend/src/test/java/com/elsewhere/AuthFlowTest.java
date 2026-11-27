package com.elsewhere;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static com.elsewhere.ApiTestRequests.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:authtest;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password="})
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class AuthFlowTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    @Test
    void registrationLoginSessionAndLogout() throws Exception {
        String password = "Aa1!" + UUID.randomUUID();
        var registered = mvc.perform(register("Traveler", password))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.username").value("Traveler"))
                .andExpect(jsonPath("$.password").doesNotExist()).andReturn();
        Cookie cookie = registered.getResponse().getCookie(AuthController.COOKIE);
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(registered.getResponse().getHeader("Set-Cookie")).contains("SameSite=Lax");
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE username_key = 'traveler'", String.class);
        assertThat(hash).startsWith("$2a$10$").doesNotContain(password);
        assertThat(new BCryptPasswordEncoder().matches(password, hash)).isTrue();
        assertThat(jdbc.queryForObject("""
                SELECT token_hash FROM auth_sessions WHERE user_id = (SELECT id FROM users WHERE username_key = 'traveler')
                """, String.class)).matches("[0-9a-f]{64}").isNotEqualTo(cookie.getValue());

        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("Traveler"));
        mvc.perform(register("Traveler", password)).andExpect(status().isConflict());
        var loggedIn = mvc.perform(login("TRAVELER", password).cookie(cookie).secure(true))
                .andExpect(status().isOk()).andExpect(jsonPath("$.username").value("Traveler")).andReturn();
        Cookie rotated = loggedIn.getResponse().getCookie(AuthController.COOKIE);
        assertThat(rotated.getValue()).isNotEqualTo(cookie.getValue());
        assertThat(rotated.isHttpOnly()).isTrue();
        assertThat(rotated.getSecure()).isTrue();
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").cookie(rotated)).andExpect(status().isOk());
        var logout = mvc.perform(post("/api/auth/logout").cookie(rotated).secure(true))
                .andExpect(status().isNoContent()).andReturn();
        Cookie cleared = logout.getResponse().getCookie(AuthController.COOKIE);
        assertThat(cleared.getMaxAge()).isZero();
        assertThat(cleared.getSecure()).isTrue();
        mvc.perform(get("/api/auth/me").cookie(rotated)).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM auth_sessions WHERE user_id = (SELECT id FROM users WHERE username_key = 'traveler')
                """, Integer.class)).isZero();
    }

    @Test
    void rejectsInvalidRegistrationAndAnonymousAccess() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"x\",\"password\":\"short\",\"agreementAccepted\":false}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isString());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Aa1!xyz", "12345678", "aa12345!", "AA12345!", "Aabcdef!", "Aa123456", "Aa12345 "})
    void rejectsNewPasswordsMissingLengthOrCharacterTypes(String candidate) throws Exception {
        mvc.perform(register("invalid_password_probe", candidate)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("8–72 characters")));
    }

    @Test
    void acceptsAsciiBoundariesAndRejectsLongOrMultibyteOverflow(CapturedOutput output) throws Exception {
        mvc.perform(register("minimum", "Aa1!" + randomPart().substring(0, 4))).andExpect(status().isCreated());
        String maximum = "Aa1!" + randomPart().repeat(2) + "xxxx";
        mvc.perform(register("maximum", maximum)).andExpect(status().isCreated());
        mvc.perform(register("maximum_overflow", maximum + "x")).andExpect(status().isBadRequest());
        String multibyte = "Aa1!" + randomPart() + "旅".repeat(20);
        mvc.perform(register("utf8_overflow", multibyte)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Password must fit within 72 UTF-8 bytes"));
        mvc.perform(login("minimum", multibyte)).andExpect(status().isUnauthorized());
        assertThat(output.getAll()).doesNotContain(maximum, multibyte);
    }

    @Test
    void keepsLegacyPasswordsValidAndMakesCredentialFailuresIndistinguishable() throws Exception {
        String legacy = Long.toString(new java.security.SecureRandom().nextLong(10_000_000, 100_000_000));
        jdbc.update("INSERT INTO users(username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?)",
                "Legacy", "legacy", new BCryptPasswordEncoder().encode(legacy), Timestamp.from(Instant.now()));
        String wrong = randomPart();
        var unknown = mvc.perform(login("unknown", wrong)).andExpect(status().isUnauthorized()).andReturn();
        var existing = mvc.perform(login("Legacy", wrong)).andExpect(status().isUnauthorized()).andReturn();
        assertThat(existing.getResponse().getContentAsString()).isEqualTo(unknown.getResponse().getContentAsString())
                .isEqualTo("{\"message\":\"Invalid username or password\"}");
        mvc.perform(login("Legacy", legacy)).andExpect(status().isOk());
    }

    @Test
    void blocksReplayedExpiredSessionAcrossProtectedEndpoints() throws Exception {
        var registered = mvc.perform(register("expiring_user", "Aa1!" + randomPart()))
                .andExpect(status().isCreated()).andReturn();
        Cookie cookie = registered.getResponse().getCookie(AuthController.COOKIE);
        jdbc.update("""
                UPDATE auth_sessions SET expires_at=? WHERE user_id = (SELECT id FROM users WHERE username_key='expiring_user')
                """, Timestamp.from(Instant.now().minusSeconds(60)));
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/footprints").cookie(cookie)).andExpect(status().isUnauthorized());
    }

    @Test
    void requiresCsrfHeaderForLoginLogoutOauthStartAndFootprintWrites() throws Exception {
        String password = "Aa1!" + randomPart();
        var registered = mvc.perform(register("csrf_user", password)).andExpect(status().isCreated()).andReturn();
        Cookie cookie = registered.getResponse().getCookie(AuthController.COOKIE);
        mvc.perform(MockMvcRequestBuilders.post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "csrf_user", "password", password))))
                .andExpect(status().isForbidden());
        mvc.perform(MockMvcRequestBuilders.post("/api/auth/logout").cookie(cookie)).andExpect(status().isForbidden());
        mvc.perform(MockMvcRequestBuilders.post("/api/auth/oauth/github/start")).andExpect(status().isForbidden());
        mvc.perform(MockMvcRequestBuilders.delete("/api/footprints/item").cookie(cookie)).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/logout").cookie(cookie).header("Sec-Fetch-Site", "cross-site"))
                .andExpect(status().isForbidden());
        mvc.perform(MockMvcRequestBuilders.options("/api/auth/logout")
                        .header("Origin", "https://untrusted.example")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "X-Elsewhere-Request"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk());
        mvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent());
    }

    @Test
    void limitsAccountAndActualIpWithoutLockingTheAccountAcrossIps() throws Exception {
        String password = "Aa1!" + randomPart();
        mvc.perform(register("limited_user", password)).andExpect(status().isCreated());
        for (int i = 0; i < 5; i++) {
            mvc.perform(login(" LiMiTeD_user ", randomPart()).with(request -> {
                request.setRemoteAddr("192.0.2.10");
                return request;
            }).header("X-Forwarded-For", "198.51.100." + i)).andExpect(status().isUnauthorized());
        }
        mvc.perform(login("limited_user", password).with(request -> {
            request.setRemoteAddr("192.0.2.10");
            return request;
        }).header("X-Forwarded-For", "198.51.100.30")).andExpect(status().isTooManyRequests());
        mvc.perform(login("limited_user", password).with(request -> {
            request.setRemoteAddr("192.0.2.11");
            return request;
        })).andExpect(status().isOk());
    }

    @Test
    void allowsLocalHttpButCanForceSecureCookiesBehindHttpsProxy() {
        var request = new org.springframework.mock.web.MockHttpServletRequest();
        assertThat(new AuthCookies(false).session("", request, true)).doesNotContain("; Secure");
        assertThat(new AuthCookies(true).session("", request, true)).contains("; Secure", "HttpOnly", "SameSite=Lax");
        assertThat(new AuthCookies(true).oauthState("", request, true)).contains("; Secure", "HttpOnly", "SameSite=Lax");
    }

    private MockHttpServletRequestBuilder register(String username, String password) throws Exception {
        return post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", username, "password", password, "agreementAccepted", true)));
    }

    private MockHttpServletRequestBuilder login(String username, String password) throws Exception {
        return post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", username, "password", password)));
    }

    private static String randomPart() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}
