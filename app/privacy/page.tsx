import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | CityLogger",
  description: "How CityLogger collects, uses and protects account and travel-journal data."
};

const supportEmail = "support@citylogger.app";

export default function PrivacyPolicy() {
  return <main className="legal-page">
    <nav className="legal-nav" aria-label="CityLogger legal navigation">
      <a href="/">CityLogger</a><span aria-hidden="true">·</span>
      <a href="/support">Support</a><span aria-hidden="true">·</span>
      <a href="/terms">Terms</a>
    </nav>

    <p className="kicker">CITYLOGGER</p>
    <h1>Privacy Policy</h1>
    <p><strong>Last updated:</strong> 4 October 2026</p>
    <p className="legal-summary">CityLogger is a private travel journal. We use the minimum information needed to provide accounts, save your travel history and keep it synchronised across your devices. We do not sell personal information, serve behavioural advertising or make your journal public.</p>

    <h2>Who is responsible for your information</h2>
    <p>The App Store seller identified on CityLogger’s product page operates CityLogger and is the controller of personal information processed through the service. In this policy, “CityLogger”, “we” and “us” refer to that operator. Privacy questions and rights requests can be sent to <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>

    <h2>Information we process</h2>
    <ul>
      <li><strong>Account information:</strong> your email address, optional display name, internal account identifier and authentication information.</li>
      <li><strong>Travel-journal content:</strong> cities you select, the city coordinates used to place markers, category ratings, visit dates, visit type, notes, goals, ranking order, Want to Visit entries and personal lists.</li>
      <li><strong>Service and security information:</strong> limited technical records such as IP address, request time, device or browser information and authentication events generated when the service is used.</li>
      <li><strong>Support information:</strong> the contents of messages you choose to send to our support address.</li>
    </ul>

    <h2>Information we do not request</h2>
    <p>The current version does not request access to your device location, camera, photo library, contacts or advertising identifier. It does not include advertising or cross-app tracking. The cities in your journal are places you enter manually; CityLogger does not follow your live location.</p>

    <h2>How and why we use information</h2>
    <p>We process account and journal information to create and secure your account, provide the map and journal features, synchronise your entries, recover account access, respond to support requests and provide data export and deletion. These uses are necessary to provide the service you request. We may also process limited security records to prevent abuse, diagnose failures and meet legal obligations.</p>

    <h2>Service providers</h2>
    <p>CityLogger uses carefully selected providers acting on our behalf:</p>
    <ul>
      <li><strong>Supabase</strong> for account authentication and database hosting.</li>
      <li><strong>Resend</strong> for transactional account emails such as verification and password recovery.</li>
      <li><strong>Cloudflare and OpenAI Sites</strong> for website hosting, delivery and security.</li>
    </ul>
    <p>These providers process information only to supply their services and are required to protect it. Information may be processed outside the UK or European Economic Area using appropriate contractual or legal safeguards.</p>

    <h2>Retention and deletion</h2>
    <p>Your account and journal remain stored while your account is active. Individual visits can be removed inside the app. You can permanently delete the account and its associated profile, visits, ratings, notes, lists and goals from <strong>Profile → Account &amp; Privacy → Delete Account</strong>. Deletion begins immediately, although encrypted backups and security records may remain for a limited period before being overwritten or where retention is legally required.</p>

    <h2>Your choices and rights</h2>
    <p>You can download a JSON copy of your information from <strong>Profile → Account &amp; Privacy → Download My Data</strong>. Depending on where you live, you may also have rights to access, correct, erase, restrict or object to processing, or request portability of your information. Contact <a href={`mailto:${supportEmail}`}>{supportEmail}</a> to make a request. You may also complain to your local data-protection authority.</p>

    <h2>Security</h2>
    <p>CityLogger uses encrypted network connections, account authentication and database row-level security designed to keep each journal accessible only to its owner. No online service can guarantee absolute security, so please use a unique password and contact us if you suspect unauthorised access.</p>

    <h2>Children</h2>
    <p>CityLogger is a general-audience private journal and is not designed to solicit information from children. If you believe a child has created an account without appropriate permission, contact us so we can investigate and delete the information where required.</p>

    <h2>Changes to this policy</h2>
    <p>We may update this policy when CityLogger’s features or legal obligations change. The latest version will remain available at this URL with its effective date.</p>

    <h2>Contact</h2>
    <p>Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a> or visit the <a href="/support">CityLogger support page</a>.</p>
  </main>;
}
