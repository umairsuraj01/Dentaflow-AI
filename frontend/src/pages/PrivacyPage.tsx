// PrivacyPage.tsx — Privacy Policy (public, no login required).

import { Link } from 'react-router-dom';
import { Brain, ArrowLeft } from 'lucide-react';
import { APP_NAME, APP_SUPPORT_EMAIL } from '@/constants';

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      <nav className="flex items-center justify-between px-6 lg:px-12 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#06B6D4]">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-dark-text tracking-tight">{APP_NAME}</span>
        </Link>
        <Link to="/demo" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-electric transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold text-dark-text tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <div className="prose prose-slate prose-sm max-w-none space-y-6 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-dark-text mt-8 mb-3">1. Information We Collect</h2>
            <p><strong>Account Information:</strong> Name, email address, role, clinic name, country, and timezone when you register.</p>
            <p><strong>Patient Data:</strong> STL scans, dental images, treatment plans, and related clinical data that you upload to the platform.</p>
            <p><strong>Usage Data:</strong> Pages visited, features used, timestamps, browser type, and IP address.</p>
            <p><strong>Payment Data:</strong> Processed securely by Stripe. We do not store credit card numbers on our servers.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-dark-text mt-8 mb-3">2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide and maintain the Service</li>
              <li>Process dental scans using our AI models</li>
              <li>Generate treatment plans and manufacturing files</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send service notifications and updates</li>
              <li>Improve our AI models using anonymized data</li>
              <li>Provide customer support</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-dark-text mt-8 mb-3">3. Data Storage & Security</h2>
            <p>Your data is stored on secure cloud servers with encryption at rest and in transit. We implement industry-standard security measures including:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>AES-256 encryption for data at rest</li>
              <li>TLS 1.3 for data in transit</li>
              <li>Role-based access control</li>
              <li>Regular security audits</li>
              <li>Automatic backups</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-dark-text mt-8 mb-3">4. Data Sharing</h2>
            <p>We do not sell your data. We share data only with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Stripe:</strong> For payment processing</li>
              <li><strong>Cloud providers:</strong> For hosting and storage</li>
              <li><strong>Your organization:</strong> Team members within your organization can access shared cases</li>
              <li><strong>Legal requirements:</strong> If required by law or court order</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-dark-text mt-8 mb-3">5. Patient Data</h2>
            <p>Patient dental data is treated with the highest level of confidentiality. We process it solely to deliver the Service. Patient data is isolated per organization — no other organization can access your patients' data. You are responsible for obtaining appropriate patient consent.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-dark-text mt-8 mb-3">6. AI Model Training</h2>
            <p>We may use anonymized and de-identified dental scan data to improve our AI segmentation models. This data cannot be traced back to any individual patient. You can opt out of AI training data contribution by contacting support.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-dark-text mt-8 mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and data</li>
              <li>Export your data in a standard format</li>
              <li>Opt out of marketing communications</li>
              <li>Opt out of AI training data contribution</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-dark-text mt-8 mb-3">8. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We use analytics cookies to understand how the Service is used. You can disable non-essential cookies in your browser settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-dark-text mt-8 mb-3">9. Data Retention</h2>
            <p>Account data is retained while your account is active. After account deletion, data is permanently removed within 30 days. Anonymized AI training data may be retained indefinitely.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-dark-text mt-8 mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via email. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-dark-text mt-8 mb-3">11. Contact Us</h2>
            <p>For privacy-related questions or to exercise your rights, contact us at <a href={`mailto:${APP_SUPPORT_EMAIL}`} className="text-electric hover:underline">{APP_SUPPORT_EMAIL}</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
