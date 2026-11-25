package com.elsewhere;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.assertThat;
import static com.elsewhere.ApiTestRequests.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=${TEST_DB_URL:jdbc:h2:mem:footprints;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1}",
        "spring.datasource.username=${TEST_DB_USERNAME:sa}", "spring.datasource.password=${TEST_DB_PASSWORD:}"
})
@AutoConfigureMockMvc
@Transactional
class FootprintFlowTest {
    @Autowired MockMvc mvc;
    @Autowired AuthService auth;
    @Autowired ObjectMapper json;

    private Cookie account(String name) {
        return new Cookie(AuthController.COOKIE, auth.register(name, "Aa1!" + java.util.UUID.randomUUID(), null).token());
    }

    private Map<String, Object> draft(String image) {
        return Map.of("province", "Anhui", "city", "Hefei", "date", "2026-05-01", "note", "A spring visit",
                "themes", List.of("CITY", "CULTURE"), "image", Map.of("src", image, "thumbnailSrc", image));
    }

    @Test
    void externalIdentityIsCaseSensitive() {
        var first = auth.loginExternal("google", "test-app", "CaseSensitiveSubject", null);
        var second = auth.loginExternal("google", "test-app", "casesensitivesubject", null);
        assertThat(first.user().id()).isNotEqualTo(second.user().id());
        assertThat(auth.loginExternal("google", "test-app", "CaseSensitiveSubject", null).user().id()).isEqualTo(first.user().id());
    }

    @Test
    void savesImagesAndMetadataWithOwnerIsolationAndDeletion() throws Exception {
        Cookie owner = account("fp_owner");
        Cookie other = account("fp_other");
        mvc.perform(get("/api/footprints")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/footprints").cookie(owner)).andExpect(jsonPath("$.length()").value(34));
        String image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=";
        var response = mvc.perform(post("/api/footprints").cookie(owner).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(draft(image))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.city").value("Hefei")).andReturn();
        var created = json.readTree(response.getResponse().getContentAsString());
        String id = created.path("id").asText();
        String path = created.path("image").path("src").asText();
        mvc.perform(get(path).cookie(owner)).andExpect(status().isOk())
                .andExpect(content().bytes(Base64.getDecoder().decode(image.split(",")[1])))
                .andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(get(path).cookie(other)).andExpect(status().isNotFound());
        mvc.perform(put("/api/footprints/{id}", id).cookie(other).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(draft(image)))).andExpect(status().isNotFound());
        mvc.perform(put("/api/footprints/{id}", id).cookie(owner).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(draft(path)))).andExpect(status().isOk());
        mvc.perform(delete("/api/footprints/{id}", id).cookie(other)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/footprints/{id}", id).cookie(owner)).andExpect(status().isNoContent());
        mvc.perform(get(path).cookie(owner)).andExpect(status().isNotFound());
        mvc.perform(get("/api/footprints").cookie(owner)).andExpect(jsonPath("$.length()").value(34));
    }

    @Test
    void rejectsInvalidDataAndImportsBrowserRecordsOnlyOnce() throws Exception {
        Cookie owner = account("fp_import");
        long ownerId = auth.requireUser(owner.getValue()).id();
        String bundled = "/images/carousel/%E5%AE%89%E5%BE%BD.webp";
        var invalid = new java.util.HashMap<>(draft(bundled));
        invalid.put("date", "2026-02-30");
        mvc.perform(post("/api/footprints").cookie(owner).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(invalid))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/footprints").cookie(owner).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(draft("data:image/png;base64,SGVsbG8=")))).andExpect(status().isBadRequest());
        var legacy = new java.util.HashMap<>(draft(bundled));
        legacy.put("id", "old-browser-photo");
        legacy.put("ownerId", ownerId);
        byte[] payload = json.writeValueAsBytes(Map.of("records", List.of(legacy)));
        for (int i = 0; i < 2; i++) {
            mvc.perform(post("/api/footprints/import").cookie(owner).contentType(MediaType.APPLICATION_JSON).content(payload))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(35));
        }
        legacy.put("ownerId", ownerId + 1);
        mvc.perform(post("/api/footprints/import").cookie(owner).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("records", List.of(legacy))))).andExpect(status().isForbidden());
        var photos = mvc.perform(get("/api/footprints").cookie(owner)).andReturn();
        assertThat(json.readTree(photos.getResponse().getContentAsString())).hasSize(35);
    }
}
