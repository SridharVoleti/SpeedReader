import { describe, expect, it } from "vitest";
import { createStore, type StorageConfig } from "../../../lib/sr/pipeline/storage";
import { canonicalHash } from "../../../lib/sr/pipeline/hash";

const cfg: StorageConfig = {
  wipRoot: "D:\\Sridhar\\Projects\\SpeedReader\\hosted-app\\pipeline\\wip",
  approvedRoot: "D:\\Sridhar\\Projects\\SpeedReader\\hosted-app\\pipeline\\approved",
  qaActors: ["qa-agent"]
};
const WIP = `${cfg.wipRoot}\\role2\\W1-0007.json`;
const content = JSON.stringify({ passageId: "W1-0007" });

describe("SR-042 WIP / approved separation", () => {
  it("generated artifacts can only be written under the configured Windows WIP path", () => {
    const s = createStore(cfg);
    expect(() => s.writeWip(WIP, content)).not.toThrow();
    expect(() => s.writeWip(`${cfg.approvedRoot}\\role2\\x.json`, content)).toThrow(/WIP/);
    expect(() => s.writeWip("D:\\elsewhere\\x.json", content)).toThrow(/WIP/);
  });
  it("path traversal and case tricks cannot escape the WIP root", () => {
    const s = createStore(cfg);
    expect(() => s.writeWip(`${cfg.wipRoot}\\..\\approved\\x.json`, content)).toThrow(/WIP/);
    expect(() => s.writeWip(cfg.approvedRoot.toUpperCase() + "\\x.json", content)).toThrow(/WIP/);
    expect(() => s.writeWip(cfg.wipRoot.toUpperCase() + "\\ok.json", content)).not.toThrow();
  });
  it("downstream stages cannot read WIP as authoritative", () => {
    const s = createStore(cfg);
    s.writeWip(WIP, content);
    expect(() => s.readAuthoritative(WIP)).toThrow(/not authoritative/);
  });
  it("only QA may promote an exact artifact, with a PASS, to the approved location", () => {
    const s = createStore(cfg);
    s.writeWip(WIP, content);
    const hash = canonicalHash(JSON.parse(content));
    expect(() => s.approve({ actor: "creator-agent", verdict: "PASS", wipPath: WIP, hash })).toThrow(/QA/);
    expect(() => s.approve({ actor: "qa-agent", verdict: "FAIL", wipPath: WIP, hash })).toThrow(/PASS/);
    const approvedPath = s.approve({ actor: "qa-agent", verdict: "PASS", wipPath: WIP, hash });
    expect(approvedPath.toLowerCase().startsWith(cfg.approvedRoot.toLowerCase())).toBe(true);
  });
  it("the approved copy matches the QA'd hash exactly and is readable as authoritative", () => {
    const s = createStore(cfg);
    s.writeWip(WIP, content);
    const hash = canonicalHash(JSON.parse(content));
    const ap = s.approve({ actor: "qa-agent", verdict: "PASS", wipPath: WIP, hash });
    expect(s.readAuthoritative(ap)).toEqual({ content, hash });
  });
  it("an artifact edited in WIP after QA cannot be approved with the old hash", () => {
    const s = createStore(cfg);
    s.writeWip(WIP, content);
    const hash = canonicalHash(JSON.parse(content));
    s.writeWip(WIP, JSON.stringify({ passageId: "W1-0007", sneaky: true }));
    expect(() => s.approve({ actor: "qa-agent", verdict: "PASS", wipPath: WIP, hash })).toThrow(/hash/);
  });
  it("approved files are immutable: writing or re-approving over them is refused", () => {
    const s = createStore(cfg);
    s.writeWip(WIP, content);
    const hash = canonicalHash(JSON.parse(content));
    const ap = s.approve({ actor: "qa-agent", verdict: "PASS", wipPath: WIP, hash });
    expect(() => s.writeWip(ap, "x")).toThrow();
    expect(() => s.approve({ actor: "qa-agent", verdict: "PASS", wipPath: WIP, hash })).toThrow(/already approved/);
  });
});
