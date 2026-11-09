import { SaxesParser } from "saxes";

const svgNamespace = "http://www.w3.org/2000/svg";
const pathDataPattern = /^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\-\s]+$/;

export function parseStrokeSvg(source, sourceName = "stroke asset") {
  const errors = [];
  const paths = [];
  let rootSeen = false;
  let viewBox = null;
  const parser = new SaxesParser({ xmlns: true });

  parser.on("opentag", (tag) => {
    if (!rootSeen) {
      rootSeen = true;
      if (tag.local !== "svg" || (tag.uri && tag.uri !== svgNamespace)) errors.push("must have an SVG root element");
      const attributes = Object.values(tag.attributes);
      if (attributes.some((attribute) => !["xmlns", "viewBox"].includes(attribute.local))) errors.push("has unsupported SVG root attributes");
      const rawViewBox = tag.attributes.viewBox?.value ?? "";
      const values = rawViewBox.trim().split(/[\s,]+/).map(Number);
      if (values.length !== 4 || values.some((value) => !Number.isFinite(value)) || values[0] !== 0 || values[1] !== 0 || values[2] !== 1 || values[3] !== 1) {
        errors.push('must use normalized viewBox="0 0 1 1"');
      } else {
        viewBox = "0 0 1 1";
      }
      return;
    }

    if (tag.local !== "path" || (tag.uri && tag.uri !== svgNamespace)) {
      errors.push("may contain only SVG path elements");
      return;
    }

    const attributes = Object.values(tag.attributes);
    if (attributes.some((attribute) => attribute.local !== "d")) errors.push("path elements may only have a d attribute");
    const pathData = tag.attributes.d?.value ?? "";
    if (!pathData || !pathDataPattern.test(pathData)) errors.push("contains invalid SVG path data");
    else paths.push(pathData);
  });

  parser.on("text", (text) => {
    if (text.trim()) errors.push("may not contain text nodes");
  });
  parser.on("error", (error) => errors.push(`is malformed: ${error.message}`));

  try {
    parser.write(source).close();
  } catch (error) {
    errors.push(`is malformed: ${error.message}`);
  }

  if (!rootSeen) errors.push("must have an SVG root element");
  if (paths.length === 0) errors.push("must contain at least one path");
  if (errors.length) throw new Error(`${sourceName}: ${[...new Set(errors)].join("; ")}.`);
  return { viewBox, paths };
}
