/** One journal write at a time; old account completions cannot update a new journal. */
export class JournalOperations {
  private owner: string | null = null;
  private generation = 0;
  private active: symbol | null = null;
  private loaded = false;

  setOwner(owner: string | null) {
    if (owner === this.owner) return;
    this.owner = owner;
    this.generation++;
    this.active = null;
    this.loaded = false;
  }

  get busy() { return this.active !== null; }
  get ready() { return this.owner === null || this.loaded; }

  /** Only call after a complete, still-current cloud journal has been read. */
  markLoaded(owner: string) {
    if (owner === this.owner) this.loaded = true;
  }

  markLoadFailed(owner: string) {
    if (owner === this.owner) this.loaded = false;
  }

  begin(owner: string | null) {
    if (!this.ready || this.busy || owner !== this.owner) return null;
    const generation = this.generation;
    const token = Symbol();
    this.active = token;
    const isCurrent = () => this.generation === generation && this.active === token;
    return {
      isCurrent,
      finish: () => { if (isCurrent()) this.active = null; }
    };
  }
}

/** Keep a creation ID across uncertain responses, until success or a new draft. */
export class CreationAttempt {
  private pending: { key: string; id: string } | null = null;

  idFor(owner: string | null, draft: string): string {
    const key = JSON.stringify([owner, draft]);
    if (this.pending?.key !== key) this.pending = { key, id: crypto.randomUUID() };
    return this.pending.id;
  }

  clear() { this.pending = null; }
}
