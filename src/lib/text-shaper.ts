// SPDX-License-Identifier: Apache-2.0
export type TextDirection = "ltr" | "rtl";

export interface TextShapeInput {
  text: string;
  fontId: string;
  language?: string;
  direction?: TextDirection;
}

export interface ShapedRun extends TextShapeInput {
  fontFamily: string;
}

export interface TextShaper {
  shape(input: TextShapeInput): Promise<ShapedRun>;
}

export class BrowserTextShaper implements TextShaper {
  constructor(private readonly fontFamilies: ReadonlyMap<string, string>) {}

  async shape(input: TextShapeInput): Promise<ShapedRun> {
    const fontFamily = this.fontFamilies.get(input.fontId);
    if (!fontFamily) throw new Error(`No loaded browser font is registered for "${input.fontId}".`);
    await document.fonts.load(`1px "${fontFamily}"`, input.text);
    return { ...input, fontFamily };
  }
}
