package com.elsewhere;

import java.io.IOException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ApiCacheFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getRequestURI().startsWith("/api/")) {
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("X-Content-Type-Options", "nosniff");
            if (request.getContentLengthLong() > 32L * 1024 * 1024) {
                response.setStatus(413);
                response.setContentType("application/json");
                response.getWriter().write("{\"message\":\"Request must be smaller than 32 MB\"}");
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
