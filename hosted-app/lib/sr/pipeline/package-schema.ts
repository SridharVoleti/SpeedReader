// SR-036 - Canonical final-package JSON Schema, validated with a real validator (ajv), not hand-rolled checks.

import Ajv from "ajv";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const SCHEMA_VALIDATOR = { name: "ajv", version: (require("ajv/package.json") as { version: string }).version };

const str = { type: "string", minLength: 1 } as const;

export const PACKAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "packageId", "passageId", "packageVersion", "spec", "passage", "assessment", "meaningUnits", "bpc", "scoring", "attemptContract", "lock"],
  properties: {
    schemaVersion: { const: "1.0" },
    packageId: str,
    passageId: str,
    packageVersion: { type: "integer", minimum: 1 },
    spec: {
      type: "object", required: ["passageId", "sequence", "rsId", "pId", "targetWords", "complexity"],
      properties: { sequence: { type: "integer", minimum: 1, maximum: 1500 }, targetWords: { type: "integer", minimum: 1 } }
    },
    passage: {
      type: "object", additionalProperties: false, required: ["passageId", "text", "wordCount"],
      properties: { passageId: str, text: str, wordCount: { type: "integer", minimum: 1 } }
    },
    assessment: {
      type: "object", additionalProperties: false, required: ["passageId", "items"],
      properties: {
        passageId: str,
        items: {
          type: "array", minItems: 4, maxItems: 4,
          items: {
            type: "object", additionalProperties: false, required: ["itemId", "stem", "options", "answerIndex", "primary", "evidence"],
            properties: { itemId: str, stem: str, options: { type: "array", minItems: 2, items: str }, answerIndex: { type: "integer", minimum: 0 }, primary: { type: "boolean" }, evidence: { type: "object", additionalProperties: false, required: ["quote"], properties: { quote: str } } }
          }
        }
      }
    },
    meaningUnits: {
      type: "object", additionalProperties: false, required: ["passageId", "units"],
      properties: {
        passageId: str,
        units: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["muId", "text", "factIds", "evidence"], properties: { muId: str, text: str, factIds: { type: "array", minItems: 1, items: str }, evidence: { type: "object", additionalProperties: false, minProperties: 1, properties: { sentences: { type: "array", minItems: 1, items: { type: "integer", minimum: 1 } }, span: str } } } } }
      }
    },
    bpc: {
      type: "object", additionalProperties: false, required: ["passageId", "text", "factIds"],
      properties: { passageId: str, text: str, factIds: { type: "array", items: str } }
    },
    scoring: {
      type: "object", additionalProperties: false, required: ["passageId", "passThreshold", "primaryItemId", "itemPoints"],
      properties: { passageId: str, passThreshold: { type: "number", minimum: 0, maximum: 100 }, primaryItemId: str, itemPoints: { type: "object", additionalProperties: { type: "number", minimum: 0 } } }
    },
    attemptContract: {
      type: "object", additionalProperties: false, required: ["passageId", "outcomes"],
      properties: {
        passageId: str,
        outcomes: {
          type: "array", minItems: 2,
          items: {
            type: "object", additionalProperties: false, required: ["state", "nextAction", "oralReady", "comprehensionReady"],
            properties: { state: { enum: ["PASS", "FAIL"] }, nextAction: { enum: ["CONTINUE_NEXT_PASSAGE"] }, oralReady: { type: "boolean" }, comprehensionReady: { type: "boolean" } }
          }
        }
      }
    },
    lock: {
      type: "object", additionalProperties: false, required: ["roleHashes"],
      properties: { roleHashes: { type: "object", minProperties: 7, additionalProperties: { type: "string", pattern: "^[0-9a-f]{64}$" } } }
    }
  }
} as const;

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(PACKAGE_SCHEMA);

export function validatePackageSchema(pkg: unknown): { ok: boolean; errors: string[] } {
  const ok = validate(pkg) as boolean;
  return { ok, errors: ok ? [] : (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}${e.params && "missingProperty" in e.params ? ` (${String(e.params.missingProperty)})` : ""}`) };
}
