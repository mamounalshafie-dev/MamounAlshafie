import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Lock, Mail, ArrowLeft, ShieldCheck, FolderKanban, Landmark, Users,
  BarChart3, CheckCircle2, Sparkles,
} from 'lucide-react';
import { useAuth, useToast } from '../lib/app-context';
import { ApiError } from '../lib/api';
import { Spinner } from '../components/ui';

const DEMO = [
  { role: 'مدير النظام', name: 'م. مؤمن الشافعي', email: 'admin@noor.iq', password: 'admin123', color: '#4f46e5' },
  { role: 'مديرة المشاريع', name: 'سارة الحسيني', email: 'sara@noor.iq', password: 'noor123', color: '#0ea5e9' },
  { role: 'محاسب رئيسي', name: 'زينب عبد الله', email: 'zainab@noor.iq', password: 'noor123', color: '#10b981' },
  { role: 'موظفة', name: 'نورة العتيبي', email: 'noura@noor.iq', password: 'noor123', color: '#8b5cf6' },
];

export default function Login() {
  const [email, setEmail] = useState('admin@noor.iq');
  const [password, setPassword] = useState('admin123');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation() as any;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.push('مرحباً بك في نور ERP 👋', 'success');
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر تسجيل الدخول، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-hero">
        <div>
          <div className="row gap-12">
            <div className="brand-mark" style={{ width: 44, height: 44 }}>
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
                <path d="M5 19V5l14 14V5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>نور ERP</div>
              <div style={{ fontSize: 10.5, letterSpacing: '0.18em', color: '#7d8db0' }}>ENTERPRISE SUITE</div>
            </div>
          </div>

          <h1 style={{ marginTop: 54 }}>
            أدر أعمالك بالكامل<br />
            من <span style={{ background: 'linear-gradient(90deg,#a5b4fc,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>منصة واحدة</span>
          </h1>
          <p className="lead">
            نظام متكامل لإدارة موارد المؤسسات يجمع المشاريع، المبيعات، المشتريات، المخزون،
            المحاسبة والموارد البشرية في تجربة واحدة سريعة وواضحة — بمعايير عالمية.
          </p>

          <div className="login-features">
            {[
              { icon: FolderKanban, title: 'إدارة مشاريع احترافية', desc: 'لوحات Kanban، جداول زمنية، ميزانيات ومتابعة الإنجاز' },
              { icon: Landmark, title: 'محاسبة متكاملة', desc: 'قيود يومية، ميزان مراجعة، قوائم مالية وتقارير تحليلية' },
              { icon: Users, title: 'موارد بشرية ذكية', desc: 'حضور، إجازات، رواتب وهيكل تنظيمي في مكان واحد' },
              { icon: BarChart3, title: 'تحليلات فورية', desc: 'مؤشرات أداء حيّة وتنبيهات ذكية لكل وحدة' },
            ].map((f) => (
              <div className="login-feature" key={f.title}>
                <div className="icon"><f.icon size={17} /></div>
                <div>
                  <b>{f.title}</b>
                  <span>{f.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="login-stats">
            <div><b>16</b><span>مشروع نشط</span></div>
            <div><b>148</b><span>مهمة قيد المتابعة</span></div>
            <div><b>42</b><span>فاتورة مُصدرة</span></div>
            <div><b>99.9%</b><span>جهوزية النظام</span></div>
          </div>
          <p className="tiny" style={{ marginTop: 18, color: '#5f6f8f' }}>
            © 2026 شركة نور التقنية المحدودة · جميع الحقوق محفوظة
          </p>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <div className="row gap-8 mb-12">
            <span className="badge badge-indigo"><ShieldCheck size={12} /> اتصال آمن ومشفّر</span>
          </div>
          <h2>تسجيل الدخول</h2>
          <p className="sub">أدخل بياناتك للوصول إلى مساحة العمل المؤسسية.</p>

          <form onSubmit={submit}>
            <div className="field mb-16">
              <label>البريد الإلكتروني</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', insetInlineStart: 12, top: 12, color: 'var(--muted-2)' }} />
                <input
                  className="input"
                  style={{ paddingInlineStart: 38 }}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.iq"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="field mb-8">
              <label>كلمة المرور</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', insetInlineStart: 12, top: 12, color: 'var(--muted-2)' }} />
                <input
                  className="input"
                  style={{ paddingInlineStart: 38, paddingInlineEnd: 38 }}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  style={{ position: 'absolute', insetInlineEnd: 10, top: 9, background: 'none', border: 'none', color: 'var(--muted-2)', padding: 4 }}
                  aria-label="إظهار كلمة المرور"
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="row-between mb-20">
              <label className="checkbox"><input type="checkbox" defaultChecked /> تذكرني</label>
              <span className="small muted" style={{ cursor: 'pointer' }}>نسيت كلمة المرور؟</span>
            </div>

            {error && (
              <div className="badge badge-red mb-16" style={{ width: '100%', padding: '9px 12px', borderRadius: 10, justifyContent: 'flex-start' }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary btn-lg btn-block" disabled={loading} type="submit">
              {loading ? <><Spinner size={17} /> جارٍ الدخول…</> : <>دخول إلى النظام <ArrowLeft size={17} /></>}
            </button>
          </form>

          <div className="demo-box">
            <div className="title"><Sparkles size={13} /> حسابات تجريبية — اضغط للدخول السريع</div>
            {DEMO.map((d) => (
              <div
                key={d.email}
                className="demo-account"
                onClick={() => { setEmail(d.email); setPassword(d.password); }}
              >
                <div className="row gap-8">
                  <div className="avatar avatar-sm" style={{ background: d.color }}>{d.name.split(' ').slice(-1)[0][0]}</div>
                  <div>
                    <div className="role">{d.role}</div>
                    <div className="creds">{d.email}</div>
                  </div>
                </div>
                <CheckCircle2 size={15} color="var(--green-500)" />
              </div>
            ))}
            <div className="tiny muted mt-8" style={{ textAlign: 'center' }}>
              كلمة مرور المدير: <span className="num">admin123</span> · بقية الحسابات: <span className="num">noor123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
