package com.picklight.controller;

import java.io.IOException;
import java.security.Principal;
import java.util.List;

import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.picklight.common.BizException;
import com.picklight.common.ErrorCode;
import com.picklight.common.Result;
import com.picklight.domain.post.Media;
import com.picklight.service.media.MediaUploadService;

@RestController
@RequestMapping("/api/v1/media")
public class MediaController {
    private final MediaUploadService uploads;

    public MediaController(MediaUploadService uploads) {
        this.uploads = uploads;
    }

    @PostMapping(path = "/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result upload(MultipartHttpServletRequest request, Principal principal) throws IOException {
        if (principal == null) {
            throw new BizException(ErrorCode.UNAUTHORIZED);
        }
        long uploaderId;
        try {
            uploaderId = Long.parseLong(principal.getName());
        } catch (NumberFormatException e) {
            throw new BizException(ErrorCode.UNAUTHORIZED);
        }
        if (uploaderId <= 0) {
            throw new BizException(ErrorCode.UNAUTHORIZED);
        }

        List<MultipartFile> files = request.getFiles("file");
        if (files.size() != 1 || request.getMultiFileMap().size() != 1) {
            throw new BizException(ErrorCode.BAD_REQUEST, "请使用 file 字段上传一个文件");
        }

        Media media = uploads.save(uploaderId, files.get(0));
        String url = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/v1/media/files/{key}").buildAndExpand(media.getStorageKey()).toUriString();
        String type = media.getMimeType().startsWith("image/") ? "IMAGE" : "VIDEO";
        return Result.ok(new UploadResult(media.getId(), url, type));
    }

    @GetMapping("/files/{key}")
    public ResponseEntity<Resource> read(@PathVariable String key) {
        MediaUploadService.StoredFile file = uploads.read(key);
        return ResponseEntity.ok().header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(file.mimeType())).body(file.content());
    }

    public record UploadResult(long id, String url, String mediaType) {}
}
