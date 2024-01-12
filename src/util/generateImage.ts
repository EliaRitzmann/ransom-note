import fs from "fs";
import path from "path";
import sharp from "sharp";
import { BackgroundColor } from "../../types";

export async function generateImage(
  value: string,
  seed: number,
  backgroundColor: BackgroundColor,
  spaceing: number
): Promise<Buffer> {
  if (!value) {
    throw new Error("Value must be provided");
  }

  if (!isValidSpacing(spaceing)) {
    throw new Error("Spacing must be between -80 and 500");
  }

  const filePathsOrSpaces = await Promise.all(
    Array.from(value).map(async (char, index) =>
      char === " "
        ? " "
        : await getRandomImagePath(char.toLowerCase(), seed, index)
    )
  );

  filePathsOrSpaces.forEach((filePath) => {
    if (filePath !== " " && !fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
  });

  const imageBuffers = await Promise.all(
    filePathsOrSpaces.map(async (filePath) =>
      filePath === " "
        ? sharp({
            create: {
              width: 81 + spaceing,
              height: 100,
              channels: 4,
              background: backgroundColor,
            },
          })
            .png()
            .toBuffer()
        : await sharp(filePath)
            .rotate(getRandomRotationAngle(), {
              background: backgroundColor,
            })
            .toBuffer()
    )
  );

  const metadatas = await Promise.all(
    imageBuffers.map((buffer) => sharp(buffer).metadata())
  );

  const combinedWidth = metadatas.reduce(
    (acc, metadata) => acc + (metadata.width || 0) + spaceing, // Adjust for spacing
    -spaceing // Start with -space to avoid extra spacing at the beginning
  );

  const maxHeight = Math.max(
    ...metadatas.map((metadata) => metadata.height || 0)
  );

  const baseImage = await sharp({
    create: {
      width: combinedWidth,
      height: maxHeight,
      channels: 4,
      background: backgroundColor,
    },
  });

  let leftOffset = 0;
  const imagesToComposite = imageBuffers.map((buffer, index) => {
    const image = { input: buffer, left: leftOffset, top: 0 };
    leftOffset += metadatas[index].width || 0;
    leftOffset += spaceing; // Adjust for spacing
    return image;
  });

  const imageBuffer = await baseImage
    .composite(imagesToComposite)
    .png()
    .toBuffer();

  //fs.writeFileSync(value + seed + ".png", imageBuffer);
  return imageBuffer;
}

async function getRandomImagePath(char: string, seed: number, index: number) {
  const dirPath = path.resolve(".", "res/images/characters");
  const files = fs.readdirSync(dirPath);

  // Find all files that start with the character
  const charFiles = files.filter(
    (file) => file.startsWith(`${char}-`) && file.endsWith(".png")
  );

  if (charFiles.length === 0) {
    throw new Error(`No files found for character: ${char}`);
  }

  // Modify the seed with the index to ensure different characters get different images
  const modifiedSeed = seed + index;
  const randomFile =
    charFiles[Math.floor(seededRandom(modifiedSeed) * charFiles.length)];

  return path.join(dirPath, randomFile);
}

function seededRandom(seed: number) {
  var x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function getRandomRotationAngle() {
  return Math.floor(Math.random() * 11) - 5; // Generates a random integer between -5 and 5
}

function isValidSpacing(spacing: number): boolean {
  return spacing >= -80 && spacing <= 500;
}
