// SR-036 - Canonical final-package JSON Schema, validated with a real validator (ajv), not hand-rolled checks.

import Ajv from "ajv";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const SCHEMA_VALIDATOR = { name: "ajv", version: (require("ajv/package.json") as { version: string }).version };

const str = { type: "string", minLength: 1 } as const;
const passageId = { type: "string", pattern: "^W1-\[0-9]{4}$" } as const;
const hash = { type: "string", pattern: "^[0-9a-f]{64}$" } as const;
const posInt = { type: "integer", minimum: 1 } as const;
const bool = { type: "boolean" } as const;
const strList = { type: "array", minItems: 1, uniqueItems: true, items: str } as const;
/** Closed object: every listed property is required and nothing else is allowed. */
const closed = <P extends Record<string, unknown>>(properties: P) =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties }) as const;

export const ROLE_HASH_KEYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

export const PACKAGE_SCHEMA = closed({
  schemaVersion: { const: "1.0" },
  packageId: { type: "string", pattern: "^PKG-W1-\[0-9]{4}$" },
  passageId,
  packageVersion: posInt,
  spec: closed({
    passageId,
    sequence: { type: "integer", minimum: 1, maximum: 1500 },
    rsId: { type: "string", pattern: "^RS(0[1-9]|1[0-5])$" },
    pId: { type: "string", pattern: "^P(0[1-9]|10)$" },
    targetWords: posInt,
    complexity: closed({ maxSentenceWords: posInt, vocabularyBand: str, maxClausesPerSentence: posInt })
  }),
  passage: closed({ passageId, text: str, wordCount: posInt }),
  assessment: closed({
    passageId,
    items: {
      type: "array", minItems: 4, maxItems: 4,
      items: closed({
        itemId: str, stem: str, options: { type: "array", minItems: 2, uniqueItems: true, items: str },
        answerIndex: { type: "integer", minimum: 0 }, primary: bool, evidence: closed({ quote: str })
      })
    }
  }),
  meaningUnits: closed({
    passageId,
    units: {
      type: "array", minItems: 1,
      items: closed({
        muId: str, text: str, factIds: strList,
        evidence: {
          type: "object", additionalProperties: false,
          properties: { sentences: { type: "array", minItems: 1, uniqueItems: true, items: posInt }, span: str },
          anyOf: [{ required: ["sentences"] }, { required: ["span"] }]
        }
      })
    }
  }),
  bpc: closed({ passageId, text: str, factIds: strList }),
  scoring: closed({
    passageId, ruleId: { enum: ["P10_FIRST_ATTEMPT_3_OF_4_PRIMARY"] }, primaryItemId: str,
    itemPoints: { type: "object", minProperties: 4, maxProperties: 4, propertyNames: { minLength: 1 }, additionalProperties: { type: "number", minimum: 0 } }
  }),
  attemptContract: closed({
    passageId,
    outcomes: {
      type: "array", minItems: 2,
      items: closed({ state: { enum: ["PASS", "FAIL"] }, nextAction: { enum: ["CONTINUE_NEXT_PASSAGE"] }, oralReady: bool, comprehensionReady: bool })
    }
  }),
  lock: closed({ roleHashes: closed(Object.fromEntries(ROLE_HASH_KEYS.map((k) => [k, hash]))) })
});

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(PACKAGE_SCHEMA);

export function validatePackageSchema(pkg: unknown): { ok: boolean; errors: string[] } {
  const ok = validate(pkg) as boolean;
  return { ok, errors: ok ? [] : (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}${e.params && "missingProperty" in e.params ? ` (${String(e.params.missingProperty)})` : ""}`) };
}
