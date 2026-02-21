import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, mutation, query } from './_generated/server'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MIN_WORD_INTERVAL_MS = 800
const SESSION_TTL_MS = 30 * 60 * 1000
const BLOCKLIST = new Set(['hate', 'slur'])
const sessionStatusValidator = v.union(v.literal('active'), v.literal('closed'))
const wordCountValidator = v.object({
  word: v.string(),
  count: v.number(),
})
const snapshotValidator = v.object({
  id: v.id('sessions'),
  code: v.string(),
  status: sessionStatusValidator,
  playerCount: v.number(),
  words: v.array(wordCountValidator),
  topWord: v.union(wordCountValidator, v.null()),
})
const restoreHostResultValidator = v.union(
  v.object({
    ok: v.literal(true),
    code: v.string(),
  }),
  v.object({
    ok: v.literal(false),
  }),
)
const restorePlayerResultValidator = v.union(
  v.object({
    ok: v.literal(true),
    code: v.string(),
    name: v.string(),
  }),
  v.object({
    ok: v.literal(false),
  }),
)

function randomString(size: number, alphabet: string) {
  let out = ''
  for (let i = 0; i < size; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

function normalizeWord(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-']/g, '')
    .slice(0, 24)

  return normalized
}

async function closeIfExpired(
  ctx: { db: { patch: (id: any, value: any) => Promise<any> } },
  session: { _id: any; status: 'active' | 'closed'; expiresAt: number },
  now: number,
) {
  if (session.status !== 'active') {
    return session.status
  }

  if (now >= session.expiresAt) {
    await ctx.db.patch(session._id, { status: 'closed' })
    return 'closed'
  }

  return 'active'
}

export const createSession = mutation({
  args: {},
  returns: v.object({
    sessionId: v.id('sessions'),
    code: v.string(),
    hostToken: v.string(),
  }),
  handler: async (ctx) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = randomString(6, CODE_CHARS)
      const existing = await ctx.db
        .query('sessions')
        .withIndex('by_code', (q) => q.eq('code', code))
        .unique()

      if (existing) {
        continue
      }

      const hostToken = randomString(24, `${CODE_CHARS}${CODE_CHARS.toLowerCase()}`)
      const now = Date.now()
      const expiresAt = now + SESSION_TTL_MS
      const sessionId = await ctx.db.insert('sessions', {
        code,
        hostToken,
        status: 'active',
        createdAt: now,
        expiresAt,
      })
      await ctx.scheduler.runAfter(SESSION_TTL_MS, internal.sessions.expireSession, {
        sessionId,
      })

      return { sessionId, code, hostToken }
    }

    throw new ConvexError('Could not allocate session code')
  },
})

