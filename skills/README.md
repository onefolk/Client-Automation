# Writer skills

Plain Markdown that shapes the drafting prompt. Edit a file and the next run uses it; no code change needed.

| File | Used for |
|---|---|
| `writer_system.md` | System prompt: voice, structure, evidence rules. `{banned_phrases}` is filled from `src/email_validator.py`. |
| `strict_rules.md` | Rules sent with each lead. Separate rules with a line containing only `---`. `{business}` is the prospect name. |
| `strict_grounding.md` | Extra rule added when the observation must be kept verbatim. |
| `style_reference.md` | Example email shown as style only, never as evidence. |

Hard limits (word count, one question mark, banned phrases, voice) are also enforced in code by `src/email_validator.py`, so a skill edit cannot loosen them.
