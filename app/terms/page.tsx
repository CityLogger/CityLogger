import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use | CityLog",
  description: "The terms that apply when you use CityLog."
};

const supportEmail = "support@citylogger.app";

export default function Terms() {
  return <main className="legal-page">
    <nav className="legal-nav" aria-label="CityLog legal navigation">
      <a href="/">CityLog</a><span aria-hidden="true">·</span>
      <a href="/support">Support</a><span aria-hidden="true">·</span>
      <a href="/privacy">Privacy</a>
    </nav>

    <p className="kicker">CITYLOG</p>
    <h1>Terms of Use</h1>
    <p><strong>Last updated:</strong> 11 October 2026</p>
    <p className="legal-summary">These terms apply when you use the CityLog website or mobile application. The App Store seller identified on CityLog’s product page provides the service.</p>

    <h2>The service</h2>
    <p>CityLog is a private travel journal for recording, rating, mapping and organising cities. Guest Mode lets you keep a journal locally on one device. Guest entries are not a cloud backup and can be lost if browser or app data is cleared. An account is required for cloud storage and synchronisation across devices.</p>

    <h2>Your account</h2>
    <p>You must provide accurate account information, keep your password secure and tell us promptly if you suspect unauthorised access. You are responsible for activity carried out through your account. We may limit access where reasonably necessary to protect users, the service or the law.</p>

    <h2>Your content</h2>
    <p>You retain ownership of the notes and travel information you add. You give CityLog a limited permission to host, process, back up and display that content only as needed to operate and improve the service for you. The current version does not publish your journal or provide public profiles.</p>

    <h2>Acceptable use</h2>
    <p>You must not misuse CityLog, attempt to access another person’s account, interfere with the service, introduce malicious code, use automated methods that unreasonably burden the service, or add material that is unlawful or infringes another person’s rights.</p>

    <h2>Availability and changes</h2>
    <p>We aim to keep CityLog reliable, but the service may occasionally be unavailable for maintenance, security or reasons outside our control. Features may change as the service develops. If a change materially affects your rights, we will provide reasonable notice where required.</p>

    <h2>Ending your account</h2>
    <p>You may stop using CityLog at any time. You can download your data or permanently delete your account from <strong>Profile → Account &amp; Privacy</strong>. We may suspend or close an account that seriously or repeatedly violates these terms, subject to applicable law.</p>

    <h2>Responsibility</h2>
    <p>CityLog is provided for personal travel journaling and is not professional, safety or travel advice. Nothing in these terms excludes liability that cannot legally be excluded. Subject to those mandatory rights, we are not responsible for indirect losses or losses caused by events outside our reasonable control.</p>

    <h2>Consumer rights</h2>
    <p>These terms do not reduce any mandatory consumer protections that apply where you live. Any dispute will be handled under the laws and courts applicable to the App Store seller, unless local consumer law gives you the right to use another law or court.</p>

    <h2>Contact</h2>
    <p>Questions about these terms can be sent to <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. Product and account help is available on the <a href="/support">CityLog support page</a>.</p>
  </main>;
}
