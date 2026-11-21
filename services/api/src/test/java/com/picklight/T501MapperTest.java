package com.picklight;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import com.picklight.domain.post.Media;
import com.picklight.domain.post.Post;
import com.picklight.domain.post.PostStatus;
import com.picklight.domain.post.PostTag;
import com.picklight.domain.post.Tag;
import com.picklight.repository.MediaMapper;
import com.picklight.repository.PostMapper;
import com.picklight.repository.PostTagMapper;
import com.picklight.repository.TagMapper;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:t501;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password="
})
class T501MapperTest {
    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PostMapper posts;

    @Autowired
    private MediaMapper media;

    @Autowired
    private TagMapper tags;

    @Autowired
    private PostTagMapper postTags;

    @Test
    void mapsTablesAndEnforcesCompositeUniqueness() {
        jdbc.execute("CREATE TABLE users (id BIGINT PRIMARY KEY)");
        jdbc.execute("CREATE TABLE posts (id BIGINT AUTO_INCREMENT PRIMARY KEY, author_id BIGINT NOT NULL, body VARCHAR(2000), media_type VARCHAR(16), status VARCHAR(16) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, FOREIGN KEY (author_id) REFERENCES users(id))");
        jdbc.execute("CREATE TABLE media (id BIGINT AUTO_INCREMENT PRIMARY KEY, post_id BIGINT, uploader_id BIGINT NOT NULL, storage_key VARCHAR(255) NOT NULL UNIQUE, mime_type VARCHAR(127) NOT NULL, size_bytes BIGINT NOT NULL, sort_order INT NOT NULL, FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (uploader_id) REFERENCES users(id))");
        jdbc.execute("CREATE TABLE tags (id BIGINT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(191) NOT NULL UNIQUE)");
        jdbc.execute("CREATE TABLE post_tags (post_id BIGINT NOT NULL, tag_id BIGINT NOT NULL, PRIMARY KEY (post_id, tag_id), FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (tag_id) REFERENCES tags(id))");
        jdbc.update("INSERT INTO users (id) VALUES (?)", 1L);

        Post post = new Post();
        post.setAuthorId(1L);
        post.setBody("test post");
        post.setStatus(PostStatus.PUBLISHED);
        post.setCreatedAt(LocalDateTime.of(2026, 11, 21, 12, 0));
        post.setUpdatedAt(post.getCreatedAt());
        assertEquals(1, posts.insert(post));
        assertEquals(PostStatus.PUBLISHED, posts.selectById(post.getId()).getStatus());
        post.setStatus(PostStatus.HIDDEN);
        posts.updateById(post);
        assertEquals(PostStatus.HIDDEN, posts.selectById(post.getId()).getStatus());
        post.setStatus(PostStatus.DELETED);
        posts.updateById(post);
        assertEquals(PostStatus.DELETED, posts.selectById(post.getId()).getStatus());

        Media file = new Media();
        file.setUploaderId(1L);
        file.setPostId(post.getId());
        file.setStorageKey("test.jpg");
        file.setMimeType("image/jpeg");
        file.setSizeBytes(32L);
        file.setSortOrder(0);
        assertEquals(1, media.insert(file));
        assertEquals(post.getId(), media.selectById(file.getId()).getPostId());

        Tag tag = new Tag();
        tag.setName("test");
        assertEquals(1, tags.insert(tag));
        assertEquals("test", tags.selectById(tag.getId()).getName());

        PostTag link = new PostTag();
        link.setPostId(post.getId());
        link.setTagId(tag.getId());
        assertEquals(1, postTags.insert(link));
        assertEquals(tag.getId(), postTags.findByPostId(post.getId()).get(0).getTagId());
        assertThrows(DataIntegrityViolationException.class, () -> postTags.insert(link));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", -1L, tag.getId()));
        assertEquals(1, postTags.delete(post.getId(), tag.getId()));
    }
}
