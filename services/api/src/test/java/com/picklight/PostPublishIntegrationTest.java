package com.picklight;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.picklight.domain.post.PostTag;
import com.picklight.repository.PostTagMapper;

@EnabledIfEnvironmentVariable(named = "T504_MYSQL_URL", matches = ".+")
@SpringBootTest(properties = {
        "spring.datasource.url=${T504_MYSQL_URL}", "spring.datasource.username=${T504_MYSQL_USER}",
        "spring.datasource.password=${T504_MYSQL_PASSWORD}"
})
@AutoConfigureMockMvc
class PostPublishIntegrationTest {
    @TempDir static Path uploads;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate db;
    @Autowired ObjectMapper json;
    @MockitoSpyBean PostTagMapper links;
    long owner;
    long other;
    String tag;

    @DynamicPropertySource
    static void directory(DynamicPropertyRegistry props) {
        props.add("app.media.upload-dir", () -> uploads.toString());
    }

    @BeforeEach
    void setup() {
        owner = user();
        other = user();
        tag = UUID.randomUUID().toString().substring(0, 8);
    }

    private long user() {
        String name = UUID.randomUUID().toString();
        db.update("INSERT INTO users(username,password_hash,created_at) VALUES (?, 'test', UTC_TIMESTAMP())", name);
        return db.queryForObject("SELECT id FROM users WHERE username=?", Long.class, name);
    }

    @AfterEach
    void cleanup() throws Exception {
        for (String key : db.queryForList("SELECT storage_key FROM media WHERE uploader_id IN (?,?)", String.class, owner, other)) {
            Files.deleteIfExists(uploads.resolve(key));
        }
        db.update("DELETE FROM media WHERE uploader_id IN (?,?)", owner, other);
        db.update("DELETE pt FROM post_tags pt JOIN posts p ON p.id=pt.post_id WHERE p.author_id IN (?,?)", owner, other);
        db.update("DELETE FROM posts WHERE author_id IN (?,?)", owner, other);
        db.update("DELETE FROM tags WHERE name=?", tag);
        db.update("DELETE FROM users WHERE id IN (?,?)", owner, other);
    }

    private ResultActions publish(long actor, Map<String, ?> payload) throws Exception {
        return mvc.perform(post("/api/v1/posts").principal(() -> Long.toString(actor))
                .contentType("application/json").content(json.writeValueAsBytes(payload)));
    }

    private JsonNode data(ResultActions result) throws Exception {
        return json.readTree(result.andExpect(status().isOk()).andExpect(jsonPath("$.code").value(0))
                .andReturn().getResponse().getContentAsByteArray()).required("data");
    }

    private long file(long uploader, String mime) {
        String key = UUID.randomUUID().toString();
        db.update("INSERT INTO media(uploader_id, storage_key, mime_type, size_bytes) VALUES (?,?,?,1)", uploader, key, mime);
        return db.queryForObject("SELECT id FROM media WHERE storage_key=?", Long.class, key);
    }

    private int postCount() {
        return db.queryForObject("SELECT COUNT(*) FROM posts WHERE author_id=?", Integer.class, owner);
    }

    @Test
    void textOnlyAndLimits() throws Exception {
        var post = data(publish(owner, Map.of("body", "纯文字", "tags", List.of(tag, " " + tag + " "))));
        assertEquals(1, post.required("tags").size());
        assertEquals(0, post.required("media").size());
        assertEquals("PUBLISHED", post.required("status").asText());
        assertEquals(owner, post.required("authorId").asLong());
        assertEquals("纯文字", post.required("body").asText());
        assertEquals(post.required("createdAt"), post.required("updatedAt"));
        var createdAt = java.time.OffsetDateTime.parse(post.required("createdAt").asText());
        var storedAt = db.queryForObject("SELECT created_at FROM posts WHERE id=?",
                java.time.LocalDateTime.class, post.required("id").asLong());
        assertEquals(storedAt.toInstant(java.time.ZoneOffset.UTC), createdAt.toInstant());
        assertEquals(0, post.required("averageScore").intValue());
        assertEquals(0, post.required("ratingCount").intValue());
        assertEquals(0, post.required("commentCount").intValue());
        assertEquals(1, db.queryForObject("SELECT COUNT(*) FROM post_tags WHERE post_id=?", Integer.class, post.required("id").asLong()));
        publish(owner, Map.of("body", "　", "tags", List.of(tag))).andExpect(status().isBadRequest());
        publish(owner, Map.of("body", "hi", "tags", List.of("1","2","3","4","5","6"))).andExpect(status().isBadRequest());
        assertEquals(1, postCount());
    }

