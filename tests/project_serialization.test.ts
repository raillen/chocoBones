import { describe, expect, it } from "vitest";
import { loadProjectFromJson, Project, saveProjectToJson } from "../src/project/project";

describe("Project Serialization & Zod Validation", () => {
  it("loads and parses valid puppet project json", () => {
    const rawJson = JSON.stringify({
      schema: "survivor-puppet",
      version: 1,
      name: "Hero Puppet",
      width: 512,
      height: 512,
      assets: [],
      joints: [
        { id: "root", name: "Root", parent: "", x: 256, y: 256, color: "#fff" },
      ],
      layers: [
        { id: "torso", name: "Torso Layer", asset: "torso.png", joint: "root" },
      ],
    });

    const project = loadProjectFromJson(rawJson);
    expect(project.name).toBe("Hero Puppet");
    expect(project.joints.length).toBe(1);
    expect(project.layers.length).toBe(1);
    expect(project.layers[0]!.transform.sx).toBe(1); // default preenchido
  });

  it("throws validation error for invalid schema string", () => {
    const invalidJson = JSON.stringify({
      schema: "invalid-schema",
      version: 1,
      name: "Corrupt",
    });

    expect(() => loadProjectFromJson(invalidJson)).toThrow();
  });

  it("serializes and reloads project identically", () => {
    const initial: Project = {
      schema: "survivor-puppet",
      version: 1,
      name: "Roundtrip Test",
      width: 1024,
      height: 768,
      assets: [],
      joints: [
        { id: "root", name: "Root", parent: "", x: 100, y: 200, color: "#eab308" },
      ],
      layers: [],
    };

    const serialized = saveProjectToJson(initial);
    const reloaded = loadProjectFromJson(serialized);
    expect(reloaded).toEqual(initial);
  });
});
