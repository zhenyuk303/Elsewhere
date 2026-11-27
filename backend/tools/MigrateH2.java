import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.Properties;

/** Run from backend/ against a new MySQL database after schema initialization. */
class MigrateH2 {
    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("Pass the absolute H2 database path without .mv.db");
        var config = new Properties();
        if (Files.exists(Path.of(".env"))) {
            try (var reader = Files.newBufferedReader(Path.of(".env"))) { config.load(reader); }
        }
        String url = System.getenv().getOrDefault("DB_URL", config.getProperty("DB_URL", "jdbc:mysql://127.0.0.1:3306/elsewhere?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true"));
        String username = System.getenv().getOrDefault("DB_USERNAME", config.getProperty("DB_USERNAME", "elsewhere"));
        String password = System.getenv().getOrDefault("DB_PASSWORD", config.getProperty("DB_PASSWORD", ""));
        try (var source = DriverManager.getConnection("jdbc:h2:file:" + args[0].replace('\\', '/')
                + ";IFEXISTS=TRUE;ACCESS_MODE_DATA=r;MODE=MySQL;DATABASE_TO_LOWER=TRUE", "sa", "");
             var target = DriverManager.getConnection(url, username, password)) {
            target.setAutoCommit(false);
            try {
                try (var check = target.createStatement(); var existing = check.executeQuery("SELECT id FROM users FOR UPDATE")) {
                    if (existing.next()) throw new IllegalStateException("Target users table must be empty. No records changed.");
                }
                int users = 0;
                try (var query = source.createStatement(); var rows = query.executeQuery("SELECT * FROM users ORDER BY id");
                     var insert = target.prepareStatement("INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES (?,?,?,?,?)")) {
                    while (rows.next()) {
                        insert.setLong(1, rows.getLong("id"));
                        insert.setString(2, rows.getString("username"));
                        insert.setString(3, rows.getString("username_key"));
                        insert.setString(4, rows.getString("password_hash"));
                        insert.setTimestamp(5, rows.getTimestamp("created_at"));
                        insert.executeUpdate();
                        users++;
                    }
                }
                int identities = 0;
                try (var query = source.createStatement(); var rows = query.executeQuery("SELECT * FROM oauth_identities");
                     var insert = target.prepareStatement("INSERT INTO oauth_identities(provider,app_id,provider_user_id,user_id,created_at) VALUES (?,?,?,?,?)")) {
                    while (rows.next()) {
                        insert.setString(1, rows.getString("provider"));
                        insert.setString(2, rows.getString("app_id"));
                        insert.setString(3, rows.getString("provider_user_id"));
                        insert.setLong(4, rows.getLong("user_id"));
                        insert.setTimestamp(5, rows.getTimestamp("created_at"));
                        insert.executeUpdate();
                        identities++;
                    }
                }
                target.commit();
                System.out.printf("Migrated %d users and %d OAuth identities. Sign in again to create new sessions.%n", users, identities);
            } catch (Exception error) {
                target.rollback();
                throw error;
            }
        }
    }
}
