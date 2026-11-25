package com.picklight.service.post;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.picklight.common.BizException;
import com.picklight.common.ErrorCode;
import com.picklight.domain.post.Media;
import com.picklight.domain.post.Post;
import com.picklight.domain.post.PostStatus;
import com.picklight.domain.post.PostTag;
import com.picklight.domain.post.Tag;
import com.picklight.repository.MediaMapper;
import com.picklight.repository.PostMapper;
import com.picklight.repository.PostPublishMapper;
import com.picklight.repository.PostTagMapper;

@Service
public class PostPublishService {
    private final PostMapper posts;
    private final MediaMapper files;
    private final PostTagMapper links;
    private final PostPublishMapper publishing;

    public PostPublishService(PostMapper posts, MediaMapper files, PostTagMapper links, PostPublishMapper publishing) {
        this.posts = posts;
        this.files = files;
        this.links = links;
        this.publishing = publishing;
    }

    @Transactional
    public PublishedPost publish(long authorId, PublishPostRequest request, String mediaBaseUrl) {
        String status = publishing.accountStatus(authorId);
        if (status == null || "DELETED".equals(status)) throw new BizException(ErrorCode.UNAUTHORIZED);
        if (!"ACTIVE".equals(status)) throw new BizException(ErrorCode.ACCOUNT_DISABLED);

        List<MediaItem> media = loadMedia(authorId, request.mediaIds(), mediaBaseUrl);
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        Post post = new Post();
        post.setAuthorId(authorId);
        post.setBody(request.body());
        post.setMediaType(media.isEmpty() ? null : media.get(0).mediaType());
        post.setStatus(PostStatus.PUBLISHED);
        post.setCreatedAt(LocalDateTime.ofInstant(now, ZoneOffset.UTC));
        post.setUpdatedAt(post.getCreatedAt());
        posts.insert(post);

        // Acquire row locks in stable order but store the client's original ordering.
        for (long id : request.mediaIds().stream().sorted().toList()) {
            if (publishing.attach(id, authorId, post.getId(), request.mediaIds().indexOf(id)) != 1) {
                throw new BizException(ErrorCode.CONFLICT, "媒体已被其他动态引用");
            }
        }
        List<String> tags = linkTags(post.getId(), request.tags());
        OffsetDateTime time = now.atZone(ZoneId.of("Asia/Shanghai")).toOffsetDateTime();
        return new PublishedPost(post.getId(), authorId, post.getBody(), tags, media, post.getStatus(),
                time, time, 0, 0, 0);
    }

    private List<MediaItem> loadMedia(long authorId, List<Long> ids, String baseUrl) {
        if (ids.isEmpty()) return List.of();
        var byId = new HashMap<Long, Media>();
        for (Media file : files.selectList(Wrappers.<Media>lambdaQuery().in(Media::getId, ids))) {
            byId.put(file.getId(), file);
        }
        var items = new ArrayList<MediaItem>();
        for (long id : ids) {
            Media file = byId.get(id);
            if (file == null) throw new BizException(ErrorCode.BAD_REQUEST, "所选媒体不存在");
            if (file.getUploaderId() != authorId) throw new BizException(ErrorCode.FORBIDDEN, "不能引用他人上传的媒体");
            if (file.getPostId() != null) throw new BizException(ErrorCode.CONFLICT, "媒体已关联动态");
            String type = switch (file.getMimeType()) {
                case "image/jpeg", "image/png", "image/webp" -> "IMAGE";
                case "video/mp4" -> "VIDEO";
                default -> throw new BizException(ErrorCode.MEDIA_TYPE_UNSUPPORTED);
            };
            if (type.equals("VIDEO") && ids.size() != 1) {
                throw new BizException(ErrorCode.BAD_REQUEST, "视频只能单独发布");
            }
            items.add(new MediaItem(id, baseUrl + file.getStorageKey(), type));
        }
        return items;
    }

    private List<String> linkTags(long postId, List<String> names) {
        Map<String, Tag> byName = new HashMap<>();
        for (String name : names.stream().sorted(String.CASE_INSENSITIVE_ORDER).toList()) {
            publishing.ensureTag(name);
            byName.put(name, publishing.findTag(name));
        }

        // MySQL collation may consider two different spellings the same tag.
        var unique = new LinkedHashMap<Long, String>();
        for (String name : names) {
            Tag tag = byName.get(name);
            if (unique.putIfAbsent(tag.getId(), tag.getName()) == null) {
                PostTag link = new PostTag();
                link.setPostId(postId);
                link.setTagId(tag.getId());
                links.insert(link);
            }
        }
        return List.copyOf(unique.values());
    }

    public record MediaItem(long id, String url, String mediaType) {}
    public record PublishedPost(long id, long authorId, String body, List<String> tags, List<MediaItem> media,
            PostStatus status, OffsetDateTime createdAt, OffsetDateTime updatedAt,
            int averageScore, int ratingCount, int commentCount) {}
}
