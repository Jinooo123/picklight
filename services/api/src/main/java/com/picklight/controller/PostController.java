package com.picklight.controller;

import java.security.Principal;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.picklight.common.BizException;
import com.picklight.common.ErrorCode;
import com.picklight.common.Result;
import com.picklight.service.post.PostPublishService;
import com.picklight.service.post.PublishPostRequest;

@RestController
@RequestMapping("/api/v1/posts")
public class PostController {
    private final PostPublishService posts;

    public PostController(PostPublishService posts) {
        this.posts = posts;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public Result publish(@RequestBody ObjectNode json, Principal principal) {
        if (principal == null) throw new BizException(ErrorCode.UNAUTHORIZED);
        long userId;
        try {
            userId = Long.parseLong(principal.getName());
        } catch (NumberFormatException e) {
            throw new BizException(ErrorCode.UNAUTHORIZED);
        }
        if (userId <= 0) throw new BizException(ErrorCode.UNAUTHORIZED);

        String mediaBaseUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/v1/media/files/").build().toUriString();
        return Result.ok(posts.publish(userId, PublishPostRequest.from(json), mediaBaseUrl));
    }
}