    @Test
    void publishUploadedImageAndReadItBack() throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(3, 3, BufferedImage.TYPE_INT_RGB), "png", bytes);
        JsonNode uploaded = data(mvc.perform(multipart("/api/v1/media/uploads")
                .file(new MockMultipartFile("file", "photo.png", "image/png", bytes.toByteArray()))
                .principal(() -> Long.toString(owner))));
        long first = uploaded.required("id").asLong();
        long second = file(owner, "image/webp");
        var created = data(publish(owner, Map.of("mediaIds", List.of(second, first))));
        long postId = created.required("id").asLong();
        assertEquals(List.of(second, first), db.queryForList(
                "SELECT id FROM media WHERE post_id=? ORDER BY sort_order", Long.class, postId));
        assertEquals(first, created.required("media").get(1).required("id").asLong());
        String url = created.required("media").get(1).required("url").asText();
        assertEquals(uploaded.required("url").asText(), url);
        mvc.perform(get(java.net.URI.create(url))).andExpect(status().isOk()).andExpect(content().bytes(bytes.toByteArray()));
    }

    @Test
    void rejectsUnauthorizedForeignMissingAndMixedMedia() throws Exception {
        mvc.perform(post("/api/v1/posts").contentType("application/json").content("{\"body\":\"hello\"}"))
                .andExpect(status().isUnauthorized());
        long own = file(owner, "image/png");
        long video = file(owner, "video/mp4");
        long foreign = file(other, "image/png");
        publish(owner, Map.of("mediaIds", List.of(own, foreign))).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(40300));
        publish(owner, Map.of("mediaIds", List.of(Long.MAX_VALUE))).andExpect(status().isBadRequest());
        publish(owner, Map.of("mediaIds", List.of(own, video))).andExpect(status().isBadRequest());
        publish(owner, Map.of("mediaIds", List.of(video, file(owner, "video/mp4")))).andExpect(status().isBadRequest());
        assertEquals(0, postCount());
        assertEquals("VIDEO", data(publish(owner, Map.of("mediaIds", List.of(video)))).required("media").get(0).required("mediaType").asText());
    }

    @Test
    void acceptsNineImagesAndRejectsReuse() throws Exception {
        var ids = new java.util.ArrayList<Long>();
        for (int i = 0; i < 9; i++) ids.add(file(owner, "image/png"));
        assertEquals(9, data(publish(owner, Map.of("mediaIds", ids))).required("media").size());
        publish(owner, Map.of("mediaIds", ids)).andExpect(status().isConflict());
        ids.add(file(owner, "image/png"));
        publish(owner, Map.of("mediaIds", ids)).andExpect(status().isBadRequest());
        assertEquals(1, postCount());
    }

    @Test
    void sharedTagIsReusedAcrossAuthorsAndDisabledUserCannotPublish() throws Exception {
        data(publish(owner, Map.of("body", "一", "tags", List.of(tag))));
        data(publish(other, Map.of("body", "二", "tags", List.of(tag))));
        assertEquals(1, db.queryForObject("SELECT COUNT(*) FROM tags WHERE name=?", Integer.class, tag));
        assertEquals(2, db.queryForObject("SELECT COUNT(*) FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE t.name=?", Integer.class, tag));
        db.update("UPDATE users SET status='DISABLED' WHERE id=?", owner);
        publish(owner, Map.of("body", "三")).andExpect(status().isForbidden());
        assertEquals(1, postCount());
    }

    @Test
    void lateDatabaseFailureRollsBackPostAttachmentAndNewTag() throws Exception {
        long id = file(owner, "image/png");
        // Exercise a real InnoDB FK error at the last write, after all earlier writes succeeded.
        doAnswer(call -> {
            PostTag link = call.getArgument(0);
            return db.update("INSERT INTO post_tags(post_id,tag_id) VALUES (?,-1)", link.getPostId());
        }).when(links).insert(any(PostTag.class));
        publish(owner, Map.of("tags", List.of(tag), "mediaIds", List.of(id))).andExpect(status().isInternalServerError());
        assertEquals(0, postCount());
        assertEquals(0, db.queryForObject("SELECT COUNT(*) FROM tags WHERE name=?", Integer.class, tag));
        assertNull(db.queryForObject("SELECT post_id FROM media WHERE id=?", Long.class, id));
    }

    @Test
    void concurrentPublishCannotClaimSameUploadTwice() throws Exception {
        long id = file(owner, "image/jpeg");
        var start = new CountDownLatch(1);
        Callable<Integer> publish = () -> {
            start.await(10, TimeUnit.SECONDS);
            return publish(owner, Map.of("mediaIds", List.of(id))).andReturn().getResponse().getStatus();
        };
        var pool = Executors.newFixedThreadPool(2);
        try {
            var first = pool.submit(publish);
            var second = pool.submit(publish);
            start.countDown();
            assertEquals(List.of(200, 409), java.util.stream.Stream.of(
                    first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS)).sorted().toList());
            assertEquals(1, postCount());
        } finally {
            pool.shutdownNow();
        }
    }
}
