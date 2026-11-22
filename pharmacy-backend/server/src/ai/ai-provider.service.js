const {
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} = require('@nestjs/common');

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRY_AFTER_SECONDS = 30;
const MAX_RETRY_AFTER_SECONDS = 300;

const PROVIDER_ALIASES = Object.freeze({
  gemini: 'gemini',
  google: 'gemini',
  'google-gemini': 'gemini',
  openai: 'openai',
  'openai-compatible': 'openai-compatible',
  anthropic: 'anthropic',
  claude: 'anthropic',
});

const SUPPORTED_PROVIDERS = new Set(['gemini', 'openai', 'openai-compatible', 'anthropic']);

function normalizeProviderName(rawProvider) {
  const cleaned = String(rawProvider || '').trim().toLowerCase();
  if (!cleaned) return '';
  return PROVIDER_ALIASES[cleaned] || cleaned;
}

function inferProviderFromGenericKey(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) return '';
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('AIza')) return 'gemini';
  if (key.startsWith('sk-')) return 'openai';
  // Default to Gemini to align with .env.example and Render blueprint defaults
  return 'gemini';
}

function resolveAiProviderConfig(env = process.env) {
  const rawExplicitProvider = String(env.AI_PROVIDER || '').trim().toLowerCase();
  const explicitProvider = normalizeProviderName(rawExplicitProvider);
  const timeoutMs = Math.min(Math.max(Number(env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS, 2000), 45000);

  if (explicitProvider && !SUPPORTED_PROVIDERS.has(explicitProvider)) {
    return {
      configured: false,
      provider: explicitProvider,
      unsupportedProvider: true,
      apiKey: '',
      keySource: null,
      model: '',
      baseUrl: '',
      timeoutMs,
      reason: 'unsupported_provider',
    };
  }

  const genericKey = String(env.AI_API_KEY || '').trim();
  const geminiDedicatedKey = String(env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '').trim();
  const openaiDedicatedKey = String(env.OPENAI_API_KEY || '').trim();
  const anthropicDedicatedKey = String(env.ANTHROPIC_API_KEY || '').trim();

  const geminiKeySource = env.GEMINI_API_KEY
    ? 'GEMINI_API_KEY'
    : env.GOOGLE_API_KEY
      ? 'GOOGLE_API_KEY'
      : '';

  let provider = explicitProvider;
  if (!provider) {
    if (geminiDedicatedKey) provider = 'gemini';
    else if (openaiDedicatedKey) provider = 'openai';
    else if (anthropicDedicatedKey) provider = 'anthropic';
    else if (genericKey) provider = inferProviderFromGenericKey(genericKey);
  }

  if (provider === 'gemini') {
    const apiKey = geminiDedicatedKey || genericKey;
    const keySource = geminiDedicatedKey ? geminiKeySource : genericKey ? 'AI_API_KEY' : null;
    if (apiKey) {
      return {
        configured: true,
        provider: 'gemini',
        unsupportedProvider: false,
        apiKey,
        keySource,
        model: String(env.AI_MODEL || '').trim() || 'gemini-2.5-flash',
        baseUrl: (String(env.AI_BASE_URL || '').trim() || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''),
        timeoutMs,
        reason: null,
      };
    }
  }

  if (provider === 'openai' || provider === 'openai-compatible') {
    const apiKey = openaiDedicatedKey || genericKey;
    const keySource = openaiDedicatedKey ? 'OPENAI_API_KEY' : genericKey ? 'AI_API_KEY' : null;
    if (apiKey) {
      return {
        configured: true,
        provider,
        unsupportedProvider: false,
        apiKey,
        keySource,
        model: String(env.AI_MODEL || '').trim() || 'gpt-4o-mini',
        baseUrl: (String(env.AI_BASE_URL || '').trim() || 'https://api.openai.com/v1').replace(/\/$/, ''),
        timeoutMs,
        reason: null,
      };
    }
  }

  if (provider === 'anthropic') {
    const apiKey = anthropicDedicatedKey || genericKey;
    const keySource = anthropicDedicatedKey ? 'ANTHROPIC_API_KEY' : genericKey ? 'AI_API_KEY' : null;
    if (apiKey) {
      return {
        configured: true,
        provider: 'anthropic',
        unsupportedProvider: false,
        apiKey,
        keySource,
        model: String(env.AI_MODEL || '').trim() || 'claude-3-5-haiku-latest',
        baseUrl: (String(env.AI_BASE_URL || '').trim() || 'https://api.anthropic.com/v1').replace(/\/$/, ''),
        timeoutMs,
        reason: null,
      };
    }
  }

  return {
    configured: false,
    provider: provider || null,
    unsupportedProvider: false,
    apiKey: '',
    keySource: null,
    model: '',
    baseUrl: '',
    timeoutMs,
    reason: 'missing_api_key',
  };
}

/**
 * Returns non-secret operational diagnostics suitable for startup logs and health checks.
 * Never includes API keys or credential values.
 */
function getAiProviderDiagnostics(env = process.env) {
  const config = resolveAiProviderConfig(env);
  return {
    configured: config.configured,
    provider: config.provider,
    model: config.model || null,
    hasApiKey: Boolean(config.apiKey),
    keySource: config.keySource,
    timeoutMs: config.timeoutMs,
    reason: config.reason,
  };
}

function logAiProviderEvent(level, payload) {
  const logger = level === 'warn' ? console.warn : level === 'info' ? console.info : console.error;
  logger(
    JSON.stringify({
      event: 'ai_provider_error',
      timestamp: new Date().toISOString(),
      ...payload,
    })
  );
}

function parseRetryAfterSeconds(headers) {
  const raw = headers?.get?.('retry-after') || headers?.get?.('Retry-After');
  if (!raw) return DEFAULT_RETRY_AFTER_SECONDS;

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return Math.min(Math.max(Math.ceil(asNumber), 1), MAX_RETRY_AFTER_SECONDS);
  }

  const parsedDate = Date.parse(raw);
  if (Number.isFinite(parsedDate)) {
    const deltaSeconds = Math.ceil((parsedDate - Date.now()) / 1000);
    if (deltaSeconds > 0) {
      return Math.min(deltaSeconds, MAX_RETRY_AFTER_SECONDS);
    }
  }

  return DEFAULT_RETRY_AFTER_SECONDS;
}

