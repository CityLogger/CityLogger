export default function PrivacyPolicy() {
  return <main className="legal-page">
    <a href="/">← Back to CityLogger</a>
    <p className="kicker">CITYLOGGER</p>
    <h1>Privacy Policy</h1>
    <p><strong>Last updated:</strong> 18 July 2026</p>
    <p className="legal-placeholder">Developer action required before release: add the legal business name, postal address, privacy contact email and governing jurisdiction.</p>
    <h2>What CityLogger stores</h2>
    <p>When you create an account, CityLogger processes your account email and may store an optional display name. The service stores cities you log, category ratings, notes, visit dates, visit type and photographs you choose to upload.</p>
    <h2>Why the data is used</h2>
    <p>Your information is used to authenticate your account, save your private travel history, display it on your map and synchronise it across your devices. CityLogger does not currently provide public profiles, advertising or social sharing.</p>
    <h2>Storage provider</h2>
    <p>CityLogger uses Supabase for authentication, PostgreSQL database hosting and private photograph storage. Data is protected by account-level access controls and row-level security.</p>
    <h2>Your choices</h2>
    <p>You can download a JSON copy of your information from Profile → Account & Privacy → Download My Data. You can permanently delete your account and associated visits, ratings, notes and photographs from Profile → Account & Privacy → Delete Account.</p>
    <h2>Photographs and permissions</h2>
    <p>CityLogger only accesses a photograph when you explicitly choose one. It does not request continuous access to your photo library, camera or location.</p>
    <h2>Contact</h2>
    <p>[PRIVACY CONTACT EMAIL TO BE COMPLETED]</p>
  </main>;
}