export const joinSession = mutation({
  args: {
    code: v.string(),
    name: v.string(),
  },
  returns: v.object({
    sessionId: v.id('sessions'),
    playerId: v.id('players'),
    playerToken: v.string(),
    code: v.string(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now()
    const code = args.code.trim().toUpperCase()
    const name = args.name.trim().slice(0, 24)

    if (!name) {
      throw new ConvexError('Name required')
    }

    const session = await ctx.db
      .query('sessions')
      .withIndex('by_code', (q) => q.eq('code', code))
      .unique()

    if (!session) {
      throw new ConvexError('Session not available')
    }

    const sessionStatus = await closeIfExpired(ctx, session, now)
    if (sessionStatus !== 'active') {
      throw new ConvexError('Session not available')
    }

    const existingName = await ctx.db
      .query('players')
      .withIndex('by_session_name', (q) => q.eq('sessionId', session._id).eq('name', name))
      .unique()

    if (existingName) {
      throw new ConvexError('Name already taken')
    }

    const token = randomString(24, `${CODE_CHARS}${CODE_CHARS.toLowerCase()}`)
    const joinedAt = Date.now()

    const playerId = await ctx.db.insert('players', {
      sessionId: session._id,
      name,
      token,
      joinedAt,
    })

    return {
      sessionId: session._id,
      playerId,
      playerToken: token,
      code,
    }
  },
})

export const submitWord = mutation({
  args: {
    sessionId: v.id('sessions'),
    playerId: v.id('players'),
    playerToken: v.string(),
    word: v.string(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new ConvexError('Session closed')
    }

    const sessionStatus = await closeIfExpired(ctx, session, Date.now())
    if (sessionStatus !== 'active') {
      throw new ConvexError('Session closed')
    }

    const player = await ctx.db.get(args.playerId)
    if (!player || player.sessionId !== args.sessionId) {
      throw new ConvexError('Player not found')
    }

    if (player.token !== args.playerToken) {
      throw new ConvexError('Invalid player token')
    }

    const now = Date.now()
    if (player.lastSubmitAt && now - player.lastSubmitAt < MIN_WORD_INTERVAL_MS) {
      throw new ConvexError('Slow down a bit')
    }

    const normalizedWord = normalizeWord(args.word)
    if (!normalizedWord || normalizedWord.length < 1) {
      throw new ConvexError('Word is invalid')
    }

    if (BLOCKLIST.has(normalizedWord)) {
      throw new ConvexError('Word blocked')
    }

    await ctx.db.insert('submissions', {
      sessionId: args.sessionId,
      playerId: args.playerId,
      rawWord: args.word.trim(),
      normalizedWord,
      createdAt: now,
    })

    const existingCount = await ctx.db
      .query('wordCounts')
      .withIndex('by_session_word', (q) =>
        q.eq('sessionId', args.sessionId).eq('word', normalizedWord),
      )
      .unique()

    if (existingCount) {
      await ctx.db.patch(existingCount._id, {
        count: existingCount.count + 1,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('wordCounts', {
        sessionId: args.sessionId,
        word: normalizedWord,
        count: 1,
        updatedAt: now,
      })
    }

    await ctx.db.patch(player._id, { lastSubmitAt: now })

    return { ok: true }
  },
})

export const closeSession = mutation({
  args: {
    sessionId: v.id('sessions'),
    hostToken: v.string(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new ConvexError('Session not found')
    }
    if (session.hostToken !== args.hostToken) {
      throw new ConvexError('Unauthorized')
    }

    await ctx.db.patch(session._id, { status: 'closed' })
    return { ok: true }
  },
})

export const restoreHostSession = mutation({
  args: {
    sessionId: v.id('sessions'),
    hostToken: v.string(),
  },
  returns: restoreHostResultValidator,
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.hostToken !== args.hostToken) {
      return { ok: false as const }
    }

    const sessionStatus = await closeIfExpired(ctx, session, Date.now())
    if (sessionStatus !== 'active') {
      return { ok: false as const }
    }

    return { ok: true as const, code: session.code }
  },
})

export const restorePlayerSession = mutation({
  args: {
    sessionId: v.id('sessions'),
    playerId: v.id('players'),
    playerToken: v.string(),
  },
  returns: restorePlayerResultValidator,
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      return { ok: false as const }
    }

    const sessionStatus = await closeIfExpired(ctx, session, Date.now())
    if (sessionStatus !== 'active') {
      return { ok: false as const }
    }

    const player = await ctx.db.get(args.playerId)
    if (!player || player.sessionId !== args.sessionId || player.token !== args.playerToken) {
      return { ok: false as const }
    }

    return { ok: true as const, code: session.code, name: player.name }
  },
})

export const expireSession = internalMutation({
  args: {
    sessionId: v.id('sessions'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.status === 'closed') {
      return null
    }

    if (Date.now() >= session.expiresAt) {
      await ctx.db.patch(session._id, { status: 'closed' })
    }
    return null
  },
})

export const sessionSnapshot = query({
  args: {
    code: v.string(),
  },
  returns: v.union(snapshotValidator, v.null()),
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase()
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_code', (q) => q.eq('code', code))
      .unique()

    if (!session) {
      return null
    }

    const [players, counts] = await Promise.all([
      ctx.db
        .query('players')
        .withIndex('by_session', (q) => q.eq('sessionId', session._id))
        .collect(),
      ctx.db
        .query('wordCounts')
        .withIndex('by_session', (q) => q.eq('sessionId', session._id))
        .collect(),
    ])

    const words = counts
      .sort((a, b) => (b.count === a.count ? a.word.localeCompare(b.word) : b.count - a.count))
      .map((item) => ({ word: item.word, count: item.count }))

    return {
      id: session._id,
      code: session.code,
      status: session.status,
      playerCount: players.length,
      words,
      topWord: words[0] ?? null,
    }
  },
})