async function readSafeUpstreamErrorMeta(response) {
  try {
    const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return { upstreamCode: null, upstreamType: null, isAuthHint: false };
    }
    const body = await response.json();
    const errObj = body?.error && typeof body.error === 'object' ? body.error : body;
    const upstreamCode = errObj?.status || errObj?.code || null;
    const upstreamType = errObj?.type || null;
    const rawMsg = typeof errObj?.message === 'string' ? errObj.message : '';
    const details = Array.isArray(errObj?.details) ? errObj.details : [];
    const detailReason = details.find((item) => typeof item?.reason === 'string')?.reason || null;
    const combinedCode = detailReason || (upstreamCode ? String(upstreamCode) : null);

    const isAuthHint =
      /API_KEY_INVALID|INVALID_API_KEY|PERMISSION_DENIED|UNAUTHENTICATED|AUTHENTICATION_ERROR/i.test(
        `${combinedCode || ''} ${upstreamType || ''}`
      ) || /api key not valid|invalid api key|incorrect api key/i.test(rawMsg);

    const isQuotaHint =
      /RESOURCE_EXHAUSTED|RATE_LIMIT_EXCEEDED|INSUFFICIENT_QUOTA/i.test(
        `${combinedCode || ''} ${upstreamType || ''}`
      );

    return {
      upstreamCode: combinedCode ? String(combinedCode).slice(0, 80) : null,
      upstreamType: upstreamType ? String(upstreamType).slice(0, 80) : null,
      isAuthHint,
      isQuotaHint,
    };
  } catch (parseError) {
    return { upstreamCode: null, upstreamType: null, isAuthHint: false, isQuotaHint: false };
  }
}

