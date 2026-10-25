package com.elsewhere;

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
        "QQ_APP_ID=test-app", "QQ_APP_SECRET=test-secret",
        "QQ_REDIRECT_URI=https://elsewhere.example/api/auth/oauth/qq/callback"
})
@AutoConfigureMockMvc
class OAuthFlowTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean TencentOAuthClient client;

    @Test
    void bindsStateToBrowserAndCreatesOneLocalIdentity() throws Exception {
        when(client.authorizationUrl(any(), anyString())).thenAnswer(call ->
                "https://graph.qq.com/oauth2.0/authorize?state=" + call.getArgument(1, String.class));
        when(client.exchangeOpenId(any(), anyString())).thenReturn("qq-open-id-1");

        var started = mvc.perform(post("/api/auth/oauth/qq/start"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.authorizationUrl").isString())
                .andReturn();
        Cookie stateCookie = started.getResponse().getCookie(OAuthController.STATE_COOKIE);
        assertThat(stateCookie).isNotNull();
        assertThat(stateCookie.isHttpOnly()).isTrue();
        String state = stateCookie.getValue();
        assertThat(started.getResponse().getContentAsString()).contains(state).doesNotContain("test-secret");

        mvc.perform(get("/api/auth/oauth/qq/callback")
                        .param("code", "test-code").param("state", state))
                .andExpect(status().isSeeOther()).andExpect(redirectedUrl("/?oauthError=invalid"));

        var completed = mvc.perform(get("/api/auth/oauth/qq/callback")
                        .param("code", "test-code").param("state", state).cookie(stateCookie))
                .andExpect(status().isSeeOther()).andExpect(redirectedUrl("/"))
                .andReturn();
        Cookie session = completed.getResponse().getCookie(AuthController.COOKIE);
        assertThat(session).isNotNull();
        assertThat(session.isHttpOnly()).isTrue();
        mvc.perform(get("/api/auth/me").cookie(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(org.hamcrest.Matchers.startsWith("qq_")));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM oauth_identities WHERE provider = 'qq'", Integer.class))
                .isEqualTo(1);

        mvc.perform(get("/api/auth/oauth/qq/callback")
                        .param("code", "test-code").param("state", state).cookie(stateCookie))
                .andExpect(status().isSeeOther()).andExpect(redirectedUrl("/?oauthError=invalid"));
    }

    @Test
    void requiresProviderConfiguration() throws Exception {
        mvc.perform(post("/api/auth/oauth/wechat/start"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("WeChat login is not configured yet"));
    }
}
