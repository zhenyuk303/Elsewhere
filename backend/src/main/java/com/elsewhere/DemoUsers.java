package com.elsewhere;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "elsewhere.demo.enabled", havingValue = "true")
public class DemoUsers implements ApplicationRunner {
    private final AuthService auth;
    private final String password;

    public DemoUsers(AuthService auth, @Value("${elsewhere.demo.password:}") String password) {
        this.auth = auth;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (password.length() < 8) throw new IllegalStateException("Set ELSEWHERE_DEMO_PASSWORD (at least 8 characters) when enabling demo users");
        for (String username : new String[] {"traveler", "atlas", "rivers", "skyline"})
            auth.createDemoUser(username, password);
    }
}
