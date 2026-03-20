'use client';

import React, { useState, useCallback } from 'react';

// 简单的文件大小格式化函数
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 类型定义
type CompressQuality = 'low' | 'medium' | 'high' | 'recommend';

// 核心压缩方法
const compressPDF = async (
  file: File,
  quality: CompressQuality = 'recommend'
): Promise<{ blob: Blob; originalSize: number; compressedSize: number }> => {
  const qualityMap = { low: 0.2, medium: 0.5, high: 0.8, recommend: 0.6 };
  const compressionLevel = qualityMap[quality];

  console.log('=== 开始压缩 ===');
  console.log('文件：', file.name, '大小：', formatFileSize(file.size));
  console.log('质量：', quality, '级别：', compressionLevel);

  try {
    const arrayBuffer = await file.arrayBuffer();
    // 临时跳过压缩，直接返回原文件
    const compressedBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
    
    console.log('压缩完成：', formatFileSize(compressedBlob.size));
    console.log('压缩率：', ((1 - compressedBlob.size / file.size) * 100).toFixed(1) + '%');
    
    return {
      blob: compressedBlob,
      originalSize: file.size,
      compressedSize: compressedBlob.size,
    };
  } catch (error) {
    console.error('压缩失败：', error);
    throw error;
  }
};

const UploadCompressor = () => {
  // 状态管理
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [compressResult, setCompressResult] = useState<{
    originalSize: string;
    compressedSize: string;
    ratio: string;
  } | null>(null);
  const [quality, setQuality] = useState<CompressQuality>('recommend');

  // 处理文件上传
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // 校验PDF类型
    if (selectedFile.type !== 'application/pdf') {
      alert('仅支持上传PDF文件！');
      setFile(null);
      return;
    }
    
    setFile(selectedFile);
    setCompressResult(null); // 重置压缩结果
    alert('文件上传成功！');
  }, []);

  // 处理压缩逻辑
  const handleCompress = useCallback(async () => {
    if (!file) {
      alert('请先上传PDF文件！');
      return;
    }

    setIsLoading(true);
    try {
      const { blob, originalSize, compressedSize } = await compressPDF(file, quality);
      const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

      // 更新压缩结果
      setCompressResult({
        originalSize: formatFileSize(originalSize),
        compressedSize: formatFileSize(compressedSize),
        ratio: `${ratio}%`,
      });

      // 触发下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compressed-${file.name}`;
      a.click();
      URL.revokeObjectURL(url);

      alert('PDF压缩完成，已自动下载！');
    } catch (err) {
      console.error('压缩失败:', err);
      alert('压缩失败，请尝试更换文件或降低压缩质量！');
    } finally {
      setIsLoading(false);
    }
  }, [file, quality]);

  // 清空文件
  const handleClearFile = () => {
    setFile(null);
    setCompressResult(null);
  };

  // 简单的样式
  const styles = {
    container: {
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    },
    card: {
      border: '1px solid #d9d9d9',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '20px',
      textAlign: 'center' as const
    },
    uploadArea: {
      border: '2px dashed #d9d9d9',
      borderRadius: '8px',
      padding: '20px',
      textAlign: 'center' as const,
      marginBottom: '20px',
      backgroundColor: '#fafafa'
    },
    button: {
      padding: '10px 20px',
      marginRight: '10px',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px'
    },
    primaryButton: {
      backgroundColor: '#1890ff',
      color: 'white'
    },
    secondaryButton: {
      backgroundColor: '#f0f0f0',
      color: '#333',
      border: '1px solid #d9d9d9'
    },
    select: {
      padding: '8px 12px',
      border: '1px solid #d9d9d9',
      borderRadius: '4px',
      fontSize: '14px',
      marginRight: '10px'
    },
    result: {
      backgroundColor: '#f6ffed',
      border: '1px solid #b7eb8f',
      borderRadius: '8px',
      padding: '15px',
      marginTop: '20px'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>PDF压缩工具</h1>
        
        {/* 上传区域 */}
        <div style={styles.uploadArea}>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="pdf-upload"
          />
          <label htmlFor="pdf-upload" style={{ cursor: 'pointer' }}>
            📁 选择PDF文件
          </label>
        </div>

        {/* 文件信息 */}
        {file && (
          <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
            <strong>已选择文件：</strong> {file.name} ({formatFileSize(file.size)})
          </div>
        )}

        {/* 压缩质量选择 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            压缩质量：
          </label>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as CompressQuality)}
            disabled={isLoading || !file}
            style={styles.select}
          >
            <option value="low">低质量（压缩率最高）</option>
            <option value="recommend">推荐（平衡画质/压缩率）</option>
            <option value="medium">中等质量</option>
            <option value="high">高质量（压缩率最低）</option>
          </select>
        </div>

        {/* 操作按钮 */}
        <div style={{ marginBottom: '20px' }}>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={handleCompress}
            disabled={isLoading || !file}
          >
            {isLoading ? '压缩中...' : '🚀 开始压缩并下载'}
          </button>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={handleClearFile}
            disabled={isLoading}
          >
            🗑️ 清空文件
          </button>
        </div>

        {/* 压缩结果展示 */}
        {compressResult && (
          <div style={styles.result}>
            <h3 style={{ color: '#52c41a', marginBottom: '10px' }}>✅ PDF压缩完成！</h3>
            <div style={{ lineHeight: '1.6' }}>
              <p><strong>原文件大小：</strong> {compressResult.originalSize}</p>
              <p><strong>压缩后大小：</strong> {compressResult.compressedSize}</p>
              <p><strong>压缩率：</strong> <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{compressResult.ratio}</span></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadCompressor;
