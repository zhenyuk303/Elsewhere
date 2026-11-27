package com.elsewhere;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.function.LongSupplier;
import org.springframework.stereotype.Component;

@Component
class LoginAttempts {
    private static final int ACCOUNT_IP_LIMIT = 5;
    private static final int IP_LIMIT = 30;
    private static final int MAX_KEYS = 10_000;
    private static final long WINDOW = Duration.ofMinutes(10).toNanos();
    private static final long CLEANUP_INTERVAL = Duration.ofMinutes(1).toNanos();
    private final Map<String, Window> addresses = new HashMap<>();
    private final Map<AccountAddress, Window> accounts = new HashMap<>();
    private final LongSupplier ticker;
    private long lastCleanup;

    LoginAttempts() {
        this(System::nanoTime);
    }

    LoginAttempts(LongSupplier ticker) {
        this.ticker = ticker;
        lastCleanup = ticker.getAsLong();
    }

    private record AccountAddress(String username, String address) {}

    private static final class Window {
        private final long started;
        private int failures;
        private int pending;

        private Window(long started) {
            this.started = started;
        }

        private boolean expired(long now) {
            return pending == 0 && now - started >= WINDOW;
        }

        private boolean full(int limit) {
            return failures + pending >= limit;
        }
    }

    // Reserve a slot before hashing so concurrent requests cannot bypass the limit.
    synchronized Attempt begin(String username, String address) {
        long now = ticker.getAsLong();
        if (now - lastCleanup >= CLEANUP_INTERVAL) {
            addresses.values().removeIf(window -> window.expired(now));
            accounts.values().removeIf(window -> window.expired(now));
            lastCleanup = now;
        }
        var key = new AccountAddress(username, address);
        Window ip = current(addresses, address, now);
        Window account = current(accounts, key, now);
        if (ip == null ? addresses.size() >= MAX_KEYS : ip.full(IP_LIMIT)) return null;
        if (account == null ? accounts.size() >= MAX_KEYS : account.full(ACCOUNT_IP_LIMIT)) return null;
        ip = addresses.computeIfAbsent(address, ignored -> new Window(now));
        account = accounts.computeIfAbsent(key, ignored -> new Window(now));
        ip.pending++;
        account.pending++;
        return new Attempt(address, key, ip, account);
    }

    private static <K> Window current(Map<K, Window> windows, K key, long now) {
        Window window = windows.get(key);
        if (window != null && window.expired(now)) {
            windows.remove(key);
            return null;
        }
        return window;
    }

    record Attempt(String address, AccountAddress key, Window ip, Window account) {}

    enum Outcome { REJECTED, SIGNED_IN, ABORTED }

    synchronized void complete(Attempt attempt, Outcome outcome) {
        Window ip = attempt.ip();
        Window account = attempt.account();
        ip.pending--;
        account.pending--;
        if (outcome == Outcome.REJECTED) {
            ip.failures++;
            account.failures++;
        } else if (outcome == Outcome.SIGNED_IN) {
            account.failures = 0;
        }
        if (ip.failures == 0 && ip.pending == 0) addresses.remove(attempt.address());
        if (account.failures == 0 && account.pending == 0) accounts.remove(attempt.key());
    }
}
