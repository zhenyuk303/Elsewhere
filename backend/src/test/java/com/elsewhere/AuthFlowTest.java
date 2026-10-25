package com.elsewhere;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:authtest;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
class AuthFlowTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @Test
    void registrationLoginSessionAndLogout() throws Exception {
        String register = """
                {"username":"Traveler","password":"a long secret 123","agreementAccepted":true}
                """;
        var registered = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(register))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.username").value("Traveler"))
                .andExpect(jsonPath("$.password").doesNotExist()).andReturn();
        Cookie cookie = registered.getResponse().getCookie(AuthController.COOKIE);
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(registered.getResponse().getHeader("Set-Cookie")).contains("SameSite=Lax");
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE username_key = 'traveler'", String.class);
        assertThat(hash).startsWith("$2").doesNotContain("a long secret 123");
        assertThat(jdbc.queryForObject("SELECT token_hash FROM auth_sessions", String.class)).doesNotContain(cookie.getValue());

        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("Traveler"));
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(register))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"TRAVELER\",\"password\":\"wrong password\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"TRAVELER\",\"password\":\"a long secret 123\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.username").value("Traveler"));
        mvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsInvalidRegistrationAndAnonymousAccess() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"x\",\"password\":\"short\",\"agreementAccepted\":false}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isString());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }
}
