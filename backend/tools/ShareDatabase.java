import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.time.LocalDate;
import java.util.*;

/** Schema-only database export plus explicitly curated public development fixtures. */
class ShareDatabase {
    private static final List<String> TABLES = List.of("users", "auth_sessions", "oauth_login_states",
            "oauth_identities", "footprint_libraries", "footprints", "footprint_imports");
    private static final Set<String> THEMES = Set.of("COAST", "MOUNTAINS", "CITY", "COUNTRYSIDE", "CULTURE", "FOOD", "WILDLIFE");

    public static void main(String[] args) throws Exception {
        if (args.length < 2) throw new IllegalArgumentException("Usage: ShareDatabase Export|Import file [ownerUsername]");
        Path repo = Path.of("..").toAbsolutePath().normalize();
        Properties local = new Properties();
        if (Files.exists(Path.of(".env"))) {
            try (var reader = Files.newBufferedReader(Path.of(".env"))) { local.load(reader); }
        }
        String url = setting("DB_URL", local, "jdbc:mysql://127.0.0.1:3306/elsewhere?characterEncoding=UTF-8&connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true");
        String username = setting("DB_USERNAME", local, "elsewhere");
        String password = setting("DB_PASSWORD", local, "");
        try (Connection db = DriverManager.getConnection(url, username, password)) {
            if (!db.getMetaData().getDatabaseProductName().equals("MySQL")) throw new IllegalStateException("A MySQL connection is required");
            try (Statement statement = db.createStatement()) { statement.execute("SET time_zone = '+00:00'"); }
            Path file = Path.of(args[1]).toAbsolutePath();
            switch (args[0]) {
                case "Export" -> export(db, repo, file);
                case "Import" -> importFile(db, file, args.length > 2 ? args[2] : "");
                default -> throw new IllegalArgumentException("Action must be Export or Import");
            }
        }
    }

    private static String setting(String key, Properties local, String fallback) {
        return System.getenv().getOrDefault(key, local.getProperty(key, fallback));
    }