async function handleUpstreamFailure(response, config, startedAt) {
  const status = Number(response.status) || 502;
  const latencyMs = Date.now() - startedAt;
  const meta = await readSafeUpstreamErrorMeta(response);

  // 1. Rate limit / quota exceeded (429 or explicit quota exhaustion)
  if (status === 429 || meta.isQuotaHint) {
    const retryAfterSeconds = parseRetryAfterSeconds(response.headers);
    logAiProviderEvent('warn', {
      reason: 'provider_rate_limited',
      provider: config.provider,
      model: config.model,
      upstreamStatus: status,
      upstreamCode: meta.upstreamCode,
      retryAfterSeconds,
      latencyMs,
    });
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        code: 'AI_RATE_LIMITED',
        retryAfterSeconds,
        message: `Medical AI is currently busy. Please wait ${retryAfterSeconds}s and try again, or switch to Pharmacy Support.`,
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  // 2. Invalid or unauthorized API key (401/403 or Gemini 400 API_KEY_INVALID)
  if (status === 401 || status === 403 || (status === 400 && meta.isAuthHint)) {
    logAiProviderEvent('error', {
      reason: 'invalid_api_key',
      provider: config.provider,
      model: config.model,
      keySource: config.keySource,
      upstreamStatus: status,
      upstreamCode: meta.upstreamCode,
      latencyMs,
    });
    throw new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      code: 'AI_AUTH_ERROR',
      message:
        'Medical AI is temporarily unavailable due to a server configuration issue. Please switch to the Pharmacy Support tab.',
    });
  }

  // 3. Invalid model or bad provider request (400/404/422)
  if (status >= 400 && status < 500) {
    logAiProviderEvent('error', {
      reason: 'invalid_model_or_request',
      provider: config.provider,
      model: config.model,
      upstreamStatus: status,
      upstreamCode: meta.upstreamCode,
      upstreamType: meta.upstreamType,
      latencyMs,
    });
    throw new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      code: 'AI_CONFIG_ERROR',
      message:
        'Medical AI assistant is temporarily unavailable. Please try again or message our Pharmacy Support team.',
    });
  }

  // 4. Upstream provider outage (5xx)
  logAiProviderEvent('error', {
    reason: 'provider_outage',
    provider: config.provider,
    model: config.model,
    upstreamStatus: status,
    upstreamCode: meta.upstreamCode,
    latencyMs,
  });
  throw new ServiceUnavailableException({
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    error: 'Service Unavailable',
    code: 'AI_PROVIDER_UNAVAILABLE',
    message:
      'Medical AI assistant is temporarily unavailable. Please try again or message our Pharmacy Support team.',
  });
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

async function parseJsonOrThrow(response, config, startedAt) {
  try {
    return await response.json();
  } catch (error) {
    logAiProviderEvent('error', {
      reason: 'invalid_provider_response',
      provider: config.provider,
      model: config.model,
      upstreamStatus: response.status,
      latencyMs: Date.now() - startedAt,
    });
    throw new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      code: 'AI_PROVIDER_UNAVAILABLE',
      message:
        'Medical AI assistant returned an unexpected response. Please try again or contact Pharmacy Support.',
    });
  }
}

async function callGeminiProvider(config, { systemPrompt, history, userMessage }, startedAt) {
  const url = `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`;
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
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
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
    await handleUpstreamFailure(response, config, startedAt);
  }

  const data = await parseJsonOrThrow(response, config, startedAt);
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('')
    .trim();

  if (!text) {
    logAiProviderEvent('warn', {
      reason: 'empty_response',
      provider: config.provider,
      model: config.model,
      finishReason: data?.candidates?.[0]?.finishReason || null,
      blockReason: data?.promptFeedback?.blockReason || null,
      latencyMs: Date.now() - startedAt,
    });
    throw new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      code: 'AI_EMPTY_RESPONSE',
      message:
        'Medical AI assistant did not return a response. Please try again or contact Pharmacy Support.',
    });
  }

  return { text, provider: config.provider, model: config.model };
}

