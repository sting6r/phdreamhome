import MainFooterCards from "../../components/MainFooterCards";

export const metadata = { title: "Terms and Conditions - PhDreamHome" };

export default function TermsPage() {
  return (
    <div className="container space-y-6">
      <div className="text-2xl font-semibold">Terms and Conditions</div>
      <div className="text-sm text-black">Effective date: November 26, 2025</div>
      <div className="card space-y-4 text-sm text-black">
        <div>
          <div className="font-semibold mb-1">1. Acceptance of Terms</div>
          <p>By accessing or using PhDreamHome, you agree to be bound by these Terms and Conditions. If you do not agree, please discontinue use of the site.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">2. Service Description</div>
          <p>PhDreamHome provides a platform for browsing, listing, and managing real estate properties. We do not guarantee the accuracy, completeness, or availability of listings and related information.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">3. User Accounts</div>
          <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You agree to provide accurate information and to promptly update any changes.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">4. Listings and Content</div>
          <p>Users may submit property listings and related content. You represent that you have the right to post such content and that it does not infringe any third‑party rights. We may remove content at our discretion.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">5. Permitted Use</div>
          <p>You agree not to misuse the site, including by scraping, reverse engineering, disrupting service, posting unlawful content, or engaging in fraudulent activity.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">6. Payments</div>
          <p>Any fees, if applicable, will be disclosed prior to purchase. All transactions are subject to the terms of the payment provider. We are not responsible for payment processing issues beyond our reasonable control.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">7. Intellectual Property</div>
          <p>All site materials, trademarks, and logos are owned by PhDreamHome or its licensors. You may not copy, modify, distribute, or create derivative works without prior written consent.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">8. Third‑Party Links</div>
          <p>The site may contain links to third‑party services. We are not responsible for their content, policies, or practices.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">9. Disclaimers</div>
          <p>The site is provided on an “as is” and “as available” basis. We disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, and non‑infringement.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">10. Limitation of Liability</div>
          <p>To the maximum extent permitted by law, PhDreamHome will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits or data arising from your use of the site.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">11. Indemnification</div>
          <p>You agree to indemnify and hold harmless PhDreamHome and its affiliates from any claims, liabilities, damages, losses, and expenses arising from your use of the site or violation of these Terms.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">12. Termination</div>
          <p>We may suspend or terminate access to the site at any time, with or without notice, for conduct that we believe violates these Terms or is harmful to other users or the site.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">13. Governing Law</div>
          <p>These Terms are governed by the laws of the Republic of the Philippines, without regard to its conflict of law principles.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">14. Changes to Terms</div>
          <p>We may update these Terms from time to time. Continued use after changes constitutes acceptance of the updated Terms.</p>
        </div>
        <div>
          <div className="font-semibold mb-1">15. Contact</div>
          <p>For questions about these Terms, contact us at support@phdreamhome.example.</p>
        </div>
      </div>
      <MainFooterCards />
    </div>
  );
}
