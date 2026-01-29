import MainFooterCards from "../../components/MainFooterCards";

export const metadata = { title: "Privacy Policy - PhDreamHome" };

export default function PrivacyPage() {
  return (
    <div className="container space-y-6">
      <div className="text-2xl font-semibold">Privacy Policy</div>
      <div className="text-sm text-black">Effective date: November 26, 2025</div>
      <div className="card space-y-4 text-sm text-black">
        <div>
          <div className="font-semibold mb-1">1. Information We Collect</div>
          <p>We collect information you provide, such as name, email, phone, address, profile details, and property listing data. We also collect technical data like IP address, device information, and usage analytics.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">2. How We Use Information</div>
          <p>We use data to operate and improve the site, provide and personalize services, process requests, communicate with you, prevent fraud, and comply with legal obligations.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">3. Legal Bases</div>
          <p>We process data based on your consent, contract performance, legitimate interests, and compliance with law.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">4. Sharing of Information</div>
          <p>We may share data with service providers, analytics partners, payment processors, and as required by law. We do not sell your personal information.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">5. Data Retention</div>
          <p>We retain personal data for as long as necessary to provide services and comply with legal obligations. When no longer needed, we securely delete or anonymize data.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">6. Security</div>
          <p>We implement administrative, technical, and physical safeguards to protect data. No method of transmission or storage is completely secure.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">7. International Transfers</div>
          <p>Your data may be transferred and stored in locations outside your country. We take steps to ensure appropriate protections for such transfers.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">8. Your Rights</div>
          <p>Subject to applicable law, you may request access, correction, deletion, restriction, or portability of your personal data, and you may withdraw consent at any time.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">9. Cookies</div>
          <p>We use cookies and similar technologies to remember preferences and analyze usage. You can manage cookies through your browser settings.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">10. Third‑Party Services</div>
          <p>Links to third‑party sites are provided for convenience. Their privacy practices are governed by their policies, not ours.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">11. Children’s Privacy</div>
          <p>The site is not intended for children under 13. We do not knowingly collect personal data from children.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">12. Changes</div>
          <p>We may update this Privacy Policy from time to time. Continued use after changes constitutes acceptance of the updated policy.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">13. Contact</div>
          <p>For privacy inquiries, contact us at privacy@phdreamhome.example.</p>
        </div>
      </div>
      <MainFooterCards />
    </div>
  );
}
