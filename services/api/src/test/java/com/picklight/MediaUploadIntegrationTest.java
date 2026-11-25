package com.picklight;

import static org.junit.jupiter.api.Assertions.*;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.Principal;
import java.util.UUID;
import javax.imageio.ImageIO;

import jakarta.servlet.Filter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=${T502_MYSQL_URL}", "spring.datasource.username=${T502_MYSQL_USER}",
        "spring.datasource.password=${T502_MYSQL_PASSWORD}"
})
@EnabledIfEnvironmentVariable(named = "T502_MYSQL_URL", matches = ".+")
@Import(MediaUploadIntegrationTest.TestIdentity.class)
class MediaUploadIntegrationTest {
    @TempDir static Path directory;
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    private final HttpClient client = HttpClient.newHttpClient();
    private long userId;

    @DynamicPropertySource
    static void storage(DynamicPropertyRegistry properties) {
        properties.add("app.media.upload-dir", () -> directory.toString());
    }

    // Provides a servlet principal for the upload test only. Production authentication is upstream.
    @TestConfiguration
    static class TestIdentity {
        @Bean
        Filter testIdentity() {
            return (request, response, chain) -> {
                var http = (HttpServletRequest) request;
                String id = http.getHeader("X-Integration-User");
                if (id == null) {
                    chain.doFilter(request, response);
                    return;
                }
                chain.doFilter(new HttpServletRequestWrapper(http) {
                    @Override public Principal getUserPrincipal() { return () -> id; }
                }, response);
            };
        }
    }

    @BeforeEach
    void createTestUser() {
        String username = "t502-" + UUID.randomUUID();
        jdbc.update("INSERT INTO users(username, password_hash, created_at) VALUES (?, ?, NOW())",
                username, "integration-test");
        userId = jdbc.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, username);
    }

    @AfterEach
    void removeTestUser() {
        for (String key : jdbc.queryForList("SELECT storage_key FROM media WHERE uploader_id = ?", String.class, userId)) {
            try {
                Files.deleteIfExists(directory.resolve(key));
            } catch (IOException e) {
                throw new java.io.UncheckedIOException(e);
            }
        }
        jdbc.update("DELETE FROM media WHERE uploader_id = ?", userId);
        jdbc.update("DELETE FROM users WHERE id = ?", userId);
    }

    @Test
    void uploadReturnsStoredBytesAndOwner() throws Exception {
        var png = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(3, 3, BufferedImage.TYPE_INT_RGB), "png", png);
        assertRoundTrip("photo.PNG", png.toByteArray(), "image/png", "IMAGE");
        assertRoundTrip("clip.mp4", MediaValidatorTest.movie(60000), "video/mp4", "VIDEO");
    }

    private void assertRoundTrip(String name, byte[] bytes, String mime, String type) throws Exception {
        var response = post(name, bytes, userId);
        assertEquals(200, response.statusCode(), response.body());
        var data = json.readTree(response.body()).required("data");
        assertEquals(type, data.required("mediaType").asText());
        String url = data.required("url").asText();
        String key = jdbc.queryForObject("SELECT storage_key FROM media WHERE id=? AND uploader_id=? AND post_id IS NULL AND size_bytes=?",
                String.class, data.required("id").asLong(), userId, bytes.length);
        assertNotEquals(name, key);
        assertTrue(url.endsWith("/" + key));
        var get = client.send(HttpRequest.newBuilder(URI.create(url)).GET().build(), HttpResponse.BodyHandlers.ofByteArray());
        assertEquals(200, get.statusCode());
        assertEquals(mime, get.headers().firstValue("Content-Type").orElseThrow());
        assertArrayEquals(bytes, get.body());
    }

    @Test
    void invalidUploadsLeaveStorageAndDatabaseEmpty() throws Exception {
        assertError(post("photo.gif", new byte[]{1}, userId), 400, 40011);
        assertError(post("photo.jpg", new byte[10485761], userId), 400, 40010);
        assertError(post("clip.mp4", MediaValidatorTest.movie(61000), userId), 400, 40010);
        assertError(post("photo.png", new byte[0], userId), 400, 40000);
        assertError(post("photo.png", new byte[]{1}, null), 401, 40100);
        // A missing owner forces a foreign-key failure after the file was written.
        assertError(post("clip.mp4", MediaValidatorTest.movie(1000), Long.MAX_VALUE), 500, 50000);
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM media WHERE uploader_id=?", Integer.class, userId));
        try (var paths = Files.list(directory)) {
            assertEquals(0L, paths.count());
        }
    }

    private void assertError(HttpResponse<String> response, int status, int code) throws Exception {
        assertEquals(status, response.statusCode(), response.body());
        assertEquals(code, json.readTree(response.body()).required("code").asInt());
    }

    private HttpResponse<String> post(String name, byte[] bytes, Long identity) throws Exception {
        String boundary = UUID.randomUUID().toString();
        String prefix = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + name
                + "\"\r\nContent-Type: application/octet-stream\r\n\r\n";
        var body = HttpRequest.BodyPublishers.concat(HttpRequest.BodyPublishers.ofString(prefix),
                HttpRequest.BodyPublishers.ofByteArray(bytes), HttpRequest.BodyPublishers.ofString("\r\n--" + boundary + "--\r\n"));
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1/media/uploads"))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary).POST(body);
        if (identity != null) request.header("X-Integration-User", identity.toString());
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }
}
