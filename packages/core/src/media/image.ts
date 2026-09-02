export interface McpImageContent {
  type: 'image';
  data: string; // base64
  mimeType: string;
}

export function isImageContentType(contentType?: string): boolean {
  if (!contentType) return false;
  return contentType.startsWith('image/') && !contentType.includes('svg');
}

export function formatImageContent(buffer: Buffer, mimeType: string): McpImageContent {
  return {
    type: 'image',
    data: buffer.toString('base64'),
    mimeType: mimeType.split(';')[0].trim(),
  };
}
