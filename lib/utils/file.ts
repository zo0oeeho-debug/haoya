export type Mode = "image" | "pdf";

export const ACCEPT_MAP: Record<Mode, string> = {
  image: "image/png,image/jpeg,image/jpg,image/gif,image/svg+xml",
  pdf: "application/pdf"
};

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function validateFileForMode(file: File, mode: Mode): string | null {
  const accept = ACCEPT_MAP[mode].split(",");
  if (!accept.some((type) => file.type === type)) {
    return "文件类型与当前模式不匹配，请重新选择。";
  }
  return null;
}
