const { randomUUID } = require('node:crypto');
const {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} = require('@nestjs/common');
const { generateAiCompletion } = require('./ai-provider.service');
const { lookupVerifiedCatalogueContext } = require('./ai-catalogue.service');
const {
  EDUCATIONAL_DISCLAIMER,
  buildEmergencyResponse,
  buildMedicalSystemPrompt,
  detectMedicalEmergency,
  shouldRecommendPharmacist,
} = require('./medical-safety');

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SESSIONS = 1000;
const MAX_HISTORY_TURNS = 16; // 8 user + 8 assistant messages
const MAX_MESSAGE_LENGTH = 1000;
const MAX_RATE_LIMIT_BUCKETS = 2000;
const MAX_REQUESTS_PER_BUCKET = 1000;

const VERIFIED_GENERAL_SOURCES = [
  { label: 'World Health Organization (WHO)', url: 'https://www.who.int/health-topics' },
  { label: 'MedlinePlus Drug Information', url: 'https://medlineplus.gov/druginformation.html' },
];

class AiService {
  constructor({ completionFn = generateAiCompletion, catalogueLookupFn = lookupVerifiedCatalogueContext } = {}) {
    this.completionFn = completionFn;
    this.catalogueLookupFn = catalogueLookupFn;
    this.sessions = new Map();
    this.rateLimitBuckets = new Map();
  }

  getRateLimitConfig() {
    return {
      windowMs: Math.max(Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 60000, 1000),
      maxRequests: Math.min(Math.max(Number(process.env.AI_RATE_LIMIT_MAX) || 15, 1), MAX_REQUESTS_PER_BUCKET),
    };
  }