async function callOpenAiCompatibleProvider(config, { systemPrompt, history, userMessage }, startedAt) {
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
    await handleUpstreamFailure(response, config, startedAt);
  }

  const data = await parseJsonOrThrow(response, config, startedAt);
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!text) {
    logAiProviderEvent('warn', {
      reason: 'empty_response',
      provider: config.provider,
      model: config.model,
      finishReason: data?.choices?.[0]?.finish_reason || null,
      latencyMs: Date.now() - startedAt,
    });
    throw new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      code: 'AI_EMPTY_RESPONSE',
      message:
        'Medical AI assistant did not return a response. Please try again or contact Pharmacy Support.',
    });
  }

  return { text, provider: config.provider, model: config.model };
}

async function callAnthropicProvider(config, { systemPrompt, history, userMessage }, startedAt) {
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
    await handleUpstreamFailure(response, config, startedAt);
  }

  const data = await parseJsonOrThrow(response, config, startedAt);
  const text = (Array.isArray(data?.content) ? data.content : [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text || '')
    .join('')
    .trim();

  if (!text) {
    logAiProviderEvent('warn', {
      reason: 'empty_response',
      provider: config.provider,
      model: config.model,
      stopReason: data?.stop_reason || null,
      latencyMs: Date.now() - startedAt,
    });
    throw new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      code: 'AI_EMPTY_RESPONSE',
      message:
        'Medical AI assistant did not return a response. Please try again or contact Pharmacy Support.',
    });
  }

  return { text, provider: config.provider, model: config.model };
}

async function generateAiCompletion({ systemPrompt, history = [], userMessage }, env = process.env) {
  const startedAt = Date.now();
  const config = resolveAiProviderConfig(env);

  if (!config.configured) {
    logAiProviderEvent('error', {
      reason: config.reason || 'missing_api_key',
      provider: config.provider,
      hasApiKey: false,
    });
    throw new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      code: config.unsupportedProvider ? 'AI_UNSUPPORTED_PROVIDER' : 'AI_NOT_CONFIGURED',
      message: config.unsupportedProvider
        ? 'Unsupported AI provider configuration. Please contact Pharmacy Support.'
        : 'Medical AI is not currently configured on this server. Please switch to the Pharmacy Support tab to message a MediQuick pharmacist directly.',
    });
  }

  try {
    if (config.provider === 'gemini') {
      return await callGeminiProvider(config, { systemPrompt, history, userMessage }, startedAt);
    }
    if (config.provider === 'openai' || config.provider === 'openai-compatible') {
      return await callOpenAiCompatibleProvider(config, { systemPrompt, history, userMessage }, startedAt);
    }
    if (config.provider === 'anthropic') {
      return await callAnthropicProvider(config, { systemPrompt, history, userMessage }, startedAt);
    }
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      logAiProviderEvent('warn', {
        reason: 'timeout',
        provider: config.provider,
        model: config.model,
        timeoutMs: config.timeoutMs,
        latencyMs: Date.now() - startedAt,
      });
      throw new GatewayTimeoutException({
        statusCode: HttpStatus.GATEWAY_TIMEOUT,
        error: 'Gateway Timeout',
        code: 'AI_TIMEOUT',
        message: 'Medical AI took too long to respond. Please try again or message Pharmacy Support.',
      });
    }
    logAiProviderEvent('error', {
      reason: 'network_error',
      provider: config.provider,
      model: config.model,
      errorName: error?.name || 'Error',
      errorCode: error?.cause?.code || error?.code || null,
      latencyMs: Date.now() - startedAt,
    });
    throw new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      code: 'AI_PROVIDER_UNAVAILABLE',
      message:
        'Unable to reach the Medical AI service right now. Please try again or switch to Pharmacy Support.',
    });
  }

  logAiProviderEvent('error', {
    reason: 'unsupported_provider',
    provider: config.provider,
  });
  throw new ServiceUnavailableException({
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    error: 'Service Unavailable',
    code: 'AI_UNSUPPORTED_PROVIDER',
    message: 'Unsupported AI provider configuration. Please contact Pharmacy Support.',
  });
}

module.exports = {
  generateAiCompletion,
  getAiProviderDiagnostics,
  resolveAiProviderConfig,
};
