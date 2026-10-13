import { describe, expect, it } from "vitest";
import { resolvePortablePath, toPortablePath } from "../src/project/project";

describe("portable project paths without Node globals", () => {
  it("normalizes POSIX paths while rejecting traversal and sibling prefixes", () => {
    expect(toPortablePath("/studio/character/assets/hero.png", "/studio/character")).toBe("assets/hero.png");
    expect(resolvePortablePath("parts/../assets/hero.png", "/studio/character")).toBe("/studio/character/assets/hero.png");
    expect(() => resolvePortablePath("../../other.png", "/studio/character")).toThrow(/escapa/);
    expect(() => resolvePortablePath("/studio/character-copy/hero.png", "/studio/character")).toThrow(/escapa/);
  });
  it("roundtrips Windows drives and detects cross-drive escapes", () => {
    expect(toPortablePath("C:\\Studio\\Character\\assets\\hero.png", "c:\\studio\\character")).toBe("assets/hero.png");
    expect(resolvePortablePath("assets/hero.png", "C:\\Studio\\Character")).toBe("C:/Studio/Character/assets/hero.png");
    expect(() => resolvePortablePath("D:/Studio/Character/hero.png", "C:/Studio/Character")).toThrow(/escapa/);
    expect(() => resolvePortablePath("..\\hero.png", "C:/Studio/Character")).toThrow(/escapa/);
  });
  it("keeps UNC share boundaries and rejects null bytes", () => {
    expect(resolvePortablePath("assets/hero.png", "\\\\server\\share\\project")).toBe("//server/share/project/assets/hero.png");
    expect(toPortablePath("//server/share/project/assets/hero.png", "//server/share/project")).toBe("assets/hero.png");
    expect(() => resolvePortablePath("//server/other/project/hero.png", "//server/share/project")).toThrow(/escapa/);
    expect(() => resolvePortablePath("hero\0.png", "/project")).toThrow(/inválido/);
  });
});
