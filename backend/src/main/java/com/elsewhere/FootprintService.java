package com.elsewhere;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class FootprintService {
    public enum Theme { COAST, MOUNTAINS, CITY, COUNTRYSIDE, CULTURE, FOOD, WILDLIFE }
    public record Image(@NotBlank @Size(max = 5_600_000) String src,
                        @Size(max = 5_600_000) String thumbnailSrc) {}
    public record Draft(@Valid Image image, @NotBlank @Size(max = 40) String province,
                        @NotNull @Size(max = 120) String city, @NotNull @Size(max = 10) String date,
                        @NotNull @Size(max = 4000) String note,
                        @NotNull @Size(max = 7) List<@NotNull Theme> themes, UUID uploadId) {
        Draft(Image image, String province, String city, String date, String note, List<Theme> themes) {
            this(image, province, city, date, note, themes, null);
        }
    }
    public record Photo(String id, long ownerId, Image image, String province, String city,
                        String date, String note, List<Theme> themes) {}
    public record Legacy(@NotBlank @Size(max = 128) String id, long ownerId,
                         @NotNull @Valid Image image, @NotBlank @Size(max = 40) String province,
                         @NotNull @Size(max = 120) String city, @NotNull @Size(max = 10) String date,
                         @NotNull @Size(max = 4000) String note,
                         @NotNull @Size(max = 7) List<@NotNull Theme> themes) {
        Draft draft() { return new Draft(image, province, city, date, note, themes); }
    }
    public record BinaryImage(byte[] data, String type) {}

    // Matches carouselData.ts. These are the existing bundled gallery photographs.
    static final Map<String, String> PROVINCES = Map.ofEntries(
            Map.entry("Anhui", "安徽"), Map.entry("Macau", "澳门"), Map.entry("Beijing", "北京"),
            Map.entry("Chongqing", "重庆"), Map.entry("Fujian", "福建"), Map.entry("Gansu", "甘肃"),
            Map.entry("Guangdong", "广东"), Map.entry("Guangxi", "广西"), Map.entry("Guizhou", "贵州"),
            Map.entry("Hainan", "海南"), Map.entry("Hebei", "河北"), Map.entry("Henan", "河南"),
            Map.entry("Heilongjiang", "黑龙江"), Map.entry("Hubei", "湖北"), Map.entry("Hunan", "湖南"),
            Map.entry("Jilin", "吉林"), Map.entry("Jiangsu", "江苏"), Map.entry("Jiangxi", "江西"),
            Map.entry("Liaoning", "辽宁"), Map.entry("Inner Mongolia", "内蒙古"), Map.entry("Ningxia", "宁夏"),
            Map.entry("Qinghai", "青海"), Map.entry("Shandong", "山东"), Map.entry("Shanxi", "山西"),
            Map.entry("Shaanxi", "陕西"), Map.entry("Shanghai", "上海"), Map.entry("Sichuan", "四川"),
            Map.entry("Taiwan", "台湾"), Map.entry("Tianjin", "天津"), Map.entry("Tibet", "西藏"),
            Map.entry("Hong Kong", "香港"), Map.entry("Xinjiang", "新疆"), Map.entry("Yunnan", "云南"),
            Map.entry("Zhejiang", "浙江"));
    private final JdbcTemplate jdbc;

    public FootprintService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public List<Photo> list(long owner) {
        initialize(owner);
        return jdbc.query("SELECT * FROM footprints WHERE user_id = ? ORDER BY created_at, id", this::map, owner);
    }

    private void initialize(long owner) {
        // Serializes first access and imports for this account without blocking other accounts.
        jdbc.queryForObject("SELECT id FROM users WHERE id = ? FOR UPDATE", Long.class, owner);
        if (jdbc.queryForObject("SELECT COUNT(*) FROM footprint_libraries WHERE user_id = ?", Integer.class, owner) != 0) return;
        jdbc.update("INSERT INTO footprint_libraries(user_id) VALUES (?)", owner);
        PROVINCES.keySet().stream().sorted().forEach(province -> insert(owner, "seed:" + owner + ":" + province,
                new Draft(new Image(bundled(province), bundled(province)), province, "", "", "", List.of())));
    }

    @Transactional
    public Photo create(long owner, Draft draft) {
        requireInlineImage(draft);
        initialize(owner);
        return insert(owner, UUID.randomUUID().toString(), draft);
    }

    @Transactional
    public Photo createUploaded(long owner, String id, Draft draft, BinaryImage image) {
        if (draft.image != null) throw invalid("Specify either an upload ID or an inline image");
        if (!validUploadedImage(image)) throw invalid("Upload a valid JPEG, PNG, GIF or WebP photo");
        initialize(owner);
        return insert(owner, id, draft, null, image);
    }

    private Photo insert(long owner, String id, Draft draft) {
        var image = image(draft.image.src());
        return insert(owner, id, draft, image == null ? draft.image.src : null, image);
    }

    private Photo insert(long owner, String id, Draft draft, String imagePath, BinaryImage image) {
        validate(draft);
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO footprints(id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at) "
                        + "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", id, owner, draft.province, draft.city.trim(), date(draft.date), draft.note,
                labels(draft), imagePath, image == null ? null : image.data,
                image == null ? null : image.type, now, now);
        return get(owner, id);
    }

    @Transactional
    public Photo update(long owner, String id, Draft draft) {
        Photo existing = get(owner, id);
        requireInlineImage(draft);
        validate(draft);
        if (draft.image.src.equals(existing.image.src)) {
            jdbc.update("UPDATE footprints SET province=?,city=?,photo_date=?,note=?,themes=?,updated_at=? WHERE id=? AND user_id=?",
                    draft.province, draft.city.trim(), date(draft.date), draft.note, labels(draft), Timestamp.from(Instant.now()), id, owner);
        } else {
            var image = image(draft.image.src);
            jdbc.update("UPDATE footprints SET province=?,city=?,photo_date=?,note=?,themes=?,image_path=?,image_data=?,image_type=?,updated_at=? WHERE id=? AND user_id=?",
                    draft.province, draft.city.trim(), date(draft.date), draft.note, labels(draft),
                    image == null ? draft.image.src : null, image == null ? null : image.data, image == null ? null : image.type,
                    Timestamp.from(Instant.now()), id, owner);
        }
        return get(owner, id);
    }

    public Photo get(long owner, String id) {
        return jdbc.query("SELECT * FROM footprints WHERE user_id=? AND id=?", this::map, owner, id)
                .stream().findFirst().orElseThrow(FootprintService::notFound);
    }

    @Transactional
    public void delete(long owner, String id) {
        if (jdbc.update("DELETE FROM footprints WHERE user_id=? AND id=?", owner, id) == 0) throw notFound();
    }

    public BinaryImage photo(long owner, String id) {
        return jdbc.query("SELECT image_data,image_type FROM footprints WHERE user_id=? AND id=? AND image_data IS NOT NULL",
                (rs, row) -> new BinaryImage(rs.getBytes(1), rs.getString(2)), owner, id)
                .stream().findFirst().orElseThrow(FootprintService::notFound);
    }

    @Transactional
    public List<Photo> importLegacy(long owner, List<Legacy> records) {
        initialize(owner);
        for (Legacy record : records) {
            if (record.ownerId != owner) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only import your own footprints");
            if (jdbc.queryForObject("SELECT COUNT(*) FROM footprint_imports WHERE user_id=? AND source_id=?", Integer.class, owner, record.id) != 0) continue;
            String seedId = "seed:" + owner + ":" + record.province;
            if (record.id.equals(seedId)) update(owner, seedId, record.draft());
            else insert(owner, UUID.randomUUID().toString(), record.draft());
            jdbc.update("INSERT INTO footprint_imports(user_id,source_id) VALUES (?,?)", owner, record.id);
        }
        return list(owner);
    }

    private Photo map(ResultSet rs, int row) throws SQLException {
        String id = rs.getString("id");
        String path = rs.getString("image_path");
        String src = path == null ? "/api/footprints/" + id + "/image" : path;
        String thumbnail = path == null ? src : path.replace("/carousel/", "/footprint-thumbs/");
        var day = rs.getDate("photo_date");
        String labels = rs.getString("themes");
        return new Photo(id, rs.getLong("user_id"), new Image(src, thumbnail), rs.getString("province"),
                rs.getString("city"), day == null ? "" : day.toLocalDate().toString(), rs.getString("note"),
                labels.isEmpty() ? List.of() : Arrays.stream(labels.split(",")).map(Theme::valueOf).toList());
    }

    private static String bundled(String province) {
        return "/images/carousel/" + java.net.URLEncoder.encode(PROVINCES.get(province), StandardCharsets.UTF_8) + ".webp";
    }

    private static String labels(Draft draft) {
        return draft.themes.stream().distinct().map(Theme::name).collect(java.util.stream.Collectors.joining(","));
    }

    private static void validate(Draft draft) {
        if (!PROVINCES.containsKey(draft.province)) throw invalid("Choose a supported province");
        date(draft.date);
    }

    private static void requireInlineImage(Draft draft) {
        if (draft.image == null || draft.uploadId != null) throw invalid("Upload a photo or keep the current image");
    }

    private static java.sql.Date date(String input) {
        if (input.isEmpty()) return null;
        try {
            if (!input.matches("\\d{4}-\\d{2}-\\d{2}")) throw invalid("Use YYYY-MM-DD for the photo date");
            LocalDate date = LocalDate.parse(input);
            if (date.getYear() < 1000) throw invalid("Photo year must be 1000 or later");
            return java.sql.Date.valueOf(date);
        } catch (DateTimeParseException ex) { throw invalid("Enter a valid photo date"); }
    }

    private static BinaryImage image(String src) {
        if (PROVINCES.keySet().stream().anyMatch(province -> bundled(province).equals(src))) return null;
        int separator = src.indexOf(";base64,");
        if (!src.startsWith("data:image/") || separator < 0) throw invalid("Upload a photo or keep the current image");
        String type = src.substring(5, separator);
        byte[] data;
        try { data = Base64.getDecoder().decode(src.substring(separator + 8)); }
        catch (IllegalArgumentException ex) { throw invalid("Invalid photo data"); }
        if (data.length > FootprintUploads.MAX_SIZE) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Prepared photo must be at most 4 MB");
        if (!validSignature(type, data)) throw invalid("Upload a valid JPEG, PNG, GIF or WebP photo");
        return new BinaryImage(data, type);
    }

    private static boolean validSignature(String type, byte[] data) {
        if (data.length < 12) return false;
        String start = new String(data, 0, 12, StandardCharsets.ISO_8859_1);
        return switch (type) {
            case "image/webp" -> start.startsWith("RIFF") && start.substring(8).equals("WEBP")
                    && Integer.toUnsignedLong(ByteBuffer.wrap(data, 4, 4).order(ByteOrder.LITTLE_ENDIAN).getInt()) + 8 == data.length;
            case "image/png" -> Arrays.equals(Arrays.copyOf(data, 8), new byte[]{(byte)137,80,78,71,13,10,26,10});
            case "image/jpeg" -> data[0] == (byte)255 && data[1] == (byte)216 && data[2] == (byte)255;
            case "image/gif" -> start.startsWith("GIF87a") || start.startsWith("GIF89a");
            default -> false;
        };
    }

    private static boolean validUploadedImage(BinaryImage image) {
        if (!validSignature(image.type, image.data)) return false;
        if (image.type.equals("image/webp")) return validWebp(image.data);
        try (var input = new javax.imageio.stream.MemoryCacheImageInputStream(new ByteArrayInputStream(image.data))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) return false;
            var reader = readers.next();
            try {
                reader.setInput(input);
                return (long) reader.getWidth(0) * reader.getHeight(0) <= 16_000_000 && reader.read(0) != null;
            } finally { reader.dispose(); }
        } catch (IOException ex) { return false; }
    }

    // The JDK has no built-in WebP decoder. Check the RIFF layout and the still-image bitstream header.
    private static boolean validWebp(byte[] data) {
        ByteBuffer bytes = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);
        boolean foundImage = false;
        int offset = 12;
        while (offset + 8 <= data.length) {
            String chunk = new String(data, offset, 4, StandardCharsets.US_ASCII);
            long length = Integer.toUnsignedLong(bytes.getInt(offset + 4));
            int start = offset + 8;
            long next = start + length + (length % 2);
            if (next > data.length) return false;
            if (chunk.equals("VP8 ") || chunk.equals("VP8L")) {
                if (foundImage) return false;
                foundImage = chunk.equals("VP8 ")
                        ? length > 10 && (data[start] & 1) == 0 && data[start + 3] == (byte) 0x9d && data[start + 4] == 1
                                && data[start + 5] == 0x2a && (bytes.getShort(start + 6) & 0x3fff) != 0
                                && (bytes.getShort(start + 8) & 0x3fff) != 0
                        : length > 5 && data[start] == 0x2f && (data[start + 4] & 0xe0) == 0;
                if (!foundImage) return false;
            }
            offset = (int) next;
        }
        return foundImage && offset == data.length;
    }

    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private static ResponseStatusException notFound() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Footprint not found"); }
}
