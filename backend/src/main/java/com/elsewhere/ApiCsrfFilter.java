package com.elsewhere;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
class ApiCsrfFilter extends OncePerRequestFilter {
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // The app uses same-origin fetch and has no cross-origin API permissions.
        // Cross-origin browser requests cannot send this header without an approved preflight.
        String path = request.getServletPath();
        if (path.isEmpty()) path = request.getRequestURI().substring(request.getContextPath().length());
        if (path.startsWith("/api/") && !SAFE_METHODS.contains(request.getMethod())
                && (!"1".equals(request.getHeader("X-Elsewhere-Request"))
                    || "cross-site".equals(request.getHeader("Sec-Fetch-Site")))) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.setHeader("Cache-Control", "no-store");
            response.getWriter().write("{\"message\":\"Request blocked by CSRF protection\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
