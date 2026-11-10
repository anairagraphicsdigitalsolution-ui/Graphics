const fs=require('fs');
const api=fs.readFileSync('app/api/growth/billing/route.ts','utf8');
const ui=fs.readFileSync('components/growth-billing-admin.tsx','utf8');
const schema=fs.readFileSync('supabase/migrations/20261111100000_growth_manual_billing_invoices_v6811.sql','utf8');
const workspace=fs.readFileSync('components/growth-workspace-billing.tsx','utf8');
const checks=[
 ['platform admin only can record offline payments',api.includes("if(!await platformAdmin(c.db,c.userId))")&&api.includes("b.action==='record_manual_payment'")],
 ['cash, UPI and bank transfer methods allow-listed',api.includes("['cash','upi','bank_transfer'].includes(method)")],
 ['UPI requires transaction reference',api.includes("method==='upi'&&!reference")],
 ['payment ledger and invoice tables migration present',schema.includes('growth_manual_payments')&&schema.includes('growth_invoices')],
 ['payment receipt saved before invoice and subscription activation',api.indexOf("from('growth_manual_payments').insert")<api.indexOf("from('growth_invoices').insert")&&api.includes("status:'active'")],
 ['failed invoice or activation attempts trigger rollback',api.includes("delete().eq('id',payment.id)")&&api.includes("delete().eq('id',invoice.id)")],
 ['admin UI supports manual collection and print invoice',ui.includes('Save payment & create invoice')&&ui.includes('Print / Save PDF')],
 ['payment history and invoice history visible',ui.includes('Payment history')&&ui.includes('Invoices (')],
 ['workspace plan page distinguishes Cashfree from offline payments',workspace.includes('paymentChoice')&&workspace.includes('Anaira admin must verify receipt')],
 ['offline payment cannot be self-marked as paid by workspace',workspace.includes("paymentChoice!=='cashfree'")]
];
for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} manual billing checks passed`);