    private static void export(Connection db, Path repo, Path output) throws Exception {
        StringBuilder sql = new StringBuilder("-- Elsewhere safe development snapshot v1\n"
                + "-- Structure of all seven tables. No live table rows are exported.\n"
                + "-- Fixtures come exclusively from database/dev-seeds.json.\n"
                + "-- Set @shared_owner_username to your own registered username before importing fixtures.\n"
                + "-- Existing tables and rows are preserved. No database name or credentials are embedded.\n"
                + "SET NAMES utf8mb4;\nSET time_zone = '+00:00';\n\n");
        for (String table : TABLES) {
            try (Statement query = db.createStatement(); ResultSet result = query.executeQuery("SHOW CREATE TABLE `" + table + "`")) {
                if (!result.next()) throw new IllegalStateException("Missing table " + table);
                String ddl = result.getString(2).replaceFirst("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
                        .replaceAll(" AUTO_INCREMENT=\\d+", "");
                sql.append(ddl).append(";\n\n");
            }
        }
        JsonNode fixtures = new ObjectMapper().readTree(repo.resolve("database/dev-seeds.json").toFile());
        if (!fixtures.isArray() || fixtures.size() == 0) throw new IllegalArgumentException("Development fixtures must be a nonempty array");
        Set<String> provinces = new HashSet<>();
        sql.append("START TRANSACTION;\nSELECT id FROM users WHERE username_key = @shared_owner_username FOR UPDATE;\n");
        for (JsonNode fixture : fixtures) {
            String province = text(fixture, "province", 40);
            String path = text(fixture, "imagePath", 255);
            String city = text(fixture, "city", 120);
            String day = text(fixture, "date", 10);
            String note = text(fixture, "note", 4000);
            if (!provinces.add(province)) throw new IllegalArgumentException("Duplicate province in development fixtures");
            if (!path.matches("/images/carousel/(?:%[0-9A-F]{2})+\\.webp")) throw new IllegalArgumentException("Only bundled public photographs can be exported");
            String filename = java.net.URLDecoder.decode(path.substring("/images/carousel/".length()), StandardCharsets.UTF_8);
            if (!Files.isRegularFile(repo.resolve("public/images/carousel").resolve(filename))) throw new IllegalArgumentException("Missing bundled photo");
            if (!day.isEmpty()) LocalDate.parse(day);
            JsonNode labels = fixture.get("themes");
            if (labels == null || !labels.isArray() || labels.size() > 7) throw new IllegalArgumentException("Invalid themes");
            List<String> themes = new ArrayList<>();
            for (JsonNode label : labels) {
                if (!THEMES.contains(label.asText())) throw new IllegalArgumentException("Unknown theme");
                themes.add(label.asText());
            }
            // Hex literals keep text safe under both NO_BACKSLASH_ESCAPES and the default SQL mode.
            String id = "CONCAT('seed:', u.id, ':', " + hex(province) + ")";
            sql.append("INSERT INTO footprints (id,user_id,province,city,photo_date,note,themes,image_path,image_data,image_type,created_at,updated_at)\nSELECT ")
                    .append(id).append(",u.id,").append(hex(province)).append(',').append(hex(city)).append(',')
                    .append(day.isEmpty() ? "NULL" : hex(day)).append(',').append(hex(note)).append(',')
                    .append(hex(String.join(",", themes))).append(',').append(hex(path))
                    .append(",NULL,NULL,'2026-01-01 00:00:00.000','2026-01-01 00:00:00.000'\n")
                    .append("FROM users u WHERE u.username_key = @shared_owner_username AND NOT EXISTS ")
                    .append("(SELECT 1 FROM footprints f WHERE f.id = ").append(id).append(");\n");
        }
        sql.append("INSERT INTO footprint_libraries (user_id) SELECT u.id FROM users u WHERE u.username_key = @shared_owner_username ")
                .append("AND NOT EXISTS (SELECT 1 FROM footprint_libraries l WHERE l.user_id = u.id);\nCOMMIT;\n");
        Files.createDirectories(output.getParent());
        Path temporary = Files.createTempFile(output.getParent(), "shared-", ".tmp");
        try {
            Files.writeString(temporary, sql, StandardCharsets.UTF_8);
            Files.move(temporary, output, StandardCopyOption.REPLACE_EXISTING);
        } finally { Files.deleteIfExists(temporary); }
        System.out.printf("Exported %d table definitions and %d curated fixtures. Live rows exported: 0.%n", TABLES.size(), fixtures.size());
    }

    private static String text(JsonNode fixture, String field, int max) {
        JsonNode value = fixture.get(field);
        if (value == null || !value.isTextual() || value.asText().length() > max) throw new IllegalArgumentException("Invalid fixture field " + field);
        return value.asText();
    }

    private static String hex(String text) {
        if (text.isEmpty()) return "''";
        return "CONVERT(0x" + HexFormat.of().formatHex(text.getBytes(StandardCharsets.UTF_8)) + " USING utf8mb4)";
    }

    private static void importFile(Connection db, Path file, String owner) throws Exception {
        String sql = Files.readString(file, StandardCharsets.UTF_8);
        if (!sql.startsWith("-- Elsewhere safe development snapshot v1\n")) throw new IllegalArgumentException("Use the SQL generated by this export tool");
        // Exported string values are hex literals. DDL and statements contain no quoted semicolons.
        List<String> statements = Arrays.stream(sql.replaceAll("(?m)^--[^\\n]*", "").split(";"))
                .map(String::trim).filter(value -> !value.isEmpty()).toList();
        for (String statement : statements) {
            if (!(statement.startsWith("CREATE TABLE IF NOT EXISTS ") || statement.startsWith("SET ")
                    || statement.equals("START TRANSACTION") || statement.equals("COMMIT")
                    || statement.startsWith("SELECT id FROM users WHERE ")
                    || statement.startsWith("INSERT INTO footprints (") || statement.startsWith("INSERT INTO footprint_libraries ("))) {
                throw new IllegalArgumentException("Unsupported statement. Import cancelled before executing SQL.");
            }
        }
        try (PreparedStatement setOwner = db.prepareStatement("SET @shared_owner_username = ?")) {
            setOwner.setString(1, owner.isBlank() ? null : owner.trim().toLowerCase(Locale.ROOT));
            setOwner.execute();
        }
        int inserted = 0;
        try (Statement statement = db.createStatement()) {
            for (String sqlStatement : statements) {
                if (sqlStatement.equals("START TRANSACTION")) {
                    if (!owner.isBlank()) {
                        try (PreparedStatement check = db.prepareStatement("SELECT id FROM users WHERE username_key = ?")) {
                            check.setString(1, owner.trim().toLowerCase(Locale.ROOT));
                            try (ResultSet user = check.executeQuery()) {
                                if (!user.next()) throw new IllegalArgumentException("Register your local account first, then import with its username. Schema has been created.");
                            }
                        }
                    }
                    db.setAutoCommit(false);
                } else if (sqlStatement.equals("COMMIT")) db.commit();
                else {
                    boolean result = statement.execute(sqlStatement);
                    if (result) { try (ResultSet rows = statement.getResultSet()) { while (rows.next()) { /* consume owner lock result */ } } }
                    else if (sqlStatement.startsWith("INSERT INTO footprints (")) inserted += statement.getUpdateCount();
                }
            }
        } catch (Exception error) {
            if (!db.getAutoCommit()) db.rollback();
            throw error;
        }
        System.out.printf("Imported schema. Added %d footprints. Existing rows preserved.%n", inserted);
        if (owner.isBlank()) System.out.println("No owner selected. Register locally and use -OwnerUsername to import development fixtures.");
    }
}
