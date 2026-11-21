import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="page" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
      <div className="text-center" style={{ maxWidth: 460 }}>
        <div style={{
          width: 84, height: 84, borderRadius: 24, margin: '0 auto 22px',
          background: 'linear-gradient(135deg, #eef2ff, #e0f2fe)', display: 'grid', placeItems: 'center', color: '#4f46e5',
        }}>
          <Compass size={38} />
        </div>
        <div className="num" style={{ fontSize: 62, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--text)' }}>404</div>
        <h2 style={{ fontSize: 20, marginTop: 8 }}>الصفحة غير موجودة</h2>
        <p className="muted mt-8" style={{ lineHeight: 1.8 }}>يبدو أن الرابط الذي فتحته غير صحيح أو تم نقل الصفحة. يمكنك العودة إلى لوحة التحكم والمتابعة.</p>
        <div className="row gap-12 mt-24" style={{ justifyContent: 'center' }}>
          <Link to="/" className="btn btn-primary"><Home size={15} /> لوحة التحكم</Link>
          <button className="btn" onClick={() => history.back()}><ArrowLeft size={15} /> رجوع</button>
        </div>
      </div>
    </div>
  );
}
