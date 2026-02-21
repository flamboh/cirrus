import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  sessions: defineTable({
    code: v.string(),
    hostToken: v.string(),
    status: v.union(v.literal('active'), v.literal('closed')),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index('by_code', ['code'])
    .index('by_status', ['status']),

  players: defineTable({
    sessionId: v.id('sessions'),
    name: v.string(),
    token: v.string(),
    joinedAt: v.number(),
    lastSubmitAt: v.optional(v.number()),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_name', ['sessionId', 'name']),

  submissions: defineTable({
    sessionId: v.id('sessions'),
    playerId: v.id('players'),
    rawWord: v.string(),
    normalizedWord: v.string(),
    createdAt: v.number(),
  }).index('by_session', ['sessionId']),

  wordCounts: defineTable({
    sessionId: v.id('sessions'),
    word: v.string(),
    count: v.number(),
    updatedAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_word', ['sessionId', 'word']),
})
