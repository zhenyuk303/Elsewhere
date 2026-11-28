package com.elsewhere;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ElsewhereApplication {
    public static void main(String[] args) {
        SpringApplication.run(ElsewhereApplication.class, args);
    }
}
