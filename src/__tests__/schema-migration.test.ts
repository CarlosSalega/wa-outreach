import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function readSchema(): string {
  return readFileSync(resolve(import.meta.dirname, '../../prisma/schema.prisma'), 'utf-8');
}

describe('T01 — Schema: WhatsAppAccount and ContactList models', () => {
  const schema = readSchema();

  // ── WhatsAppAccount model ──────────────────────────
  it('declares WhatsAppAccount model', () => {
    expect(schema).toMatch(/model WhatsAppAccount\s*\{/);
  });

  it('WhatsAppAccount has id field', () => {
    expect(schema).toMatch(/model WhatsAppAccount[\s\S]*?\bid\b.*@id/);
  });

  it('WhatsAppAccount has name String field', () => {
    expect(schema).toMatch(/model WhatsAppAccount[\s\S]*?name\s+String/);
  });

  it('WhatsAppAccount has waAccountStartDate DateTime field', () => {
    expect(schema).toMatch(/model WhatsAppAccount[\s\S]*?waAccountStartDate\s+DateTime/);
  });

  it('WhatsAppAccount has dailyLimit Int @default(50)', () => {
    expect(schema).toMatch(/model WhatsAppAccount[\s\S]*?dailyLimit\s+Int\s+@default\(50\)/);
  });

  it('WhatsAppAccount has sendWindowStart Int @default(9)', () => {
    expect(schema).toMatch(
      /model WhatsAppAccount[\s\S]*?sendWindowStart\s+Int\s+@default\(9\)/
    );
  });

  it('WhatsAppAccount has sendWindowStartMin Int @default(0)', () => {
    expect(schema).toMatch(
      /model WhatsAppAccount[\s\S]*?sendWindowStartMin\s+Int\s+@default\(0\)/
    );
  });

  it('WhatsAppAccount has sendWindowEnd Int @default(19)', () => {
    expect(schema).toMatch(
      /model WhatsAppAccount[\s\S]*?sendWindowEnd\s+Int\s+@default\(19\)/
    );
  });

  it('WhatsAppAccount has sendWindowEndMin Int @default(0)', () => {
    expect(schema).toMatch(
      /model WhatsAppAccount[\s\S]*?sendWindowEndMin\s+Int\s+@default\(0\)/
    );
  });

  it('WhatsAppAccount has status String field with CONFIGURED|CONNECTED|DISCONNECTED', () => {
    // Must have a status field and the default must be one of the three
    expect(schema).toMatch(/model WhatsAppAccount[\s\S]*?status\s+String\s+@default\("CONFIGURED"\)/);
  });

  // ── ContactList model ──────────────────────────────
  it('declares ContactList model', () => {
    expect(schema).toMatch(/model ContactList\s*\{/);
  });

  it('ContactList has id field', () => {
    expect(schema).toMatch(/model ContactList[\s\S]*?\bid\b.*@id/);
  });

  it('ContactList has name String field', () => {
    expect(schema).toMatch(/model ContactList[\s\S]*?name\s+String/);
  });

  it('ContactList has campaignId with unique FK to Campaign', () => {
    // Check campaignId field and @unique constraint
    expect(schema).toMatch(
      /model ContactList[\s\S]*?campaignId\s+String\s+@unique/
    );
    expect(schema).toMatch(
      /model ContactList[\s\S]*?campaign\s+Campaign\s+@relation/
    );
  });

  // ── Campaign model additions ───────────────────────
  it('Campaign has whatsappAccountId FK to WhatsAppAccount', () => {
    expect(schema).toMatch(
      /model Campaign[\s\S]*?whatsappAccountId\s+String/
    );
    expect(schema).toMatch(
      /model Campaign[\s\S]*?whatsappAccount\s+WhatsAppAccount\s+@relation/
    );
  });

  it('Campaign has contactList back-reference to ContactList (1:1)', () => {
    // FK is on ContactList.campaignId; Campaign just holds the back-reference
    expect(schema).toMatch(
      /model Campaign[\s\S]*?contactList\s+ContactList\?/
    );
  });

  it('Campaign has order Int @default(0)', () => {
    expect(schema).toMatch(
      /model Campaign[\s\S]*?order\s+Int\s+@default\(0\)/
    );
  });

  // ── Contact model additions ────────────────────────
  it('Contact has optional contactListId FK to ContactList', () => {
    expect(schema).toMatch(
      /model Contact[\s\S]*?contactListId\s+String\?/
    );
    expect(schema).toMatch(
      /model Contact[\s\S]*?contactList\s+ContactList\?\s+@relation/
    );
  });

  // ── Indexes ────────────────────────────────────────
  it('has Campaign(status, order) composite index', () => {
    expect(schema).toMatch(
      /@@index\(\[status,\s*order\]\)/
    );
  });

  it('has MessageQueue(status, campaignId) composite index', () => {
    expect(schema).toMatch(
      /MessageQueue[\s\S]*?@@index\(\[status,\s*campaignId\]\)/
    );
  });

  // ── AppConfig backward-compat (additive-first) ─────
  it('AppConfig still has waAccountStartDate (not removed yet)', () => {
    expect(schema).toMatch(/model AppConfig[\s\S]*?waAccountStartDate\s+DateTime/);
  });

  it('AppConfig still has dailyLimit (not removed yet)', () => {
    expect(schema).toMatch(/model AppConfig[\s\S]*?dailyLimit\s+Int/);
  });

  it('AppConfig still has sendWindowStart (not removed yet)', () => {
    expect(schema).toMatch(/model AppConfig[\s\S]*?sendWindowStart\s+Int/);
  });

  it('AppConfig still has sendWindowEnd (not removed yet)', () => {
    expect(schema).toMatch(/model AppConfig[\s\S]*?sendWindowEnd\s+Int/);
  });
});
