// SPDX-License-Identifier: Apache-2.0
import type { ModelRecord } from "../../tools/content.mjs";
import { repertoireCharacters } from "../../tools/content.mjs";

export type AlphabetGroupId =
  | "uppercase"
  | "lowercase"
  | "special"
  | "numerals"
  | "punctuation"
  | "other";

export interface AlphabetSpecimenGroup {
  id: AlphabetGroupId;
  characters: string[];
}

export interface AlphabetSpecimen {
  groups: AlphabetSpecimenGroup[];
  characterCount: number;
}

export function alphabetSpecimenForModel(model: ModelRecord): AlphabetSpecimen {
  const characters = repertoireCharacters(model);
  const available = new Set(characters);
  const uppercase = characters.filter((character) => /^[A-Z]$/u.test(character));
  const lowercase = characters.filter((character) => /^[a-z]$/u.test(character));
  const numerals = [..."1234567890"].filter((character) => available.has(character));
  const punctuation = [".", ",", "?", "!"].filter((character) => available.has(character));
  const consumed = new Set([...uppercase, ...lowercase, ...numerals, ...punctuation]);
  const special = characters.filter((character) => !consumed.has(character) && /[\p{L}\p{M}]/u.test(character));
  const specialSet = new Set(special);
  const other = characters.filter((character) => !consumed.has(character) && !specialSet.has(character));
  const groups: AlphabetSpecimenGroup[] = [
    { id: "uppercase", characters: uppercase },
    { id: "lowercase", characters: lowercase },
    { id: "special", characters: special },
    { id: "numerals", characters: numerals },
    { id: "punctuation", characters: punctuation },
    { id: "other", characters: other },
  ];
  return { groups: groups.filter((group) => group.characters.length > 0), characterCount: characters.length };
}
