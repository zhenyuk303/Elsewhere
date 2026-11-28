package com.elsewhere;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"server.address=127.0.0.1", "elsewhere.demo.enabled=false"})
@TestMethodOrder(OrderAnnotation.class)
class StageAuthHttpTest {
    private static final String PW = "Travel123!";
    private static final String H2 = "jdbc:h2:mem:elsewhere_stage_auth;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
    @LocalServerPort int port;
    @Autowired JdbcTemplate sql;
    @Autowired ObjectMapper json;
    private final HttpClient http = HttpClient.newHttpClient();

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        String url = System.getenv("DB_URL");
        if (url == null || !(url.equals(H2) || url.matches("jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/elsewhere_stage_auth(?:\\?.*)?"))) {
            throw new IllegalArgumentException("DB_URL must explicitly name the isolated stage auth database");
        }
        registry.add("spring.datasource.url", () -> url);
    }

    record Row(String id, String name, String password, boolean agreement, int status) {}

    @Test @Order(1)
    void E01_registersAndReusesSession() throws Exception {
        verify(new Row("E01", "qa_test01", PW, true, 201));
    }

    @TestFactory @Order(2)
    List<DynamicTest> E_equivalenceClasses() {
        return List.of(
                reg("E02", "", PW, true, 400), reg("E03", "q", PW, true, 400),
                reg("E04", "q".repeat(31), PW, true, 400), reg("E05", "qa@test", PW, true, 400),
                reg("E06", "qa_test01", "", true, 400), reg("E07", "qa_test01", "Aa1!abc", true, 400),
                reg("E08", "qa_test01", password(73), true, 400), DynamicTest.dynamicTest("E09", this::duplicate),
                reg("E10", "qa_test01", PW, false, 400));
    }

    @TestFactory @Order(3)
    List<DynamicTest> B_boundaries() {
        int[][] lengths = {{10,12},{2,12},{3,12},{29,12},{30,12},{10,8},{10,9},{10,71},{10,72},
                {1,12},{31,12},{10,7},{10,73}};
        return java.util.stream.IntStream.range(0, lengths.length).mapToObj(i ->
                reg("B%02d".formatted(i + 1), "q".repeat(lengths[i][0]), password(lengths[i][1]), true, i < 9 ? 201 : 400)).toList();
    }

    @TestFactory @Order(4)
    List<DynamicTest> C_causes() {
        return List.of(login("C01", "qa_login", PW, 200), login("C02", "qa_login", "Travel124!", 401),
                login("C03", "qa_absent", PW, 401));
    }

    @TestFactory @Order(5)
    List<DynamicTest> D_ruleRepresentativesAndCombinations() {
        String bad = "Aa1!abc";
        return List.of(reg("D01", "qa_rule", PW, true, 201), reg("D02", "qa_rule", PW, false, 400),
                reg("D03", "qa_rule", bad, true, 400), reg("D05", "q", PW, true, 400),
                reg("D04", "qa_rule", bad, false, 400), reg("D06", "q", PW, false, 400),
                reg("D07", "q", bad, true, 400), reg("D08", "q", bad, false, 400));
    }

    private static String password(int length) { return "Aa1!" + "a".repeat(length - 4); }

    private DynamicTest reg(String id, String name, String pw, boolean agreement, int expected) {
        return DynamicTest.dynamicTest(id, () -> verify(new Row(id, name, pw, agreement, expected)));
    }

    private void verify(Row row) throws Exception {
        assertThat(ids(row.name)).isEmpty();
        int usersBefore = count("SELECT COUNT(*) FROM users");
        int sessionsBefore = count("SELECT COUNT(*) FROM auth_sessions");
        try {
            var reply = register(row.name, row.password, row.agreement);
            assertEquals(row.status, reply.statusCode(), "registration status");
            if (row.status == 201) {
                long id = verifySession(reply, row.name);
                assertThat(ids(row.name)).containsExactly(id);
            } else {
                assertNoSession(reply);
                assertThat(ids(row.name)).isEmpty();
            }
            int delta = row.status == 201 ? 1 : 0;
            assertEquals(usersBefore + delta, count("SELECT COUNT(*) FROM users"));
            assertEquals(sessionsBefore + delta, count("SELECT COUNT(*) FROM auth_sessions"));
            System.out.printf("STAGE %s status=%d usernameLen=%d passwordLen=%d agreement=%s usersDelta=%d sessionsDelta=%d me=%s%n",
                    row.id, reply.statusCode(), row.name.length(), row.password.length(), row.agreement, delta, delta,
                    delta == 1 ? "200/same-new-id" : "401/no-cookie");
        } finally { clean(row.name); }
    }

    private void duplicate() throws Exception {
        String name = "qa_test01";
        assertThat(ids(name)).isEmpty();
        try {
            var setup = register(name, PW, true);
            assertEquals(201, setup.statusCode());
            long original = verifySession(setup, name);
            int sessionsBefore = count("SELECT COUNT(*) FROM auth_sessions");
            var reply = register(name, PW, true);
            assertEquals(409, reply.statusCode());
            assertNoSession(reply);
            assertThat(ids(name)).containsExactly(original);
            assertEquals(sessionsBefore, count("SELECT COUNT(*) FROM auth_sessions"));
            assertEquals(original, verifySession(setup, name));
            System.out.println("STAGE E09 setup=201 status=409 exactOriginalIdOnly=true noNewSession=true");
        } finally { clean(name); }
    }

    private DynamicTest login(String id, String name, String password, int expected) {
        return DynamicTest.dynamicTest(id, () -> {
            assertThat(ids("qa_login")).isEmpty();
            assertThat(ids("qa_absent")).isEmpty();
            try {
                var setup = register("qa_login", PW, true);
                assertEquals(201, setup.statusCode());
                long original = verifySession(setup, "qa_login");
                int sessionsBefore = count("SELECT COUNT(*) FROM auth_sessions");
                var reply = send("POST", "/api/auth/login", Map.of("username", name, "password", password), null);
                assertEquals(expected, reply.statusCode());
                if (expected == 200) assertEquals(original, verifySession(reply, name));
                else assertNoSession(reply);
                assertEquals(sessionsBefore + (expected == 200 ? 1 : 0), count("SELECT COUNT(*) FROM auth_sessions"));
                System.out.printf("STAGE %s status=%d cookie=%s me=%s%n", id, reply.statusCode(),
                        expected == 200 ? "present" : "absent", expected == 200 ? "200/same-id" : "401");
            } finally { clean("qa_login"); }
        });
    }

    private long verifySession(HttpResponse<String> reply, String name) throws Exception {
        var cookie = reply.headers().firstValue("Set-Cookie");
        assertThat(cookie.isPresent()).as("session cookie was supplied").isTrue();
        var me = send("GET", "/api/auth/me", null, cookie.orElseThrow().split(";", 2)[0]);
        assertEquals(200, me.statusCode());
        var account = json.readTree(me.body());
        long id = account.path("id").asLong();
        assertThat(id).isPositive();
        assertEquals(name, account.path("username").asText());
        assertEquals(id, json.readTree(reply.body()).path("id").asLong());
        return id;
    }

    private void assertNoSession(HttpResponse<String> reply) throws Exception {
        assertThat(reply.headers().firstValue("Set-Cookie").isEmpty()).as("no session cookie").isTrue();
        assertEquals(401, send("GET", "/api/auth/me", null, null).statusCode());
    }

    private HttpResponse<String> register(String name, String pw, boolean agreement) throws Exception {
        return send("POST", "/api/auth/register", Map.of("username", name, "password", pw, "agreementAccepted", agreement), null);
    }

    private HttpResponse<String> send(String method, String path, Map<String, ?> body, String cookie) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .timeout(java.time.Duration.ofSeconds(10));
        if (cookie != null) request.header("Cookie", cookie);
        if (body != null) request.header("Content-Type", "application/json");
        return http.send(request.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(), HttpResponse.BodyHandlers.ofString());
    }

    private int count(String query) { return sql.queryForObject(query, Integer.class); }
    private List<Long> ids(String name) { return sql.queryForList("SELECT id FROM users WHERE username = ?", Long.class, name); }
    private void clean(String name) { sql.update("DELETE FROM users WHERE username = ?", name); }
}
