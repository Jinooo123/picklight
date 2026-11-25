package com.picklight.repository;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.picklight.domain.post.Media;

@Mapper
public interface MediaMapper extends BaseMapper<Media> {
}
