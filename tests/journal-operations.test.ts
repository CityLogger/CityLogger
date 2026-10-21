import { describe, expect, it } from "vitest";
import { CreationAttempt, JournalOperations } from "../src/frontend/journalOperations";

describe("journal mutation coordination", () => {
  it("drops a delayed prior-account response after the newer account completes", async () => {
    const journal = new JournalOperations();
    const committed: string[] = [];
    journal.setOwner("alice");
    journal.markLoaded("alice");
    const old = journal.begin("alice")!;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release=resolve; }).then(()=>{if(old.isCurrent()) committed.push("alice");old.finish();});
    expect(journal.begin("alice")).toBeNull();
    journal.setOwner("bob");
    journal.markLoaded("bob");
    const current=journal.begin("bob")!;
    if(current.isCurrent()) committed.push("bob");
    current.finish(); release(); await pending;
    expect(committed).toEqual(["bob"]);
  });
  it("allows only one write until it finishes, including after failure", () => {
    const journal = new JournalOperations();
    journal.setOwner("alice");
    journal.markLoaded("alice");
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
    journal.markLoaded("alice");
    const old = journal.begin("alice")!;
    journal.setOwner(null);
    journal.setOwner("alice");
    journal.markLoaded("alice");
    const current = journal.begin("alice")!;
    expect(old.isCurrent()).toBe(false);
    old.finish();
    expect(current.isCurrent()).toBe(true);
    expect(journal.busy).toBe(true);
  });
  it("rejects stale account handlers and preserves requests on token refresh", () => {
    const journal = new JournalOperations();
    journal.setOwner("alice");
    journal.markLoaded("alice");
    const write = journal.begin("alice")!;
    journal.setOwner("alice");
    expect(write.isCurrent()).toBe(true);
    journal.setOwner("bob");
    expect(write.isCurrent()).toBe(false);
    expect(journal.begin("alice")).toBeNull();
    journal.markLoaded("bob");
    expect(journal.begin("bob")).not.toBeNull();
  });
});

describe("complete-journal requirement", () => {
  it("blocks writes after sign-in or a failed load until a complete retry succeeds", () => {
    const journal = new JournalOperations();
    journal.setOwner("alice");
    expect(journal.ready).toBe(false);
    expect(journal.begin("alice")).toBeNull();
    journal.markLoaded("alice");
    journal.markLoadFailed("alice");
    expect(journal.begin("alice")).toBeNull();
    journal.markLoaded("alice");
    expect(journal.begin("alice")).not.toBeNull();
  });

  it("does not let another account's load unlock or block the current journal", () => {
    const journal = new JournalOperations();
    journal.setOwner("bob");
    journal.markLoaded("alice");
    expect(journal.ready).toBe(false);
    journal.markLoaded("bob");
    journal.markLoadFailed("alice");
    expect(journal.ready).toBe(true);
    journal.setOwner(null);
    expect(journal.begin(null)).not.toBeNull();
  });

  it("requires a fresh load when signing back into the same account", () => {
    const journal = new JournalOperations();
    journal.setOwner("alice"); journal.markLoaded("alice");
    journal.setOwner(null); journal.setOwner("alice");
    expect(journal.begin("alice")).toBeNull();
  });
});

describe("list creation attempt identity", () => {
  it("reuses the same identifier after an uncertain response and allocates a new one after success", () => {
    const attempt = new CreationAttempt();
    const first = attempt.idFor("alice", "Capitals");
    expect(attempt.idFor("alice", "Capitals")).toBe(first);
    attempt.clear();
    expect(attempt.idFor("alice", "Capitals")).not.toBe(first);
  });

  it("does not share identifiers between distinct drafts or accounts", () => {
    const attempt = new CreationAttempt();
    const ids = [attempt.idFor("alice", "Capitals"), attempt.idFor("alice", "Coasts"), attempt.idFor("bob", "Coasts"), attempt.idFor(null, "Coasts")];
    expect(new Set(ids).size).toBe(4);
  });
});
