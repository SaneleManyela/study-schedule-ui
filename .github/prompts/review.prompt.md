---
name: review
description: >
  Production-safety code review. Catches what breaks in production, not what breaks a linter.
  Use for: reviewing auth flows, data mutations, API endpoints, service functions, Firestore queries.
  Flags: SQL/NoSQL injection, N+1 queries, unhandled edge cases, auth bypass, unsafe deletes/updates,
  cache invalidation gaps, secrets leaking into responses, error swallowing.
mode: ask
---

Review the selected code or file for **production-breaking issues only**. Ignore all style, formatting, naming, and linter concerns.

## Checklist — work through every item in order

### 1. Injection vectors
- Are any Firestore collection paths, document IDs, field names, or `order_by` values constructed from raw user input without validation?
- Does every FastAPI route accept input through a Pydantic model with explicit field constraints (`min_length`, `max_length`, `pattern`)? Flag any route that accepts a plain `str` or `dict` directly.
- Are there any f-strings or string concatenations that feed into a Firestore query?

### 2. Auth and session correctness
- Is every password comparison done with `secrets.compare_digest` (constant-time)? Flag any `==` comparison on passwords or PINs.
- Is PIN expiry enforced **server-side** using a UTC timestamp comparison? Flag if expiry is validated only on the client.
- Can a user reach a protected resource by manipulating `localStorage` without the backend verifying the session?
- Does the signup endpoint verify the email does not already exist **before** hashing and writing? Is that check atomic, or is there a race window?
- Do any API responses include `password`, `pin`, or `pinExpiresAt` fields from the `Auth` collection?

### 3. Data mutations — updates and deletes
- Does every DELETE verify the document exists before attempting deletion? What happens if it does not?
- Does every UPDATE (Firestore `.set()` or `.set(merge=True)`) operate only on the intended fields? Could it silently overwrite unrelated fields?
- Is there an ownership or authorisation check before any mutation? Or does knowing a document ID grant write access?
- Are there any bulk mutations (loops with writes) that lack a transaction? What is the partial-failure state?

### 4. N+1 query patterns
- Is there any loop that issues a Firestore `.get()` or `.stream()` per iteration?
- Could any `list_*` function be rewritten to use `get_all()` or a single collection query instead of per-document reads?

### 5. Cache invalidation gaps
- After every `create_`, `update_`, `delete_`, or `upsert_` function, is the corresponding `_cache.delete(...)` or `_cache.delete_prefix(...)` call present?
- Could a stale cache entry be served after a write, causing the UI to show outdated data?

### 6. Unhandled edge cases
- What happens when a Firestore `.to_dict()` returns `None` or a field is missing? Are all field accesses guarded with `.get(key, default)`?
- What happens if a required environment variable (`GOOGLE_APPLICATION_CREDENTIALS`, `SMTP_USER`, `SMTP_PASSWORD`) is missing at startup — does the app fail fast with a clear error, or does it fail silently on the first request?
- What happens if two requests hit `signup_admin` for the same email at the same millisecond? Is the uniqueness check atomic?
- Are datetime comparisons for PIN expiry using timezone-aware `datetime.now(UTC)` consistently? Flag any naive datetime comparison.

### 7. Error handling
- Are there `except Exception` blocks that return a success response or silently swallow the error? The caller must be able to distinguish a transient failure from a business logic failure.
- Are errors logged before being swallowed, or are they lost entirely?

---

## Output format

For each issue found:

```
[SEVERITY] Category — Location
Problem: one sentence describing what is broken
Impact: what fails in production and under what conditions
Fix: the minimal change required
```

Severity levels: **CRITICAL** (data loss, auth bypass, injection) · **HIGH** (incorrect behaviour under load or edge input) · **MEDIUM** (silent failure, stale cache, missing guard)

If no issues are found in a category, write `✓ Category — nothing to flag` and move on. Do not pad the output.
