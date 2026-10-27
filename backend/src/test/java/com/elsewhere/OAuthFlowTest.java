package com.elsewhere;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:oauthtest;DB_CLOSE_DELAY=-1",
        "CLIENT_ID_GITHUB=test-github-id", "CLIENT_SECRET_GITHUB=test-github-secret",
        "CLIENT_ID_GOOGLE=test-google-id", "CLIENT_SECRET_GOOGLE=test-google-secret"
})
@AutoConfigureMockMvc
class OAuthFlowTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean OAuthClient client;

    @Test
    void githubLoginBindsStateAndReusesIdentity() throws Exception {
        when(client.authorizationUrl(any(), anyString(), anyString())).thenAnswer(call ->
                "https://github.com/login/oauth/authorize?state=" + call.getArgument(1, String.class));
        when(client.exchangeUserId(any(), anyString(), anyString())).thenReturn("1234567");

        var started = mvc.perform(post("/api/auth/oauth/github/start"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.authorizationUrl").isString())
                .andReturn();
        Cookie stateCookie = started.getResponse().getCookie(OAuthController.STATE_COOKIE);
        assertThat(stateCookie).isNotNull();
        assertThat(stateCookie.isHttpOnly()).isTrue();
        String state = stateCookie.getValue();
        assertThat(started.getResponse().getContentAsString()).contains(state).doesNotContain("test-github-secret");

        mvc.perform(get("/api/auth/oauth/github/callback").param("code", "sample").param("state", state))
                .andExpect(status().isSeeOther()).andExpect(redirectedUrl("/?oauthError=invalid"));

        var completed = mvc.perform(get("/api/auth/oauth/github/callback")
                        .param("code", "sample").param("state", state).cookie(stateCookie))
                .andExpect(status().isSeeOther()).andExpect(redirectedUrl("/"))
                .andReturn();
        Cookie session = completed.getResponse().getCookie(AuthController.COOKIE);
        assertThat(session).isNotNull();
        assertThat(session.isHttpOnly()).isTrue();
        mvc.perform(get("/api/auth/me").cookie(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(org.hamcrest.Matchers.startsWith("github_")));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM oauth_identities WHERE provider = 'github'", Integer.class))
                .isEqualTo(1);

        mvc.perform(get("/api/auth/oauth/github/callback")
                        .param("code", "sample").param("state", state).cookie(stateCookie))
                .andExpect(status().isSeeOther()).andExpect(redirectedUrl("/?oauthError=invalid"));

        var secondStart = mvc.perform(post("/api/auth/oauth/github/start")).andExpect(status().isOk()).andReturn();
        Cookie secondState = secondStart.getResponse().getCookie(OAuthController.STATE_COOKIE);
        mvc.perform(get("/api/auth/oauth/github/callback")
                        .param("code", "second").param("state", secondState.getValue()).cookie(secondState))
                .andExpect(status().isSeeOther()).andExpect(redirectedUrl("/"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM oauth_identities WHERE provider = 'github'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void googleLoginUsesItsOwnIdentity() throws Exception {
        when(client.authorizationUrl(any(), anyString(), anyString())).thenAnswer(call ->
                "https://accounts.google.com/o/oauth2/v2/auth?state=" + call.getArgument(1, String.class));
        when(client.exchangeUserId(any(), anyString(), anyString())).thenReturn("google-sub-1");

        var started = mvc.perform(post("/api/auth/oauth/google/start"))
                .andExpect(status().isOk()).andReturn();
        Cookie stateCookie = started.getResponse().getCookie(OAuthController.STATE_COOKIE);
        mvc.perform(get("/api/auth/oauth/google/callback")
                        .param("code", "sample").param("state", stateCookie.getValue()).cookie(stateCookie))
                .andExpect(status().isSeeOther()).andExpect(redirectedUrl("/"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM oauth_identities WHERE provider = 'google'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void authorizationUrlsUseExpectedProvidersAndPkce() {
        OAuthClient actual = new OAuthClient(new ObjectMapper());
        var github = new OAuthSettings.Provider("github", "gh-id", "secret",
                "http://localhost:5173/api/auth/oauth/github/callback");
        var google = new OAuthSettings.Provider("google", "google-id", "secret",
                "http://localhost:5173/api/auth/oauth/google/callback");
        assertThat(actual.authorizationUrl(github, "state1", "challenge1"))
                .startsWith("https://github.com/login/oauth/authorize?")
                .contains("code_challenge=challenge1", "code_challenge_method=S256", "scope=read%3Auser");
        assertThat(actual.authorizationUrl(google, "state2", "challenge2"))
                .startsWith("https://accounts.google.com/o/oauth2/v2/auth?")
                .contains("code_challenge=challenge2", "scope=openid+profile");
    }

    @Test
    void retiredProvidersHaveNoLoginEndpoint() throws Exception {
        mvc.perform(post("/api/auth/oauth/qq/start")).andExpect(status().isNotFound());
        mvc.perform(post("/api/auth/oauth/wechat/start")).andExpect(status().isNotFound());
    }
}
