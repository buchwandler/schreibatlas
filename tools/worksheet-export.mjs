// SPDX-License-Identifier: Apache-2.0
const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const textEncoder = new TextEncoder();
const crcTable = new Uint32Array(256);

for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

function concatBytes(parts) {
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function uint32Bytes(value) {
  return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
}

function readUint32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function pngChunk(type, data) {
  const typeBytes = textEncoder.encode(type);
  const checkBytes = concatBytes([typeBytes, data]);
  return concatBytes([uint32Bytes(data.length), typeBytes, data, uint32Bytes(crc32(checkBytes))]);
}

export function appendWorksheetMetadataToPng(png, metadata) {
  if (png.length < pngSignature.length || pngSignature.some((byte, index) => png[index] !== byte)) {
    throw new Error("Worksheet PNG export received an invalid PNG.");
  }

  let offset = pngSignature.length;
  let ihdrEnd = -1;
  while (offset + 12 <= png.length) {
    const length = readUint32(png, offset);
    const end = offset + 12 + length;
    if (end > png.length) throw new Error("Worksheet PNG export received a truncated PNG.");
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (type === "IHDR") {
      ihdrEnd = end;
      break;
    }
    offset = end;
  }
  if (ihdrEnd < 0) throw new Error("Worksheet PNG export has no image header.");

  const metadataText = encodeBase64(textEncoder.encode(JSON.stringify(metadata)));
  const textData = textEncoder.encode(`SchreibatlasWorksheet\0${metadataText}`);
  const chunk = pngChunk("tEXt", textData);
  return concatBytes([png.subarray(0, ihdrEnd), chunk, png.subarray(ihdrEnd)]);
}

async function deflate(bytes) {
  const stream = new CompressionStream("deflate");
  const compressed = new Response(stream.readable).arrayBuffer();
  const writer = stream.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  return new Uint8Array(await compressed);
}

function pdfString(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function pdfNumber(value) {
  return Number(value.toFixed(3)).toString();
}

function buildPdf({ pageWidthMm, pageHeightMm, pixelWidth, pixelHeight, imageBytes, metadataBytes, worksheetId }) {
  const pageWidthPt = pdfNumber((pageWidthMm * 72) / 25.4);
  const pageHeightPt = pdfNumber((pageHeightMm * 72) / 25.4);
  const pdfParts = [];
  const objectOffsets = new Array(8).fill(0);
  let byteOffset = 0;

  const pushBytes = (bytes) => {
    pdfParts.push(bytes);
    byteOffset += bytes.length;
  };
  const pushText = (text) => pushBytes(textEncoder.encode(text));
  const beginObject = (number) => {
    objectOffsets[number] = byteOffset;
    pushText(`${number} 0 obj\n`);
  };
  const endObject = () => pushText("\nendobj\n");
  const addStream = (number, dictionary, bytes) => {
    beginObject(number);
    pushText(`<< ${dictionary} /Length ${bytes.length} >>\nstream\n`);
    pushBytes(bytes);
    pushText("\nendstream");
    endObject();
  };

  pushText("%PDF-1.7\n");
  beginObject(1);
  pushText("<< /Type /Catalog /Pages 2 0 R /Metadata 7 0 R >>");
  endObject();
  beginObject(2);
  pushText("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  endObject();
  beginObject(3);
  pushText(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt} ${pageHeightPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  endObject();
  addStream(4, `/Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`, imageBytes);

  const pageContent = textEncoder.encode(`q\n${pageWidthPt} 0 0 ${pageHeightPt} 0 0 cm\n/Im0 Do\nQ\n`);
  addStream(5, "", pageContent);
  beginObject(6);
  pushText(`<< /Title (Schreibatlas worksheet) /Author (Schreibatlas) /Creator (Schreibatlas) /Producer (Schreibatlas) /Subject (${pdfString(worksheetId)}) >>`);
  endObject();
  addStream(7, "/Type /Metadata /Subtype /XML", metadataBytes);

  const xrefOffset = byteOffset;
  pushText(`xref\n0 ${objectOffsets.length}\n0000000000 65535 f \n`);
  for (let number = 1; number < objectOffsets.length; number += 1) {
    pushText(`${String(objectOffsets[number]).padStart(10, "0")} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size ${objectOffsets.length} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return concatBytes(pdfParts);
}

export async function createWorksheetPdf({ pageWidthMm, pageHeightMm, pixelWidth, pixelHeight, rgb, metadata }) {
  if (rgb.length !== pixelWidth * pixelHeight * 3) throw new Error("Worksheet PDF export received inconsistent image dimensions.");

  const worksheetId = String(metadata.worksheetId ?? "unknown").replace(/[^A-Za-z0-9._-]/g, "");
  const metadataBase64 = encodeBase64(textEncoder.encode(JSON.stringify(metadata)));
  const xmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<x:xmpmeta xmlns:x="adobe:ns:meta/">\n<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n<rdf:Description rdf:about="" xmlns:sa="urn:schreibatlas:worksheet:1.0">\n<sa:worksheetId>${worksheetId}</sa:worksheetId>\n<sa:metadata encoding="base64">${metadataBase64}</sa:metadata>\n</rdf:Description>\n</rdf:RDF>\n</x:xmpmeta>\n<?xpacket end="w"?>`;
  const [imageBytes, metadataBytes] = await Promise.all([deflate(rgb), Promise.resolve(textEncoder.encode(xmp))]);
  return buildPdf({ pageWidthMm, pageHeightMm, pixelWidth, pixelHeight, imageBytes, metadataBytes, worksheetId });
}
