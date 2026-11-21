package com.picklight.service.media;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import com.picklight.common.BizException;
import com.picklight.common.ErrorCode;

/**
 * Checks a selected file before the upload service creates a destination file.
 * The final limits and whitelist must be agreed in the API contract.
 */
@Component
public class MediaValidator {

    private final long maxImageBytes;
    private final long maxVideoBytes;

    public MediaValidator(
            @Value("${app.media.max-image-bytes:10485760}") long maxImageBytes,
            @Value("${app.media.max-video-bytes:104857600}") long maxVideoBytes) {
        this.maxImageBytes = maxImageBytes;
        this.maxVideoBytes = maxVideoBytes;
    }

    public ValidatedMedia validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BizException(ErrorCode.BAD_REQUEST, "请选择非空文件");
        }

        String filename = file.getOriginalFilename();
        int dot = filename == null ? -1 : filename.lastIndexOf('.');
        String extension = dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        String mediaType;
        String mimeType;
        long maxBytes;
        switch (extension) {
            case "jpg", "jpeg" -> {
                mediaType = "IMAGE";
                mimeType = "image/jpeg";
                maxBytes = maxImageBytes;
            }
            case "png" -> {
                mediaType = "IMAGE";
                mimeType = "image/png";
                maxBytes = maxImageBytes;
            }
            case "webp" -> {
                mediaType = "IMAGE";
                mimeType = "image/webp";
                maxBytes = maxImageBytes;
            }
            case "mp4" -> {
                mediaType = "VIDEO";
                mimeType = "video/mp4";
                maxBytes = maxVideoBytes;
            }
            default -> throw new BizException(ErrorCode.MEDIA_TYPE_UNSUPPORTED);
        }

        if (file.getSize() > maxBytes) {
            throw new BizException(ErrorCode.MEDIA_TOO_LARGE);
        }
        byte[] header;
        try (InputStream input = file.getInputStream()) {
            header = input.readNBytes(12);
        } catch (IOException exception) {
            throw new BizException(ErrorCode.BAD_REQUEST, "无法读取文件");
        }
        if (!matchesHeader(extension, header)) {
            throw new BizException(ErrorCode.MEDIA_TYPE_UNSUPPORTED);
        }
        return new ValidatedMedia(extension, mimeType, mediaType);
    }

    private boolean matchesHeader(String extension, byte[] header) {
        return switch (extension) {
            case "jpg", "jpeg" -> header.length >= 3
                    && (header[0] & 0xff) == 0xff
                    && (header[1] & 0xff) == 0xd8
                    && (header[2] & 0xff) == 0xff;
            case "png" -> header.length >= 8
                    && (header[0] & 0xff) == 0x89
                    && header[1] == 'P' && header[2] == 'N' && header[3] == 'G'
                    && header[4] == 0x0d && header[5] == 0x0a
                    && header[6] == 0x1a && header[7] == 0x0a;
            case "webp" -> header.length >= 12
                    && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
                    && header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P';
            case "mp4" -> header.length >= 12
                    && header[4] == 'f' && header[5] == 't' && header[6] == 'y' && header[7] == 'p'
                    && !(header[8] == 'q' && header[9] == 't' && header[10] == ' ' && header[11] == ' ');
            default -> false;
        };
    }

    public record ValidatedMedia(String extension, String mimeType, String mediaType) {
    }
}
