const { ServiceUnavailableException } = require('@nestjs/common');

const DEFAULT_TIMEOUT_MS = 15000;

function resolveAiProviderConfig(env = process.env) {
  const explicitProvider = String(env.AI_PROVIDER || '').trim().toLowerCase();
  const timeoutMs = Math.min(Math.max(Number(env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS, 2000), 45000);

  const geminiKey = String(env.GEMINI_API_KEY || (explicitProvider === 'gemini' ? env.AI_API_KEY : '') || '').trim();
  const openaiKey = String(env.OPENAI_API_KEY || (explicitProvider === 'openai' || explicitProvider === 'openai-compatible' ? env.AI_API_KEY : '') || '').trim();
  const anthropicKey = String(env.ANTHROPIC_API_KEY || (explicitProvider === 'anthropic' ? env.AI_API_KEY : '') || '').trim();

  let provider = explicitProvider;
  if (!provider) {
    if (geminiKey) provider = 'gemini';
    else if (openaiKey) provider = 'openai';
    else if (anthropicKey) provider = 'anthropic';
  }

  if (provider === 'gemini' && geminiKey) {
    return {
      configured: true,
      provider: 'gemini',
      apiKey: geminiKey,
      model: String(env.AI_MODEL || 'gemini-2.5-flash').trim(),
      baseUrl: String(env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''),
      timeoutMs,
    };
  }

  if ((provider === 'openai' || provider === 'openai-compatible') && openaiKey) {
    return {
      configured: true,
      provider,
      apiKey: openaiKey,
      model: String(env.AI_MODEL || 'gpt-4o-mini').trim(),
      baseUrl: String(env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
      timeoutMs,
    };
  }

  if (provider === 'anthropic' && anthropicKey) {
    return {
      configured: true,
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: String(env.AI_MODEL || 'claude-3-5-haiku-latest').trim(),
      baseUrl: String(env.AI_BASE_URL || 'https://api.anthropic.com/v1').replace(/\/$/, ''),
      timeoutMs,
    };
  }

  return {
    configured: false,
    provider: provider || null,
    apiKey: '',
    model: '',
    baseUrl: '',
    timeoutMs,
  };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiProvider(config, { systemPrompt, history, userMessage }) {
  const url = `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const contents = [
    ...history.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 512,
        },
      }),
    },
    config.timeoutMs
  );

  if (!response.ok) {
    throw new ServiceUnavailableException('Medical AI assistant is temporarily unavailable. Please message our Pharmacy Support team.');
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new ServiceUnavailableException('Medical AI assistant did not return a response. Please try again or contact Pharmacy Support.');
  }

  return { text, provider: config.provider, model: config.model };
}

async function callOpenAiCompatibleProvider(config, { systemPrompt, history, userMessage }) {
  const url = `${config.baseUrl}/chat/completions`;
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((turn) => ({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      content: turn.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.25,
        max_tokens: 512,
      }),
    },
    config.timeoutMs
  );

  if (!response.ok) {
    throw new ServiceUnavailableException('Medical AI assistant is temporarily unavailable. Please message our Pharmacy Support team.');
  }

  const data = await response.json();
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!text) {
    throw new ServiceUnavailableException('Medical AI assistant did not return a response. Please try again or contact Pharmacy Support.');
  }

  return { text, provider: config.provider, model: config.model };
}

async function callAnthropicProvider(config, { systemPrompt, history, userMessage }) {
  const url = `${config.baseUrl}/messages`;
  const messages = [
    ...history.map((turn) => ({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      content: turn.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        system: systemPrompt,
        messages,
        temperature: 0.25,
        max_tokens: 512,
      }),
    },
    config.timeoutMs
  );

  if (!response.ok) {
    throw new ServiceUnavailableException('Medical AI assistant is temporarily unavailable. Please message our Pharmacy Support team.');
  }

  const data = await response.json();
  const text = (Array.isArray(data?.content) ? data.content : [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new ServiceUnavailableException('Medical AI assistant did not return a response. Please try again or contact Pharmacy Support.');
  }

  return { text, provider: config.provider, model: config.model };
}

async function generateAiCompletion({ systemPrompt, history = [], userMessage }, env = process.env) {
  const config = resolveAiProviderConfig(env);
  if (!config.configured) {
    throw new ServiceUnavailableException(
      'Medical AI is not currently configured on this server. Please switch to the Pharmacy Support tab to message a MediQuick pharmacist directly.'
    );
  }

  try {
    if (config.provider === 'gemini') {
      return await callGeminiProvider(config, { systemPrompt, history, userMessage });
    }
    if (config.provider === 'openai' || config.provider === 'openai-compatible') {
      return await callOpenAiCompatibleProvider(config, { systemPrompt, history, userMessage });
    }
    if (config.provider === 'anthropic') {
      return await callAnthropicProvider(config, { systemPrompt, history, userMessage });
    }
  } catch (error) {
    if (error instanceof ServiceUnavailableException) {
      throw error;
    }
    if (error?.name === 'AbortError') {
      throw new ServiceUnavailableException(
        'Medical AI took too long to respond. Please try again or message Pharmacy Support.'
      );
    }
    throw new ServiceUnavailableException(
      'Unable to reach the Medical AI service right now. Please try again or switch to Pharmacy Support.'
    );
  }

  throw new ServiceUnavailableException(
    'Unsupported AI provider configuration. Please contact Pharmacy Support.'
  );
}

module.exports = {
  generateAiCompletion,
  resolveAiProviderConfig,
};
