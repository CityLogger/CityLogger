/** One journal write at a time; old account completions cannot update a new journal. */
export class JournalOperations {
  private owner: string | null = null;
  private generation = 0;
  private active: symbol | null = null;

  setOwner(owner: string | null) {
    if (owner === this.owner) return;
    this.owner = owner;
    this.generation++;
    this.active = null;
  }

  get busy() { return this.active !== null; }

  begin(owner: string | null) {
    if (this.busy || owner !== this.owner) return null;
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
