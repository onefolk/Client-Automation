import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { memoryStore } from '@/lib/store';
import { Analysis, Business } from '@/lib/types';
import { resolveOrSynthesizeBusinessProfile } from '@/lib/business-resolver';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let business = memoryStore.businesses.get(params.id);
    if (!business) {
      business = resolveOrSynthesizeBusinessProfile(params.id);
    }

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
    const endpoint = isGroq
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const model = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

    const prompt = `You are a premier agency client intelligence auditor.
Analyze this verified business profile:
Name: ${business.name}
Industry: ${business.industry}
Location: ${business.city}, ${business.country}
Domain: ${business.domain || business.website}
Rating: ${business.rating || 4.2} (${business.review_count || 20} reviews)
Verified Contacts: Email: ${business.email || 'None'}, Phone: ${business.phone || 'None'}

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
    const analysis: Analysis = {
      id: crypto.randomUUID(),
      business_id: business.id,
      model: `${model} (Live LLM)`,
      digital_presence_score: parsed.digital_presence_score || 75,
      website_score: parsed.website_score || 80,
      social_score: parsed.social_score || 70,
      seo_score: parsed.seo_score || 60,
      lead_capture_score: parsed.lead_capture_score || 55,
      reputation_score: parsed.reputation_score || 85,
      marketing_maturity: parsed.marketing_maturity || 'GROWTH_OPPORTUNITY',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      created_at: new Date().toISOString(),
    };

    (business as any).analysis = analysis;
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
