package com.picklight;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDateTime;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.picklight.domain.post.Media;
import com.picklight.domain.post.Post;
import com.picklight.domain.post.PostStatus;
import com.picklight.domain.post.PostTag;
import com.picklight.domain.post.Tag;
import com.picklight.repository.MediaMapper;
import com.picklight.repository.PostMapper;
import com.picklight.repository.PostTagMapper;
import com.picklight.repository.TagMapper;

@EnabledIfEnvironmentVariable(named = "T501_MYSQL_URL", matches = ".+")
@SpringBootTest(properties = {
        "spring.datasource.url=${T501_MYSQL_URL}",
        "spring.datasource.username=${T501_MYSQL_USER}",
        "spring.datasource.password=${T501_MYSQL_PASSWORD}"
})
@Transactional
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
        String username = "t501-" + UUID.randomUUID();
        jdbc.update("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
                username, "test-only");
        Long authorId = jdbc.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, username);

        Post post = new Post();
        post.setAuthorId(authorId);
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
        file.setUploaderId(authorId);
        file.setPostId(post.getId());
        file.setStorageKey(username + ".jpg");
        file.setMimeType("image/jpeg");
        file.setSizeBytes(32L);
        file.setSortOrder(0);
        assertEquals(1, media.insert(file));
        assertEquals(post.getId(), media.selectById(file.getId()).getPostId());

        Tag tag = new Tag();
        tag.setName(username);
        assertEquals(1, tags.insert(tag));
        assertEquals(username, tags.selectById(tag.getId()).getName());

        PostTag link = new PostTag();
        link.setPostId(post.getId());
        link.setTagId(tag.getId());
        assertEquals(1, postTags.insert(link));
        assertEquals(tag.getId(), postTags.findByPostId(post.getId()).get(0).getTagId());
        assertThrows(DataIntegrityViolationException.class, () -> postTags.insert(link));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", -1L, tag.getId()));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", post.getId(), -1L));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "UPDATE posts SET author_id = -1 WHERE id = ?", post.getId()));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "UPDATE media SET uploader_id = -1 WHERE id = ?", file.getId()));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "UPDATE media SET post_id = -1 WHERE id = ?", file.getId()));
        assertEquals(1, postTags.delete(post.getId(), tag.getId()));
    }
}
