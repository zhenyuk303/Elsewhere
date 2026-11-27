package com.elsewhere;

import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

final class ApiTestRequests {
    private ApiTestRequests() {}

    static MockHttpServletRequestBuilder post(String path, Object... variables) {
        return MockMvcRequestBuilders.post(path, variables).header("X-Elsewhere-Request", "1");
    }

    static MockHttpServletRequestBuilder put(String path, Object... variables) {
        return MockMvcRequestBuilders.put(path, variables).header("X-Elsewhere-Request", "1");
    }

    static MockHttpServletRequestBuilder delete(String path, Object... variables) {
        return MockMvcRequestBuilders.delete(path, variables).header("X-Elsewhere-Request", "1");
    }
}
