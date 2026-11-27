package com.elsewhere;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class FootprintUploads {
    static final int FRAME_SIZE = 256 * 1024;
    static final int MAX_SIZE = 4 * 1024 * 1024;
    private static final Duration RETENTION = Duration.ofHours(24);
    private static final Set<String> TYPES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");

    public record Start(int totalSize, @NotBlank String type,
                        @NotBlank @Pattern(regexp = "[0-9a-f]{64}") String sha256) {}
    public record Status(String uploadId, int frameSize, int frameCount, List<Integer> received, boolean completed) {}
    public record Ack(int frameIndex) {}
    private record Upload(String id, int size, String type, String sha256, boolean completed) {
        int count() { return (size + FRAME_SIZE - 1) / FRAME_SIZE; }
    }
    private record Frame(int index, byte[] data) {}

    private final JdbcTemplate jdbc;
    private final FootprintService footprints;

    public FootprintUploads(JdbcTemplate jdbc, FootprintService footprints) {
        this.jdbc = jdbc;
        this.footprints = footprints;
    }

    @Transactional
    public Status start(long owner, Start request) {
        if (request.totalSize > MAX_SIZE) throw error(HttpStatus.PAYLOAD_TOO_LARGE, "Prepared photo must be at most 4 MB");
        if (request.totalSize < 1 || !TYPES.contains(request.type)) throw badFrame("Upload a JPEG, PNG, GIF or WebP photo");
        jdbc.queryForObject("SELECT id FROM users WHERE id=? FOR UPDATE", Long.class, owner);
        int active = jdbc.queryForObject("SELECT COUNT(*) FROM footprint_upload_sessions WHERE user_id=? AND completed=FALSE AND expires_at>?",
                Integer.class, owner, Timestamp.from(Instant.now()));
        if (active >= 4) throw error(HttpStatus.TOO_MANY_REQUESTS, "Too many unfinished photo uploads");

        Upload upload = new Upload(UUID.randomUUID().toString(), request.totalSize, request.type, request.sha256, false);
        jdbc.update("INSERT INTO footprint_upload_sessions(id,user_id,total_size,image_type,sha256,expires_at,completed) VALUES (?,?,?,?,?,?,FALSE)",
                upload.id, owner, upload.size, upload.type, upload.sha256, expiresAt());
        return new Status(upload.id, FRAME_SIZE, upload.count(), List.of(), false);
    }

    @Transactional
    public Status status(long owner, String id) {
        Upload upload = lock(owner, id);
        List<Integer> received = upload.completed ? List.of() : jdbc.queryForList(
                "SELECT frame_index FROM footprint_upload_frames WHERE upload_id=? ORDER BY frame_index", Integer.class, id);
        return new Status(id, FRAME_SIZE, upload.count(), received, upload.completed);
    }

    static byte[] readFrame(InputStream input, int length) throws IOException {
        if (length < 1 || length > FRAME_SIZE) throw badFrame("Invalid frame length");
        byte[] data = input.readNBytes(length + 1);
        if (data.length != length) throw badFrame("Frame body length does not match");
        return data;
    }

    @Transactional
    public Ack receive(long owner, String id, int index, int offset, int totalSize, String sha256, byte[] data) {
        Upload upload = lock(owner, id);
        if (upload.completed) throw error(HttpStatus.CONFLICT, "Photo upload is already complete");
        if (index < 0 || index >= upload.count() || offset != index * FRAME_SIZE || totalSize != upload.size
                || data.length != Math.min(FRAME_SIZE, upload.size - offset)) {
            throw badFrame("Frame index, offset, length or total size does not match the upload");
        }
        if (!sha256(data).equals(sha256)) throw badFrame("Frame SHA-256 does not match");
        var existing = jdbc.queryForList("SELECT sha256 FROM footprint_upload_frames WHERE upload_id=? AND frame_index=?",
                String.class, id, index);
        if (existing.isEmpty()) {
            jdbc.update("INSERT INTO footprint_upload_frames(upload_id,frame_index,sha256,payload) VALUES (?,?,?,?)",
                    id, index, sha256, data);
        } else if (!existing.getFirst().equals(sha256)) {
            throw error(HttpStatus.CONFLICT, "This frame already has different data");
        }
        jdbc.update("UPDATE footprint_upload_sessions SET expires_at=? WHERE id=?", expiresAt(), id);
        return new Ack(index);
    }

    @Transactional
    public FootprintService.Photo complete(long owner, String id, FootprintService.Draft draft) {
        Upload upload = lock(owner, id);
        if (upload.completed) return footprints.get(owner, id);
        List<Frame> frames = jdbc.query("SELECT frame_index,payload FROM footprint_upload_frames WHERE upload_id=? ORDER BY frame_index",
                (rs, row) -> new Frame(rs.getInt(1), rs.getBytes(2)), id);
        if (frames.size() != upload.count()) throw error(HttpStatus.CONFLICT, "Some photo frames are still missing");
        byte[] data = new byte[upload.size];
        int offset = 0;
        for (int index = 0; index < frames.size(); index++) {
            Frame frame = frames.get(index);
            if (frame.index != index || frame.data.length != Math.min(FRAME_SIZE, upload.size - offset)) {
                throw badFrame("Stored photo frames could not be reassembled");
            }
            System.arraycopy(frame.data, 0, data, offset, frame.data.length);
            offset += frame.data.length;
        }
        if (!sha256(data).equals(upload.sha256)) throw badFrame("Complete photo SHA-256 does not match");
        var photo = footprints.createUploaded(owner, id, draft, new FootprintService.BinaryImage(data, upload.type));
        jdbc.update("DELETE FROM footprint_upload_frames WHERE upload_id=?", id);
        jdbc.update("UPDATE footprint_upload_sessions SET completed=TRUE, expires_at=? WHERE id=?", expiresAt(), id);
        return photo;
    }

    @Transactional
    public void cancel(long owner, String id) {
        if (!lock(owner, id).completed) jdbc.update("DELETE FROM footprint_upload_sessions WHERE id=?", id);
    }

    @Scheduled(fixedDelay = 600_000)
    public void cleanup() {
        jdbc.update("DELETE FROM footprint_upload_sessions WHERE expires_at<=?", Timestamp.from(Instant.now()));
    }

    private Upload lock(long owner, String id) {
        return jdbc.query("SELECT total_size,image_type,sha256,completed,expires_at FROM footprint_upload_sessions WHERE id=? AND user_id=? FOR UPDATE",
                (rs, row) -> {
                    if (!rs.getTimestamp("expires_at").toInstant().isAfter(Instant.now())) {
                        throw error(HttpStatus.GONE, "Photo upload has expired");
                    }
                    return new Upload(id, rs.getInt("total_size"), rs.getString("image_type"), rs.getString("sha256"), rs.getBoolean("completed"));
                }, id, owner).stream().findFirst().orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Photo upload not found"));
    }

    private static Timestamp expiresAt() { return Timestamp.from(Instant.now().plus(RETENTION)); }

    static String sha256(byte[] data) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data)); }
        catch (NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }

    private static ResponseStatusException badFrame(String message) { return error(HttpStatus.BAD_REQUEST, message); }
    private static ResponseStatusException error(HttpStatus status, String message) { return new ResponseStatusException(status, message); }
}
