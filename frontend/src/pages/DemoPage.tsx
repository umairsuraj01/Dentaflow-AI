// DemoPage.tsx — Public demo page with video and sample 3D viewer (no login required).

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Brain, Play, ArrowRight, CheckCircle, Zap, Shield, Clock,
  Users, BarChart3, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { APP_NAME, ROUTES } from '@/constants';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const FEATURES = [
  {
    icon: Brain,
    title: 'AI Tooth Detection',
    desc: 'Upload a dental scan and our AI identifies and separates every tooth in seconds with clinical accuracy.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: BarChart3,
    title: 'Smart Treatment Planning',
    desc: 'Automatic aligner staging, attachment planning, and movement simulation — all powered by AI.',
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    icon: Sparkles,
    title: 'Manufacturing Ready',
    desc: 'Generate manufacturing sheets, track production orders, and manage delivery — all in one place.',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    desc: 'Dentists upload cases, your team processes them, managers oversee production — all in one platform.',
    gradient: 'from-amber-500 to-orange-500',
  },
];

const WORKFLOW_STEPS = [
  { step: '01', title: 'Upload Scan', desc: 'Doctor uploads the patient\'s dental scan' },
  { step: '02', title: 'AI Analysis', desc: 'Our AI identifies and maps every tooth automatically' },
  { step: '03', title: 'Treatment Plan', desc: 'AI creates the full aligner treatment plan' },
  { step: '04', title: 'Manufacturing', desc: 'We produce your aligners and track the order' },
  { step: '05', title: 'Delivery', desc: 'Aligners shipped directly to your practice' },
];

export function DemoPage() {
  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 lg:px-12 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#06B6D4]">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-dark-text tracking-tight">{APP_NAME}</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to={ROUTES.LOGIN}>
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link to={ROUTES.REGISTER}>
            <Button variant="gradient" size="sm">Get Started <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0F172A]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[10%] left-[15%] h-[400px] w-[400px] rounded-full bg-[#3B82F6]/[0.1] blur-[120px]" />
          <div className="absolute bottom-[15%] right-[10%] h-[350px] w-[350px] rounded-full bg-[#06B6D4]/[0.08] blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 lg:py-28 text-center">
          <motion.div variants={fadeUp}>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 mb-6 backdrop-blur-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-slate-300">See how it works</span>
            </div>
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
            AI-Powered Dental
            <br />
            <span className="bg-gradient-to-r from-[#3B82F6] via-[#06B6D4] to-[#10B981] bg-clip-text text-transparent">
              Treatment Planning
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            From intraoral scan to manufactured aligners — fully automated with deep learning.
            Upload, segment, plan, and manufacture in one platform.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to={ROUTES.REGISTER}>
              <Button variant="gradient" className="h-12 px-8 text-base shadow-button hover:shadow-glow-blue">
                Start Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>

          {/* Video Demo Placeholder */}
          <motion.div variants={fadeUp} className="mt-14 max-w-3xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/30 aspect-video bg-slate-900/80 backdrop-blur-sm">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 cursor-pointer hover:bg-white/20 hover:scale-110 transition-all duration-300">
                  <Play className="h-8 w-8 text-white ml-1" />
                </div>
                <p className="text-sm font-medium text-white/70">Watch the 60-second demo</p>
              </div>
              {/* Replace this div with an actual video embed:
                  <iframe src="https://www.youtube.com/embed/YOUR_VIDEO_ID" ... /> */}
            </div>
            <p className="mt-3 text-xs text-slate-500 text-center">
              See the full workflow: scan upload → AI analysis → treatment plan → manufacturing
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* How It Works */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        className="max-w-5xl mx-auto px-6 py-20"
      >
        <motion.div variants={fadeUp} className="text-center mb-14">
          <h2 className="text-3xl font-extrabold text-dark-text tracking-tight">How It Works</h2>
          <p className="mt-3 text-slate-500 max-w-lg mx-auto">Five simple steps from scan to delivery</p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-5">
          {WORKFLOW_STEPS.map((s, i) => (
            <motion.div key={s.step} variants={fadeUp} className="relative text-center group">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-gradient-to-br from-electric/10 to-cyan-500/10 border border-electric/10 mb-4 group-hover:scale-110 transition-transform duration-300">
                <span className="text-lg font-extrabold text-electric">{s.step}</span>
              </div>
              <h3 className="text-sm font-bold text-dark-text mb-1">{s.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div className="hidden sm:block absolute top-7 -right-2 w-4">
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Features */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        className="bg-white border-y border-slate-200/60"
      >
        <div className="max-w-5xl mx-auto px-6 py-20">
          <motion.div variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-dark-text tracking-tight">Everything You Need</h2>
            <p className="mt-3 text-slate-500 max-w-lg mx-auto">One platform for the entire clear aligner workflow</p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-card hover:shadow-card-hover transition-all duration-300"
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} text-white mb-4 shadow-sm`}>
                  <f.icon className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <h3 className="text-lg font-bold text-dark-text mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Trust */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="max-w-5xl mx-auto px-6 py-20"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { icon: Shield, label: 'Your data is safe', desc: 'Enterprise-grade encryption' },
            { icon: Zap, label: 'Fast processing', desc: 'AI results in seconds' },
            { icon: Clock, label: 'Quick turnaround', desc: 'Same-day available' },
            { icon: CheckCircle, label: 'Reliable results', desc: 'Clinically validated AI' },
          ].map((t) => (
            <motion.div key={t.label} variants={fadeUp} className="text-center">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-slate-100 mb-3">
                <t.icon className="h-6 w-6 text-slate-600" strokeWidth={1.8} />
              </div>
              <p className="text-sm font-bold text-dark-text">{t.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0F172A] py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Ready to get started?</h2>
          <p className="mt-4 text-slate-400 max-w-lg mx-auto">
            Join dental professionals who trust {APP_NAME} for AI-powered treatment planning and aligner manufacturing.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to={ROUTES.REGISTER}>
              <Button variant="gradient" className="h-12 px-8 text-base shadow-button hover:shadow-glow-blue">
                Create Your Account <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to={ROUTES.LOGIN}>
              <Button variant="ghost" className="h-12 px-8 text-base text-white/70 hover:text-white">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/60 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#06B6D4]">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-dark-text">{APP_NAME}</span>
          </div>
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
