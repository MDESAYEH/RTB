import sharp from 'sharp';
import {copyFileSync} from 'node:fs';
const source='C:/Users/moham/.codex/generated_images/01a10d51-7355-7ff3-857e-d3ab5996643c/exec-a0716547-e647-4453-80b3-744647400bb9.png';
copyFileSync(source,'public/images/tripoli-court-original.png');
await sharp(source).resize({width:1440}).webp({quality:78,effort:6}).toFile('public/images/tripoli-court.webp');
console.log(await sharp('public/images/tripoli-court.webp').metadata());
