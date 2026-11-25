package com.picklight.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;

@Configuration(proxyBeanMethods = false)
@PropertySource("classpath:media-upload.properties")
public class MediaUploadConfiguration {
}
