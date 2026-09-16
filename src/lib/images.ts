const MAX_WIDTH = 1280;

// Reduz o print para no máximo 1280px e WebP antes de subir: um print de tela cai de ~2 MB para ~150 KB
export async function compressImage(file: Blob): Promise<{ base64: string; previewUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Falha ao converter a imagem'))), 'image/webp', 0.85));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return { base64: btoa(binary), previewUrl: URL.createObjectURL(blob) };
}
