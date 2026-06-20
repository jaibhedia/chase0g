import { renderOgImage, ogSize, ogContentType, ogAlt } from './ogImage';

export const size = ogSize;
export const contentType = ogContentType;
export const alt = ogAlt;

export default function OpengraphImage() {
  return renderOgImage();
}
