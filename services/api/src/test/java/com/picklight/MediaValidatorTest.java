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
    void acceptsSupportedFormatsAndUsesServerDeterminedMime() {
        assertEquals("image/jpeg", validate("a.jpeg", new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff}).mimeType());
        assertEquals("image/png", validate("a.png", new byte[] {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10}).mimeType());
        assertEquals("image/webp", validate("a.webp", "RIFF0000WEBP".getBytes(StandardCharsets.US_ASCII)).mimeType());
        assertEquals("VIDEO", validate("a.mp4", "0000ftypisom".getBytes(StandardCharsets.US_ASCII)).mediaType());
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
        when(image.getInputStream()).thenReturn(new ByteArrayInputStream(new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff}));
        assertEquals("IMAGE", validator.validate(image).mediaType());

        MultipartFile video = mock(MultipartFile.class);
        when(video.isEmpty()).thenReturn(false);
        when(video.getOriginalFilename()).thenReturn("clip.mp4");
        when(video.getSize()).thenReturn(100L * 1024 * 1024);
        when(video.getInputStream()).thenReturn(new ByteArrayInputStream("0000ftypisom".getBytes(StandardCharsets.US_ASCII)));
        assertEquals("VIDEO", validator.validate(video).mediaType());
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

    private MediaValidator.ValidatedMedia validate(String name, byte[] content) {
        return validator.validate(new MockMultipartFile("file", name, "application/octet-stream", content));
    }
}
