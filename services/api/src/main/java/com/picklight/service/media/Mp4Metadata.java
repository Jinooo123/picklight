package com.picklight.service.media;

import java.io.BufferedInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;

import com.picklight.common.BizException;
import com.picklight.common.ErrorCode;

/** Reads ISO BMFF movie metadata without buffering or decoding the video payload. */
final class Mp4Metadata {
    private static final Set<String> BRANDS = Set.of("isom", "iso2", "iso3", "iso4", "iso5",
            "iso6", "iso7", "iso8", "iso9", "mp41", "mp42", "avc1", "M4V ", "dash", "MSNV");
    private final DataInputStream in;
    private boolean mp4;
    private boolean durationKnown;
    private boolean video;
    private boolean mediaData;
    private int boxes;

    private Mp4Metadata(InputStream input) {
        in = new DataInputStream(new BufferedInputStream(input));
    }

    static void validate(InputStream input, long size) throws IOException {
        var movie = new Mp4Metadata(input);
        movie.readBoxes(size, "file");
        if (!(movie.mp4 && movie.durationKnown && movie.video && movie.mediaData)) {
            throw invalid();
        }
    }

    private void readBoxes(long remaining, String parent) throws IOException {
        while (remaining > 0) {
            if (remaining < 8 || ++boxes > 100_000) throw invalid();
            long length = Integer.toUnsignedLong(in.readInt());
            String type = fourCC();
            int header = 8;
            if (length == 1) {
                if (remaining < 16) throw invalid();
                length = in.readLong();
                header = 16;
            } else if (length == 0) {
                length = remaining;
            }
            if (length < header || length > remaining) throw invalid();
            long payload = length - header;
            switch (parent + "/" + type) {
                case "file/ftyp" -> readBrands(payload);
                case "file/moov", "moov/trak", "trak/mdia" -> readBoxes(payload, type);
                case "moov/mvhd" -> readDuration(payload);
                case "mdia/hdlr" -> {
                    if (payload < 12) throw invalid();
                    in.skipNBytes(8);
                    video |= fourCC().equals("vide");
                    in.skipNBytes(payload - 12);
                }
                case "file/mdat" -> {
                    mediaData |= payload > 0;
                    in.skipNBytes(payload);
                }
                default -> in.skipNBytes(payload);
            }
            remaining -= length;
        }
    }

    private void readBrands(long size) throws IOException {
        if (size < 8 || size > 4096 || size % 4 != 0) throw invalid();
        String major = fourCC();
        if (major.equals("qt  ")) throw invalid();
        mp4 |= BRANDS.contains(major);
        in.skipNBytes(4);
        for (long i = 8; i < size; i += 4) mp4 |= BRANDS.contains(fourCC());
    }

    private void readDuration(long size) throws IOException {
        if (size < 20) throw invalid();
        int version = in.readUnsignedByte();
        if (durationKnown || version > 1 || (version == 1 && size < 32)) throw invalid();
        in.skipNBytes(version == 1 ? 19 : 11);
        long scale = Integer.toUnsignedLong(in.readInt());
        long ticks = version == 1 ? in.readLong() : Integer.toUnsignedLong(in.readInt());
        if (ticks <= 0 || scale == 0 || (version == 0 && ticks == 0xffffffffL)) throw invalid();
        if (ticks > 60L * scale) {
            throw new BizException(ErrorCode.MEDIA_TOO_LARGE, "视频时长不能超过 60 秒");
        }
        durationKnown = true;
        in.skipNBytes(size - (version == 1 ? 32 : 20));
    }

    private String fourCC() throws IOException {
        byte[] bytes = new byte[4];
        in.readFully(bytes);
        return new String(bytes, StandardCharsets.ISO_8859_1);
    }

    private static BizException invalid() {
        return new BizException(ErrorCode.MEDIA_TYPE_UNSUPPORTED, "无法识别 MP4 视频或读取视频时长");
    }
}
