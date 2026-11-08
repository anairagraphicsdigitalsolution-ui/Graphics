import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] as string));

export async function POST(req: Request) {
  const form = await req.formData();
  // Quiet honeypot for basic bot filtering.
  if (String(form.get('website') || '').trim()) return NextResponse.redirect(new URL('/contact?sent=1', req.url), 303);
  const name = String(form.get('name') || '').trim();
  const contact = String(form.get('contact') || '').trim();
  const message = String(form.get('message') || '').trim();
  const department = String(form.get('department') || 'General enquiry').trim();
  if (!name || !contact || !message) return NextResponse.redirect(new URL('/contact?error=missing', req.url), 303);
  if (name.length > 120 || contact.length > 180 || message.length > 5000 || department.length > 120) return NextResponse.redirect(new URL('/contact?error=length', req.url), 303);

  const fullMessage = `Department: ${department}\n\n${message}`;
  let databaseSaved = false;
  if (supabase) {
    const { error } = await supabase.from('inquiries').insert({ name, contact, message: fullMessage });
    databaseSaved = !error;
    if (error) console.error('Anaira enquiry database insert failed:', error.message);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  let emailSent = false;
  if (apiKey && from) {
    const body = [
      'New website enquiry for Anaira Graphics & Digital Solution',
      `Name: ${name}`,
      `Contact: ${contact}`,
      `Department: ${department}`,
      '',
      'Project brief:',
      message,
    ].join('\n');
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: ['anairagraphicsdigitalsolution@gmail.com'],
          subject: `New Anaira website enquiry — ${name}`,
          text: body,
          html: `<h2>New website enquiry</h2><p><b>Name:</b> ${escapeHtml(name)}</p><p><b>Contact:</b> ${escapeHtml(contact)}</p><p><b>Department:</b> ${escapeHtml(department)}</p><hr/><p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>`,
          reply_to: contact.includes('@') ? contact : undefined,
        }),
      });
      emailSent = response.ok;
      if (!response.ok) console.error('Anaira enquiry email failed:', await response.text());
    } catch (error) {
      console.error('Anaira enquiry email request failed:', error);
    }
  }

  const status = emailSent ? 'sent' : (databaseSaved ? 'saved' : 'email-not-configured');
  return NextResponse.redirect(new URL(`/contact?sent=1&delivery=${status}`, req.url), 303);
}
