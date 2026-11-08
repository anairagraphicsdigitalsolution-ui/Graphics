'use client';
import { useEffect, useState } from 'react';

const numbers = [
  { label: '+91 97365 80084', tel: '+919736580084', wa: '919736580084' },
  { label: '+91 97365 00084', tel: '+919736500084', wa: '919736500084' },
];

export default function ProjectEnquiryModal() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);
  return <>
    <button className="btn nav-cta" type="button" onClick={() => setOpen(true)}>Start a Project ↗</button>
    {open && <div className="project-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section className="project-modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
        <button className="project-modal-close" type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button>
        <div className="eyebrow">LET’S CONNECT</div><h2 id="project-modal-title">How would you like to start?</h2>
        <p className="project-modal-intro">Choose a direct conversation or send us your project details.</p>
        <div className="project-modal-actions">
          <div className="project-choice"><strong>Call Anaira</strong>{numbers.map(n => <a key={n.tel} href={`tel:${n.tel}`}> <span>{n.label}</span><b>Call ↗</b></a>)}</div>
          <div className="project-choice"><strong>WhatsApp Anaira</strong>{numbers.map(n => <a key={n.wa} href={`https://wa.me/${n.wa}?text=Hello%20Anaira%2C%20I%20would%20like%20to%20discuss%20a%20project.`} target="_blank" rel="noreferrer"><span>{n.label}</span><b>Chat ↗</b></a>)}</div>
        </div>
        <form className="project-modal-form" action="/api/contact" method="post">
          <strong>Send a project enquiry</strong>
          <div className="modal-form-grid"><input name="name" required maxLength={120} placeholder="Your name *"/><input name="contact" required maxLength={180} placeholder="Phone / WhatsApp / Email *"/></div>
          <select name="department" defaultValue="General enquiry"><option>General enquiry</option><option>Graphic Design & Branding</option><option>Social Media & Advertising</option><option>Website Development</option><option>Software Development</option><option>SEO & Digital Growth</option></select>
          <textarea name="message" required maxLength={5000} rows={3} placeholder="Tell us briefly about your project *"/>
          <label className="modal-consent"><input type="checkbox" required/> I agree that Anaira may contact me about this enquiry.</label>
          <button className="btn" type="submit">Send Enquiry ↗</button>
          
        </form>
      </section>
    </div>}
  </>;
}