  enforceRateLimit(clientKey) {
    const { windowMs, maxRequests } = this.getRateLimitConfig();
    const now = Date.now();
    const key = String(clientKey || 'anonymous');

    const timestamps = (this.rateLimitBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (timestamps.length >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - timestamps[0])) / 1000));
      console.warn(
        JSON.stringify({
          event: 'ai_rate_limited',
          applicationCode: 'AI_RATE_LIMITED',
          retryAfterSeconds,
          maxRequests,
          windowMs,
        })
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          code: 'AI_RATE_LIMITED',
          message: `You have reached the Medical AI message limit. Please wait ${retryAfterSeconds}s or switch to the Pharmacy Support tab.`,
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    timestamps.push(now);
    this.rateLimitBuckets.delete(key);
    if (!this.rateLimitBuckets.has(key) && this.rateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
      for (const [bucketKey, bucketTimes] of this.rateLimitBuckets.entries()) {
        if (!bucketTimes.some((ts) => now - ts < windowMs)) {
          this.rateLimitBuckets.delete(bucketKey);
        }
      }
      while (this.rateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
        const oldestKey = this.rateLimitBuckets.keys().next().value;
        if (oldestKey === undefined) break;
        this.rateLimitBuckets.delete(oldestKey);
      }
    }
    this.rateLimitBuckets.set(key, timestamps);

    while (this.rateLimitBuckets.size > MAX_RATE_LIMIT_BUCKETS) {
      const oldestKey = this.rateLimitBuckets.keys().next().value;
      if (oldestKey === undefined) break;
      this.rateLimitBuckets.delete(oldestKey);
    }
  }

  pruneExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.updatedAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
    while (this.sessions.size > MAX_SESSIONS) {
      const oldestKey = this.sessions.keys().next().value;
      if (!oldestKey) break;
      this.sessions.delete(oldestKey);
    }
  }

  getOrCreateSession(requestedSessionId, userId = null) {
    this.pruneExpiredSessions();
    const cleanId =
      typeof requestedSessionId === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(requestedSessionId.trim())
        ? requestedSessionId.trim()
        : null;

    const ownerId = userId || null;
    const existing = cleanId ? this.sessions.get(cleanId) : null;
    if (existing && existing.userId === ownerId) {
      existing.updatedAt = Date.now();
      return existing;
    }

    const session = {
      id: cleanId && !existing ? cleanId : randomUUID(),
      userId: ownerId,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  clearSession(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      return { cleared: false };
    }
    const existed = this.sessions.delete(sessionId.trim());
    return { cleared: existed };
  }

  resetRateLimits() {
    this.rateLimitBuckets.clear();
  }

  async chat(payload = {}, { clientIp = 'unknown', user = null } = {}) {
    const startedAt = Date.now();
    const rawMessage = typeof payload.message === 'string' ? payload.message.trim() : '';

    if (!rawMessage) {
      throw new BadRequestException('Please enter a message for the Medical AI assistant.');
    }
    if (rawMessage.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
    }

    const session = this.getOrCreateSession(payload.sessionId, user?.id || null);
    const rateKey = user?.id ? `user:${user.id}` : `ip:${clientIp}`;
    this.enforceRateLimit(rateKey);

    // 1. Emergency triage fast-path (deterministic, zero delay, never waits on external AI)
    if (detectMedicalEmergency(rawMessage)) {
      const emergencyPayload = buildEmergencyResponse();
      session.history.push(
        { role: 'user', content: rawMessage },
        { role: 'assistant', content: emergencyPayload.reply }
      );
      if (session.history.length > MAX_HISTORY_TURNS) {
        session.history = session.history.slice(-MAX_HISTORY_TURNS);
      }
      session.updatedAt = Date.now();

      console.info(
        JSON.stringify({
          event: 'ai_chat',
          sessionId: session.id,
          emergency: true,
          catalogueMatches: 0,
          latencyMs: Date.now() - startedAt,
        })
      );

      return {
        sessionId: session.id,
        ...emergencyPayload,
        products: [],
        verifiedAlternatives: [],
        provider: 'safety-triage',
      };
    }

    // 2. Ground with real MediQuick catalogue & verified direct equivalents
    const { products, verifiedAlternatives } = await this.catalogueLookupFn(rawMessage, {
      maxProducts: 4,
    });
    const recommendPharmacist = shouldRecommendPharmacist(rawMessage);

    // 3. Build structured medical safety + verified catalogue prompt
    const systemPrompt = buildMedicalSystemPrompt({
      catalogueContext: products,
      verifiedAlternatives,
    });

    const historySnapshot = session.history.slice(-MAX_HISTORY_TURNS);

    // 4. Call configured external AI provider (never returns fake/mock AI replies in production)
    let completion;
    try {
      completion = await this.completionFn({
        systemPrompt,
        history: historySnapshot,
        userMessage: rawMessage,
      });
    } catch (error) {
      const statusCode = typeof error?.getStatus === 'function' ? error.getStatus() : 500;
      const responseBody = typeof error?.getResponse === 'function' ? error.getResponse() : null;
      const code =
        responseBody && typeof responseBody === 'object' && typeof responseBody.code === 'string'
          ? responseBody.code
          : null;
      console.error(
        JSON.stringify({
          event: 'ai_chat_error',
          sessionId: session.id,
          statusCode,
          applicationCode: code,
          code,
          catalogueMatches: products.length,
          latencyMs: Date.now() - startedAt,
        })
      );
      throw error;
    }

    // 5. Persist conversation turn in ephemeral server session (never logged in plaintext)
    session.history.push(
      { role: 'user', content: rawMessage },
      { role: 'assistant', content: completion.text }
    );
    if (session.history.length > MAX_HISTORY_TURNS) {
      session.history = session.history.slice(-MAX_HISTORY_TURNS);
    }
    session.updatedAt = Date.now();

    console.info(
      JSON.stringify({
        event: 'ai_chat',
        sessionId: session.id,
        provider: completion.provider || 'configured',
        emergency: false,
        recommendPharmacist,
        catalogueMatches: products.length,
        verifiedAlternativesCount: verifiedAlternatives.length,
        latencyMs: Date.now() - startedAt,
      })
    );

    return {
      sessionId: session.id,
      reply: completion.text,
      disclaimer: EDUCATIONAL_DISCLAIMER,
      emergency: false,
      recommendPharmacist,
      products,
      verifiedAlternatives,
      sources: VERIFIED_GENERAL_SOURCES,
      provider: completion.provider || 'configured',
    };
  }
}

Injectable()(AiService);

module.exports = AiService;
