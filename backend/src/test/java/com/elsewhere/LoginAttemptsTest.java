package com.elsewhere;

import java.time.Duration;
import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class LoginAttemptsTest {
    @Test
    void throttlesPasswordSprayAndRecoversWithoutExtendingTheWindow() {
        var time = new AtomicLong();
        var limiter = new LoginAttempts(time::get);
        for (int count = 0; count < 30; count++) {
            var attempt = limiter.begin("account" + count, "192.0.2.10");
            assertThat(attempt).isNotNull();
            limiter.complete(attempt, LoginAttempts.Outcome.REJECTED);
        }
        assertThat(limiter.begin("other", "192.0.2.10")).isNull();
        assertThat(limiter.begin("other", "192.0.2.11")).isNotNull();
        time.set(Duration.ofMinutes(10).minusSeconds(1).toNanos());
        assertThat(limiter.begin("other", "192.0.2.10")).isNull();
        time.set(Duration.ofMinutes(10).toNanos());
        assertThat(limiter.begin("other", "192.0.2.10")).isNotNull();
    }

    @Test
    void reservesSlotsForConcurrentRequestsAndReleasesSuccessfulAttempts() {
        var limiter = new LoginAttempts();
        var pending = new ArrayList<LoginAttempts.Attempt>();
        for (int count = 0; count < 5; count++) {
            var attempt = limiter.begin("account", "192.0.2.10");
            assertThat(attempt).isNotNull();
            pending.add(attempt);
        }
        assertThat(limiter.begin("account", "192.0.2.10")).isNull();
        pending.forEach(attempt -> limiter.complete(attempt, LoginAttempts.Outcome.SIGNED_IN));
        assertThat(limiter.begin("account", "192.0.2.10")).isNotNull();
    }
}
