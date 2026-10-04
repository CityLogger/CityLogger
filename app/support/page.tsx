import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support | CityLogger",
  description: "Get help with CityLogger accounts, travel logs, privacy and data requests."
};

const supportEmail = "support@citylogger.app";

export default function Support() {
  return <main className="legal-page support-page">
    <nav className="legal-nav" aria-label="CityLogger support navigation">
      <a href="/">CityLogger</a><span aria-hidden="true">·</span>
      <a href="/privacy">Privacy</a><span aria-hidden="true">·</span>
      <a href="/terms">Terms</a>
    </nav>

    <p className="kicker">CITYLOGGER SUPPORT</p>
    <h1>How can we help?</h1>
    <p className="legal-summary">Find quick answers below or email us for help with your account, saved travel data or the CityLogger app.</p>

    <section className="support-contact" aria-labelledby="contact-support">
      <div>
        <p className="kicker">CONTACT SUPPORT</p>
        <h2 id="contact-support">Email the CityLogger team</h2>
        <p>We aim to reply within five working days.</p>
      </div>
      <a className="support-email" href={`mailto:${supportEmail}?subject=CityLogger%20support%20request`}>{supportEmail}</a>
    </section>

    <div className="support-grid">
      <section className="support-card">
        <h2>Account and sign-in</h2>
        <p>Use <strong>Forgotten your password?</strong> on the sign-in screen to request a secure reset email. If the message does not arrive, check spam and confirm that you entered the address used to create the account.</p>
      </section>
      <section className="support-card">
        <h2>Saved travel data</h2>
        <p>After signing in, visits, rankings, lists, Want to Visit entries and your yearly goal synchronise with your account. If something appears missing, confirm you are using the same email address and reopen the app while online.</p>
      </section>
      <section className="support-card">
        <h2>Export or delete</h2>
        <p>Open <strong>Profile → Account &amp; Privacy</strong> to download a JSON copy of your data or permanently delete your account. Account deletion removes the account and associated journal data.</p>
      </section>
      <section className="support-card">
        <h2>Report a problem</h2>
        <p>Tell us your device model, operating-system version, CityLogger app version, what you expected and what happened. Screenshots are helpful, but never send your password or authentication codes.</p>
      </section>
    </div>

    <h2>Privacy requests</h2>
    <p>For access, correction, deletion or other privacy requests, email <a href={`mailto:${supportEmail}?subject=CityLogger%20privacy%20request`}>{supportEmail}</a>. Read the <a href="/privacy">Privacy Policy</a> for details about information handling and your choices.</p>
  </main>;
}
