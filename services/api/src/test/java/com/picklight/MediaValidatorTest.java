package com.picklight;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import com.picklight.common.BizException;
import com.picklight.common.ErrorCode;
import com.picklight.service.media.MediaValidator;

class MediaValidatorTest {

    private final MediaValidator validator = new MediaValidator(10 * 1024 * 1024, 100 * 1024 * 1024);

    @Test
    void acceptsSupportedFormatsAndUsesServerDeterminedMime() throws Exception {
        assertEquals("image/jpeg", validate("a.jpeg", image("jpeg")).mimeType());
        assertEquals("image/png", validate("a.png", image("png")).mimeType());
        assertEquals("image/webp", validate("a.webp", java.util.Base64.getDecoder().decode("UklGRkoAAABXRUJQVlA4ID4AAACQAwCdASpAAEAAPm02mEkkIyKhIggAgA2JaQAAEDdTUAV4hbkAAP7eEn//wrX9aH9vOar/qqnr79AAAAAAAA==")).mimeType());
        assertEquals("VIDEO", validate("a.mp4", movie(60000)).mediaType());
    }

    @Test
    void rejectsOversizedFilesBeforeOpeningTheStream() throws Exception {
        MultipartFile image = mock(MultipartFile.class);
        when(image.isEmpty()).thenReturn(false);
        when(image.getOriginalFilename()).thenReturn("photo.jpg");
        when(image.getSize()).thenReturn(10L * 1024 * 1024 + 1);
        assertEquals(ErrorCode.MEDIA_TOO_LARGE, assertThrows(BizException.class, () -> validator.validate(image)).getCode());
        verify(image, never()).getInputStream();

        MultipartFile video = mock(MultipartFile.class);
        when(video.isEmpty()).thenReturn(false);
        when(video.getOriginalFilename()).thenReturn("clip.mp4");
        when(video.getSize()).thenReturn(100L * 1024 * 1024 + 1);
        assertEquals(ErrorCode.MEDIA_TOO_LARGE, assertThrows(BizException.class, () -> validator.validate(video)).getCode());
        verify(video, never()).getInputStream();
    }

    @Test
    void acceptsFilesAtTheSizeLimit() throws Exception {
        MultipartFile image = mock(MultipartFile.class);
        when(image.isEmpty()).thenReturn(false);
        when(image.getOriginalFilename()).thenReturn("photo.jpg");
        when(image.getSize()).thenReturn(10L * 1024 * 1024);
        when(image.getInputStream()).thenReturn(new ByteArrayInputStream(image("jpeg")));
        assertEquals("IMAGE", validator.validate(image).mediaType());
    }

    @Test
    void rejectsUnsupportedExtensionsAndMismatchedContent() {
        assertEquals(ErrorCode.MEDIA_TYPE_UNSUPPORTED,
                assertThrows(BizException.class, () -> validate("image.gif", "GIF89a".getBytes(StandardCharsets.US_ASCII))).getCode());
        assertEquals(ErrorCode.MEDIA_TYPE_UNSUPPORTED,
                assertThrows(BizException.class, () -> validate("image.jpg", "not a jpg".getBytes(StandardCharsets.US_ASCII))).getCode());
        assertEquals(ErrorCode.MEDIA_TYPE_UNSUPPORTED,
                assertThrows(BizException.class, () -> validate("clip.mp4", "0000ftypqt  ".getBytes(StandardCharsets.US_ASCII))).getCode());
    }

    @Test
    void rejectsLongTruncatedAndNonVideoMp4() {
        assertEquals(ErrorCode.MEDIA_TOO_LARGE,
                assertThrows(BizException.class, () -> validate("a.mp4", movie(60001))).getCode());
        byte[] truncated = java.util.Arrays.copyOf(movie(1000), 25);
        assertEquals(ErrorCode.MEDIA_TYPE_UNSUPPORTED,
                assertThrows(BizException.class, () -> validate("a.mp4", truncated)).getCode());
        assertThrows(BizException.class, () -> validate("a.mp4", movie(0)));
    }

    // Minimal ISO BMFF metadata used to exercise exact duration and truncation boundaries.
    static byte[] movie(int millis) {
        byte[] header = java.nio.ByteBuffer.allocate(20).putInt(0).putLong(0)
                .putInt(1000).putInt(millis).array();
        byte[] handler = java.nio.ByteBuffer.allocate(12).putLong(0)
                .put("vide".getBytes(StandardCharsets.US_ASCII)).array();
        var result = new java.io.ByteArrayOutputStream();
        result.writeBytes(box("ftyp", "isom0000".getBytes(StandardCharsets.US_ASCII)));
        var children = new java.io.ByteArrayOutputStream();
        children.writeBytes(box("mvhd", header));
        children.writeBytes(box("trak", box("mdia", box("hdlr", handler))));
        result.writeBytes(box("moov", children.toByteArray()));
        result.writeBytes(box("mdat", new byte[1]));
        return result.toByteArray();
    }

    private static byte[] box(String type, byte[] data) {
        return java.nio.ByteBuffer.allocate(8 + data.length).putInt(8 + data.length)
                .put(type.getBytes(StandardCharsets.US_ASCII)).put(data).array();
    }

    private static byte[] image(String format) throws java.io.IOException {
        var bytes = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(3, 3,
                java.awt.image.BufferedImage.TYPE_INT_RGB), format, bytes);
        return bytes.toByteArray();
    }

    private MediaValidator.ValidatedMedia validate(String name, byte[] content) {
        return validator.validate(new MockMultipartFile("file", name, "application/octet-stream", content));
    }
}
