package com.elsewhere;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Random;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
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
    @Autowired JdbcTemplate jdbc;
    @Autowired FootprintUploads uploads;

    private Cookie account(String name) {
        return new Cookie(AuthController.COOKIE, auth.register(name, "Aa1!" + java.util.UUID.randomUUID(), null).token());
    }

    private Map<String, Object> draft(String image) {
        return Map.of("province", "Anhui", "city", "Hefei", "date", "2026-05-01", "note", "A spring visit",
                "themes", List.of("CITY", "CULTURE"), "image", Map.of("src", image, "thumbnailSrc", image));
    }

    @Test
    void stageI02CreatesReadsAndDeletesById() throws Exception {
        Cookie owner = account("qa_stage_i02");
        String png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=";
        var input = new java.util.HashMap<>(draft("data:image/png;base64," + png));
        input.put("note", "\u6625\u6e38");
        var response = mvc.perform(post("/api/footprints").cookie(owner).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(input)))
                .andExpect(status().isCreated()).andReturn().getResponse();
        String id = json.readTree(response.getContentAsByteArray()).path("id").asText();
        assertThat(id).isNotBlank();
        String image = "/api/footprints/" + id + "/image";
        mvc.perform(get("/api/footprints/{id}", id).cookie(owner)).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id)).andExpect(jsonPath("$.province").value("Anhui"))
                .andExpect(jsonPath("$.city").value("Hefei")).andExpect(jsonPath("$.note").value("\u6625\u6e38"))
                .andExpect(jsonPath("$.image.src").value(image));
        mvc.perform(get(image).cookie(owner)).andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(content().bytes(Base64.getDecoder().decode(png)));
        mvc.perform(delete("/api/footprints/{id}", id).cookie(owner)).andExpect(status().isNoContent());
        mvc.perform(get("/api/footprints/{id}", id).cookie(owner)).andExpect(status().isNotFound());
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

    @Test
    void resumesOutOfOrderFramesAndCreatesOneFootprintWithTheOriginalImageBytes() throws Exception {
        Cookie owner = account("fp_frames_owner");
        byte[] png = largePng();
        int size = FootprintUploads.FRAME_SIZE;
        assertThat(png.length).isBetween(size + 1, size * 2);
        String upload = startUpload(owner, png.length, FootprintUploads.sha256(png));
        byte[] first = Arrays.copyOfRange(png, 0, size);
        byte[] last = Arrays.copyOfRange(png, size, png.length);

        mvc.perform(frame(upload, owner, 1, size, last.length, png.length, last, FootprintUploads.sha256(last)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.frameIndex").value(1));
        mvc.perform(finish(owner, upload)).andExpect(status().isConflict());
        mvc.perform(get("/api/footprints/uploads/{id}", upload).cookie(owner)).andExpect(status().isOk())
                .andExpect(jsonPath("$.received.length()").value(1)).andExpect(jsonPath("$.received[0]").value(1))
                .andExpect(jsonPath("$.frameCount").value(2));
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(frame(upload, owner, 0, 0, size, png.length, first, FootprintUploads.sha256(first)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.frameIndex").value(0));
        }
        first[0] ^= 1;
        mvc.perform(frame(upload, owner, 0, 0, size, png.length, first, FootprintUploads.sha256(first)))
                .andExpect(status().isConflict());

        String imagePath = "/api/footprints/" + upload + "/image";
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(finish(owner, upload)).andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(upload))
                    .andExpect(jsonPath("$.image.src").value(imagePath)).andExpect(jsonPath("$.province").value("Anhui"));
        }
        mvc.perform(get("/api/footprints").cookie(owner)).andExpect(jsonPath("$.length()").value(35));
        mvc.perform(get(imagePath).cookie(owner)).andExpect(status().isOk()).andExpect(content().bytes(png));
        mvc.perform(get("/api/footprints/uploads/{id}", upload).cookie(owner)).andExpect(jsonPath("$.completed").value(true));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM footprint_upload_frames WHERE upload_id=?", Integer.class, upload)).isZero();
    }

    @Test
    void rejectsInvalidFramesAndVerifiesWholePhotoHashAndFormat() throws Exception {
        Cookie owner = account("fp_frames_check");
        byte[] invalidImage = "This is not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String hash = FootprintUploads.sha256(invalidImage);
        int size = invalidImage.length;
        String upload = startUpload(owner, size, "0".repeat(64));
        mvc.perform(frame(upload, owner, 1, 0, size, size, invalidImage, hash)).andExpect(status().isBadRequest());
        mvc.perform(frame(upload, owner, 0, 1, size, size, invalidImage, hash)).andExpect(status().isBadRequest());
        mvc.perform(frame(upload, owner, 0, 0, size, size + 1, invalidImage, hash)).andExpect(status().isBadRequest());
        mvc.perform(frame(upload, owner, 0, 0, size - 1, size, invalidImage, hash)).andExpect(status().isBadRequest());
        mvc.perform(frame(upload, owner, 0, 0, size, size, invalidImage, "0".repeat(64))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/footprints/uploads/{id}", upload).cookie(owner)).andExpect(jsonPath("$.received").isEmpty());
        mvc.perform(frame(upload, owner, 0, 0, size, size, invalidImage, hash)).andExpect(status().isOk());
        mvc.perform(finish(owner, upload)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Complete photo SHA-256 does not match"));
        String correctHash = startUpload(owner, size, hash);
        mvc.perform(frame(correctHash, owner, 0, 0, size, size, invalidImage, hash)).andExpect(status().isOk());
        mvc.perform(finish(owner, correctHash)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Upload a valid JPEG, PNG, GIF or WebP photo"));
        mvc.perform(get("/api/footprints").cookie(owner)).andExpect(jsonPath("$.length()").value(34));
    }

    @Test
    void checksOwnershipSizeCancellationAndExpiry() throws Exception {
        Cookie owner = account("fp_frames_private");
        Cookie other = account("fp_frames_other");
        byte[] payload = {1, 2, 3};
        String hash = FootprintUploads.sha256(payload);
        int size = payload.length;
        mvc.perform(startUploadRequest(FootprintUploads.MAX_SIZE + 1, hash).cookie(owner)).andExpect(status().isPayloadTooLarge());
        mvc.perform(startUploadRequest(size, hash)).andExpect(status().isUnauthorized());
        String upload = startUpload(owner, size, hash);
        mvc.perform(get("/api/footprints/uploads/{id}", upload)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/footprints/uploads/{id}", upload).cookie(other)).andExpect(status().isNotFound());
        mvc.perform(frame(upload, other, 0, 0, size, size, payload, hash)).andExpect(status().isNotFound());
        mvc.perform(finish(other, upload)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/footprints/uploads/{id}", upload).cookie(other)).andExpect(status().isNotFound());
        mvc.perform(frame(upload, owner, 0, 0, size, size, payload, hash)).andExpect(status().isOk());
        mvc.perform(delete("/api/footprints/uploads/{id}", upload).cookie(owner)).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM footprint_upload_frames WHERE upload_id=?", Integer.class, upload)).isZero();
        String expired = startUpload(owner, size, hash);
        mvc.perform(frame(expired, owner, 0, 0, size, size, payload, hash)).andExpect(status().isOk());
        jdbc.update("UPDATE footprint_upload_sessions SET expires_at=? WHERE id=?", Timestamp.from(Instant.now().minusSeconds(60)), expired);
        mvc.perform(get("/api/footprints/uploads/{id}", expired).cookie(owner)).andExpect(status().isGone());
        uploads.cleanup();
        mvc.perform(get("/api/footprints/uploads/{id}", expired).cookie(owner)).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM footprint_upload_frames WHERE upload_id=?", Integer.class, expired)).isZero();
    }

    @Test
    void publishesWebpAndRejectsAContainerWithoutAnImageChunk() throws Exception {
        Cookie owner = account("fp_frames_webp");
        byte[] webp = Files.readAllBytes(Path.of("..", "public", "images", "footprint-thumbs", "天津.webp"));
        String hash = FootprintUploads.sha256(webp);
        String upload = startUpload(owner, webp.length, hash, "image/webp");
        mvc.perform(frame(upload, owner, 0, 0, webp.length, webp.length, webp, hash)).andExpect(status().isOk());
        mvc.perform(finish(owner, upload)).andExpect(status().isCreated());
        mvc.perform(get("/api/footprints/{id}/image", upload).cookie(owner)).andExpect(content().contentType("image/webp"))
                .andExpect(content().bytes(webp));

        assertThat(new String(webp, 12, 4, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("VP8 ");
        System.arraycopy(new byte[]{'J', 'U', 'N', 'K'}, 0, webp, 12, 4);
        String invalidHash = FootprintUploads.sha256(webp);
        String invalid = startUpload(owner, webp.length, invalidHash, "image/webp");
        mvc.perform(frame(invalid, owner, 0, 0, webp.length, webp.length, webp, invalidHash)).andExpect(status().isOk());
        mvc.perform(finish(owner, invalid)).andExpect(status().isBadRequest());
    }

    private MockHttpServletRequestBuilder startUploadRequest(int size, String hash) throws Exception {
        return startUploadRequest(size, hash, "image/png");
    }

    private MockHttpServletRequestBuilder startUploadRequest(int size, String hash, String type) throws Exception {
        return post("/api/footprints/uploads").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("totalSize", size, "type", type, "sha256", hash)));
    }

    private String startUpload(Cookie owner, int size, String hash) throws Exception {
        return startUpload(owner, size, hash, "image/png");
    }

    private String startUpload(Cookie owner, int size, String hash, String type) throws Exception {
        var response = mvc.perform(startUploadRequest(size, hash, type).cookie(owner)).andExpect(status().isCreated()).andReturn();
        return json.readTree(response.getResponse().getContentAsString()).path("uploadId").asText();
    }

    private MockHttpServletRequestBuilder frame(String id, Cookie owner, int index, int offset, int length, int totalSize,
                                                byte[] data, String hash) {
        return put("/api/footprints/uploads/{id}/frames/{index}", id, index).cookie(owner)
                .contentType(MediaType.APPLICATION_OCTET_STREAM).header("X-Frame-Offset", offset).header("X-Frame-Length", length)
                .header("X-Upload-Size", totalSize).header("X-Frame-SHA256", hash).content(data);
    }

    private MockHttpServletRequestBuilder finish(Cookie owner, String id) throws Exception {
        return post("/api/footprints").cookie(owner).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(
                Map.of("uploadId", id, "province", "Anhui", "city", "Hefei", "date", "", "note", "", "themes", List.of())));
    }

    private static byte[] largePng() throws Exception {
        var image = new BufferedImage(380, 380, BufferedImage.TYPE_INT_RGB);
        var random = new Random(1);
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) image.setRGB(x, y, random.nextInt());
        }
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(image, "png", bytes);
        return bytes.toByteArray();
    }
}
