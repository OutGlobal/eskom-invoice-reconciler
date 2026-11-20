/** Server-only OpenAI invoice reader. Never import from browser components. */
import { createClient } from '@supabase/supabase-js';

const schemaPrompt = `You are ENERA's financial document reader. Read EVERY page of this South African electricity invoice, including scanned page images. Return ONLY a JSON object with keys: accountNumber, invoiceNumber, customerName, billingPeriodStart, billingPeriodEnd, billingPeriod, tariffName, meterNumber, premiseId, totalKwh, peakKwh, standardKwh, offPeakKwh, maximumDemandKva, totalInvoice, vat, lineItems, evidence, warnings. Use null for every missing or illegible field; never guess or infer from filename. Numbers are JSON numbers without thousands separators. Dates are YYYY-MM-DD if clearly legible. lineItems is an array of {description,amount,rate,quantity,page}. evidence is an array of {field,page,quote}. If a financial value is ambiguous, use null and explain in warnings. Do not calculate totals from other fields. Output exact observed values.`;

export async function handleAiInvoiceExtraction(request: Request): Promise<Response> {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return json(503, { error: 'AI document extraction is not configured' });
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json(401, { error: 'Authentication required' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return json(503, { error: 'Authentication provider unavailable' });
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return json(401, { error: 'Invalid session' });
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/pdf')) return json(415, { error: 'PDF required' });
  const declaredSize = Number(request.headers.get('content-length') || 0);
  if (declaredSize > 10 * 1024 * 1024) return json(413, { error: 'Maximum PDF size is 10 MB' });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) return json(413, { error: 'PDF is empty or too large' });
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') return json(400, { error: 'Invalid PDF signature' });
  const data = Buffer.from(bytes).toString('base64');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 110_000);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_DOCUMENT_MODEL || 'gpt-4.1',
        store: false,
        max_output_tokens: 3500,
        input: [{ role: 'user', content: [
          { type: 'input_text', text: schemaPrompt },
          { type: 'input_file', filename: 'invoice.pdf', file_data: `data:application/pdf;base64,${data}` },
        ] }],
        text: { format: { type: 'json_object' } },
      }),
    });
    if (!response.ok) {
      console.error('ENERA AI document request failed', response.status);
      return json(502, { error: `Document AI provider failed (${response.status})` });
    }
    const payload = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const content = payload.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
    if (!content) return json(502, { error: 'Document AI returned no structured result' });
    const extracted = JSON.parse(content);
    if (!extracted || typeof extracted !== 'object' || Array.isArray(extracted)) return json(502, { error: 'Invalid extraction format' });
    const allowed = ['accountNumber','invoiceNumber','customerName','billingPeriodStart','billingPeriodEnd','billingPeriod','tariffName','meterNumber','premiseId','totalKwh','peakKwh','standardKwh','offPeakKwh','maximumDemandKva','totalInvoice','vat','lineItems','evidence','warnings'];
    const safe: Record<string, unknown> = {};
    for (const field of allowed) safe[field] = extracted[field] ?? null;
    if (!safe.accountNumber && !safe.invoiceNumber) return json(422, { error: 'Document AI could not read a verifiable invoice identifier', warnings: safe.warnings });
    return json(200, { invoice: safe, source: 'openai_vision', reviewRequired: true });
  } catch (err) {
    console.error('ENERA AI invoice processing failed', err instanceof Error ? err.message : String(err));
    return json(502, { error: 'Document AI processing failed' });
  } finally { clearTimeout(timer); }
}
