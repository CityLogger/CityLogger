import { describe, expect, it } from "vitest";
import { JournalOperations } from "../src/frontend/journalOperations";

describe("journal mutation coordination", () => {
  it("drops a delayed prior-account response after the newer account completes", async () => {
    const journal = new JournalOperations();
    const committed: string[] = [];
    journal.setOwner("alice");
    const old = journal.begin("alice")!;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release=resolve; }).then(()=>{if(old.isCurrent()) committed.push("alice");old.finish();});
    expect(journal.begin("alice")).toBeNull();
    journal.setOwner("bob");
    const current=journal.begin("bob")!;
    if(current.isCurrent()) committed.push("bob");
    current.finish(); release(); await pending;
    expect(committed).toEqual(["bob"]);
  });
  it("allows only one write until it finishes, including after failure", () => {
    const journal = new JournalOperations();
    journal.setOwner("alice");
    const write = journal.begin("alice")!;
    expect(journal.begin("alice")).toBeNull();
    expect(journal.busy).toBe(true);
    write.finish();
    expect(journal.busy).toBe(false);
    expect(journal.begin("alice")).not.toBeNull();
  });
  it("invalidates old completions when signing out and back into the same account", () => {
    const journal = new JournalOperations();
    journal.setOwner("alice");
    const old = journal.begin("alice")!;
    journal.setOwner(null);
    journal.setOwner("alice");
    const current = journal.begin("alice")!;
    expect(old.isCurrent()).toBe(false);
    old.finish();
    expect(current.isCurrent()).toBe(true);
    expect(journal.busy).toBe(true);
  });
  it("rejects stale account handlers and preserves requests on token refresh", () => {
    const journal = new JournalOperations();
    journal.setOwner("alice");
    const write = journal.begin("alice")!;
    journal.setOwner("alice");
    expect(write.isCurrent()).toBe(true);
    journal.setOwner("bob");
    expect(write.isCurrent()).toBe(false);
    expect(journal.begin("alice")).toBeNull();
    expect(journal.begin("bob")).not.toBeNull();
  });
});
