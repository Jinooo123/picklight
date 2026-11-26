package com.picklight.service.media;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.picklight.common.BizException;
import com.picklight.common.ErrorCode;
import com.picklight.domain.post.Media;
import com.picklight.repository.MediaMapper;

@Service
public class MediaUploadService {
    private static final Logger log = LoggerFactory.getLogger(MediaUploadService.class);
    private final MediaValidator validator;
    private final MediaMapper mediaMapper;
    private final Path directory;

    public MediaUploadService(MediaValidator validator, MediaMapper mediaMapper,
            @Value("${app.media.upload-dir:./uploads}") String directory) {
        this.validator = validator;
        this.mediaMapper = mediaMapper;
        this.directory = Path.of(directory).toAbsolutePath().normalize();
    }

    @Transactional(rollbackFor = IOException.class)
    public Media save(long uploaderId, MultipartFile file) throws IOException {
        var format = validator.validate(file);
        String key = UUID.randomUUID() + "." + format.extension();
        Path target = directory.resolve(key);
        Files.createDirectories(directory);
        try (InputStream in = file.getInputStream();
                OutputStream out = Files.newOutputStream(target, StandardOpenOption.CREATE_NEW)) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status == STATUS_ROLLED_BACK) {
                        try {
                            Files.deleteIfExists(target);
                        } catch (IOException e) {
                            log.error("无法清理已回滚的上传文件 {}", key, e);
                        }
                    }
                }
            });
            in.transferTo(out);
        }
        Media media = new Media();
        media.setUploaderId(uploaderId);
        media.setStorageKey(key);
        media.setMimeType(format.mimeType());
        media.setSizeBytes(file.getSize());
        media.setSortOrder(0);
        mediaMapper.insert(media);
        return media;
    }

    public StoredFile read(String key) {
        if (!key.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|jpeg|png|webp|mp4)")) {
            throw new BizException(ErrorCode.NOT_FOUND);
        }
        Media media = mediaMapper.selectOne(Wrappers.<Media>lambdaQuery().eq(Media::getStorageKey, key));
        Path path = directory.resolve(key);
        if (media == null || !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
            throw new BizException(ErrorCode.NOT_FOUND);
        }
        return new StoredFile(media.getMimeType(), new FileSystemResource(path));
    }

    public record StoredFile(String mimeType, Resource content) {}
}
