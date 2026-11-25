package com.picklight.service.media;

import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import com.picklight.common.BizException;
import com.picklight.common.ErrorCode;

/**
 * Checks a selected file before the upload service creates a destination file.
 * Video duration is read from the uploaded file, never from a client parameter.
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
        try (InputStream input = file.getInputStream()) {
            switch (extension) {
                case "mp4" -> Mp4Metadata.validate(input, file.getSize());
                case "webp" -> validateWebp(input, file.getSize());
                default -> validateImage(input, extension.equals("png") ? "png" : "jpeg");
            }
        } catch (EOFException | javax.imageio.IIOException e) {
            throw new BizException(ErrorCode.MEDIA_TYPE_UNSUPPORTED);
        } catch (IOException e) {
            throw new BizException(ErrorCode.BAD_REQUEST, "无法读取文件");
        }
        return new ValidatedMedia(extension, mimeType, mediaType);
    }

    private static void validateImage(InputStream input, String expected) throws IOException {
        // Read dimensions from the image metadata without expanding all pixels.
        try (var stream = new MemoryCacheImageInputStream(input)) {
            var readers = ImageIO.getImageReaders(stream);
            if (readers.hasNext()) {
                var reader = readers.next();
                try {
                    reader.setInput(stream);
                    if (expected.equalsIgnoreCase(reader.getFormatName())
                            && reader.getWidth(0) > 0 && reader.getHeight(0) > 0) {
                        return;
                    }
                } finally {
                    reader.dispose();
                }
            }
        }
        throw new BizException(ErrorCode.MEDIA_TYPE_UNSUPPORTED);
    }

    private static void validateWebp(InputStream input, long size) throws IOException {
        byte[] header = input.readNBytes(20);
        if (header.length == 20) {
            var data = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN);
            long riffSize = Integer.toUnsignedLong(data.getInt(4));
            long chunkSize = Integer.toUnsignedLong(data.getInt(16));
            String type = new String(header, 12, 4, StandardCharsets.US_ASCII);
            if ("RIFF".equals(new String(header, 0, 4, StandardCharsets.US_ASCII))
                    && "WEBP".equals(new String(header, 8, 4, StandardCharsets.US_ASCII))
                    && riffSize + 8 == size && chunkSize > 0 && chunkSize <= size - 20
                    && (type.equals("VP8 ") || type.equals("VP8L") || type.equals("VP8X"))) {
                return;
            }
        }
        throw new BizException(ErrorCode.MEDIA_TYPE_UNSUPPORTED);
    }

    public record ValidatedMedia(String extension, String mimeType, String mediaType) {
    }
}
