import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { memoryStore } from '@/lib/store';
import { Analysis, Business } from '@/lib/types';
import { resolveBusinessProfile } from '@/lib/business-resolver';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let business = memoryStore.businesses.get(params.id);
    if (!business) {
      business = resolveBusinessProfile(params.id);
    }

    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const apiKey =
      process.env.GROQ_API_KEY ||
      process.env.LLAMA_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.XAI_API_KEY;

    // Strict validation: Do not hide with silent fallback if API key is missing
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Missing LLM API Key. Please set GROQ_API_KEY (or LLAMA_API_KEY / OPENAI_API_KEY) in your environment variables (.env.local / deployment config).',
          error_code: 'MISSING_API_KEY',
        },
        { status: 400 }
      );
    }

    const isGroq = !!(process.env.GROQ_API_KEY || process.env.LLAMA_API_KEY);
    const isXai = !isGroq && !process.env.OPENAI_API_KEY && !!process.env.XAI_API_KEY;
    const endpoint = isGroq
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : isXai ? 'https://api.x.ai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = isGroq ? 'llama-3.3-70b-versatile' : isXai ? process.env.XAI_MODEL : 'gpt-4o-mini';
    if (!model) return NextResponse.json({ error: 'Set XAI_MODEL to the model enabled for your xAI account.' }, { status: 400 });

    const prompt = `You are a premier agency client intelligence auditor.
Analyze the available business data. Treat missing evidence as unknown, and distinguish recommendations from observed facts. Do not invent ratings, crawl findings or contact verification.
Name: ${business.name}
Industry: ${business.industry}
Location: ${business.city}, ${business.country}
Domain: ${business.domain || business.website}
Rating: ${business.rating ?? 'Unknown'} (${business.review_count ?? 0} recorded reviews)
Public Contacts: Email: ${business.email || 'Unknown'}, Phone: ${business.phone || 'Unknown'}
Recorded audit facts: ${JSON.stringify((business as any).facts || [])}

Return ONLY a valid JSON object with this exact structure:
{
  "digital_presence_score": number (0-100),
  "website_score": number (0-100),
  "social_score": number (0-100),
  "seo_score": number (0-100),
  "lead_capture_score": number (0-100),
  "reputation_score": number (0-100),
  "marketing_maturity": "EARLY_STAGE" | "GROWTH_OPPORTUNITY" | "SCALING",
  "strengths": string[] (3 bespoke strengths referencing ${business.name}),
  "weaknesses": string[] (3 bespoke technical/operational gaps for ${business.name}),
  "opportunities": string[] (3 actionable agency conversion retainers with dollar amounts)
}`;

    const llmRes = await fetch(endpoint, {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.6,
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      let parsedErr = errText;
      try {
        const errJson = JSON.parse(errText);
        parsedErr = errJson.error?.message || errText;
      } catch (_) {}

      return NextResponse.json(
        {
          error: `LLM Provider Error (${llmRes.status}): ${parsedErr}`,
          error_code: llmRes.status === 401 ? 'INVALID_API_KEY' : 'LLM_REQUEST_FAILED',
        },
        { status: llmRes.status }
      );
    }

    const json = await llmRes.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'LLM returned empty response choices.' },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(content);
    const scoreKeys = ['digital_presence_score', 'website_score', 'social_score', 'seo_score', 'lead_capture_score', 'reputation_score'];
    if (!parsed || scoreKeys.some((key) => typeof parsed[key] !== 'number' || !Number.isFinite(parsed[key]) || parsed[key] < 0 || parsed[key] > 100) ||
        !['EARLY_STAGE', 'GROWTH_OPPORTUNITY', 'SCALING'].includes(parsed.marketing_maturity) ||
        ['strengths', 'weaknesses', 'opportunities'].some((key) => !Array.isArray(parsed[key]) || parsed[key].some((item: unknown) => typeof item !== 'string'))) {
      return NextResponse.json({ error: 'LLM returned invalid analysis data. Please try again.' }, { status: 502 });
    }
    const analysis: Analysis = {
      id: crypto.randomUUID(),
      business_id: business.id,
      model: `${model} (Live LLM)`,
      digital_presence_score: parsed.digital_presence_score,
      website_score: parsed.website_score,
      social_score: parsed.social_score,
      seo_score: parsed.seo_score,
      lead_capture_score: parsed.lead_capture_score,
      reputation_score: parsed.reputation_score,
      marketing_maturity: parsed.marketing_maturity || 'GROWTH_OPPORTUNITY',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      created_at: new Date().toISOString(),
    };

    (business as any).analysis = analysis;
    business.last_analyzed_at = analysis.created_at;
    business.updated_at = analysis.created_at;
    business.status = 'ANALYZED';
    memoryStore.businesses.set(business.id, business);

    memoryStore.activities.unshift({
      id: crypto.randomUUID(),
      business_id: business.id,
      event_type: 'analysis.completed',
      title: `Live ${model} Intelligence Audit`,
      description: `Evaluated 6 pillars: ${analysis.marketing_maturity} Maturity across ${analysis.strengths.length} strengths and ${analysis.weaknesses.length} digital gaps.`,
      metadata: {
        industry: business.industry,
        maturity: analysis.marketing_maturity,
        model: analysis.model,
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (err: any) {
    console.error('Error running live deep analysis', err);
    return NextResponse.json({ error: err.message || 'Analysis failed' }, { status: 500 });
  }
}
