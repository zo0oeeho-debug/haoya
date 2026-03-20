import React, { useState } from 'react';

// 临时修复：极简PDF压缩组件（仅保证页面不崩溃）
const UploadCompressor = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 临时空方法，避免调用报错
  const handlePDFCompress = async (file: File, quality: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // 临时返回原文件，后续替换真实压缩逻辑
      return new Blob([file], { type: 'application/pdf' });
    } catch (err) {
      setError('压缩功能临时维护中，稍后恢复');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompress = async () => {
    if (!file) {
      setError('请选择PDF文件');
      return;
    }
    const compressedBlob = await handlePDFCompress(file, 'recommend');
    if (compressedBlob) {
      // 简单下载逻辑
      const url = URL.createObjectURL(compressedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compressed-${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px' }}>
      <h3>PDF压缩工具</h3>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button
        onClick={handleCompress}
        disabled={isLoading || !file}
        style={{ marginTop: '10px', padding: '8px 16px' }}
      >
        {isLoading ? '压缩中...' : '压缩PDF'}
      </button>
      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
    </div>
  );
};

export default UploadCompressor;
